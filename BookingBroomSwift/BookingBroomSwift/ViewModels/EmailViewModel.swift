import Foundation
import Observation

@MainActor
@Observable
public final class EmailViewModel {
    public var mailboxes: [EmailMailbox] = [] { didSet { totalUnreadCount = mailboxes.reduce(0) { $0 + $1.unreadCount } } }
    public var selectedMailbox: EmailMailbox? = nil
    public var threads: [EmailThread] = []
    public var activeThread: EmailThread? = nil
    public var activeMessages: [EmailMessage] = []
    public var draftReplyText: String = ""
    public var isLoading: Bool = false
    public var isLoadingMessages: Bool = false
    public var isSyncing: Bool = false
    public var isSendingReply: Bool = false
    public var searchText: String = ""
    public var replyError: String? = nil
    public var syncError: String? = nil
    
    public private(set) var totalUnreadCount: Int = 0
    
    @ObservationIgnored private var didLoad = false
    @ObservationIgnored private var lastLoadedAt: Date?
    @ObservationIgnored private var threadsLoadedAt: [String: Date] = [:]
    /// thread id → when its messages were last fetched (60 s TTL).
    @ObservationIgnored private var messagesLoadedAt: [String: Date] = [:]
    @ObservationIgnored private var messagesTask: Task<Void, Never>?
    @ObservationIgnored private var threadsGeneration: UInt = 0
    
    @ObservationIgnored private let staleAfter: TimeInterval = 5 * 60
    @ObservationIgnored private let messagesTTL: TimeInterval = 60
    
    public init() {}
    
    // MARK: - Lifecycle
    
    public func ensureLoaded() {
        if !didLoad {
            didLoad = true
            loadMailboxes()
            return
        }
        refreshIfStale(olderThan: staleAfter)
    }
    
    public func refreshIfStale(olderThan seconds: TimeInterval) {
        guard didLoad else {
            ensureLoaded()
            return
        }
        if let last = lastLoadedAt, Date().timeIntervalSince(last) < seconds { return }
        if let mb = selectedMailbox {
            loadThreads(mailboxId: mb.id)
        } else {
            loadMailboxes()
        }
    }
    
    public func resetForNewSession() {
        threadsGeneration &+= 1
        messagesTask?.cancel()
        messagesTask = nil
        didLoad = false
        lastLoadedAt = nil
        threadsLoadedAt = [:]
        messagesLoadedAt = [:]
        mailboxes = []
        selectedMailbox = nil
        threads = []
        activeThread = nil
        activeMessages = []
        draftReplyText = ""
        searchText = ""
        replyError = nil
        syncError = nil
        isLoading = false
        isLoadingMessages = false
        isSyncing = false
        isSendingReply = false
    }
    
    public var filteredThreads: [EmailThread] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if query.isEmpty { return threads }
        return threads.filter { t in
            t.subject.lowercased().contains(query) ||
            t.lastSnippet.lowercased().contains(query) ||
            t.participants.contains { $0.lowercased().contains(query) }
        }
    }
    
    // MARK: - Loading
    
    public func loadMailboxes() {
        Task { await loadMailboxesAndWait() }
    }
    
    public func loadMailboxesAndWait() async {
        if mailboxes.isEmpty { isLoading = true }
        do {
            let list = try await ConvexAPIService.shared.fetchEmailMailboxes()
            if list != mailboxes { mailboxes = list }
            syncError = nil
            if let current = selectedMailbox, let refreshed = list.first(where: { $0.id == current.id }) {
                selectedMailbox = refreshed
                await loadThreadsAndWait(mailboxId: refreshed.id)
            } else if let first = list.first {
                selectedMailbox = first
                await loadThreadsAndWait(mailboxId: first.id)
            } else {
                selectedMailbox = nil
                threads = []
            }
            lastLoadedAt = Date()
        } catch let error as ConvexError where error.isCancelled {
            // superseded
        } catch {
            if mailboxes.isEmpty {
                syncError = error.localizedDescription
            }
        }
        isLoading = false
    }
    
    public func selectMailbox(_ mailbox: EmailMailbox) {
        guard selectedMailbox?.id != mailbox.id else { return }
        selectedMailbox = mailbox
        threads = []
        loadThreads(mailboxId: mailbox.id)
    }
    
    public func loadThreads(mailboxId: String) {
        Task { await loadThreadsAndWait(mailboxId: mailboxId) }
    }
    
    /// Pull-to-refresh: reload the selected mailbox's threads from Convex (mailbox list if nothing is selected).
    public func refreshCurrentMailboxAndWait() async {
        if let mailboxId = selectedMailbox?.id {
            await loadThreadsAndWait(mailboxId: mailboxId)
        } else {
            await loadMailboxesAndWait()
        }
    }
    
    public func loadThreadsAndWait(mailboxId: String) async {
        threadsGeneration &+= 1
        let generation = threadsGeneration
        if threads.isEmpty { isLoading = true }
        do {
            let tList = try await ConvexAPIService.shared.fetchEmailThreads(mailboxId: mailboxId)
            guard generation == threadsGeneration, selectedMailbox?.id == mailboxId else { return }
            if tList != threads { threads = tList }
            threadsLoadedAt[mailboxId] = Date()
            lastLoadedAt = Date()
        } catch let error as ConvexError where error.isCancelled {
            // superseded
        } catch {
            guard generation == threadsGeneration else { return }
            if threads.isEmpty {
                syncError = error.localizedDescription
            }
        }
        if generation == threadsGeneration {
            isLoading = false
        }
    }
    
    // MARK: - Thread detail
    
    /// Idempotent: re-opening the same thread within 60 s is free. Any previous
    /// message load is cancelled and late responses for other threads are dropped.
    public func openThread(_ thread: EmailThread) {
        let switching = activeThread?.id != thread.id
        activeThread = thread
        if switching {
            draftReplyText = ""
            replyError = nil
        }
        
        let fresh = messagesLoadedAt[thread.id].map { Date().timeIntervalSince($0) < messagesTTL } ?? false
        if switching || !fresh {
            if switching { activeMessages = [] }
            loadMessages(threadId: thread.id)
        }
        
        // Mark as read locally and remotely
        if thread.unreadCount > 0 {
            if let idx = threads.firstIndex(where: { $0.id == thread.id }) {
                threads[idx].unreadCount = 0
            }
            if let mb = selectedMailbox, let mbIdx = mailboxes.firstIndex(where: { $0.id == mb.id }) {
                mailboxes[mbIdx].unreadCount = max(0, mailboxes[mbIdx].unreadCount - thread.unreadCount)
            }
            Task {
                try? await ConvexAPIService.shared.markEmailThreadRead(threadId: thread.id)
            }
        }
    }
    
    public func loadMessages(threadId: String, force: Bool = false) {
        if !force, let at = messagesLoadedAt[threadId], Date().timeIntervalSince(at) < messagesTTL,
           activeThread?.id == threadId, !activeMessages.isEmpty {
            return
        }
        messagesTask?.cancel()
        isLoadingMessages = true
        messagesTask = Task {
            do {
                let msgs = try await ConvexAPIService.shared.fetchEmailMessages(threadId: threadId)
                guard !Task.isCancelled, self.activeThread?.id == threadId else { return }
                if msgs != self.activeMessages { self.activeMessages = msgs }
                self.messagesLoadedAt[threadId] = Date()
            } catch let error as ConvexError where error.isCancelled {
                return
            } catch {
                guard !Task.isCancelled, self.activeThread?.id == threadId else { return }
                if self.activeMessages.isEmpty {
                    self.replyError = "Couldn’t load messages: \(error.localizedDescription)"
                }
            }
            if self.activeThread?.id == threadId {
                self.isLoadingMessages = false
            }
        }
    }
    
    public func sendReply(threadId: String) {
        let text = draftReplyText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isSendingReply else { return }
        isSendingReply = true
        replyError = nil
        
        Task {
            do {
                try await ConvexAPIService.shared.sendEmailReply(threadId: threadId, text: text)
                self.draftReplyText = ""
                self.loadMessages(threadId: threadId, force: true)
                HapticFeedback.notification(.success)
            } catch {
                self.replyError = "Couldn’t send reply: \(error.localizedDescription)"
                HapticFeedback.notification(.error)
            }
            self.isSendingReply = false
        }
    }
    
    public func deleteThread(_ thread: EmailThread) {
        let removedIndex = threads.firstIndex(where: { $0.id == thread.id })
        threads.removeAll(where: { $0.id == thread.id })
        if activeThread?.id == thread.id {
            activeThread = nil
            activeMessages = []
        }
        messagesLoadedAt[thread.id] = nil
        Task {
            do {
                try await ConvexAPIService.shared.deleteEmailThread(threadId: thread.id)
            } catch {
                if let removedIndex {
                    self.threads.insert(thread, at: min(removedIndex, self.threads.count))
                }
                self.syncError = "Couldn’t delete thread: \(error.localizedDescription)"
            }
        }
    }
    
    /// IMAP pull (external) then reload. Toolbar / ⌘R only — never pull-to-refresh.
    public func syncCurrentMailbox() {
        guard let mb = selectedMailbox, !isSyncing else { return }
        isSyncing = true
        syncError = nil
        Task {
            do {
                try await ConvexAPIService.shared.syncEmailMailbox(mailboxId: mb.id)
            } catch {
                self.syncError = error.localizedDescription
            }
            // Refresh threads for the current mailbox only (avoid re-select storm).
            self.messagesLoadedAt = [:]
            await self.loadThreadsAndWait(mailboxId: mb.id)
            if let active = self.activeThread {
                self.loadMessages(threadId: active.id, force: true)
            }
            self.isSyncing = false
        }
    }
}

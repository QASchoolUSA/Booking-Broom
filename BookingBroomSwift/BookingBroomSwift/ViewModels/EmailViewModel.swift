import Foundation
import Combine

public final class EmailViewModel: ObservableObject {
    @Published public var mailboxes: [EmailMailbox] = []
    @Published public var selectedMailbox: EmailMailbox? = nil
    @Published public var threads: [EmailThread] = []
    @Published public var activeThread: EmailThread? = nil
    @Published public var activeMessages: [EmailMessage] = []
    @Published public var draftReplyText: String = ""
    @Published public var isLoading: Bool = false
    @Published public var isSyncing: Bool = false
    @Published public var isSendingReply: Bool = false
    @Published public var searchText: String = ""
    @Published public var replyError: String? = nil
    @Published public var syncError: String? = nil
    
    private var didLoad = false
    
    public init() {}
    
    public func ensureLoaded() {
        guard !didLoad else { return }
        didLoad = true
        loadMailboxes()
    }
    
    public func resetForNewSession() {
        didLoad = false
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
        isSyncing = false
        isSendingReply = false
    }
    
    public var totalUnreadCount: Int {
        mailboxes.reduce(0) { $0 + $1.unreadCount }
    }
    
    public var filteredThreads: [EmailThread] {
        if searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return threads
        }
        let query = searchText.lowercased()
        return threads.filter { t in
            t.subject.lowercased().contains(query) ||
            t.lastSnippet.lowercased().contains(query) ||
            t.participants.contains { $0.lowercased().contains(query) }
        }
    }
    
    public func loadMailboxes() {
        isLoading = true
        Task { @MainActor in
            do {
                let list = try await ConvexAPIService.shared.fetchEmailMailboxes()
                self.mailboxes = list
                if self.selectedMailbox == nil, let first = list.first {
                    self.selectMailbox(first)
                } else if list.isEmpty {
                    self.selectedMailbox = nil
                    self.threads = []
                }
            } catch {
                self.mailboxes = []
                self.selectedMailbox = nil
                self.threads = []
                self.syncError = error.localizedDescription
            }
            self.isLoading = false
        }
    }
    
    public func selectMailbox(_ mailbox: EmailMailbox) {
        self.selectedMailbox = mailbox
        loadThreads(mailboxId: mailbox.id)
    }
    
    public func loadThreads(mailboxId: String) {
        isLoading = true
        Task { @MainActor in
            do {
                let tList = try await ConvexAPIService.shared.fetchEmailThreads(mailboxId: mailboxId)
                self.threads = tList
            } catch {
                self.threads = []
            }
            self.isLoading = false
        }
    }
    
    public func openThread(_ thread: EmailThread) {
        self.activeThread = thread
        self.draftReplyText = ""
        loadMessages(threadId: thread.id)
        
        // Mark as read locally and remotely
        if thread.unreadCount > 0 {
            if let idx = threads.firstIndex(where: { $0.id == thread.id }) {
                threads[idx].unreadCount = 0
            }
            if let mb = selectedMailbox, let mbIdx = mailboxes.firstIndex(where: { $0.id == mb.id }) {
                mailboxes[mbIdx].unreadCount = max(0, mailboxes[mbIdx].unreadCount - 1)
            }
            Task {
                await ConvexAPIService.shared.markEmailThreadRead(threadId: thread.id)
            }
        }
    }
    
    public func loadMessages(threadId: String) {
        Task { @MainActor in
            do {
                let msgs = try await ConvexAPIService.shared.fetchEmailMessages(threadId: threadId)
                self.activeMessages = msgs
            } catch {
                self.activeMessages = []
            }
        }
    }
    
    public func sendReply(threadId: String) {
        let text = draftReplyText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        isSendingReply = true
        replyError = nil
        
        Task { @MainActor in
            do {
                _ = try await ConvexAPIService.shared.sendEmailReply(threadId: threadId, text: text)
                self.draftReplyText = ""
                self.loadMessages(threadId: threadId)
                HapticFeedback.notification(.success)
            } catch {
                self.replyError = "Couldn’t send reply: \(error.localizedDescription)"
                HapticFeedback.notification(.error)
            }
            self.isSendingReply = false
        }
    }
    
    public func deleteThread(_ thread: EmailThread) {
        Task { @MainActor in
            _ = try? await ConvexAPIService.shared.deleteEmailThread(threadId: thread.id)
            self.threads.removeAll(where: { $0.id == thread.id })
            if self.activeThread?.id == thread.id {
                self.activeThread = nil
                self.activeMessages = []
            }
        }
    }
    
    public func syncCurrentMailbox() {
        guard let mb = selectedMailbox else { return }
        isSyncing = true
        Task { @MainActor in
            _ = try? await ConvexAPIService.shared.syncEmailMailbox(mailboxId: mb.id)
            // Refresh threads for the current mailbox only (avoid re-select storm).
            self.loadThreads(mailboxId: mb.id)
            self.isSyncing = false
        }
    }
}

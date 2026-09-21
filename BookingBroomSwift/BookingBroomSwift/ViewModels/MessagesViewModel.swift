import Foundation
import Observation

public struct VoipmsDidInfo: Identifiable, Hashable {
    public var id: String { did }
    public var did: String
    public var description: String
    public var subAccount: String
    public var formatted: String
    public var siteId: String?
    
    public var label: String {
        if !description.isEmpty { return description }
        if !subAccount.isEmpty { return subAccount }
        return formatted
    }
}

@MainActor
@Observable
public final class MessagesViewModel {
    public var messages: [SMSMessage] = [] { didSet { rebuildThreads() } }
    public var liveThreads: [ChatThread] = [] { didSet { rebuildThreads() } }
    public var dids: [VoipmsDidInfo] = []
    public var selectedDid: String? = nil
    public var searchText: String = ""
    public var draftText: String = ""
    public var isPolishingWithAI: Bool = false
    public var isLoading: Bool = false
    public var isSyncingVoipms: Bool = false
    public var showingComposeSheet: Bool = false
    public var loadError: String? = nil
    
    /// Threads sorted newest-first — stored, so `threads` is not regrouped per render.
    public private(set) var threads: [ChatThread] = []
    
    @ObservationIgnored private var didLoad = false
    @ObservationIgnored private var didLoadDids = false
    @ObservationIgnored private var lastLoadedAt: Date?
    @ObservationIgnored private var lastDidsLoadedAt: Date?
    /// thread id → when its full history was last fetched.
    @ObservationIgnored private var hydratedAt: [String: Date] = [:]
    @ObservationIgnored private var loadGeneration: UInt = 0
    
    @ObservationIgnored private let staleAfter: TimeInterval = 5 * 60
    @ObservationIgnored private let threadHydrationTTL: TimeInterval = 60
    
    public init() {}
    
    // MARK: - Lifecycle
    
    public func ensureLoaded() {
        if !didLoad {
            didLoad = true
            loadMessages()
            ensureDidsLoaded()
            return
        }
        refreshIfStale(olderThan: staleAfter)
        ensureDidsLoaded()
    }
    
    public func refreshIfStale(olderThan seconds: TimeInterval) {
        guard didLoad else {
            ensureLoaded()
            return
        }
        if let last = lastLoadedAt, Date().timeIntervalSince(last) < seconds { return }
        loadMessages()
    }
    
    /// DIDs change rarely — fetch once per session, then only when stale (5 min).
    public func ensureDidsLoaded() {
        if didLoadDids,
           let last = lastDidsLoadedAt,
           Date().timeIntervalSince(last) < staleAfter {
            return
        }
        didLoadDids = true
        loadDids()
    }
    
    public func resetForNewSession() {
        loadGeneration &+= 1
        didLoad = false
        didLoadDids = false
        lastLoadedAt = nil
        lastDidsLoadedAt = nil
        hydratedAt = [:]
        messages = []
        liveThreads = []
        dids = []
        selectedDid = nil
        searchText = ""
        draftText = ""
        loadError = nil
        isLoading = false
        isSyncingVoipms = false
        showingComposeSheet = false
    }
    
    // MARK: - Loading
    
    public func loadDids() {
        Task {
            do {
                let raw = try await ConvexAPIService.shared.fetchDids()
                let mapped = raw.map { d in
                    VoipmsDidInfo(
                        did: d["did"] ?? "",
                        description: d["description"] ?? "",
                        subAccount: d["sub_account"] ?? "",
                        formatted: d["formatted"] ?? (d["did"] ?? ""),
                        siteId: (d["site_id"]?.isEmpty == false) ? d["site_id"] : nil
                    )
                }
                if mapped != self.dids { self.dids = mapped }
                self.lastDidsLoadedAt = Date()
            } catch {
                // Keep existing DIDs on failure.
            }
        }
    }
    
    public func loadMessages() {
        Task { await loadMessagesAndWait() }
    }
    
    public func loadMessagesAndWait() async {
        loadGeneration &+= 1
        let generation = loadGeneration
        loadError = nil
        // Only show the loading state on a cold list; refreshes swap in place.
        if liveThreads.isEmpty { isLoading = true }
        
        do {
            let fetchedThreads = try await ConvexAPIService.shared.fetchSMSThreads()
            guard generation == loadGeneration else { return }
            // Preserve already-hydrated histories so rows don't collapse to one message.
            let merged = fetchedThreads.map { fresh -> ChatThread in
                guard let existing = liveThreads.first(where: { $0.id == fresh.id }),
                      existing.messages.count > 1,
                      existing.lastMessage.sentAt >= fresh.lastMessage.sentAt else { return fresh }
                var kept = existing
                kept.contactName = fresh.contactName
                return kept
            }
            if merged != liveThreads { liveThreads = merged }
            if !messages.isEmpty { messages = [] }
            lastLoadedAt = Date()
        } catch let error as ConvexError where error.isCancelled {
            // superseded
        } catch {
            guard generation == loadGeneration else { return }
            if liveThreads.isEmpty {
                loadError = error.localizedDescription
            }
        }
        if generation == loadGeneration {
            isLoading = false
        }
    }
    
    /// Pull from Voip.ms (external API) then reload. Toolbar / ⌘R only — never pull-to-refresh.
    public func syncVoipms() {
        guard !isSyncingVoipms else { return }
        isSyncingVoipms = true
        HapticFeedback.impact(.medium)
        Task {
            do {
                try await ConvexAPIService.shared.syncVoipmsNow()
            } catch {
                self.loadError = error.localizedDescription
            }
            self.hydratedAt = [:]
            await self.loadMessagesAndWait()
            self.loadDids()
            self.isSyncingVoipms = false
        }
    }
    
    private func rebuildThreads() {
        if !liveThreads.isEmpty {
            threads = liveThreads.sorted { $0.lastMessage.sentAt > $1.lastMessage.sentAt }
            return
        }
        let grouped = Dictionary(grouping: messages) { "\($0.did)_\($0.contact)" }
        threads = grouped.compactMap { (_, msgList) -> ChatThread? in
            let sorted = msgList.sorted { $0.sentAt < $1.sentAt }
            guard let last = sorted.last, let firstMsg = sorted.first else { return nil }
            let unread = msgList.filter { $0.direction == .in && $0.status == "unread" }.count
            return ChatThread(
                did: firstMsg.did,
                contact: firstMsg.contact,
                contactName: "Customer (\(firstMsg.contact.suffix(4)))",
                lastMessage: last,
                unreadCount: unread,
                messages: sorted
            )
        }.sorted { $0.lastMessage.sentAt > $1.lastMessage.sentAt }
    }
    
    // MARK: - Sending
    
    public func sendMessage(did: String, contact: String) {
        let trimmed = draftText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        
        let newMsg = SMSMessage(
            id: UUID().uuidString,
            voipmsId: "v_\(UUID().uuidString.prefix(6))",
            did: did,
            contact: contact,
            direction: .out,
            type: .sms,
            body: trimmed,
            sentAt: Date(),
            status: "sent"
        )
        
        if let idx = liveThreads.firstIndex(where: { $0.did == did && $0.contact == contact }) {
            liveThreads[idx].messages.append(newMsg)
            liveThreads[idx].lastMessage = newMsg
        } else {
            messages.append(newMsg)
        }
        draftText = ""
        
        Task {
            do {
                try await ConvexAPIService.shared.sendSMS(did: did, contact: contact, message: trimmed)
            } catch {
                self.loadError = "Couldn’t send message: \(error.localizedDescription)"
                HapticFeedback.notification(.error)
            }
        }
        HapticFeedback.notification(.success)
    }
    
    public func composeNewSMS(fromDid: String, toContact: String, messageText: String) async -> Bool {
        do {
            try await ConvexAPIService.shared.sendSMS(did: fromDid, contact: toContact, message: messageText)
        } catch {
            loadError = "Couldn’t send message: \(error.localizedDescription)"
            return false
        }
        let newMsg = SMSMessage(
            id: UUID().uuidString,
            voipmsId: "v_\(UUID().uuidString.prefix(6))",
            did: fromDid,
            contact: toContact,
            direction: .out,
            type: .sms,
            body: messageText,
            sentAt: Date(),
            status: "sent"
        )
        if let idx = liveThreads.firstIndex(where: { $0.did == fromDid && $0.contact == toContact }) {
            liveThreads[idx].messages.append(newMsg)
            liveThreads[idx].lastMessage = newMsg
        } else {
            let thread = ChatThread(did: fromDid, contact: toContact, contactName: nil, lastMessage: newMsg, unreadCount: 0, messages: [newMsg])
            liveThreads.insert(thread, at: 0)
        }
        loadMessages()
        return true
    }
    
    public func deleteConversation(did: String, contact: String) {
        messages.removeAll(where: { $0.did == did && $0.contact == contact })
        liveThreads.removeAll(where: { $0.did == did && $0.contact == contact })
        hydratedAt["\(did)_\(contact)"] = nil
        Task {
            do {
                try await ConvexAPIService.shared.deleteSMSConversation(did: did, contact: contact)
            } catch {
                self.loadError = "Couldn’t delete conversation: \(error.localizedDescription)"
                self.loadMessages()
            }
        }
        HapticFeedback.impact(.medium)
    }
    
    /// Load full conversation history into the matching thread. Cached for 60 s so
    /// pushing/popping the chat screen doesn't refetch.
    public func loadThreadMessages(did: String, contact: String, force: Bool = false) {
        let key = "\(did)_\(contact)"
        if !force, let at = hydratedAt[key], Date().timeIntervalSince(at) < threadHydrationTTL {
            return
        }
        hydratedAt[key] = Date()
        Task {
            do {
                let fetched = try await ConvexAPIService.shared.fetchSMSMessages(did: did, contact: contact)
                guard !fetched.isEmpty else { return }
                
                if let idx = liveThreads.firstIndex(where: { $0.did == did && $0.contact == contact }) {
                    var updated = liveThreads[idx]
                    if updated.messages != fetched {
                        updated.messages = fetched
                        if let last = fetched.last {
                            updated.lastMessage = last
                        }
                        liveThreads[idx] = updated
                    }
                } else {
                    messages.removeAll(where: { $0.did == did && $0.contact == contact })
                    messages.append(contentsOf: fetched)
                }
            } catch {
                self.hydratedAt[key] = nil
            }
        }
    }
    
    public func polishDraft(siteName: String) {
        guard !draftText.isEmpty else { return }
        isPolishingWithAI = true
        
        Task {
            let polished = await AIWandService.shared.polishMessage(draft: self.draftText, siteName: siteName)
            self.draftText = polished
            self.isPolishingWithAI = false
            HapticFeedback.notification(.success)
        }
    }
    
    /// Name of the cleaning site that owns a DID (for the AI wand), if known.
    public func siteId(forDid did: String) -> String? {
        dids.first(where: { $0.did == did })?.siteId
    }
}

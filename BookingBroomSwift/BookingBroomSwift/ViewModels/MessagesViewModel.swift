import Foundation
import Combine

public struct VoipmsDidInfo: Identifiable, Hashable {
    public var id: String { did }
    public var did: String
    public var description: String
    public var subAccount: String
    public var formatted: String
    
    public var label: String {
        if !description.isEmpty { return description }
        if !subAccount.isEmpty { return subAccount }
        return formatted
    }
}

@MainActor
public final class MessagesViewModel: ObservableObject {
    @Published public var messages: [SMSMessage] = []
    @Published public var liveThreads: [ChatThread] = []
    @Published public var dids: [VoipmsDidInfo] = []
    @Published public var selectedDid: String? = nil
    @Published public var searchText: String = ""
    @Published public var draftText: String = ""
    @Published public var isPolishingWithAI: Bool = false
    @Published public var isLoading: Bool = false
    @Published public var isSyncingVoipms: Bool = false
    @Published public var showingComposeSheet: Bool = false
    @Published public var loadError: String? = nil
    
    private var didLoad = false
    
    public init() {}
    
    public func ensureLoaded() {
        guard !didLoad else { return }
        didLoad = true
        loadMessages()
        loadDids()
    }
    
    public func resetForNewSession() {
        didLoad = false
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
    
    public func loadDids() {
        Task {
            do {
                let raw = try await ConvexAPIService.shared.fetchDids()
                self.dids = raw.map { d in
                    VoipmsDidInfo(
                        did: d["did"] ?? "",
                        description: d["description"] ?? "",
                        subAccount: d["sub_account"] ?? "",
                        formatted: d["formatted"] ?? (d["did"] ?? "")
                    )
                }
            } catch {
                self.dids = []
            }
        }
    }
    
    public func loadMessages() {
        isLoading = true
        loadError = nil
        Task {
            do {
                let fetchedThreads = try await ConvexAPIService.shared.fetchSMSThreads()
                self.liveThreads = fetchedThreads
                self.messages = []
            } catch {
                self.liveThreads = []
                self.messages = []
                self.loadError = error.localizedDescription
            }
            self.isLoading = false
        }
    }
    
    public func syncVoipms() {
        isSyncingVoipms = true
        Task {
            _ = try? await ConvexAPIService.shared.syncVoipmsNow()
            self.loadMessages()
            self.loadDids()
            self.isSyncingVoipms = false
        }
        HapticFeedback.impact(.medium)
    }
    
    public var threads: [ChatThread] {
        if !liveThreads.isEmpty {
            return liveThreads
        }
        let grouped = Dictionary(grouping: messages) { "\($0.did)_\($0.contact)" }
        return grouped.map { (_, msgList) -> ChatThread in
            let sorted = msgList.sorted { $0.sentAt < $1.sentAt }
            let last = sorted.last!
            let firstMsg = sorted.first!
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
        
        messages.append(newMsg)
        if let idx = liveThreads.firstIndex(where: { $0.did == did && $0.contact == contact }) {
            liveThreads[idx].messages.append(newMsg)
            liveThreads[idx].lastMessage = newMsg
        }
        draftText = ""
        
        Task {
            _ = try? await ConvexAPIService.shared.sendSMS(did: did, contact: contact, message: trimmed)
        }
        HapticFeedback.notification(.success)
    }
    
    public func composeNewSMS(fromDid: String, toContact: String, messageText: String) async -> Bool {
        let success = (try? await ConvexAPIService.shared.sendSMS(did: fromDid, contact: toContact, message: messageText)) ?? false
        if success {
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
            messages.append(newMsg)
            loadMessages()
        }
        return success
    }
    
    public func deleteConversation(did: String, contact: String) {
        messages.removeAll(where: { $0.did == did && $0.contact == contact })
        liveThreads.removeAll(where: { $0.did == did && $0.contact == contact })
        Task {
            _ = try? await ConvexAPIService.shared.deleteSMSConversation(did: did, contact: contact)
        }
        HapticFeedback.impact(.medium)
    }
    
    /// Load full conversation history into the matching thread.
    public func loadThreadMessages(did: String, contact: String) {
        Task {
            let fetched = (try? await ConvexAPIService.shared.fetchSMSMessages(did: did, contact: contact)) ?? []
            guard !fetched.isEmpty else { return }
            
            if let idx = liveThreads.firstIndex(where: { $0.did == did && $0.contact == contact }) {
                var updated = liveThreads[idx]
                updated.messages = fetched
                if let last = fetched.last {
                    updated.lastMessage = last
                }
                liveThreads[idx] = updated
            } else {
                messages.removeAll(where: { $0.did == did && $0.contact == contact })
                messages.append(contentsOf: fetched)
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
}

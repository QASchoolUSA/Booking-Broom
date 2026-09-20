import Foundation

public enum MessageDirection: String, Codable {
    case `in` = "in"
    case out = "out"
}

public enum MessageType: String, Codable {
    case sms = "sms"
    case mms = "mms"
}

public struct SMSMessage: Identifiable, Codable, Hashable {
    public var id: String
    public var voipmsId: String
    public var did: String
    public var contact: String
    public var direction: MessageDirection
    public var type: MessageType
    public var body: String
    public var mediaUrls: [String]?
    public var sentAt: Date
    public var status: String?
    
    public init(
        id: String,
        voipmsId: String,
        did: String,
        contact: String,
        direction: MessageDirection,
        type: MessageType = .sms,
        body: String,
        mediaUrls: [String]? = nil,
        sentAt: Date = Date(),
        status: String? = "sent"
    ) {
        self.id = id
        self.voipmsId = voipmsId
        self.did = did
        self.contact = contact
        self.direction = direction
        self.type = type
        self.body = body
        self.mediaUrls = mediaUrls
        self.sentAt = sentAt
        self.status = status
    }
}

public struct ChatThread: Identifiable, Hashable {
    public var id: String { "\(did)_\(contact)" }
    public var did: String
    public var contact: String
    public var contactName: String?
    public var lastMessage: SMSMessage
    public var unreadCount: Int
    public var messages: [SMSMessage]
    
    public init(did: String, contact: String, contactName: String? = nil, lastMessage: SMSMessage, unreadCount: Int = 0, messages: [SMSMessage]) {
        self.did = did
        self.contact = contact
        self.contactName = contactName
        self.lastMessage = lastMessage
        self.unreadCount = unreadCount
        self.messages = messages
    }
}

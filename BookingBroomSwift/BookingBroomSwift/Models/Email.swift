import Foundation

public struct EmailAttachment: Codable, Hashable, Identifiable {
    public var id: String { filename }
    public var filename: String
    public var size: Int?
    public var skipped: Bool?
    
    public init(filename: String, size: Int? = nil, skipped: Bool? = nil) {
        self.filename = filename
        self.size = size
        self.skipped = skipped
    }
}

public struct EmailMessage: Identifiable, Codable, Hashable {
    public var id: String
    public var from: String
    public var subject: String
    public var textBody: String?
    public var htmlBody: String?
    public var sentAt: Date
    public var direction: String // "in" or "out"
    public var attachments: [EmailAttachment]
    
    public init(
        id: String,
        from: String,
        subject: String,
        textBody: String? = nil,
        htmlBody: String? = nil,
        sentAt: Date = Date(),
        direction: String = "in",
        attachments: [EmailAttachment] = []
    ) {
        self.id = id
        self.from = from
        self.subject = subject
        self.textBody = textBody
        self.htmlBody = htmlBody
        self.sentAt = sentAt
        self.direction = direction
        self.attachments = attachments
    }
    
    public var isOutbound: Bool {
        direction == "out"
    }
}

public struct EmailThread: Identifiable, Codable, Hashable {
    public var id: String
    public var mailboxId: String
    public var subject: String
    public var participants: [String]
    public var lastSnippet: String
    public var lastMessageAt: Date
    public var unreadCount: Int
    public var siteName: String?
    
    public init(
        id: String,
        mailboxId: String,
        subject: String,
        participants: [String] = [],
        lastSnippet: String = "",
        lastMessageAt: Date = Date(),
        unreadCount: Int = 0,
        siteName: String? = nil
    ) {
        self.id = id
        self.mailboxId = mailboxId
        self.subject = subject
        self.participants = participants
        self.lastSnippet = lastSnippet
        self.lastMessageAt = lastMessageAt
        self.unreadCount = unreadCount
        self.siteName = siteName
    }
}

public struct EmailMailbox: Identifiable, Codable, Hashable {
    public var id: String
    public var email: String
    public var label: String?
    public var siteSlug: String?
    public var siteName: String?
    public var unreadCount: Int
    public var totalThreads: Int?
    
    public init(
        id: String,
        email: String,
        label: String? = nil,
        siteSlug: String? = nil,
        siteName: String? = nil,
        unreadCount: Int = 0,
        totalThreads: Int? = nil
    ) {
        self.id = id
        self.email = email
        self.label = label
        self.siteSlug = siteSlug
        self.siteName = siteName
        self.unreadCount = unreadCount
        self.totalThreads = totalThreads
    }
    
    public var displayName: String {
        if let l = label, !l.isEmpty { return l }
        if let sn = siteName, !sn.isEmpty { return sn }
        return email
    }
}

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
    /// Plain-text rendering of the body, derived once at parse time (off-main)
    /// so list rows never run the HTML regex passes during layout.
    public var plainText: String?
    
    public init(
        id: String,
        from: String,
        subject: String,
        textBody: String? = nil,
        htmlBody: String? = nil,
        sentAt: Date = Date(),
        direction: String = "in",
        attachments: [EmailAttachment] = [],
        plainText: String? = nil
    ) {
        self.id = id
        self.from = from
        self.subject = subject
        self.textBody = textBody
        self.htmlBody = htmlBody
        self.sentAt = sentAt
        self.direction = direction
        self.attachments = attachments
        self.plainText = plainText
    }
    
    public var isOutbound: Bool {
        direction == "out"
    }
    
    /// Prefer the text part; fall back to a plain-text conversion of the HTML part.
    public static func derivePlainText(text: String?, html: String?) -> String? {
        if let text = text?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty {
            return text
        }
        if let html = html?.trimmingCharacters(in: .whitespacesAndNewlines), !html.isEmpty {
            let cleaned = htmlToPlainText(html)
            return cleaned.isEmpty ? nil : cleaned
        }
        return nil
    }
    
    /// Plain-text fallback when HTML is missing or unusable (previews / empty edge cases).
    public static func htmlToPlainText(_ html: String) -> String {
        var s = html
        let blockPatterns = [
            "(?is)<style[^>]*>.*?</style>",
            "(?is)<script[^>]*>.*?</script>",
            "(?is)<head[^>]*>.*?</head>",
            "(?is)<!--.*?-->"
        ]
        for pattern in blockPatterns {
            s = s.replacingOccurrences(of: pattern, with: " ", options: .regularExpression)
        }
        s = s.replacingOccurrences(of: "(?i)<br\\s*/?>", with: "\n", options: .regularExpression)
        s = s.replacingOccurrences(of: "(?i)</p>", with: "\n\n", options: .regularExpression)
        s = s.replacingOccurrences(of: "(?i)</div>", with: "\n", options: .regularExpression)
        s = s.replacingOccurrences(of: "(?i)</tr>", with: "\n", options: .regularExpression)
        s = s.replacingOccurrences(of: "(?i)</li>", with: "\n", options: .regularExpression)
        s = s.replacingOccurrences(of: "(?i)</h[1-6]>", with: "\n\n", options: .regularExpression)
        s = s.replacingOccurrences(of: "<[^>]+>", with: " ", options: .regularExpression)
        let entities: [(String, String)] = [
            ("&nbsp;", " "),
            ("&amp;", "&"),
            ("&lt;", "<"),
            ("&gt;", ">"),
            ("&quot;", "\""),
            ("&#39;", "'"),
            ("&apos;", "'"),
            ("&mdash;", "—"),
            ("&ndash;", "–"),
            ("&rsquo;", "'"),
            ("&lsquo;", "'"),
            ("&rdquo;", "\""),
            ("&ldquo;", "\"")
        ]
        for (entity, replacement) in entities {
            s = s.replacingOccurrences(of: entity, with: replacement)
        }
        if let regex = try? NSRegularExpression(pattern: "&#(\\d+);") {
            let ns = s as NSString
            let matches = regex.matches(in: s, range: NSRange(location: 0, length: ns.length)).reversed()
            var mutable = s
            for match in matches {
                if match.numberOfRanges >= 2,
                   let full = Range(match.range, in: mutable),
                   let numRange = Range(match.range(at: 1), in: mutable),
                   let code = UInt32(mutable[numRange]),
                   let scalar = UnicodeScalar(code) {
                    mutable.replaceSubrange(full, with: String(Character(scalar)))
                }
            }
            s = mutable
        }
        s = s.replacingOccurrences(of: "[ \\t\\x0B\\f\\r]+", with: " ", options: .regularExpression)
        s = s.replacingOccurrences(of: "\n{3,}", with: "\n\n", options: .regularExpression)
        return s.trimmingCharacters(in: .whitespacesAndNewlines)
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

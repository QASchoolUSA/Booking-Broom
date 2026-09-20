import SwiftUI

public struct EmailMessageCardView: View {
    public let message: EmailMessage
    @State private var showHTML = false
    
    public init(message: EmailMessage) {
        self.message = message
    }
    
    private var htmlBody: String? {
        guard let html = message.htmlBody?.trimmingCharacters(in: .whitespacesAndNewlines),
              !html.isEmpty else { return nil }
        return html
    }
    
    private var plainBody: String? {
        if let text = message.textBody?.trimmingCharacters(in: .whitespacesAndNewlines),
           !text.isEmpty {
            return text
        }
        if let html = htmlBody {
            let cleaned = Self.htmlToPlainText(html)
            return cleaned.isEmpty ? nil : cleaned
        }
        return nil
    }
    
    private var plainPreview: String {
        plainBody ?? "(Formatted message)"
    }
    
    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(message.isOutbound ? "You" : shortAddress(message.from))
                        .font(.subheadline.weight(.semibold))
                    Text(message.sentAt.formatted(date: .abbreviated, time: .shortened))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(message.isOutbound ? "Sent" : "Received")
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        (message.isOutbound ? AppColors.primary : AppColors.emerald).opacity(0.14)
                    )
                    .foregroundStyle(message.isOutbound ? AppColors.primary : AppColors.emerald)
                    .clipShape(Capsule())
            }
            
            if !message.subject.isEmpty && !message.isOutbound {
                Text(message.subject)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
            }
            
            if let html = htmlBody {
                if showHTML {
                    HTMLEmailBodyView(html: html)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(plainPreview)
                            .font(.body)
                            .foregroundStyle(.primary)
                            .lineSpacing(5)
                            .lineLimit(8)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        
                        Button {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                showHTML = true
                            }
                        } label: {
                            Label("Show formatted email", systemImage: "doc.richtext")
                                .font(.caption.weight(.semibold))
                        }
                        .buttonStyle(.borderless)
                    }
                }
            } else if let plain = plainBody {
                Text(plain)
                    .font(.body)
                    .foregroundStyle(.primary)
                    .lineSpacing(5)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                Text("(Empty message)")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            
            if !message.attachments.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Attachments")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.secondary)
                    
                    ForEach(message.attachments) { att in
                        HStack(spacing: 10) {
                            Image(systemName: "paperclip")
                                .font(.caption)
                                .foregroundStyle(AppColors.primary)
                            Text(att.filename)
                                .font(.subheadline)
                                .lineLimit(1)
                            Spacer()
                            if let sz = att.size {
                                Text("\(max(sz / 1024, 1)) KB")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(10)
                        .background(Color.secondary.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                }
                .padding(.top, 4)
            }
        }
        .padding(16)
        .background {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(
                    message.isOutbound
                        ? AppColors.primary.opacity(0.08)
                        : AppColors.cardBackground
                )
        }
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.primary.opacity(0.06), lineWidth: 1)
        )
    }
    
    private func shortAddress(_ value: String) -> String {
        if let start = value.firstIndex(of: "<"), let end = value.firstIndex(of: ">") {
            let name = value[..<start].trimmingCharacters(in: .whitespaces)
            return name.isEmpty ? String(value[value.index(after: start)..<end]) : name
        }
        return value
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

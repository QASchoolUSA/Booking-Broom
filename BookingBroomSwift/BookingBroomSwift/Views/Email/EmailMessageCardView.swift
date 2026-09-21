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
    
    /// Uses the parse-time `plainText`; only falls back to conversion for
    /// messages constructed without it (e.g. optimistic local inserts).
    private var plainBody: String? {
        if let cached = message.plainText, !cached.isEmpty {
            return cached
        }
        return EmailMessage.derivePlainText(text: message.textBody, html: message.htmlBody)
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
}

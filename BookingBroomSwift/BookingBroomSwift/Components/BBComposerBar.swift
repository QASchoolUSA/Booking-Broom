import SwiftUI

/// Shared bottom composer for SMS / Email threads — system bar material.
public struct BBComposerBar: View {
    @Binding public var text: String
    public var placeholder: String
    public var isSending: Bool
    public var leadingSystemImage: String?
    public var leadingTint: Color
    public var leadingHelp: String?
    public var onLeading: (() -> Void)?
    public var onSend: () -> Void

    @FocusState private var isFocused: Bool

    private var canSend: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSending
    }

    public init(
        text: Binding<String>,
        placeholder: String = "Message",
        isSending: Bool = false,
        leadingSystemImage: String? = nil,
        leadingTint: Color = AppColors.violet,
        leadingHelp: String? = nil,
        onLeading: (() -> Void)? = nil,
        onSend: @escaping () -> Void
    ) {
        self._text = text
        self.placeholder = placeholder
        self.isSending = isSending
        self.leadingSystemImage = leadingSystemImage
        self.leadingTint = leadingTint
        self.leadingHelp = leadingHelp
        self.onLeading = onLeading
        self.onSend = onSend
    }

    public var body: some View {
        HStack(alignment: .bottom, spacing: AppSpacing.xs) {
            if let leadingSystemImage, !leadingSystemImage.isEmpty, let onLeading {
                Button(action: onLeading) {
                    Image(systemName: leadingSystemImage)
                        .font(.system(size: 17, weight: .semibold))
                }
                .buttonStyle(BBIconButtonStyle(tint: leadingTint))
                .help(leadingHelp ?? "")
                .accessibilityLabel(leadingHelp ?? "Action")
            }

            TextField(placeholder, text: $text, axis: .vertical)
                .lineLimit(1...6)
                .focused($isFocused)
                .bbComposerField(isFocused: isFocused)
                .disabled(isSending)

            Button(action: onSend) {
                Group {
                    if isSending {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 28))
                            .symbolRenderingMode(.hierarchical)
                            .foregroundStyle(canSend ? AppColors.primary : Color.secondary.opacity(0.45))
                    }
                }
                .frame(width: ControlMetrics.iconHitTarget, height: ControlMetrics.iconHitTarget)
            }
            .buttonStyle(.plain)
            .disabled(!canSend)
            .accessibilityLabel("Send")
        }
        .padding(.horizontal, AppSpacing.sm)
        .padding(.vertical, AppSpacing.xs)
        .background(.bar)
    }
}

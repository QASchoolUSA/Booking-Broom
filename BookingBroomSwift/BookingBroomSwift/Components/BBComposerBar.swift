import SwiftUI

/// Shared bottom composer for SMS / Email threads.
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
                        .font(.system(size: 15, weight: .semibold))
                }
                .buttonStyle(BBIconButtonStyle(tint: leadingTint))
                .help(leadingHelp ?? "")
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
                        Image(systemName: "arrow.up")
                            .font(.system(size: 13, weight: .bold))
                    }
                }
                .frame(width: ControlMetrics.iconHitTarget, height: ControlMetrics.iconHitTarget)
            }
            .bbPrimaryButton(expand: false)
            .disabled(!canSend)
            .help("Send")
        }
        .padding(.horizontal, AppSpacing.sm)
        .padding(.vertical, AppSpacing.xs)
        .background(.bar)
    }
}

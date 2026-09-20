import SwiftUI

/// Labeled field chrome with hairline border and focus ring.
public struct BBFieldChrome<Content: View>: View {
    public let title: String?
    public let symbol: String?
    public var isFocused: Bool
    @ViewBuilder public var content: () -> Content
    
    public init(
        title: String? = nil,
        symbol: String? = nil,
        isFocused: Bool = false,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.symbol = symbol
        self.isFocused = isFocused
        self.content = content
    }
    
    public var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xxs + 2) {
            if let title {
                Text(title)
                    .font(AppTypography.metaBold)
                    .foregroundStyle(.secondary)
            }
            
            HStack(spacing: AppSpacing.xs) {
                if let symbol, !symbol.isEmpty {
                    Image(systemName: symbol)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(isFocused ? AppColors.primary : .secondary)
                        .frame(width: 18)
                }
                content()
                    .textFieldStyle(.plain)
            }
            .padding(.horizontal, ControlMetrics.fieldHorizontalPadding)
            .padding(.vertical, ControlMetrics.fieldVerticalPadding)
            .frame(minHeight: ControlMetrics.fieldMinHeight)
            .background(
                RoundedRectangle(cornerRadius: ControlMetrics.fieldRadius, style: .continuous)
                    .fill(AppColors.secondarySystemBackground)
            )
            .overlay(
                RoundedRectangle(cornerRadius: ControlMetrics.fieldRadius, style: .continuous)
                    .stroke(
                        isFocused ? AppColors.primary.opacity(0.85) : AppColors.separator.opacity(0.55),
                        lineWidth: isFocused ? ControlMetrics.focusRingWidth : ControlMetrics.hairlineWidth
                    )
            )
        }
    }
}

/// Compact chrome for inline / composer multiline fields.
public struct BBComposerFieldModifier: ViewModifier {
    public var isFocused: Bool
    
    public func body(content: Content) -> some View {
        content
            .textFieldStyle(.plain)
            .padding(.horizontal, ControlMetrics.fieldHorizontalPadding)
            .padding(.vertical, ControlMetrics.fieldVerticalPadding)
            .frame(minHeight: ControlMetrics.fieldMinHeight)
            .background(
                RoundedRectangle(cornerRadius: ControlMetrics.composerRadius, style: .continuous)
                    .fill(AppColors.secondarySystemBackground)
            )
            .overlay(
                RoundedRectangle(cornerRadius: ControlMetrics.composerRadius, style: .continuous)
                    .stroke(
                        isFocused ? AppColors.primary.opacity(0.8) : AppColors.separator.opacity(0.5),
                        lineWidth: isFocused ? ControlMetrics.focusRingWidth : ControlMetrics.hairlineWidth
                    )
            )
    }
}

extension View {
    public func bbComposerField(isFocused: Bool = false) -> some View {
        modifier(BBComposerFieldModifier(isFocused: isFocused))
    }
    
    /// Multiline / TextEditor field with labeled chrome.
    public func bbEditorChrome(isFocused: Bool = false) -> some View {
        self
            .padding(ControlMetrics.fieldHorizontalPadding)
            .scrollContentBackground(.hidden)
            .background(
                RoundedRectangle(cornerRadius: ControlMetrics.fieldRadius, style: .continuous)
                    .fill(AppColors.secondarySystemBackground)
            )
            .overlay(
                RoundedRectangle(cornerRadius: ControlMetrics.fieldRadius, style: .continuous)
                    .stroke(
                        isFocused ? AppColors.primary.opacity(0.85) : AppColors.separator.opacity(0.55),
                        lineWidth: isFocused ? ControlMetrics.focusRingWidth : ControlMetrics.hairlineWidth
                    )
            )
    }
}

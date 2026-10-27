import SwiftUI

/// Content surfaces: flat grouped cards — materials reserved for chrome.
public struct AppSurfaceModifier: ViewModifier {
    var cornerRadius: CGFloat?

    private var resolvedRadius: CGFloat {
        cornerRadius ?? AppSpacing.cardCornerRadius
    }

    public func body(content: Content) -> some View {
        content
            .background(AppColors.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: resolvedRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: resolvedRadius, style: .continuous)
                    .strokeBorder(AppColors.separator.opacity(0.35), lineWidth: ControlMetrics.hairlineWidth)
            )
    }
}

/// Subtle elevated panel for interactive cards (booking row, etc.).
public struct AppElevatedSurfaceModifier: ViewModifier {
    var cornerRadius: CGFloat?

    private var resolvedRadius: CGFloat {
        cornerRadius ?? AppSpacing.cardCornerRadius
    }

    public func body(content: Content) -> some View {
        #if os(macOS)
        content
            .background(AppColors.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: resolvedRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: resolvedRadius, style: .continuous)
                    .strokeBorder(AppColors.separator.opacity(0.4), lineWidth: ControlMetrics.hairlineWidth)
            )
        #else
        content
            .background(AppColors.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: resolvedRadius, style: .continuous))
            .shadow(color: Color.black.opacity(0.04), radius: 2, x: 0, y: 1)
        #endif
    }
}

extension View {
    /// Preferred content card surface (no glass).
    public func appSurface(cornerRadius: CGFloat? = nil) -> some View {
        modifier(AppSurfaceModifier(cornerRadius: cornerRadius))
    }

    public func appElevatedSurface(cornerRadius: CGFloat? = nil) -> some View {
        modifier(AppElevatedSurfaceModifier(cornerRadius: cornerRadius))
    }

    /// Legacy alias — routes to flat content surface (HIG: no glass on content cards).
    public func glassCard(cornerRadius: CGFloat = 12) -> some View {
        appSurface(cornerRadius: cornerRadius)
    }

    /// Page background using system grouped color.
    public func bbPageBackground() -> some View {
        background(AppColors.groupedBackground.ignoresSafeArea())
    }
}

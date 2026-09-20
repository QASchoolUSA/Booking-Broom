import SwiftUI

/// Platform-adaptive card surface: flat Mac panels vs iOS glass materials.
public struct AppSurfaceModifier: ViewModifier {
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
                    .stroke(Color.primary.opacity(0.08), lineWidth: 1)
            )
        #else
        content
            .background(.regularMaterial)
            .clipShape(RoundedRectangle(cornerRadius: resolvedRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: resolvedRadius, style: .continuous)
                    .stroke(Color.primary.opacity(0.08), lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 4)
        #endif
    }
}

extension View {
    /// Preferred card surface for list rows, stats, and panels.
    public func appSurface(cornerRadius: CGFloat? = nil) -> some View {
        modifier(AppSurfaceModifier(cornerRadius: cornerRadius))
    }
    
    /// Legacy alias — routes through `appSurface` so call sites pick up Mac-native styling.
    public func glassCard(cornerRadius: CGFloat = 16) -> some View {
        #if os(macOS)
        appSurface(cornerRadius: min(cornerRadius, 12))
        #else
        appSurface(cornerRadius: cornerRadius)
        #endif
    }
}

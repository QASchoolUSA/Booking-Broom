import SwiftUI

/// Full-width primary CTA — system prominent on Mac, filled brand on iOS.
public struct BBPrimaryButtonStyle: ButtonStyle {
    public var isLoading: Bool = false
    public var expand: Bool = true
    
    public init(isLoading: Bool = false, expand: Bool = true) {
        self.isLoading = isLoading
        self.expand = expand
    }
    
    public func makeBody(configuration: Configuration) -> some View {
        #if os(macOS)
        configuration.label
            .font(AppTypography.rowTitle)
            .frame(maxWidth: expand ? .infinity : nil, minHeight: ControlMetrics.primaryButtonMinHeight)
            .padding(.horizontal, expand ? AppSpacing.sm : AppSpacing.xs)
            .opacity(configuration.isPressed ? 0.85 : 1)
        #else
        configuration.label
            .font(.headline)
            .foregroundStyle(.white)
            .frame(maxWidth: expand ? .infinity : nil, minHeight: ControlMetrics.primaryButtonMinHeight)
            .padding(.horizontal, AppSpacing.md)
            .background(AppColors.primary.opacity(configuration.isPressed ? 0.85 : 1))
            .clipShape(RoundedRectangle(cornerRadius: ControlMetrics.controlRadius, style: .continuous))
            .opacity(isLoading ? 0.7 : 1)
        #endif
    }
}

/// Secondary / bordered action.
public struct BBSecondaryButtonStyle: ButtonStyle {
    public var expand: Bool = true
    
    public init(expand: Bool = true) {
        self.expand = expand
    }
    
    public func makeBody(configuration: Configuration) -> some View {
        #if os(macOS)
        configuration.label
            .font(AppTypography.rowTitle)
            .frame(maxWidth: expand ? .infinity : nil, minHeight: ControlMetrics.primaryButtonMinHeight)
            .padding(.horizontal, expand ? AppSpacing.sm : AppSpacing.xs)
            .opacity(configuration.isPressed ? 0.85 : 1)
        #else
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(AppColors.primary)
            .frame(maxWidth: expand ? .infinity : nil, minHeight: ControlMetrics.primaryButtonMinHeight)
            .padding(.horizontal, AppSpacing.md)
            .background(AppColors.primary.opacity(configuration.isPressed ? 0.18 : 0.12))
            .clipShape(RoundedRectangle(cornerRadius: ControlMetrics.controlRadius, style: .continuous))
        #endif
    }
}

/// Destructive full-width action.
public struct BBDestructiveButtonStyle: ButtonStyle {
    public var expand: Bool = true
    
    public init(expand: Bool = true) {
        self.expand = expand
    }
    
    public func makeBody(configuration: Configuration) -> some View {
        #if os(macOS)
        configuration.label
            .font(AppTypography.rowTitle)
            .foregroundStyle(AppColors.rose)
            .frame(maxWidth: expand ? .infinity : nil, minHeight: ControlMetrics.primaryButtonMinHeight)
            .padding(.horizontal, expand ? AppSpacing.sm : AppSpacing.xs)
            .opacity(configuration.isPressed ? 0.85 : 1)
        #else
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(AppColors.rose)
            .frame(maxWidth: expand ? .infinity : nil, minHeight: ControlMetrics.primaryButtonMinHeight)
            .padding(.horizontal, AppSpacing.md)
            .background(AppColors.rose.opacity(configuration.isPressed ? 0.22 : 0.14))
            .clipShape(RoundedRectangle(cornerRadius: ControlMetrics.controlRadius, style: .continuous))
        #endif
    }
}

/// Icon-only control with a proper hit target (composer / toolbar).
public struct BBIconButtonStyle: ButtonStyle {
    public var tint: Color = AppColors.primary
    
    public init(tint: Color = AppColors.primary) {
        self.tint = tint
    }
    
    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(tint)
            .frame(width: ControlMetrics.iconHitTarget, height: ControlMetrics.iconHitTarget)
            .contentShape(Rectangle())
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

extension View {
    /// Apply native Mac borderedProminent + brand tint; iOS uses filled primary style.
    @ViewBuilder
    public func bbPrimaryButton(isLoading: Bool = false, expand: Bool = true) -> some View {
        #if os(macOS)
        self
            .buttonStyle(.borderedProminent)
            .tint(AppColors.primary)
            .controlSize(expand ? .large : .regular)
        #else
        self.buttonStyle(BBPrimaryButtonStyle(isLoading: isLoading, expand: expand))
        #endif
    }
    
    @ViewBuilder
    public func bbSecondaryButton(expand: Bool = true) -> some View {
        #if os(macOS)
        self
            .buttonStyle(.bordered)
            .controlSize(expand ? .large : .regular)
        #else
        self.buttonStyle(BBSecondaryButtonStyle(expand: expand))
        #endif
    }
    
    @ViewBuilder
    public func bbDestructiveButton(expand: Bool = true) -> some View {
        #if os(macOS)
        self
            .buttonStyle(.bordered)
            .tint(AppColors.rose)
            .controlSize(expand ? .large : .regular)
        #else
        self.buttonStyle(BBDestructiveButtonStyle(expand: expand))
        #endif
    }
}

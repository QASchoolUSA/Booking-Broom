import Foundation

#if os(iOS)
import UIKit
#endif
#if os(macOS)
import AppKit
#endif

public enum HapticFeedback {
    public enum ImpactStyle {
        case light, medium, heavy, soft, rigid
    }
    
    public enum NotificationType {
        case success, warning, error
    }
    
    public static func impact(_ style: ImpactStyle = .medium) {
        #if os(iOS)
        let uiStyle: UIImpactFeedbackGenerator.FeedbackStyle
        switch style {
        case .light: uiStyle = .light
        case .medium: uiStyle = .medium
        case .heavy: uiStyle = .heavy
        case .soft: uiStyle = .soft
        case .rigid: uiStyle = .rigid
        }
        UIImpactFeedbackGenerator(style: uiStyle).impactOccurred()
        #elseif os(macOS)
        NSHapticFeedbackManager.defaultPerformer.perform(.generic, performanceTime: .default)
        #endif
    }
    
    public static func notification(_ type: NotificationType) {
        #if os(iOS)
        let uiType: UINotificationFeedbackGenerator.FeedbackType
        switch type {
        case .success: uiType = .success
        case .warning: uiType = .warning
        case .error: uiType = .error
        }
        UINotificationFeedbackGenerator().notificationOccurred(uiType)
        #elseif os(macOS)
        let pattern: NSHapticFeedbackManager.FeedbackPattern
        switch type {
        case .success: pattern = .levelChange
        case .warning, .error: pattern = .generic
        }
        NSHapticFeedbackManager.defaultPerformer.perform(pattern, performanceTime: .default)
        #endif
    }
    
    public static func selection() {
        #if os(iOS)
        UISelectionFeedbackGenerator().selectionChanged()
        #elseif os(macOS)
        NSHapticFeedbackManager.defaultPerformer.perform(.alignment, performanceTime: .default)
        #endif
    }
}

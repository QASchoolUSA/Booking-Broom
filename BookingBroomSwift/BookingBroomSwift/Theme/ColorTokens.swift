import SwiftUI

#if canImport(UIKit)
import UIKit
#endif
#if canImport(AppKit)
import AppKit
#endif

public enum AppColors {
    // Brand Primary Colors
    public static let primary = Color(red: 0.01, green: 0.48, blue: 1.00) // #027AFF Apple Blue
    public static let primaryGradientStart = Color(red: 0.05, green: 0.55, blue: 1.00)
    public static let primaryGradientEnd = Color(red: 0.00, green: 0.35, blue: 0.85)
    
    // Accent Colors
    public static let emerald = Color(red: 0.06, green: 0.73, blue: 0.50) // #10B981 Success
    public static let amber = Color(red: 0.96, green: 0.62, blue: 0.06)   // #F59E0B Warning / Pending
    public static let rose = Color(red: 0.94, green: 0.27, blue: 0.38)    // #EF4444 Danger / Cancelled
    public static let violet = Color(red: 0.55, green: 0.36, blue: 0.96)  // #8B5CF6 Special / AI
    public static let sky = Color(red: 0.02, green: 0.71, blue: 0.94)     // #06B6D4 Info
    
    // Status Colors
    public static func color(forStatus status: String) -> Color {
        switch status.lowercased() {
        case "new", "pending":
            return amber
        case "confirmed", "assigned":
            return primary
        case "completed":
            return emerald
        case "cancelled":
            return rose
        default:
            return .gray
        }
    }
    
    public static func backgroundColor(forStatus status: String) -> Color {
        color(forStatus: status).opacity(0.15)
    }
    
    // Background & Vibrancy
    #if os(iOS)
    public static let cardBackground = Color(uiColor: .secondarySystemGroupedBackground)
    public static let groupedBackground = Color(uiColor: .systemGroupedBackground)
    public static let tertiaryFill = Color(uiColor: .tertiarySystemFill)
    public static let secondarySystemBackground = Color(uiColor: .secondarySystemBackground)
    #elseif os(macOS)
    public static let cardBackground = Color(nsColor: .controlBackgroundColor)
    public static let groupedBackground = Color(nsColor: .windowBackgroundColor)
    public static let tertiaryFill = Color(nsColor: .controlColor).opacity(0.35)
    public static let secondarySystemBackground = Color(nsColor: .controlBackgroundColor)
    public static let separator = Color(nsColor: .separatorColor)
    #endif
    
    #if os(iOS)
    public static let separator = Color(uiColor: .separator)
    #endif
}

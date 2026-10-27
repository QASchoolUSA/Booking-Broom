import SwiftUI

#if canImport(UIKit)
import UIKit
#endif
#if canImport(AppKit)
import AppKit
#endif

/// HIG-first palette: semantic system colors + one Booking Broom accent tint.
public enum AppColors {
    /// Brand accent — Booking Broom blue (also set as app `.tint`).
    public static let primary = Color(red: 0.0, green: 0.478, blue: 1.0) // #007AFF

    public static let primaryGradientStart = Color(red: 0.05, green: 0.55, blue: 1.00)
    public static let primaryGradientEnd = Color(red: 0.00, green: 0.35, blue: 0.85)

    // Status / semantic accents (used sparingly)
    public static let emerald = Color.green
    public static let amber = Color.orange
    public static let rose = Color.red
    public static let violet = Color.purple
    public static let sky = Color.cyan

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
            return .secondary
        }
    }

    public static func backgroundColor(forStatus status: String) -> Color {
        color(forStatus: status).opacity(0.14)
    }

    #if os(iOS)
    public static let cardBackground = Color(uiColor: .secondarySystemGroupedBackground)
    public static let groupedBackground = Color(uiColor: .systemGroupedBackground)
    public static let tertiaryFill = Color(uiColor: .tertiarySystemFill)
    public static let secondarySystemBackground = Color(uiColor: .secondarySystemBackground)
    public static let separator = Color(uiColor: .separator)
    #elseif os(macOS)
    public static let cardBackground = Color(nsColor: .controlBackgroundColor)
    public static let groupedBackground = Color(nsColor: .windowBackgroundColor)
    public static let tertiaryFill = Color(nsColor: .controlColor).opacity(0.35)
    public static let secondarySystemBackground = Color(nsColor: .controlBackgroundColor)
    public static let separator = Color(nsColor: .separatorColor)
    #endif
}

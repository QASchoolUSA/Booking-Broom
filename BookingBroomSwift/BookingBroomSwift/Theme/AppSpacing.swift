import SwiftUI

/// 8-pt spacing scale with platform content insets and readable widths.
public enum AppSpacing {
    public static let xxs: CGFloat = 4
    public static let xs: CGFloat = 8
    public static let sm: CGFloat = 12
    public static let md: CGFloat = 16
    public static let lg: CGFloat = 20
    public static let xl: CGFloat = 24
    public static let xxl: CGFloat = 32

    /// Horizontal inset for scrollable page content.
    public static var contentInset: CGFloat {
        #if os(macOS)
        20
        #else
        16
        #endif
    }

    /// Max readable width for form / detail columns on wide layouts.
    public static let readableContentWidth: CGFloat = 720

    /// Max width for dashboard-style multi-column pages.
    public static let dashboardMaxWidth: CGFloat = 1100

    public static var cardPadding: CGFloat {
        #if os(macOS)
        12
        #else
        14
        #endif
    }

    /// Content card corner radius (not chrome).
    public static var cardCornerRadius: CGFloat {
        #if os(macOS)
        8
        #else
        12
        #endif
    }

    public static var cardSpacing: CGFloat {
        #if os(macOS)
        8
        #else
        10
        #endif
    }
}

import SwiftUI

/// Spacing scale and content insets for consistent layout density.
public enum AppSpacing {
    public static let xxs: CGFloat = 4
    public static let xs: CGFloat = 8
    public static let sm: CGFloat = 12
    public static let md: CGFloat = 16
    public static let lg: CGFloat = 20
    public static let xl: CGFloat = 24
    public static let xxl: CGFloat = 32
    
    /// Horizontal inset for scrollable detail content.
    public static var contentInset: CGFloat {
        #if os(macOS)
        24
        #else
        16
        #endif
    }
    
    /// Max readable width for dashboard-style pages on wide Mac windows.
    public static let dashboardMaxWidth: CGFloat = 1000
    
    public static var cardPadding: CGFloat {
        #if os(macOS)
        12
        #else
        14
        #endif
    }
    
    public static var cardCornerRadius: CGFloat {
        #if os(macOS)
        10
        #else
        16
        #endif
    }
    
    public static var cardSpacing: CGFloat {
        #if os(macOS)
        10
        #else
        12
        #endif
    }
}

import SwiftUI

/// Shared radii and heights for buttons and text fields.
public enum ControlMetrics {
    public static var controlRadius: CGFloat {
        #if os(macOS)
        6
        #else
        10
        #endif
    }
    
    public static var fieldRadius: CGFloat {
        #if os(macOS)
        6
        #else
        10
        #endif
    }
    
    public static var composerRadius: CGFloat {
        #if os(macOS)
        8
        #else
        12
        #endif
    }
    
    public static var fieldMinHeight: CGFloat {
        #if os(macOS)
        28
        #else
        44
        #endif
    }
    
    public static var fieldHorizontalPadding: CGFloat {
        #if os(macOS)
        10
        #else
        12
        #endif
    }
    
    public static var fieldVerticalPadding: CGFloat {
        #if os(macOS)
        6
        #else
        12
        #endif
    }
    
    public static var primaryButtonMinHeight: CGFloat {
        #if os(macOS)
        28
        #else
        48
        #endif
    }
    
    public static var iconHitTarget: CGFloat {
        #if os(macOS)
        28
        #else
        44
        #endif
    }
    
    public static var focusRingWidth: CGFloat { 2 }
    public static var hairlineWidth: CGFloat { 1 }
}

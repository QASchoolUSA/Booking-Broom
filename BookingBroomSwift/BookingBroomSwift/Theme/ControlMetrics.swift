import SwiftUI

/// Shared radii and heights — capsules on iOS CTAs; denser rects on Mac.
public enum ControlMetrics {
    public static var controlRadius: CGFloat {
        #if os(macOS)
        6
        #else
        14 // near-capsule for primary buttons
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
        20
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
        10
        #endif
    }

    public static var primaryButtonMinHeight: CGFloat {
        #if os(macOS)
        28
        #else
        50
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

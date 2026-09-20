import SwiftUI

/// Semantic SF Pro styles for the manager console.
public enum AppTypography {
    public static let pageTitle = Font.title2.weight(.semibold)
    public static let sectionTitle = Font.headline
    public static let rowTitle = Font.subheadline.weight(.semibold)
    public static let body = Font.body
    public static let meta = Font.caption
    public static let metaBold = Font.caption.weight(.semibold)
    public static let micro = Font.caption2
    public static let microBold = Font.caption2.weight(.bold)
    public static let metricValue = Font.system(.title2, design: .rounded).weight(.bold)
    public static let mono = Font.system(.body, design: .monospaced).weight(.medium)
    public static let price = Font.subheadline.weight(.semibold)
}

import SwiftUI

/// Semantic SF Pro text styles — Dynamic Type scales automatically.
public enum AppTypography {
    public static let pageTitle = Font.largeTitle.weight(.bold)
    public static let sectionTitle = Font.title3.weight(.semibold)
    public static let rowTitle = Font.headline
    public static let body = Font.body
    public static let meta = Font.subheadline
    public static let metaBold = Font.subheadline.weight(.semibold)
    public static let micro = Font.caption
    public static let microBold = Font.caption.weight(.semibold)
    public static let metricValue = Font.title2.weight(.bold)
    public static let mono = Font.system(.body, design: .monospaced).weight(.medium)
    public static let price = Font.headline.weight(.semibold)
}

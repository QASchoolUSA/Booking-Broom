import SwiftUI

public struct StatCard: View {
    public let title: String
    public let value: String
    public let iconName: String
    public let iconColor: Color
    public var subtitle: String? = nil
    public var trend: String? = nil
    
    public init(title: String, value: String, iconName: String, iconColor: Color, subtitle: String? = nil, trend: String? = nil) {
        self.title = title
        self.value = value
        self.iconName = iconName
        self.iconColor = iconColor
        self.subtitle = subtitle
        self.trend = trend
    }
    
    public var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            HStack {
                ZStack {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(iconColor.opacity(0.14))
                        .frame(width: 32, height: 32)
                    Image(systemName: iconName)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(iconColor)
                }
                Spacer(minLength: 0)
                if let trend {
                    Text(trend)
                        .font(AppTypography.microBold)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(AppColors.emerald.opacity(0.14))
                        .foregroundStyle(AppColors.emerald)
                        .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                }
            }
            
            Text(value)
                .font(AppTypography.metricValue)
                .foregroundStyle(.primary)
                .monospacedDigit()
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(AppTypography.metaBold)
                    .foregroundStyle(.secondary)
                if let sub = subtitle {
                    Text(sub)
                        .font(AppTypography.micro)
                        .foregroundStyle(.secondary.opacity(0.85))
                }
            }
        }
        .padding(AppSpacing.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .appSurface()
    }
}

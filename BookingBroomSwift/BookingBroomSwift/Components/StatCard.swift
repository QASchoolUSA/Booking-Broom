import SwiftUI

public struct StatCard: View {
    public let title: String
    public let value: String
    public let iconName: String
    public let iconColor: Color
    public var subtitle: String? = nil
    public var trend: String? = nil

    public init(
        title: String,
        value: String,
        iconName: String,
        iconColor: Color,
        subtitle: String? = nil,
        trend: String? = nil
    ) {
        self.title = title
        self.value = value
        self.iconName = iconName
        self.iconColor = iconColor
        self.subtitle = subtitle
        self.trend = trend
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            HStack(alignment: .center) {
                Image(systemName: iconName)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(iconColor)
                    .frame(width: 28, height: 28)
                    .background(iconColor.opacity(0.12), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                Spacer(minLength: 0)
                if let trend {
                    Text(trend)
                        .font(AppTypography.microBold)
                        .foregroundStyle(AppColors.emerald)
                }
            }

            Text(value)
                .font(AppTypography.metricValue)
                .foregroundStyle(.primary)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            Text(title)
                .font(AppTypography.meta)
                .foregroundStyle(.secondary)
                .lineLimit(2)

            if let sub = subtitle {
                Text(sub)
                    .font(AppTypography.micro)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(AppSpacing.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .appSurface()
        .accessibilityElement(children: .combine)
    }
}

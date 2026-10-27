import SwiftUI

public struct StatusPill: View {
    public let status: BookingStatus

    public init(status: BookingStatus) {
        self.status = status
    }

    public var body: some View {
        Label(status.displayName, systemImage: status.iconName)
            .font(AppTypography.microBold)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(AppColors.backgroundColor(forStatus: status.rawValue), in: Capsule())
            .foregroundStyle(AppColors.color(forStatus: status.rawValue))
            .accessibilityLabel(status.displayName)
    }
}

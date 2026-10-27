import SwiftUI

public struct QuickStatsGrid: View {
    @Bindable var bookingsVM: BookingsViewModel
    var siteCount: Int
    @Environment(\.horizontalSizeClass) private var sizeClass

    public init(bookingsVM: BookingsViewModel, siteCount: Int) {
        self.bookingsVM = bookingsVM
        self.siteCount = siteCount
    }

    public var body: some View {
        BBMetricGrid {
            StatCard(
                title: "New Leads",
                value: "\(bookingsVM.newBookingsCount)",
                iconName: "sparkles",
                iconColor: AppColors.amber,
                subtitle: "Action required"
            )

            StatCard(
                title: "Confirmed",
                value: "\(bookingsVM.confirmedBookingsCount)",
                iconName: "checkmark.seal.fill",
                iconColor: AppColors.primary,
                subtitle: "Scheduled"
            )

            StatCard(
                title: "Completed",
                value: "\(bookingsVM.completedBookingsCount)",
                iconName: "checkmark.circle.fill",
                iconColor: AppColors.emerald,
                subtitle: "Done"
            )

            StatCard(
                title: "Sites",
                value: "\(siteCount)",
                iconName: "building.2.fill",
                iconColor: AppColors.violet,
                subtitle: "Connected"
            )
        }
    }
}

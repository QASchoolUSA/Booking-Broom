import SwiftUI

public struct QuickStatsGrid: View {
    @Bindable var bookingsVM: BookingsViewModel
    var siteCount: Int
    
    public init(bookingsVM: BookingsViewModel, siteCount: Int) {
        self.bookingsVM = bookingsVM
        self.siteCount = siteCount
    }
    
    private var columns: [GridItem] {
        #if os(macOS)
        [
            GridItem(.flexible(), spacing: AppSpacing.sm),
            GridItem(.flexible(), spacing: AppSpacing.sm),
            GridItem(.flexible(), spacing: AppSpacing.sm),
            GridItem(.flexible(), spacing: AppSpacing.sm)
        ]
        #else
        [
            GridItem(.flexible(), spacing: AppSpacing.sm),
            GridItem(.flexible(), spacing: AppSpacing.sm)
        ]
        #endif
    }
    
    public var body: some View {
        LazyVGrid(columns: columns, spacing: AppSpacing.sm) {
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

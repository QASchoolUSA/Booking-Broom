import SwiftUI

public struct DashboardView: View {
    @Bindable var bookingsVM: BookingsViewModel
    @Bindable var messagesVM: MessagesViewModel
    @Bindable var opsVM: OpsViewModel
    @Bindable var perfVM: PerformanceViewModel
    @Bindable var settingsVM: SettingsViewModel
    @Bindable var authVM: AuthViewModel
    @Environment(AppController.self) private var appController
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var showingCreateBookingSheet = false
    
    public init(
        bookingsVM: BookingsViewModel,
        messagesVM: MessagesViewModel,
        opsVM: OpsViewModel,
        perfVM: PerformanceViewModel,
        settingsVM: SettingsViewModel,
        authVM: AuthViewModel
    ) {
        self.bookingsVM = bookingsVM
        self.messagesVM = messagesVM
        self.opsVM = opsVM
        self.perfVM = perfVM
        self.settingsVM = settingsVM
        self.authVM = authVM
    }
    
    private var showsMoreSection: Bool {
        #if os(macOS)
        false
        #else
        sizeClass != .regular
        #endif
    }
    
    private var liveSiteCount: Int {
        let fromBookings = bookingsVM.sites.count
        if fromBookings > 0 { return fromBookings }
        let fromHealth = opsVM.sitesHealth.count
        if fromHealth > 0 { return fromHealth }
        return opsVM.sitePricingList.count
    }
    
    public var body: some View {
        NavigationStack {
            ScrollView {
                BBWidePage {
                    VStack(alignment: .leading, spacing: AppSpacing.xl) {
                        QuickStatsGrid(bookingsVM: bookingsVM, siteCount: liveSiteCount)

                        BBSection("Recent Bookings") {
                            #if os(iOS)
                            NavigationLink(destination: BookingsListView(bookingsVM: bookingsVM, messagesVM: messagesVM)) {
                                Text("See All (\(bookingsVM.bookings.count))")
                                    .font(AppTypography.metaBold)
                            }
                            .frame(maxWidth: .infinity, alignment: .trailing)
                            #else
                            Button("See All (\(bookingsVM.bookings.count))") {
                                appController.select(.bookings)
                            }
                            .font(AppTypography.metaBold)
                            .buttonStyle(.plain)
                            .foregroundStyle(AppColors.primary)
                            .frame(maxWidth: .infinity, alignment: .trailing)
                            #endif

                            LazyVStack(spacing: AppSpacing.sm) {
                                ForEach(bookingsVM.bookings.prefix(3)) { booking in
                                    BookingCardView(
                                        booking: booking,
                                        bookingsVM: bookingsVM,
                                        messagesVM: messagesVM,
                                        onStatusChange: { newStatus in
                                            bookingsVM.updateStatus(booking: booking, newStatus: newStatus)
                                        }
                                    )
                                }
                            }
                        }

                        BBSection("Recent SMS") {
                            #if os(iOS)
                            NavigationLink(destination: MessagesInboxView(messagesVM: messagesVM)) {
                                Text("Open Inbox")
                                    .font(AppTypography.metaBold)
                            }
                            .frame(maxWidth: .infinity, alignment: .trailing)
                            #else
                            Button("Open Inbox") {
                                appController.select(.messages)
                            }
                            .font(AppTypography.metaBold)
                            .buttonStyle(.plain)
                            .foregroundStyle(AppColors.primary)
                            .frame(maxWidth: .infinity, alignment: .trailing)
                            #endif

                            LazyVStack(spacing: AppSpacing.xs) {
                                ForEach(messagesVM.threads.prefix(2)) { thread in
                                    HStack(spacing: AppSpacing.sm) {
                                        ContactAvatar(
                                            title: thread.contactName ?? thread.contact,
                                            tint: AppColors.primary,
                                            size: 40
                                        )

                                        VStack(alignment: .leading, spacing: 2) {
                                            HStack {
                                                Text(thread.contactName ?? thread.contact)
                                                    .font(AppTypography.rowTitle)
                                                Spacer()
                                                Text(thread.lastMessage.sentAt, style: .time)
                                                    .font(AppTypography.micro)
                                                    .foregroundStyle(.secondary)
                                            }
                                            Text(thread.lastMessage.body)
                                                .font(AppTypography.meta)
                                                .foregroundStyle(.secondary)
                                                .lineLimit(1)
                                        }
                                    }
                                    .padding(AppSpacing.sm)
                                    .appSurface()
                                }
                            }
                        }

                        if showsMoreSection {
                            BBSection("More") {
                                VStack(spacing: AppSpacing.xs) {
                                    NavigationLink(destination: SitesHealthView(opsVM: opsVM)) {
                                        DashboardMoreRow(
                                            title: "Sites Health",
                                            subtitle: "Hosting, uptime, and infrastructure",
                                            iconName: "globe",
                                            iconColor: AppColors.primary
                                        )
                                    }
                                    NavigationLink(destination: DeploymentsView(deploymentsVM: appController.deploymentsVM)) {
                                        DashboardMoreRow(
                                            title: "Deploys",
                                            subtitle: "Workers Builds and free-tier usage",
                                            iconName: "cloud.fill",
                                            iconColor: AppColors.sky
                                        )
                                    }
                                    NavigationLink(destination: PerformanceDashboardView(perfVM: perfVM)) {
                                        DashboardMoreRow(
                                            title: "PageSpeed",
                                            subtitle: "Lighthouse and Core Web Vitals",
                                            iconName: "gauge.with.needle.fill",
                                            iconColor: AppColors.emerald
                                        )
                                    }
                                    NavigationLink(destination: PricingOpsView(opsVM: opsVM)) {
                                        DashboardMoreRow(
                                            title: "Live Pricing",
                                            subtitle: "Edit site rates that websites pull live",
                                            iconName: "dollarsign.circle.fill",
                                            iconColor: AppColors.amber
                                        )
                                    }
                                    NavigationLink(destination: SettingsView(settingsVM: settingsVM, authVM: authVM, opsVM: opsVM)) {
                                        DashboardMoreRow(
                                            title: "Settings",
                                            subtitle: "Account, notifications, and security",
                                            iconName: "gearshape.fill",
                                            iconColor: .secondary
                                        )
                                    }
                                }
                            }
                        }
                    }
                    .padding(.vertical, AppSpacing.md)
                }
            }
            .bbPageBackground()
            .navigationTitle("Dashboard")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingCreateBookingSheet = true
                    } label: {
                        Label("New Booking", systemImage: "plus")
                    }
                }
                ToolbarItem(placement: .primaryAction) {
                    NavigationLink(destination: SettingsView(settingsVM: settingsVM, authVM: authVM, opsVM: opsVM)) {
                        Image(systemName: "gearshape")
                    }
                }
            }
            #endif
            .refreshable {
                // Convex reads only — spinner tracks the real round-trips.
                async let bookings: Void = bookingsVM.loadBookingsAndWait()
                async let messages: Void = messagesVM.loadMessagesAndWait()
                async let health: Void = opsVM.loadHealthAndWait()
                _ = await (bookings, messages, health)
            }
            .onAppear {
                // Sites ride along with ensureBookingsLoaded(); every ensure* is
                // staleness-gated (5 min) so re-appearing costs nothing.
                bookingsVM.ensureBookingsLoaded()
                messagesVM.ensureLoaded()
                opsVM.ensureHealthLoaded()
            }
            .sheet(isPresented: $showingCreateBookingSheet) {
                CreateBookingSheet(bookingsVM: bookingsVM)
            }
        }
    }
}

private struct DashboardMoreRow: View {
    let title: String
    let subtitle: String
    let iconName: String
    let iconColor: Color
    
    var body: some View {
        HStack(spacing: AppSpacing.sm) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(iconColor.opacity(0.14))
                    .frame(width: 40, height: 40)
                Image(systemName: iconName)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(iconColor)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(AppTypography.rowTitle)
                    .foregroundStyle(.primary)
                Text(subtitle)
                    .font(AppTypography.meta)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(AppTypography.microBold)
                .foregroundStyle(.tertiary)
        }
        .padding(AppSpacing.sm)
        .appSurface()
    }
}

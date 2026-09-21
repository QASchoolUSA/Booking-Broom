import SwiftUI

public enum AppSidebarItem: String, Hashable, CaseIterable, Identifiable {
    case dashboard
    case bookings
    case messages
    case email
    case pricing
    case seo
    case health
    case deploys
    case speed
    case settings
    
    public var id: String { rawValue }
    
    var title: String {
        switch self {
        case .dashboard: return "Dashboard"
        case .bookings: return "Bookings"
        case .messages: return "Messages"
        case .email: return "Email"
        case .pricing: return "Pricing"
        case .seo: return "SEO"
        case .health: return "Sites Health"
        case .deploys: return "Deploys"
        case .speed: return "PageSpeed"
        case .settings: return "Settings"
        }
    }
    
    var systemImage: String {
        switch self {
        case .dashboard: return "rectangle.grid.2x2"
        case .bookings: return "calendar"
        case .messages: return "bubble.left.and.bubble.right"
        case .email: return "envelope"
        case .pricing: return "dollarsign.circle"
        case .seo: return "chart.xyaxis.line"
        case .health: return "globe"
        case .deploys: return "cloud"
        case .speed: return "gauge.with.needle"
        case .settings: return "gearshape"
        }
    }
}

public struct MainTabView: View {
    @Bindable var authVM: AuthViewModel
    @Bindable var appController: AppController
    @Environment(\.horizontalSizeClass) private var sizeClass
    
    @State private var selectedTab = 0
    @SceneStorage("bb.sidebarSelection") private var sidebarSelectionRaw: String = AppSidebarItem.dashboard.rawValue
    
    private var sidebarSelection: Binding<AppSidebarItem?> {
        Binding(
            get: {
                #if os(macOS)
                appController.sidebarSelection
                #else
                AppSidebarItem(rawValue: sidebarSelectionRaw) ?? .dashboard
                #endif
            },
            set: { newValue in
                let value = newValue ?? .dashboard
                #if os(macOS)
                appController.sidebarSelection = value
                #else
                sidebarSelectionRaw = value.rawValue
                #endif
            }
        )
    }
    
    public init(authVM: AuthViewModel, appController: AppController) {
        self.authVM = authVM
        self.appController = appController
    }
    
    public var body: some View {
        Group {
            #if os(macOS)
            macSplitShell
            #else
            if sizeClass == .regular {
                iPadSplitShell
            } else {
                iPhoneTabShell
            }
            #endif
        }
        .tint(AppColors.primary)
        .sheet(isPresented: $appController.showingNewBooking) {
            CreateBookingSheet(bookingsVM: appController.bookingsVM)
        }
    }
    
    #if os(iOS)
    private var iPhoneTabShell: some View {
        TabView(selection: $selectedTab) {
            DashboardView(
                bookingsVM: appController.bookingsVM,
                messagesVM: appController.messagesVM,
                opsVM: appController.opsVM,
                perfVM: appController.perfVM,
                settingsVM: appController.settingsVM,
                authVM: authVM
            )
            .tabItem { Label("Dashboard", systemImage: AppSidebarItem.dashboard.systemImage) }
            .tag(0)
            
            NavigationStack {
                BookingsListView(bookingsVM: appController.bookingsVM, messagesVM: appController.messagesVM)
            }
            .tabItem { Label("Bookings", systemImage: AppSidebarItem.bookings.systemImage) }
            .badge(appController.bookingsVM.newBookingsCount > 0 ? appController.bookingsVM.newBookingsCount : 0)
            .tag(1)
            
            MessagesInboxView(messagesVM: appController.messagesVM)
                .tabItem { Label("Messages", systemImage: AppSidebarItem.messages.systemImage) }
                .tag(2)
            
            EmailInboxView(emailVM: appController.emailVM)
                .tabItem { Label("Email", systemImage: AppSidebarItem.email.systemImage) }
                .badge(appController.emailVM.totalUnreadCount > 0 ? appController.emailVM.totalUnreadCount : 0)
                .tag(3)
            
            NavigationStack {
                MoreHubView(
                    opsVM: appController.opsVM,
                    seoVM: appController.seoVM,
                    perfVM: appController.perfVM,
                    deploymentsVM: appController.deploymentsVM,
                    settingsVM: appController.settingsVM,
                    authVM: authVM
                )
            }
            .tabItem { Label("More", systemImage: "ellipsis.circle") }
            .tag(4)
        }
    }
    
    private var iPadSplitShell: some View {
        NavigationSplitView {
            sidebarList
                .navigationTitle("Booking Broom")
                .listStyle(.sidebar)
        } detail: {
            detailView(for: AppSidebarItem(rawValue: sidebarSelectionRaw) ?? .dashboard)
        }
        .navigationSplitViewStyle(.balanced)
    }
    #endif
    
    #if os(macOS)
    private var macSplitShell: some View {
        NavigationSplitView {
            sidebarList
                .navigationSplitViewColumnWidth(min: 200, ideal: 220, max: 280)
        } detail: {
            detailView(for: appController.sidebarSelection)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .navigationSplitViewStyle(.balanced)
        .background(AppColors.groupedBackground)
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                Button {
                    appController.syncCurrent()
                } label: {
                    Label("Sync", systemImage: "arrow.clockwise")
                }
                .keyboardShortcut("r", modifiers: .command)
                .help("Refresh current section")
                
                if appController.sidebarSelection == .bookings || appController.sidebarSelection == .dashboard {
                    Button {
                        appController.showingNewBooking = true
                    } label: {
                        Label("New Booking", systemImage: "plus")
                    }
                    .keyboardShortcut("n", modifiers: .command)
                }
            }
        }
    }
    #endif
    
    private var sidebarList: some View {
        List(selection: sidebarSelection) {
            Section("Work") {
                sidebarRow(.dashboard)
                sidebarRow(.bookings, badge: appController.bookingsVM.newBookingsCount)
                sidebarRow(.messages)
                sidebarRow(.email, badge: appController.emailVM.totalUnreadCount)
            }
            
            Section("Sites") {
                sidebarRow(.pricing)
                sidebarRow(.seo)
                sidebarRow(.health)
                sidebarRow(.deploys)
                sidebarRow(.speed)
            }
            
            Section("Account") {
                sidebarRow(.settings)
            }
        }
        .listStyle(.sidebar)
        #if os(macOS)
        .navigationTitle("Booking Broom")
        #endif
    }
    
    @ViewBuilder
    private func sidebarRow(_ item: AppSidebarItem, badge: Int = 0) -> some View {
        Label(item.title, systemImage: item.systemImage)
            .badge(badge > 0 ? badge : 0)
            .tag(item)
    }
    
    @ViewBuilder
    private func detailView(for item: AppSidebarItem) -> some View {
        switch item {
        case .dashboard:
            DashboardView(
                bookingsVM: appController.bookingsVM,
                messagesVM: appController.messagesVM,
                opsVM: appController.opsVM,
                perfVM: appController.perfVM,
                settingsVM: appController.settingsVM,
                authVM: authVM
            )
        case .bookings:
            NavigationStack {
                BookingsListView(bookingsVM: appController.bookingsVM, messagesVM: appController.messagesVM)
            }
        case .messages:
            MessagesInboxView(messagesVM: appController.messagesVM)
        case .email:
            EmailInboxView(emailVM: appController.emailVM)
        case .pricing:
            NavigationStack {
                PricingOpsView(opsVM: appController.opsVM)
            }
        case .seo:
            NavigationStack {
                SEODashboardView(seoVM: appController.seoVM)
            }
        case .health:
            NavigationStack {
                SitesHealthView(opsVM: appController.opsVM)
            }
        case .deploys:
            NavigationStack {
                DeploymentsView(deploymentsVM: appController.deploymentsVM)
            }
        case .speed:
            NavigationStack {
                PerformanceDashboardView(perfVM: appController.perfVM)
            }
        case .settings:
            NavigationStack {
                SettingsView(
                    settingsVM: appController.settingsVM,
                    authVM: authVM,
                    opsVM: appController.opsVM
                )
            }
        }
    }
}

/// Compact “More” hub for iPhone tab bar.
public struct MoreHubView: View {
    @Bindable var opsVM: OpsViewModel
    @Bindable var seoVM: SEOViewModel
    @Bindable var perfVM: PerformanceViewModel
    @Bindable var deploymentsVM: DeploymentsViewModel
    @Bindable var settingsVM: SettingsViewModel
    @Bindable var authVM: AuthViewModel
    
    public var body: some View {
        List {
            Section("Sites") {
                NavigationLink {
                    PricingOpsView(opsVM: opsVM)
                } label: {
                    Label("Live Pricing", systemImage: "dollarsign.circle")
                }
                NavigationLink {
                    SEODashboardView(seoVM: seoVM)
                } label: {
                    Label("SEO", systemImage: "chart.xyaxis.line")
                }
                NavigationLink {
                    SitesHealthView(opsVM: opsVM)
                } label: {
                    Label("Sites Health", systemImage: "globe")
                }
                NavigationLink {
                    DeploymentsView(deploymentsVM: deploymentsVM)
                } label: {
                    Label("Deploys", systemImage: "cloud")
                }
                NavigationLink {
                    PerformanceDashboardView(perfVM: perfVM)
                } label: {
                    Label("PageSpeed", systemImage: "gauge.with.needle")
                }
            }
            
            Section("Account") {
                NavigationLink {
                    SettingsView(settingsVM: settingsVM, authVM: authVM, opsVM: opsVM)
                } label: {
                    Label("Settings", systemImage: "gearshape")
                }
            }
        }
        .navigationTitle("More")
    }
}

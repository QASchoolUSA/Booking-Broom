import SwiftUI
import Combine

/// Shared session state for Mac menus / Settings scene and the main shell.
@MainActor
public final class AppController: ObservableObject {
    @Published public var sidebarSelection: AppSidebarItem = .dashboard
    @Published public var showingNewBooking = false
    @Published public var pendingPushBookingId: String?
    
    public let bookingsVM = BookingsViewModel()
    public let messagesVM = MessagesViewModel()
    public let emailVM = EmailViewModel()
    public let opsVM = OpsViewModel()
    public let seoVM = SEOViewModel()
    public let perfVM = PerformanceViewModel()
    public let deploymentsVM = DeploymentsViewModel()
    public let settingsVM = SettingsViewModel()
    
    private var lastForegroundRefreshAt: Date?
    private let foregroundRefreshDebounce: TimeInterval = 2
    
    public init() {}
    
    public func select(_ item: AppSidebarItem) {
        sidebarSelection = item
    }
    
    /// Clear sticky ViewModel state and force a fresh Convex reload after login / Face ID unlock.
    public func resetAndReloadForSession() {
        ConvexAPIService.shared.invalidateSitesCache()
        bookingsVM.resetForNewSession()
        messagesVM.resetForNewSession()
        emailVM.resetForNewSession()
        opsVM.resetForNewSession()
        seoVM.resetForNewSession()
        perfVM.resetForNewSession()
        deploymentsVM.resetForNewSession()
        settingsVM.resetForNewSession()
        
        bookingsVM.ensureBookingsLoaded()
        messagesVM.ensureLoaded()
        emailVM.ensureLoaded()
        opsVM.ensureHealthLoaded()
        opsVM.ensurePricingLoaded()
        seoVM.ensureLoaded()
        perfVM.ensureLoaded()
        deploymentsVM.ensureLoaded()
        settingsVM.ensureLoaded()
    }
    
    /// Drop in-memory lists on logout so the next unlock cannot flash stale demo/live data.
    public func clearSessionData() {
        ConvexAPIService.shared.invalidateSitesCache()
        bookingsVM.resetForNewSession()
        messagesVM.resetForNewSession()
        emailVM.resetForNewSession()
        opsVM.resetForNewSession()
        seoVM.resetForNewSession()
        perfVM.resetForNewSession()
        deploymentsVM.resetForNewSession()
        settingsVM.resetForNewSession()
        lastForegroundRefreshAt = nil
    }
    
    /// Refetch live lists when the app returns to the foreground (debounced).
    public func refreshOnForeground() {
        let now = Date()
        if let last = lastForegroundRefreshAt,
           now.timeIntervalSince(last) < foregroundRefreshDebounce {
            return
        }
        lastForegroundRefreshAt = now
        bookingsVM.loadBookings()
        messagesVM.loadMessages()
        emailVM.loadMailboxes()
    }
    
    public func openBookingFromPush(bookingId: String?) {
        guard let bookingId, !bookingId.isEmpty else {
            select(.bookings)
            return
        }
        pendingPushBookingId = bookingId
        select(.bookings)
        Task {
            await bookingsVM.loadBookingsAndWait()
            if let booking = bookingsVM.bookings.first(where: { $0.id == bookingId }) {
                bookingsVM.selectedBooking = booking
            }
            pendingPushBookingId = nil
        }
    }
    
    public func syncCurrent() {
        switch sidebarSelection {
        case .bookings:
            bookingsVM.loadBookings()
        case .messages:
            messagesVM.syncVoipms()
        case .email:
            emailVM.syncCurrentMailbox()
        case .seo:
            seoVM.syncMetrics()
        case .speed:
            perfVM.loadPerformance()
        case .health:
            opsVM.loadHealth()
        case .deploys:
            deploymentsVM.syncNow()
        case .pricing:
            opsVM.loadPricing()
        default:
            bookingsVM.loadBookings()
            messagesVM.loadMessages()
        }
    }
}

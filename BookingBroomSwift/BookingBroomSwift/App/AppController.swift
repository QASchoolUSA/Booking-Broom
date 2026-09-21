import SwiftUI
import Observation

/// Shared session state for Mac menus / Settings scene and the main shell.
@MainActor
@Observable
public final class AppController {
    public var sidebarSelection: AppSidebarItem = .dashboard
    public var showingNewBooking = false
    public var pendingPushBookingId: String?
    
    @ObservationIgnored public let bookingsVM = BookingsViewModel()
    @ObservationIgnored public let messagesVM = MessagesViewModel()
    @ObservationIgnored public let emailVM = EmailViewModel()
    @ObservationIgnored public let opsVM = OpsViewModel()
    @ObservationIgnored public let seoVM = SEOViewModel()
    @ObservationIgnored public let perfVM = PerformanceViewModel()
    @ObservationIgnored public let deploymentsVM = DeploymentsViewModel()
    @ObservationIgnored public let settingsVM = SettingsViewModel()
    
    @ObservationIgnored private var lastForegroundRefreshAt: Date?
    /// Returning from the background within this window costs zero Convex calls.
    @ObservationIgnored private let foregroundRefreshDebounce: TimeInterval = 30
    
    public init() {}
    
    public func select(_ item: AppSidebarItem) {
        sidebarSelection = item
    }
    
    /// Clear sticky ViewModel state after login / Face ID unlock, then load only
    /// what the first screen needs (bookings + sites). Every other tab loads
    /// itself lazily via `ensure*Loaded()` in its root view's `onAppear`.
    public func resetAndReloadForSession() {
        Task { await ConvexAPIService.shared.invalidateSitesCache() }
        resetAllViewModels()
        bookingsVM.ensureBookingsLoaded()
    }
    
    /// Drop in-memory lists on logout so the next unlock cannot flash stale demo/live data.
    public func clearSessionData() {
        Task { await ConvexAPIService.shared.invalidateSitesCache() }
        resetAllViewModels()
        lastForegroundRefreshAt = nil
    }
    
    private func resetAllViewModels() {
        bookingsVM.resetForNewSession()
        messagesVM.resetForNewSession()
        emailVM.resetForNewSession()
        opsVM.resetForNewSession()
        seoVM.resetForNewSession()
        perfVM.resetForNewSession()
        deploymentsVM.resetForNewSession()
        settingsVM.resetForNewSession()
    }
    
    /// Refetch when the app returns to the foreground: bookings (if stale) plus
    /// the data behind the currently visible tab. Debounced to 30 s.
    public func refreshOnForeground() {
        let now = Date()
        if let last = lastForegroundRefreshAt,
           now.timeIntervalSince(last) < foregroundRefreshDebounce {
            return
        }
        lastForegroundRefreshAt = now
        bookingsVM.refreshIfStale(olderThan: 60)
        
        switch sidebarSelection {
        case .messages:
            messagesVM.refreshIfStale(olderThan: 60)
        case .email:
            emailVM.refreshIfStale(olderThan: 60)
        case .dashboard:
            messagesVM.refreshIfStale(olderThan: 60)
        default:
            break
        }
    }
    
    /// A booking push arrived while the app was active — only bookings can have changed.
    public func refreshForForegroundPush() {
        bookingsVM.refreshIfStale(olderThan: 5)
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
    
    /// ⌘R / toolbar Sync — the one place external-provider syncs are triggered.
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
            perfVM.runAudits()
        case .health:
            opsVM.checkHealthNow()
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

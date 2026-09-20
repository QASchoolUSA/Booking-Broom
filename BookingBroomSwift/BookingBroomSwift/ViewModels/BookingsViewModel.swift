import Foundation
import Combine

public enum BookingsViewMode: String, CaseIterable {
    case list = "list"
    case calendar = "calendar"
}

public enum BookingsFilterMode: String, CaseIterable {
    case active = "Active bookings"
    case archived = "Archived"
    case abandoned = "Abandoned"
}

@MainActor
public final class BookingsViewModel: ObservableObject {
    @Published public var bookings: [Booking] = []
    @Published public var partialLeads: [PartialLead] = []
    @Published public var sites: [CleaningSite] = []
    @Published public var selectedSiteId: String? = nil // nil = All sites
    @Published public var selectedStatus: BookingStatus? = nil // nil = All status
    @Published public var searchText: String = ""
    @Published public var isLoading: Bool = false
    @Published public var selectedBooking: Booking? = nil
    @Published public var selectedPartialLead: PartialLead? = nil
    
    // Calendar & View Modes
    @Published public var viewMode: BookingsViewMode = .list
    @Published public var filterMode: BookingsFilterMode = .active
    @Published public var calendarEvents: [CalendarEvent] = [] {
        didSet { rebuildEventsByDay() }
    }
    @Published public var reminders: [ReminderItem] = []
    @Published public var calendarCursor: Date = Date()
    @Published public var selectedCalendarDay: Date = Date()
    @Published public var showingAddReminderModal: Bool = false
    @Published public var reminderInitialDate: Date? = nil
    @Published public var reminderInitialBookingId: String? = nil
    @Published public var loadError: String? = nil
    
    /// Precomputed day → events map (avoids O(days × events) filters in the calendar UI).
    public private(set) var eventsByDay: [Date: [CalendarEvent]] = [:]
    
    private var didLoadBookings = false
    private var didLoadCalendar = false

    private func bookingsCacheURL(includeArchived: Bool) -> URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(
                includeArchived ? "bb_bookings_archived.json" : "bb_bookings_active.json"
            )
    }

    private var partialLeadsCacheURL: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("bb_partial_leads.json")
    }

    private func readCachedBookings(includeArchived: Bool) -> [Booking]? {
        let url = bookingsCacheURL(includeArchived: includeArchived)
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode([Booking].self, from: data)
    }

    private func writeCachedBookings(_ bookings: [Booking], includeArchived: Bool) {
        let url = bookingsCacheURL(includeArchived: includeArchived)
        guard let data = try? JSONEncoder().encode(bookings) else { return }
        try? data.write(to: url, options: [.atomic])
    }

    private func readCachedPartialLeads() -> [PartialLead]? {
        guard let data = try? Data(contentsOf: partialLeadsCacheURL) else { return nil }
        return try? JSONDecoder().decode([PartialLead].self, from: data)
    }

    private func writeCachedPartialLeads(_ leads: [PartialLead]) {
        guard let data = try? JSONEncoder().encode(leads) else { return }
        try? data.write(to: partialLeadsCacheURL, options: [.atomic])
    }
    
    public init() {}
    
    public func ensureBookingsLoaded() {
        guard !didLoadBookings else { return }
        didLoadBookings = true
        loadBookings()
        loadSites()
    }
    
    public func resetForNewSession() {
        didLoadBookings = false
        didLoadCalendar = false
        bookings = []
        partialLeads = []
        sites = []
        selectedSiteId = nil
        selectedStatus = nil
        searchText = ""
        selectedBooking = nil
        selectedPartialLead = nil
        calendarEvents = []
        reminders = []
        loadError = nil
        isLoading = false
        clearDiskCaches()
    }
    
    private func clearDiskCaches() {
        let fm = FileManager.default
        try? fm.removeItem(at: bookingsCacheURL(includeArchived: false))
        try? fm.removeItem(at: bookingsCacheURL(includeArchived: true))
        try? fm.removeItem(at: partialLeadsCacheURL)
    }
    
    public func ensureCalendarLoaded() {
        guard !didLoadCalendar else {
            loadCalendarEvents()
            return
        }
        didLoadCalendar = true
        loadCalendarEvents()
        loadReminders()
    }
    
    public func loadSites() {
        Task {
            do {
                self.sites = try await ConvexAPIService.shared.fetchSites()
            } catch {
                // Keep existing sites; never inject demo sites in live mode.
                if self.sites.isEmpty {
                    self.sites = []
                }
            }
        }
    }
    
    public func loadBookings() {
        Task { await loadBookingsAndWait() }
    }
    
    /// Fetch bookings and wait until the network round-trip finishes (used by push open).
    public func loadBookingsAndWait() async {
        if filterMode == .abandoned {
            await loadPartialLeadsAndWait()
            return
        }

        isLoading = true
        loadError = nil
        let includeArchived = (filterMode == .archived)
        // Instant paint from on-device cache; Convex remains source of truth.
        if let cached = readCachedBookings(includeArchived: includeArchived), !cached.isEmpty {
            self.bookings = cached
            self.isLoading = false
        }
        do {
            let fresh = try await ConvexAPIService.shared.fetchBookings(includeArchived: includeArchived)
            self.bookings = fresh
            self.writeCachedBookings(fresh, includeArchived: includeArchived)
            self.loadError = nil
        } catch {
            if self.bookings.isEmpty {
                self.bookings = []
                self.loadError = error.localizedDescription
            }
            // Keep cached bookings visible if refresh fails.
        }
        self.isLoading = false
    }

    public func loadPartialLeads() {
        Task { await loadPartialLeadsAndWait() }
    }
    
    public func loadPartialLeadsAndWait() async {
        isLoading = true
        loadError = nil
        if let cached = readCachedPartialLeads(), !cached.isEmpty {
            self.partialLeads = cached
            self.isLoading = false
        }
        let siteSlug: String? = {
            guard let selectedSiteId else { return nil }
            return sites.first(where: { $0.id == selectedSiteId })?.slug
        }()
        do {
            let fresh = try await ConvexAPIService.shared.fetchPartialLeads(siteSlug: siteSlug)
            self.partialLeads = fresh
            self.writeCachedPartialLeads(fresh)
            self.loadError = nil
        } catch {
            if self.partialLeads.isEmpty {
                self.partialLeads = []
                self.loadError = error.localizedDescription
            }
        }
        self.isLoading = false
    }
    
    public func setFilterMode(_ mode: BookingsFilterMode) {
        self.filterMode = mode
        if mode == .abandoned {
            selectedStatus = nil
            if viewMode == .calendar {
                viewMode = .list
            }
        }
        loadBookings()
    }
    
    public func loadCalendarEvents() {
        let calendar = Calendar.current
        let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: calendarCursor)) ?? calendarCursor
        let endOfMonth = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: startOfMonth) ?? calendarCursor
        
        let startMs = startOfMonth.timeIntervalSince1970 * 1000
        let endMs = endOfMonth.addingTimeInterval(86400).timeIntervalSince1970 * 1000
        
        Task {
            let evs = (try? await ConvexAPIService.shared.fetchCalendarEvents(startAt: startMs, endAt: endMs)) ?? []
            self.calendarEvents = evs
        }
    }
    
    public func loadReminders(bookingId: String? = nil) {
        Task {
            // Never inject demo reminders when the live call fails.
            self.reminders = (try? await ConvexAPIService.shared.fetchReminders(bookingId: bookingId)) ?? []
        }
    }
    
    private func rebuildEventsByDay() {
        let calendar = Calendar.current
        var map: [Date: [CalendarEvent]] = [:]
        for event in calendarEvents {
            let key = calendar.startOfDay(for: event.startDate)
            map[key, default: []].append(event)
        }
        eventsByDay = map
    }
    
    public var filteredBookings: [Booking] {
        bookings.filter { booking in
            let matchesSite: Bool = {
                guard let selected = selectedSiteId else { return true }
                if booking.siteId == selected { return true }
                if let site = sites.first(where: { $0.id == selected }) {
                    return booking.siteSlug == site.slug || booking.siteId == site.id
                }
                return booking.siteSlug == selected
            }()
            let matchesStatus = selectedStatus == nil || booking.status == selectedStatus
            let matchesSearch = searchText.isEmpty ||
                booking.customerName.localizedCaseInsensitiveContains(searchText) ||
                booking.siteName.localizedCaseInsensitiveContains(searchText) ||
                booking.serviceType.localizedCaseInsensitiveContains(searchText) ||
                (booking.email?.localizedCaseInsensitiveContains(searchText) ?? false) ||
                (booking.phone?.localizedCaseInsensitiveContains(searchText) ?? false) ||
                (booking.address?.localizedCaseInsensitiveContains(searchText) ?? false)
            
            return matchesSite && matchesStatus && matchesSearch
        }
    }

    public var filteredPartialLeads: [PartialLead] {
        partialLeads.filter { lead in
            let matchesSite: Bool = {
                guard let selected = selectedSiteId else { return true }
                if lead.siteId == selected { return true }
                if let site = sites.first(where: { $0.id == selected }) {
                    return lead.siteSlug == site.slug || lead.siteId == site.id
                }
                return lead.siteSlug == selected
            }()
            let matchesSearch = searchText.isEmpty ||
                lead.displayName.localizedCaseInsensitiveContains(searchText) ||
                lead.siteName.localizedCaseInsensitiveContains(searchText) ||
                (lead.serviceType?.localizedCaseInsensitiveContains(searchText) ?? false) ||
                (lead.email?.localizedCaseInsensitiveContains(searchText) ?? false) ||
                (lead.phone?.localizedCaseInsensitiveContains(searchText) ?? false) ||
                (lead.address?.localizedCaseInsensitiveContains(searchText) ?? false) ||
                (lead.lastStep?.localizedCaseInsensitiveContains(searchText) ?? false)
            return matchesSite && matchesSearch
        }
    }
    
    public var newBookingsCount: Int {
        bookings.filter { $0.status == .new }.count
    }
    
    public var confirmedBookingsCount: Int {
        bookings.filter { $0.status == .confirmed || $0.status == .assigned }.count
    }
    
    public var completedBookingsCount: Int {
        bookings.filter { $0.status == .completed }.count
    }
    
    /// Total bookings used for site filter chip counts (current list mode payload).
    public var totalBookingCountForFilters: Int {
        if filterMode == .abandoned {
            return partialLeads.count
        }
        return bookings.count
    }
    
    public func bookingCount(forSiteId siteId: String) -> Int {
        if filterMode == .abandoned {
            return partialLeads.filter { lead in
                if lead.siteId == siteId { return true }
                if let site = sites.first(where: { $0.id == siteId }) {
                    return lead.siteSlug == site.slug || lead.siteId == site.id
                }
                return lead.siteSlug == siteId
            }.count
        }
        return bookings.filter { booking in
            if booking.siteId == siteId { return true }
            if let site = sites.first(where: { $0.id == siteId }) {
                return booking.siteSlug == site.slug || booking.siteId == site.id
            }
            return booking.siteSlug == siteId
        }.count
    }
    
    public func siteFilterTitle(for site: CleaningSite) -> String {
        "\(site.name) (\(bookingCount(forSiteId: site.id)))"
    }
    
    public var allSitesFilterTitle: String {
        "All Sites (\(totalBookingCountForFilters))"
    }
    
    public func updateStatus(booking: Booking, newStatus: BookingStatus) {
        guard let index = bookings.firstIndex(where: { $0.id == booking.id }) else { return }
        bookings[index].status = newStatus
        bookings[index].updatedAt = Date()
        
        Task {
            _ = try? await ConvexAPIService.shared.updateBookingStatus(bookingId: booking.id, newStatus: newStatus)
        }
        HapticFeedback.notification(.success)
    }
    
    public func scheduleBooking(
        booking: Booking,
        scheduledStartAt: Date,
        scheduledEndAt: Date,
        timezone: String = "America/New_York",
        confirm: Bool = true,
        alertOffsetsMinutes: [Int] = [1440, 60]
    ) {
        let startMs = scheduledStartAt.timeIntervalSince1970 * 1000
        let endMs = scheduledEndAt.timeIntervalSince1970 * 1000
        
        if let idx = bookings.firstIndex(where: { $0.id == booking.id }) {
            bookings[idx].scheduledStartAt = scheduledStartAt
            bookings[idx].scheduledEndAt = scheduledEndAt
            bookings[idx].scheduledStartAtMs = startMs
            bookings[idx].scheduledEndAtMs = endMs
            bookings[idx].timezone = timezone
            if confirm { bookings[idx].status = .confirmed }
        }
        
        Task {
            _ = try? await ConvexAPIService.shared.scheduleBooking(
                bookingId: booking.id,
                scheduledStartAt: startMs,
                scheduledEndAt: endMs,
                timezone: timezone,
                confirm: confirm,
                alertOffsetsMinutes: alertOffsetsMinutes
            )
            self.loadCalendarEvents()
            self.loadReminders()
        }
        HapticFeedback.notification(.success)
    }
    
    public func saveNotes(booking: Booking, notes: String) {
        if let idx = bookings.firstIndex(where: { $0.id == booking.id }) {
            bookings[idx].internalNotes = notes
        }
        Task {
            _ = try? await ConvexAPIService.shared.saveInternalNotes(bookingId: booking.id, notes: notes)
        }
        HapticFeedback.notification(.success)
    }
    
    public func archive(booking: Booking) {
        bookings.removeAll(where: { $0.id == booking.id })
        Task {
            _ = try? await ConvexAPIService.shared.archiveBooking(bookingId: booking.id)
            self.loadCalendarEvents()
        }
        HapticFeedback.notification(.success)
    }
    
    public func unarchive(booking: Booking) {
        bookings.removeAll(where: { $0.id == booking.id })
        Task {
            _ = try? await ConvexAPIService.shared.unarchiveBooking(bookingId: booking.id)
        }
        HapticFeedback.notification(.success)
    }
    
    public func deletePermanently(booking: Booking) {
        bookings.removeAll(where: { $0.id == booking.id })
        Task {
            _ = try? await ConvexAPIService.shared.deleteBookingPermanently(bookingId: booking.id)
            self.loadCalendarEvents()
            self.loadReminders()
        }
        HapticFeedback.notification(.success)
    }
    
    public func createReminder(title: String, notes: String?, dueAt: Date, allDay: Bool, bookingId: String?) {
        let dueMs = dueAt.timeIntervalSince1970 * 1000
        Task {
            _ = try? await ConvexAPIService.shared.createReminder(
                title: title,
                notes: notes,
                dueAt: dueMs,
                allDay: allDay,
                bookingId: bookingId
            )
            self.loadCalendarEvents()
            self.loadReminders(bookingId: bookingId)
        }
        HapticFeedback.notification(.success)
    }
    
    public func removeReminder(reminderId: String) {
        reminders.removeAll(where: { $0.id == reminderId })
        calendarEvents.removeAll(where: { $0.id == "ev_rem_\(reminderId)" || $0.id == reminderId })
        Task {
            _ = try? await ConvexAPIService.shared.removeReminder(reminderId: reminderId)
        }
        HapticFeedback.impact(.light)
    }
    
    public func addBooking(_ booking: Booking) {
        bookings.insert(booking, at: 0)
        Task {
            _ = try? await ConvexAPIService.shared.createBooking(booking)
        }
        NotificationManager.shared.scheduleBookingNotification(booking: booking)
        HapticFeedback.notification(.success)
    }
}

import Foundation
import Observation

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
@Observable
public final class BookingsViewModel {
    // MARK: Source data
    
    public var bookings: [Booking] = [] { didSet { recomputeDerived() } }
    public var partialLeads: [PartialLead] = [] { didSet { recomputeDerived() } }
    public var sites: [CleaningSite] = [] {
        didSet {
            rebuildSiteIndex()
            recomputeDerived()
        }
    }
    
    // MARK: Filters
    
    public var selectedSiteId: String? = nil { didSet { recomputeDerived() } } // nil = All sites
    public var selectedStatus: BookingStatus? = nil { didSet { recomputeDerived() } } // nil = All status
    public var searchText: String = "" { didSet { scheduleSearchRecompute() } }
    
    // MARK: UI state
    
    public var isLoading: Bool = false
    public var selectedBooking: Booking? = nil
    public var selectedPartialLead: PartialLead? = nil
    public var loadError: String? = nil
    /// Transient failure of an optimistic mutation (notes, status, create…).
    public var actionError: String? = nil
    
    // MARK: Calendar & View Modes
    
    public var viewMode: BookingsViewMode = .list
    public private(set) var filterMode: BookingsFilterMode = .active
    public var calendarEvents: [CalendarEvent] = [] {
        didSet { rebuildEventsByDay() }
    }
    /// Upcoming pending reminders across all bookings (`reminders:listPending`).
    public var reminders: [ReminderItem] = []
    /// Per-booking reminders, cached 60 s so re-opening a sheet costs nothing.
    public private(set) var bookingReminders: [String: [ReminderItem]] = [:]
    public var calendarCursor: Date = Date()
    public var selectedCalendarDay: Date = Date()
    public var showingAddReminderModal: Bool = false
    public var reminderInitialDate: Date? = nil
    public var reminderInitialBookingId: String? = nil
    
    // MARK: Derived (stored — recomputed once per input change, not per render)
    
    public private(set) var filteredBookings: [Booking] = []
    public private(set) var filteredPartialLeads: [PartialLead] = []
    public private(set) var countsBySiteId: [String: Int] = [:]
    public private(set) var newBookingsCount: Int = 0
    public private(set) var confirmedBookingsCount: Int = 0
    public private(set) var completedBookingsCount: Int = 0
    /// Total bookings used for site filter chip counts (current list mode payload).
    public private(set) var totalBookingCountForFilters: Int = 0
    /// Precomputed day → events map (avoids O(days × events) filters in the calendar UI).
    public private(set) var eventsByDay: [Date: [CalendarEvent]] = [:]
    /// Optimistic rows whose Convex id is not yet known (detail actions disabled).
    public private(set) var pendingBookingIds: Set<String> = []
    /// temp id → server id, so an open detail sheet can follow the swap.
    public private(set) var resolvedBookingIds: [String: String] = [:]
    
    // MARK: Internals
    
    @ObservationIgnored private var didLoadBookings = false
    @ObservationIgnored private var didLoadCalendar = false
    @ObservationIgnored private var lastBookingsLoadedAt: Date?
    @ObservationIgnored private var lastCalendarLoadedAt: Date?
    @ObservationIgnored private var bookingsLoadGeneration: UInt = 0
    @ObservationIgnored private var searchTask: Task<Void, Never>?
    @ObservationIgnored private var remindersFetchedAt: [String: Date] = [:]
    @ObservationIgnored private var siteById: [String: CleaningSite] = [:]
    @ObservationIgnored private var siteIdBySlug: [String: String] = [:]
    
    @ObservationIgnored private let staleAfter: TimeInterval = 5 * 60
    @ObservationIgnored private let remindersTTL: TimeInterval = 60
    
    public init() {}
    
    // MARK: - Disk cache (never on the main actor)
    
    nonisolated private static func cacheDirectory() -> URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    }
    
    nonisolated private static func bookingsCacheURL(includeArchived: Bool) -> URL {
        cacheDirectory().appendingPathComponent(
            includeArchived ? "bb_bookings_archived.json" : "bb_bookings_active.json"
        )
    }
    
    nonisolated private static var partialLeadsCacheURL: URL {
        cacheDirectory().appendingPathComponent("bb_partial_leads.json")
    }
    
    nonisolated private static func readCachedBookings(includeArchived: Bool) -> [Booking]? {
        guard let data = try? Data(contentsOf: bookingsCacheURL(includeArchived: includeArchived)) else { return nil }
        return try? JSONDecoder().decode([Booking].self, from: data)
    }
    
    nonisolated private static func writeCachedBookings(_ bookings: [Booking], includeArchived: Bool) {
        guard let data = try? JSONEncoder().encode(bookings) else { return }
        try? data.write(to: bookingsCacheURL(includeArchived: includeArchived), options: [.atomic])
    }
    
    nonisolated private static func readCachedPartialLeads() -> [PartialLead]? {
        guard let data = try? Data(contentsOf: partialLeadsCacheURL) else { return nil }
        return try? JSONDecoder().decode([PartialLead].self, from: data)
    }
    
    nonisolated private static func writeCachedPartialLeads(_ leads: [PartialLead]) {
        guard let data = try? JSONEncoder().encode(leads) else { return }
        try? data.write(to: partialLeadsCacheURL, options: [.atomic])
    }
    
    nonisolated private static func clearDiskCaches() {
        let fm = FileManager.default
        try? fm.removeItem(at: bookingsCacheURL(includeArchived: false))
        try? fm.removeItem(at: bookingsCacheURL(includeArchived: true))
        try? fm.removeItem(at: partialLeadsCacheURL)
    }
    
    // MARK: - Lifecycle
    
    /// First call loads bookings + sites; later calls only refetch when stale (5 min).
    public func ensureBookingsLoaded() {
        if !didLoadBookings {
            didLoadBookings = true
            loadBookings()
            loadSites()
            return
        }
        refreshIfStale(olderThan: staleAfter)
    }
    
    public func refreshIfStale(olderThan seconds: TimeInterval) {
        guard didLoadBookings else {
            ensureBookingsLoaded()
            return
        }
        if let last = lastBookingsLoadedAt, Date().timeIntervalSince(last) < seconds { return }
        loadBookings()
    }
    
    public func resetForNewSession() {
        bookingsLoadGeneration &+= 1
        didLoadBookings = false
        didLoadCalendar = false
        lastBookingsLoadedAt = nil
        lastCalendarLoadedAt = nil
        searchTask?.cancel()
        searchTask = nil
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
        bookingReminders = [:]
        remindersFetchedAt = [:]
        pendingBookingIds = []
        resolvedBookingIds = [:]
        loadError = nil
        actionError = nil
        isLoading = false
        Task.detached(priority: .utility) { BookingsViewModel.clearDiskCaches() }
    }
    
    public func ensureCalendarLoaded() {
        if didLoadCalendar,
           let last = lastCalendarLoadedAt,
           Date().timeIntervalSince(last) < staleAfter {
            return
        }
        didLoadCalendar = true
        loadCalendarEvents()
        loadReminders()
    }
    
    // MARK: - Loading
    
    public func loadSites() {
        Task {
            do {
                let fetched = try await ConvexAPIService.shared.fetchSites()
                if fetched != self.sites { self.sites = fetched }
            } catch {
                // Keep existing sites; never inject demo sites in live mode.
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
        
        bookingsLoadGeneration &+= 1
        let generation = bookingsLoadGeneration
        let includeArchived = (filterMode == .archived)
        loadError = nil
        
        // Instant paint from on-device cache on a cold list; Convex remains source of truth.
        if bookings.isEmpty {
            isLoading = true
            let cached = await Task.detached(priority: .userInitiated) {
                BookingsViewModel.readCachedBookings(includeArchived: includeArchived)
            }.value
            guard generation == bookingsLoadGeneration else { return }
            if let cached, !cached.isEmpty, bookings.isEmpty {
                bookings = cached
                isLoading = false
            }
        }
        
        do {
            let fresh = try await ConvexAPIService.shared.fetchBookings(includeArchived: includeArchived)
            guard generation == bookingsLoadGeneration else { return }
            let pendingRows = bookings.filter { pendingBookingIds.contains($0.id) }
            let merged = pendingRows + fresh
            if merged != bookings { bookings = merged }
            lastBookingsLoadedAt = Date()
            loadError = nil
            Task.detached(priority: .utility) {
                BookingsViewModel.writeCachedBookings(fresh, includeArchived: includeArchived)
            }
        } catch let error as ConvexError where error.isCancelled {
            // superseded
        } catch {
            guard generation == bookingsLoadGeneration else { return }
            if bookings.isEmpty {
                loadError = error.localizedDescription
            }
            // Keep cached bookings visible if refresh fails.
        }
        if generation == bookingsLoadGeneration {
            isLoading = false
        }
    }
    
    public func loadPartialLeads() {
        Task { await loadPartialLeadsAndWait() }
    }
    
    public func loadPartialLeadsAndWait() async {
        bookingsLoadGeneration &+= 1
        let generation = bookingsLoadGeneration
        loadError = nil
        
        if partialLeads.isEmpty {
            isLoading = true
            let cached = await Task.detached(priority: .userInitiated) {
                BookingsViewModel.readCachedPartialLeads()
            }.value
            guard generation == bookingsLoadGeneration else { return }
            if let cached, !cached.isEmpty, partialLeads.isEmpty {
                partialLeads = cached
                isLoading = false
            }
        }
        
        let siteSlug: String? = selectedSiteId.flatMap { siteById[$0]?.slug }
        do {
            let fresh = try await ConvexAPIService.shared.fetchPartialLeads(siteSlug: siteSlug)
            guard generation == bookingsLoadGeneration else { return }
            if fresh != partialLeads { partialLeads = fresh }
            lastBookingsLoadedAt = Date()
            loadError = nil
            Task.detached(priority: .utility) {
                BookingsViewModel.writeCachedPartialLeads(fresh)
            }
        } catch let error as ConvexError where error.isCancelled {
            // superseded
        } catch {
            guard generation == bookingsLoadGeneration else { return }
            if partialLeads.isEmpty {
                loadError = error.localizedDescription
            }
        }
        if generation == bookingsLoadGeneration {
            isLoading = false
        }
    }
    
    public func setFilterMode(_ mode: BookingsFilterMode) {
        guard mode != filterMode else {
            loadBookings()
            return
        }
        filterMode = mode
        if mode == .abandoned {
            selectedStatus = nil
            if viewMode == .calendar {
                viewMode = .list
            }
        } else {
            // Active ↔ Archived share the `bookings` array — never show the other list.
            bookings = bookings.filter { pendingBookingIds.contains($0.id) }
        }
        recomputeDerived()
        loadBookings()
    }
    
    public func loadCalendarEvents() {
        Task { await loadCalendarEventsAndWait() }
    }
    
    public func loadCalendarEventsAndWait() async {
        let calendar = Calendar.current
        let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: calendarCursor)) ?? calendarCursor
        let endOfMonth = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: startOfMonth) ?? calendarCursor
        
        let startMs = startOfMonth.timeIntervalSince1970 * 1000
        let endMs = endOfMonth.addingTimeInterval(86400).timeIntervalSince1970 * 1000
        
        do {
            let evs = try await ConvexAPIService.shared.fetchCalendarEvents(startAt: startMs, endAt: endMs)
            if evs != self.calendarEvents { self.calendarEvents = evs }
            self.lastCalendarLoadedAt = Date()
        } catch {
            // Keep whatever is on screen; never inject demo events.
        }
    }
    
    /// Upcoming pending reminders for the calendar (`reminders:listPending`).
    public func loadReminders() {
        Task { await loadRemindersAndWait() }
    }
    
    public func loadRemindersAndWait() async {
        do {
            let fetched = try await ConvexAPIService.shared.fetchReminders(bookingId: nil)
            if fetched != self.reminders { self.reminders = fetched }
        } catch {
            // Never inject demo reminders when the live call fails.
        }
    }
    
    /// Everything the Bookings screen shows, awaited so pull-to-refresh tracks real work.
    public func refreshBookingsScreenAndWait(includeCalendar: Bool) async {
        if includeCalendar {
            async let b: Void = loadBookingsAndWait()
            async let c: Void = loadCalendarEventsAndWait()
            async let r: Void = loadRemindersAndWait()
            _ = await (b, c, r)
        } else if filterMode == .abandoned {
            async let b: Void = loadBookingsAndWait()
            async let p: Void = loadPartialLeadsAndWait()
            _ = await (b, p)
        } else {
            await loadBookingsAndWait()
        }
    }
    
    /// Per-booking reminders, served from a 60 s cache when a sheet is re-opened.
    public func ensureReminders(forBooking bookingId: String, force: Bool = false) {
        if !force,
           let fetchedAt = remindersFetchedAt[bookingId],
           Date().timeIntervalSince(fetchedAt) < remindersTTL {
            return
        }
        remindersFetchedAt[bookingId] = Date()
        Task {
            do {
                let fetched = try await ConvexAPIService.shared.fetchReminders(bookingId: bookingId)
                if self.bookingReminders[bookingId] != fetched {
                    self.bookingReminders[bookingId] = fetched
                }
            } catch {
                self.remindersFetchedAt[bookingId] = nil
            }
        }
    }
    
    public func reminders(forBooking bookingId: String) -> [ReminderItem] {
        bookingReminders[bookingId] ?? []
    }
    
    public func isPending(_ bookingId: String) -> Bool {
        pendingBookingIds.contains(bookingId)
    }
    
    // MARK: - Derived data
    
    private func rebuildSiteIndex() {
        var byId: [String: CleaningSite] = [:]
        var idBySlug: [String: String] = [:]
        for site in sites {
            byId[site.id] = site
            idBySlug[site.slug] = site.id
        }
        siteById = byId
        siteIdBySlug = idBySlug
    }
    
    private func scheduleSearchRecompute() {
        searchTask?.cancel()
        searchTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 150_000_000)
            guard !Task.isCancelled else { return }
            self?.recomputeDerived()
        }
    }
    
    /// Canonical site key for a row: the site's id when known, else resolved from its slug.
    private func canonicalSiteId(id: String, slug: String) -> String {
        if siteById[id] != nil { return id }
        if let resolved = siteIdBySlug[slug] { return resolved }
        return id
    }
    
    private func matchesSelectedSite(id: String, slug: String) -> Bool {
        guard let selected = selectedSiteId else { return true }
        if id == selected { return true }
        if let site = siteById[selected] {
            return slug == site.slug || id == site.id
        }
        return slug == selected
    }
    
    private func recomputeDerived() {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        var counts: [String: Int] = [:]
        
        if filterMode == .abandoned {
            for lead in partialLeads {
                counts[canonicalSiteId(id: lead.siteId, slug: lead.siteSlug), default: 0] += 1
            }
            filteredPartialLeads = partialLeads.filter { lead in
                guard matchesSelectedSite(id: lead.siteId, slug: lead.siteSlug) else { return false }
                guard !query.isEmpty else { return true }
                return lead.displayName.localizedCaseInsensitiveContains(query) ||
                    lead.siteName.localizedCaseInsensitiveContains(query) ||
                    (lead.serviceType?.localizedCaseInsensitiveContains(query) ?? false) ||
                    (lead.email?.localizedCaseInsensitiveContains(query) ?? false) ||
                    (lead.phone?.localizedCaseInsensitiveContains(query) ?? false) ||
                    (lead.address?.localizedCaseInsensitiveContains(query) ?? false) ||
                    (lead.lastStep?.localizedCaseInsensitiveContains(query) ?? false)
            }
            totalBookingCountForFilters = partialLeads.count
        } else {
            for booking in bookings {
                counts[canonicalSiteId(id: booking.siteId, slug: booking.siteSlug), default: 0] += 1
            }
            filteredPartialLeads = []
            totalBookingCountForFilters = bookings.count
        }
        
        var newCount = 0
        var confirmedCount = 0
        var completedCount = 0
        for booking in bookings {
            switch booking.status {
            case .new: newCount += 1
            case .confirmed, .assigned: confirmedCount += 1
            case .completed: completedCount += 1
            default: break
            }
        }
        newBookingsCount = newCount
        confirmedBookingsCount = confirmedCount
        completedBookingsCount = completedCount
        
        filteredBookings = bookings.filter { booking in
            guard matchesSelectedSite(id: booking.siteId, slug: booking.siteSlug) else { return false }
            guard selectedStatus == nil || booking.status == selectedStatus else { return false }
            guard !query.isEmpty else { return true }
            return booking.customerName.localizedCaseInsensitiveContains(query) ||
                booking.siteName.localizedCaseInsensitiveContains(query) ||
                booking.serviceType.localizedCaseInsensitiveContains(query) ||
                (booking.email?.localizedCaseInsensitiveContains(query) ?? false) ||
                (booking.phone?.localizedCaseInsensitiveContains(query) ?? false) ||
                (booking.address?.localizedCaseInsensitiveContains(query) ?? false)
        }
        
        countsBySiteId = counts
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
    
    public func bookingCount(forSiteId siteId: String) -> Int {
        countsBySiteId[siteId] ?? 0
    }
    
    public func siteFilterTitle(for site: CleaningSite) -> String {
        "\(site.name) (\(bookingCount(forSiteId: site.id)))"
    }
    
    public var allSitesFilterTitle: String {
        "All Sites (\(totalBookingCountForFilters))"
    }
    
    // MARK: - Mutations (optimistic; reconcile on failure)
    
    private func reportActionFailure(_ message: String, _ error: Error) {
        if let convex = error as? ConvexError, convex.isCancelled { return }
        actionError = "\(message): \(error.localizedDescription)"
        HapticFeedback.notification(.error)
    }
    
    public func updateStatus(booking: Booking, newStatus: BookingStatus) {
        guard !isPending(booking.id),
              let index = bookings.firstIndex(where: { $0.id == booking.id }) else { return }
        let previous = bookings[index]
        bookings[index].status = newStatus
        bookings[index].updatedAt = Date()
        
        Task {
            do {
                try await ConvexAPIService.shared.updateBookingStatus(bookingId: booking.id, newStatus: newStatus)
            } catch {
                if let idx = self.bookings.firstIndex(where: { $0.id == booking.id }) {
                    self.bookings[idx] = previous
                }
                self.reportActionFailure("Couldn’t update status", error)
            }
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
        guard !isPending(booking.id) else { return }
        let startMs = scheduledStartAt.timeIntervalSince1970 * 1000
        let endMs = scheduledEndAt.timeIntervalSince1970 * 1000
        
        var previous: Booking? = nil
        if let idx = bookings.firstIndex(where: { $0.id == booking.id }) {
            previous = bookings[idx]
            bookings[idx].scheduledStartAt = scheduledStartAt
            bookings[idx].scheduledEndAt = scheduledEndAt
            bookings[idx].scheduledStartAtMs = startMs
            bookings[idx].scheduledEndAtMs = endMs
            bookings[idx].timezone = timezone
            if confirm { bookings[idx].status = .confirmed }
        }
        
        Task {
            do {
                try await ConvexAPIService.shared.scheduleBooking(
                    bookingId: booking.id,
                    scheduledStartAt: startMs,
                    scheduledEndAt: endMs,
                    timezone: timezone,
                    confirm: confirm,
                    alertOffsetsMinutes: alertOffsetsMinutes
                )
                self.loadCalendarEvents()
                self.loadReminders()
                self.ensureReminders(forBooking: booking.id, force: true)
            } catch {
                if let previous, let idx = self.bookings.firstIndex(where: { $0.id == booking.id }) {
                    self.bookings[idx] = previous
                }
                self.reportActionFailure("Couldn’t schedule booking", error)
            }
        }
        HapticFeedback.notification(.success)
    }
    
    /// Persists internal notes via `bookings:updateInternalNotes`; reverts on failure.
    @discardableResult
    public func saveNotes(booking: Booking, notes: String) async -> Bool {
        guard !isPending(booking.id) else { return false }
        let previousNotes = bookings.first(where: { $0.id == booking.id })?.internalNotes
        if let idx = bookings.firstIndex(where: { $0.id == booking.id }) {
            bookings[idx].internalNotes = notes
        }
        do {
            try await ConvexAPIService.shared.saveInternalNotes(bookingId: booking.id, notes: notes)
            HapticFeedback.notification(.success)
            return true
        } catch {
            if let idx = bookings.firstIndex(where: { $0.id == booking.id }) {
                bookings[idx].internalNotes = previousNotes
            }
            reportActionFailure("Couldn’t save notes", error)
            return false
        }
    }
    
    public func archive(booking: Booking) {
        guard !isPending(booking.id) else { return }
        let removed = bookings.first(where: { $0.id == booking.id })
        bookings.removeAll(where: { $0.id == booking.id })
        Task {
            do {
                try await ConvexAPIService.shared.archiveBooking(bookingId: booking.id)
                self.loadCalendarEvents()
            } catch {
                if let removed { self.bookings.insert(removed, at: 0) }
                self.reportActionFailure("Couldn’t archive booking", error)
            }
        }
        HapticFeedback.notification(.success)
    }
    
    public func unarchive(booking: Booking) {
        guard !isPending(booking.id) else { return }
        let removed = bookings.first(where: { $0.id == booking.id })
        bookings.removeAll(where: { $0.id == booking.id })
        Task {
            do {
                try await ConvexAPIService.shared.unarchiveBooking(bookingId: booking.id)
            } catch {
                if let removed { self.bookings.insert(removed, at: 0) }
                self.reportActionFailure("Couldn’t restore booking", error)
            }
        }
        HapticFeedback.notification(.success)
    }
    
    public func deletePermanently(booking: Booking) {
        if isPending(booking.id) {
            bookings.removeAll(where: { $0.id == booking.id })
            pendingBookingIds.remove(booking.id)
            return
        }
        let removed = bookings.first(where: { $0.id == booking.id })
        bookings.removeAll(where: { $0.id == booking.id })
        Task {
            do {
                try await ConvexAPIService.shared.deleteBookingPermanently(bookingId: booking.id)
                self.bookingReminders[booking.id] = nil
                self.remindersFetchedAt[booking.id] = nil
                self.loadCalendarEvents()
                self.loadReminders()
            } catch {
                if let removed { self.bookings.insert(removed, at: 0) }
                self.reportActionFailure("Couldn’t delete booking", error)
            }
        }
        HapticFeedback.notification(.success)
    }
    
    public func createReminder(title: String, notes: String?, dueAt: Date, allDay: Bool, bookingId: String?) {
        let dueMs = dueAt.timeIntervalSince1970 * 1000
        Task {
            do {
                try await ConvexAPIService.shared.createReminder(
                    title: title,
                    notes: notes,
                    dueAt: dueMs,
                    allDay: allDay,
                    bookingId: bookingId
                )
                self.loadCalendarEvents()
                self.loadReminders()
                if let bookingId {
                    self.ensureReminders(forBooking: bookingId, force: true)
                }
            } catch {
                self.reportActionFailure("Couldn’t create reminder", error)
            }
        }
        HapticFeedback.notification(.success)
    }
    
    public func removeReminder(reminderId: String) {
        reminders.removeAll(where: { $0.id == reminderId })
        for (bookingId, items) in bookingReminders where items.contains(where: { $0.id == reminderId }) {
            bookingReminders[bookingId] = items.filter { $0.id != reminderId }
        }
        calendarEvents.removeAll(where: { $0.id == "ev_rem_\(reminderId)" || $0.id == reminderId })
        Task {
            do {
                try await ConvexAPIService.shared.removeReminder(reminderId: reminderId)
            } catch {
                self.loadReminders()
                self.reportActionFailure("Couldn’t remove reminder", error)
            }
        }
        HapticFeedback.impact(.light)
    }
    
    /// Optimistic insert with a temporary id; replaced by the server booking
    /// (real Convex id) once `bookings:createManual` returns.
    public func addBooking(_ draft: Booking) {
        let tempId = draft.id
        bookings.insert(draft, at: 0)
        pendingBookingIds.insert(tempId)
        HapticFeedback.notification(.success)
        
        Task {
            do {
                let created = try await ConvexAPIService.shared.createBooking(from: draft)
                self.resolvedBookingIds[tempId] = created.id
                if let idx = self.bookings.firstIndex(where: { $0.id == tempId }) {
                    self.bookings[idx] = created
                } else if self.filterMode == .active {
                    self.bookings.insert(created, at: 0)
                }
                self.pendingBookingIds.remove(tempId)
                if self.selectedBooking?.id == tempId { self.selectedBooking = created }
                NotificationManager.shared.scheduleBookingNotification(booking: created)
            } catch {
                self.bookings.removeAll(where: { $0.id == tempId })
                self.pendingBookingIds.remove(tempId)
                self.reportActionFailure("Couldn’t create booking", error)
            }
        }
    }
}

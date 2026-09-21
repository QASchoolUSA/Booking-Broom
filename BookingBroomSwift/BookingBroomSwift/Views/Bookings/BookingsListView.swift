import SwiftUI

public struct BookingsListView: View {
    @Bindable var bookingsVM: BookingsViewModel
    @Bindable var messagesVM: MessagesViewModel
    @State private var showingCreateSheet = false
    @State private var selectedBookingId: String?
    #if os(macOS)
    @Environment(\.openWindow) private var openWindow
    #endif
    
    public init(bookingsVM: BookingsViewModel, messagesVM: MessagesViewModel) {
        self.bookingsVM = bookingsVM
        self.messagesVM = messagesVM
    }
    
    public var body: some View {
        VStack(spacing: 0) {
            #if os(macOS)
            macFilterToolbar
            #endif
            
            Picker("View Mode", selection: $bookingsVM.viewMode) {
                Text("List").tag(BookingsViewMode.list)
                Text("Calendar").tag(BookingsViewMode.calendar)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, AppSpacing.contentInset)
            .padding(.top, AppSpacing.xs)
            .padding(.bottom, AppSpacing.xxs)
            .disabled(bookingsVM.filterMode == .abandoned)
            .opacity(bookingsVM.filterMode == .abandoned ? 0.45 : 1)
            #if os(macOS)
            .frame(maxWidth: 320, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, AppSpacing.contentInset - AppSpacing.md)
            #endif
            
            if bookingsVM.viewMode == .calendar && bookingsVM.filterMode != .abandoned {
                MonthAgendaView(bookingsVM: bookingsVM, messagesVM: messagesVM)
            } else {
                #if os(iOS)
                VStack(spacing: 0) {
                    horizontalFilterBar {
                        FilterChip(title: bookingsVM.allSitesFilterTitle, isSelected: bookingsVM.selectedSiteId == nil) {
                            bookingsVM.selectedSiteId = nil
                        }
                        
                        ForEach(bookingsVM.sites) { site in
                            FilterChip(title: bookingsVM.siteFilterTitle(for: site), isSelected: bookingsVM.selectedSiteId == site.id) {
                                bookingsVM.selectedSiteId = site.id
                            }
                        }
                    }
                    
                    if bookingsVM.filterMode != .abandoned {
                        horizontalFilterBar {
                            FilterChip(title: "All Status", isSelected: bookingsVM.selectedStatus == nil) {
                                bookingsVM.selectedStatus = nil
                            }
                            ForEach(BookingStatus.allCases) { st in
                                FilterChip(title: st.displayName, isSelected: bookingsVM.selectedStatus == st) {
                                    bookingsVM.selectedStatus = st
                                }
                            }
                        }
                    }
                }
                .fixedSize(horizontal: false, vertical: true)
                #endif
                
                bookingsContent
            }
        }
        .background(AppColors.groupedBackground.ignoresSafeArea())
        .navigationTitle(navigationTitle)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .searchable(text: $bookingsVM.searchText, prompt: searchPrompt)
        .onChange(of: bookingsVM.viewMode) { _, mode in
            if mode == .calendar && bookingsVM.filterMode != .abandoned {
                bookingsVM.ensureCalendarLoaded()
            }
        }
        .onAppear {
            bookingsVM.ensureBookingsLoaded()
            if bookingsVM.viewMode == .calendar && bookingsVM.filterMode != .abandoned {
                bookingsVM.ensureCalendarLoaded()
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button(action: { bookingsVM.setFilterMode(.active) }) {
                        Label("Active bookings", systemImage: bookingsVM.filterMode == .active ? "checkmark" : "circle")
                    }
                    Button(action: { bookingsVM.setFilterMode(.archived) }) {
                        Label("Archived", systemImage: bookingsVM.filterMode == .archived ? "checkmark" : "circle")
                    }
                    Button(action: { bookingsVM.setFilterMode(.abandoned) }) {
                        Label("Abandoned", systemImage: bookingsVM.filterMode == .abandoned ? "checkmark" : "circle")
                    }
                } label: {
                    Label("Filter", systemImage: "line.3.horizontal.decrease.circle")
                }
            }
            
            #if os(iOS)
            ToolbarItem(placement: .primaryAction) {
                Button(action: { showingCreateSheet = true }) {
                    Label("New Booking", systemImage: "plus.circle.fill")
                }
                .disabled(bookingsVM.filterMode == .abandoned)
            }
            #endif
        }
        .sheet(isPresented: $showingCreateSheet) {
            CreateBookingSheet(bookingsVM: bookingsVM)
        }
        .sheet(item: $bookingsVM.selectedPartialLead) { lead in
            PartialLeadDetailView(lead: lead)
        }
        .refreshable {
            // Sites ride along inside loadBookingsAndWait (cached in the service); no separate probe.
            await bookingsVM.refreshBookingsScreenAndWait(
                includeCalendar: bookingsVM.viewMode == .calendar && bookingsVM.filterMode != .abandoned
            )
        }
    }

    private var navigationTitle: String {
        if bookingsVM.viewMode == .calendar && bookingsVM.filterMode != .abandoned {
            return "Calendar Agenda"
        }
        switch bookingsVM.filterMode {
        case .archived: return "Archived Bookings"
        case .abandoned: return "Abandoned Leads"
        case .active: return "All Bookings"
        }
    }

    private var searchPrompt: String {
        bookingsVM.filterMode == .abandoned
            ? "Search abandoned leads..."
            : "Search customer, site or service..."
    }
    
    #if os(macOS)
    private var macFilterToolbar: some View {
        HStack(spacing: AppSpacing.sm) {
            Text("Site")
                .font(AppTypography.meta)
                .foregroundStyle(.secondary)
            StringFilterMenu(
                title: "Site",
                options: bookingsVM.sites.map { ($0.id, bookingsVM.siteFilterTitle(for: $0)) },
                selection: $bookingsVM.selectedSiteId
            )
            
            Text("Status")
                .font(AppTypography.meta)
                .foregroundStyle(.secondary)
            StatusFilterMenu(selection: $bookingsVM.selectedStatus)
            
            Spacer()
        }
        .padding(.horizontal, AppSpacing.contentInset)
        .padding(.vertical, AppSpacing.xs)
        .background(AppColors.cardBackground.opacity(0.6))
    }
    #endif
    
    @ViewBuilder
    private var bookingsContent: some View {
        if let err = bookingsVM.loadError {
            VStack(spacing: AppSpacing.sm) {
                Spacer()
                Image(systemName: "exclamationmark.triangle")
                    .font(.system(size: 40))
                    .foregroundStyle(AppColors.amber)
                Text(bookingsVM.filterMode == .abandoned ? "Couldn’t load abandoned leads" : "Couldn’t load bookings")
                    .font(AppTypography.sectionTitle)
                Text(err)
                    .font(AppTypography.meta)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, AppSpacing.xl)
                Button("Retry") {
                    bookingsVM.loadBookings()
                }
                .font(AppTypography.rowTitle)
                Spacer()
            }
        } else if bookingsVM.filterMode == .abandoned {
            abandonedLeadsContent
        } else if bookingsVM.filteredBookings.isEmpty {
            VStack(spacing: AppSpacing.sm) {
                Spacer()
                Image(systemName: bookingsVM.filterMode == .archived ? "archivebox" : "magnifyingglass")
                    .font(.system(size: 48))
                    .foregroundStyle(.secondary)
                Text(bookingsVM.filterMode == .archived ? "No Archived Bookings" : "No Bookings Found")
                    .font(AppTypography.sectionTitle)
                Text(bookingsVM.filterMode == .archived ? "Archived bookings will appear here." : "Try clearing search or site filter")
                    .font(AppTypography.meta)
                    .foregroundStyle(.secondary)
                Spacer()
            }
        } else {
            #if os(macOS)
            macBookingsTable
            #else
            ScrollView {
                LazyVStack(spacing: AppSpacing.sm) {
                    ForEach(bookingsVM.filteredBookings) { booking in
                        BookingCardView(
                            booking: booking,
                            bookingsVM: bookingsVM,
                            messagesVM: messagesVM,
                            onStatusChange: { newSt in
                                bookingsVM.updateStatus(booking: booking, newStatus: newSt)
                            }
                        )
                    }
                }
                .padding(AppSpacing.md)
            }
            #endif
        }
    }

    @ViewBuilder
    private var abandonedLeadsContent: some View {
        if bookingsVM.filteredPartialLeads.isEmpty {
            VStack(spacing: AppSpacing.sm) {
                Spacer()
                Image(systemName: "person.crop.circle.badge.clock")
                    .font(.system(size: 48))
                    .foregroundStyle(.secondary)
                Text(bookingsVM.searchText.isEmpty ? "No abandoned leads" : "No matching abandoned leads")
                    .font(AppTypography.sectionTitle)
                Text(
                    bookingsVM.searchText.isEmpty
                        ? "They appear when someone enters email or phone and leaves"
                        : "Try clearing search or site filter"
                )
                .font(AppTypography.meta)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, AppSpacing.xl)
                Spacer()
            }
        } else {
            ScrollView {
                LazyVStack(spacing: AppSpacing.sm) {
                    ForEach(bookingsVM.filteredPartialLeads) { lead in
                        Button {
                            bookingsVM.selectedPartialLead = lead
                        } label: {
                            PartialLeadCardView(lead: lead)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(AppSpacing.md)
            }
        }
    }
    
    #if os(macOS)
    private var macBookingsTable: some View {
        Table(bookingsVM.filteredBookings, selection: $selectedBookingId) {
            TableColumn("Site") { booking in
                Text(booking.siteName)
                    .font(AppTypography.rowTitle)
            }
            .width(min: 100, ideal: 140)
            
            TableColumn("Customer") { booking in
                Text(booking.customerName)
            }
            .width(min: 120, ideal: 180)
            
            TableColumn("Service") { booking in
                Text(booking.serviceType)
                    .foregroundStyle(.secondary)
            }
            .width(min: 100, ideal: 140)
            
            TableColumn("Status") { booking in
                StatusPill(status: booking.status)
            }
            .width(100)
            
            TableColumn("Date") { booking in
                Text(booking.preferredDate ?? "—")
                    .foregroundStyle(.secondary)
            }
            .width(110)
            
            TableColumn("Quote") { booking in
                Text(booking.quote?.formattedPrice ?? "—")
                    .font(AppTypography.price)
                    .monospacedDigit()
                    .foregroundStyle(AppColors.emerald)
            }
            .width(90)
        }
        .contextMenu(forSelectionType: String.self) { selection in
            if let id = selection.first,
               let booking = bookingsVM.filteredBookings.first(where: { $0.id == id }) {
                Button("Open") {
                    openWindow(id: "booking-detail", value: booking.id)
                }
                Button("Mark Confirmed") {
                    bookingsVM.updateStatus(booking: booking, newStatus: .confirmed)
                }
                Button("Mark Completed") {
                    bookingsVM.updateStatus(booking: booking, newStatus: .completed)
                }
            }
        } primaryAction: { selection in
            if let id = selection.first {
                openWindow(id: "booking-detail", value: id)
            }
        }
        .onChange(of: selectedBookingId) { _, newId in
            if let newId {
                openWindow(id: "booking-detail", value: newId)
            }
        }
    }
    #endif
    
    #if os(iOS)
    @ViewBuilder
    private func horizontalFilterBar<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        HorizontalChipScrollView {
            HStack(spacing: AppSpacing.xs) {
                content()
            }
            .padding(.horizontal, AppSpacing.md)
            .padding(.vertical, 6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .horizontalChipStrip(height: 40)
        .background(.regularMaterial)
    }
    #endif
}

struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(AppTypography.metaBold)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? AppColors.primary : Color.secondary.opacity(0.12))
                .foregroundStyle(isSelected ? .white : .primary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

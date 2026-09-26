import SwiftUI
import MapKit

public struct BookingDetailView: View {
    public let booking: Booking
    public var onStatusChange: ((BookingStatus) -> Void)?
    
    @Bindable var bookingsVM: BookingsViewModel
    @Bindable var messagesVM: MessagesViewModel
    
    @Environment(\.dismiss) private var dismiss
    @Environment(\.horizontalSizeClass) private var sizeClass
    
    @State private var liveBooking: Booking
    @State private var showingZillowSafari: Bool = false
    
    // Scheduling State
    @State private var scheduledDate: Date = Date()
    @State private var scheduledEndTime: Date = Date().addingTimeInterval(3600 * 3)
    @State private var alertDayBefore: Bool = true
    @State private var alertHourBefore: Bool = true
    @State private var isScheduling: Bool = false
    
    // Internal Notes State
    @State private var internalNotesDraft: String = ""
    @State private var isSavingNotes: Bool = false
    
    // Inline Reminder State
    @State private var newReminderTitle: String = ""
    @State private var isAddingReminder: Bool = false
    
    // Alert confirmation
    @State private var showingDeleteConfirm: Bool = false
    @State private var showingComposeSMS: Bool = false
    @State private var selectedStatus: BookingStatus
    @State private var isSendingTelegram: Bool = false
    @State private var telegramBanner: String? = nil
    
    // Map pin: geocoded from the address (no hardcoded fallback)
    @State private var mapCoordinate: CLLocationCoordinate2D?
    @State private var geocodeFailed: Bool = false
    
    /// Optimistic row whose Convex id is not yet known — server actions are disabled.
    private var isPendingCreate: Bool { bookingsVM.isPending(liveBooking.id) }
    
    public init(
        booking: Booking,
        bookingsVM: BookingsViewModel,
        messagesVM: MessagesViewModel,
        onStatusChange: ((BookingStatus) -> Void)? = nil
    ) {
        self.booking = booking
        self.bookingsVM = bookingsVM
        self.messagesVM = messagesVM
        self.onStatusChange = onStatusChange
        _liveBooking = State(initialValue: booking)
        _selectedStatus = State(initialValue: booking.status)
    }
    
    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Header Status Banner
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(liveBooking.customerName)
                                .font(.title2.bold())
                            HStack(spacing: 6) {
                                Text(liveBooking.siteName)
                                    .font(.subheadline.bold())
                                    .foregroundColor(AppColors.primary)
                                Text("·")
                                    .foregroundColor(.secondary)
                                Text(liveBooking.serviceType)
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                        }
                        Spacer()
                        StatusPill(status: liveBooking.status)
                    }
                    .padding(.top, 4)
                    
                    // Direct Action Shortcuts
                    HStack(spacing: AppSpacing.sm) {
                        if liveBooking.phone != nil {
                            Button {
                                showingComposeSMS = true
                            } label: {
                                Label("SMS", systemImage: "message.fill")
                            }
                            .bbSecondaryButton(expand: true)
                        }
                        
                        ShareLink(item: "Booking Details for \(liveBooking.customerName) (\(liveBooking.serviceType)): \(liveBooking.address ?? "")") {
                            Label("Share", systemImage: "square.and.arrow.up")
                                .frame(maxWidth: .infinity)
                        }
                        .bbSecondaryButton(expand: true)
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Button {
                            guard !isPendingCreate, !isSendingTelegram else { return }
                            isSendingTelegram = true
                            telegramBanner = nil
                            Task {
                                let sent = await bookingsVM.sendTelegram(for: liveBooking.id)
                                isSendingTelegram = false
                                if sent {
                                    liveBooking.telegramNotifiedAt = Date()
                                    telegramBanner = "Sent to Telegram chat"
                                } else {
                                    telegramBanner = "Telegram not sent — check Convex TELEGRAM_* env"
                                }
                            }
                        } label: {
                            HStack {
                                if isSendingTelegram {
                                    ProgressView().controlSize(.small)
                                } else {
                                    Image(systemName: "paperplane.fill")
                                }
                                Text(
                                    liveBooking.telegramNotifiedAt == nil
                                        ? "Send to Telegram"
                                        : "Send again to Telegram"
                                )
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .bbSecondaryButton(expand: true)
                        .disabled(isPendingCreate || isSendingTelegram)
                        
                        Text("In-app bookings skip automatic Telegram; public site quotes still notify on create.")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        
                        if let telegramBanner {
                            Text(telegramBanner)
                                .font(.caption)
                                .foregroundColor(
                                    telegramBanner.hasPrefix("Sent")
                                        ? AppColors.emerald
                                        : AppColors.rose
                                )
                        }
                    }
                    
                    if isPendingCreate {
                        HStack(spacing: AppSpacing.xs) {
                            ProgressView().controlSize(.small)
                            Text("Saving to Booking Broom… actions unlock once the booking is created.")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(AppSpacing.sm)
                        .appSurface()
                    }
                    
                    // Location Map Preview
                    if let address = liveBooking.address {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Property Location")
                                .font(.headline)
                            if let coordinate = mapCoordinate ?? liveBooking.coordinate {
                                MapPreview(address: address, coordinate: coordinate)
                            } else {
                                HStack(spacing: AppSpacing.xs) {
                                    if geocodeFailed {
                                        Image(systemName: "mappin.slash")
                                            .foregroundColor(.secondary)
                                        Text(address)
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                            .lineLimit(2)
                                    } else {
                                        ProgressView().controlSize(.small)
                                        Text("Locating address…")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                    Spacer()
                                }
                                .frame(height: 44)
                            }
                            
                            if liveBooking.zillowSearchURL != nil {
                                Button {
                                    showingZillowSafari = true
                                } label: {
                                    Label("Open on Zillow", systemImage: "safari")
                                        .frame(maxWidth: .infinity)
                                }
                                .bbSecondaryButton(expand: true)
                            }
                        }
                    }
                    
                    // Property & Service Specification Card
                    if let prop = liveBooking.property {
                        VStack(alignment: .leading, spacing: 14) {
                            Text("Property Specs")
                                .font(.headline)
                            
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                                if let beds = prop.bedrooms {
                                    PropertyMetaItem(icon: "bed.double.fill", title: "Bedrooms", value: "\(beds) Beds")
                                }
                                if let baths = prop.bathrooms {
                                    PropertyMetaItem(icon: "shower.fill", title: "Bathrooms", value: "\(baths) Baths")
                                }
                                if let sqft = prop.squareFeet {
                                    PropertyMetaItem(icon: "ruler.fill", title: "Size", value: "\(sqft) sq ft")
                                }
                                if let occ = prop.occupants {
                                    PropertyMetaItem(icon: "person.2.fill", title: "Occupants", value: "\(occ) People")
                                }
                                if let cond = prop.condition {
                                    PropertyMetaItem(icon: "gauge.with.needle.fill", title: "Condition", value: cond)
                                }
                                if let cleaned = prop.lastCleaned {
                                    PropertyMetaItem(icon: "clock.arrow.circlepath", title: "Last Cleaned", value: cleaned)
                                }
                            }
                            
                            if let excluded = prop.excludedAreas, !excluded.isEmpty {
                                Divider()
                                VStack(alignment: .leading, spacing: 6) {
                                    Text("EXCLUDED AREAS")
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundColor(.secondary)
                                    
                                    HStack(spacing: 6) {
                                        ForEach(excluded, id: \.self) { area in
                                            Text(area)
                                                .font(.caption2.bold())
                                                .padding(.horizontal, 8)
                                                .padding(.vertical, 4)
                                                .background(Color.secondary.opacity(0.1))
                                                .clipShape(Capsule())
                                        }
                                    }
                                }
                            }
                        }
                        .padding(16)
                        .glassCard()
                    }
                    
                    // Quote Breakdown Card
                    if let quote = liveBooking.quote {
                        VStack(alignment: .leading, spacing: 14) {
                            HStack {
                                Text("Quote Breakdown")
                                    .font(.headline)
                                Spacer()
                                if quote.internalQuote == true {
                                    Text("Internal Only")
                                        .font(.caption2.bold())
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(AppColors.amber.opacity(0.2))
                                        .foregroundColor(AppColors.amber)
                                        .clipShape(Capsule())
                                }
                            }
                            
                            HStack(alignment: .firstTextBaseline) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Estimated Total")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Text(quote.formattedPrice)
                                        .font(.title.bold())
                                        .foregroundColor(AppColors.emerald)
                                }
                                Spacer()
                                
                                if let freq = quote.frequency {
                                    Text(freq)
                                        .font(.subheadline.bold())
                                        .foregroundColor(AppColors.primary)
                                }
                            }
                            
                            // Add-ons list
                            if let addOns = quote.addOns, !addOns.isEmpty {
                                Divider()
                                Text("ADD-ONS (\(addOns.count))")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.secondary)
                                
                                ForEach(addOns) { addOn in
                                    HStack {
                                        Text(addOn.label)
                                            .font(.subheadline)
                                        if let q = addOn.quantity, q > 1 {
                                            Text("×\(q)")
                                                .font(.caption.bold())
                                                .foregroundColor(.secondary)
                                        }
                                        Spacer()
                                        if let p = addOn.price {
                                            Text(String(format: "+$%.2f", p * Double(addOn.quantity ?? 1)))
                                                .font(.subheadline.bold())
                                                .foregroundColor(AppColors.emerald)
                                        }
                                    }
                                }
                            }
                        }
                        .padding(16)
                        .glassCard()
                    }
                    
                    // Update Booking Status (under quote)
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Update Booking Status")
                            .font(.headline)
                        
                        Picker("Status", selection: $selectedStatus) {
                            ForEach(BookingStatus.allCases) { st in
                                Text(st.displayName).tag(st)
                            }
                        }
                        .pickerStyle(.menu)
                        .labelsHidden()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .onChange(of: selectedStatus) { _, newStatus in
                            guard newStatus != liveBooking.status else { return }
                            liveBooking.status = newStatus
                            onStatusChange?(newStatus)
                            HapticFeedback.notification(.success)
                        }
                    }
                    .padding(16)
                    .glassCard()
                    
                    // Schedule Job Appointment Card
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            Image(systemName: "calendar.badge.clock")
                                .foregroundColor(AppColors.primary)
                            Text("Job Schedule & Appointment")
                                .font(.headline)
                        }
                        
                        DatePicker("Start Date & Time", selection: $scheduledDate)
                        DatePicker("End Time", selection: $scheduledEndTime, displayedComponents: [.hourAndMinute])
                        
                        Text("Timezone: \(liveBooking.timezone ?? "America/New_York")")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        
                        if liveBooking.scheduledStartAt == nil {
                            Divider()
                            Toggle("Alert 1 day before", isOn: $alertDayBefore)
                            Toggle("Alert 1 hour before", isOn: $alertHourBefore)
                        }
                        
                        HStack(spacing: AppSpacing.sm) {
                            Button {
                                var offsets: [Int] = []
                                if alertDayBefore { offsets.append(1440) }
                                if alertHourBefore { offsets.append(60) }
                                
                                bookingsVM.scheduleBooking(
                                    booking: liveBooking,
                                    scheduledStartAt: scheduledDate,
                                    scheduledEndAt: scheduledEndTime,
                                    timezone: liveBooking.timezone ?? "America/New_York",
                                    confirm: true,
                                    alertOffsetsMinutes: offsets
                                )
                                dismiss()
                            } label: {
                                Text(liveBooking.scheduledStartAt != nil ? "Update Schedule" : "Schedule & Confirm")
                                    .frame(maxWidth: .infinity)
                            }
                            .bbPrimaryButton(expand: true)
                            .disabled(isPendingCreate)
                        }
                    }
                    .padding(16)
                    .glassCard()
                    
                    // Linked Reminders Section
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Image(systemName: "bell.fill")
                                .foregroundColor(AppColors.amber)
                            Text("Linked Reminders")
                                .font(.headline)
                        }
                        
                        let linkedReminders = bookingsVM.reminders(forBooking: liveBooking.id)
                        if linkedReminders.isEmpty {
                            Text("No reminders linked to this job yet.")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        } else {
                            ForEach(linkedReminders) { rem in
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(rem.title)
                                            .font(.subheadline.bold())
                                        Text(rem.dueDate, style: .time)
                                            .font(.caption2)
                                            .foregroundColor(AppColors.amber)
                                    }
                                    Spacer()
                                    Button {
                                        bookingsVM.removeReminder(reminderId: rem.id)
                                    } label: {
                                        Image(systemName: "trash")
                                    }
                                    .buttonStyle(BBIconButtonStyle(tint: AppColors.rose))
                                    .help("Remove reminder")
                                }
                                .padding(AppSpacing.sm)
                                .appSurface()
                            }
                        }
                        
                        // Add reminder inline
                        HStack(spacing: AppSpacing.xs) {
                            BBFieldChrome(isFocused: false) {
                                TextField("Add quick reminder...", text: $newReminderTitle)
                            }
                            
                            Button("Add") {
                                let title = newReminderTitle.trimmingCharacters(in: .whitespacesAndNewlines)
                                guard !title.isEmpty else { return }
                                let due = (liveBooking.scheduledStartAt ?? Date()).addingTimeInterval(-3600)
                                bookingsVM.createReminder(
                                    title: title,
                                    notes: nil,
                                    dueAt: due,
                                    allDay: false,
                                    bookingId: liveBooking.id
                                )
                                newReminderTitle = ""
                            }
                            .bbPrimaryButton(expand: false)
                            .disabled(newReminderTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        }
                    }
                    .padding(16)
                    .glassCard()
                    
                    // Customer Notes
                    if let notes = liveBooking.notes, !notes.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Customer Request Notes")
                                .font(.headline)
                            Text(notes)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .padding(12)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.secondary.opacity(0.08))
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                    }
                    
                    // Internal Manager Notes
                    VStack(alignment: .leading, spacing: AppSpacing.sm) {
                        Text("Internal Manager Notes")
                            .font(.headline)
                        
                        TextField("Private crew/manager notes...", text: $internalNotesDraft, axis: .vertical)
                            .lineLimit(2...4)
                            .bbComposerField()
                        
                        Button {
                            guard !isSavingNotes else { return }
                            isSavingNotes = true
                            let draft = internalNotesDraft
                            Task {
                                let ok = await bookingsVM.saveNotes(booking: liveBooking, notes: draft)
                                if ok { liveBooking.internalNotes = draft }
                                isSavingNotes = false
                            }
                        } label: {
                            Text(isSavingNotes ? "Saving..." : "Save Notes")
                        }
                        .bbPrimaryButton(isLoading: isSavingNotes, expand: false)
                        .disabled(isSavingNotes || isPendingCreate || internalNotesDraft == (liveBooking.internalNotes ?? ""))
                        
                        if let actionError = bookingsVM.actionError {
                            Text(actionError)
                                .font(.caption)
                                .foregroundColor(AppColors.rose)
                        }
                    }
                    .padding(AppSpacing.md)
                    .glassCard()
                    
                    // Lifecycle Actions: Archive, Unarchive, Permanent Delete
                    VStack(spacing: AppSpacing.sm) {
                        if liveBooking.isArchived {
                            Button {
                                bookingsVM.unarchive(booking: liveBooking)
                                dismiss()
                            } label: {
                                Text("Unarchive Booking")
                                    .frame(maxWidth: .infinity)
                            }
                            .bbSecondaryButton(expand: true)
                        } else {
                            Button {
                                bookingsVM.archive(booking: liveBooking)
                                dismiss()
                            } label: {
                                Text("Archive Booking")
                                    .frame(maxWidth: .infinity)
                            }
                            .bbSecondaryButton(expand: true)
                        }
                        
                        Button(role: .destructive) {
                            showingDeleteConfirm = true
                        } label: {
                            Text("Delete Permanently")
                                .frame(maxWidth: .infinity)
                        }
                        .bbDestructiveButton(expand: true)
                    }
                    .padding(.top, AppSpacing.xs)
                    .disabled(isPendingCreate)
                }
                .padding(16)
            }
            .background(AppColors.groupedBackground.ignoresSafeArea())
            .navigationTitle("Booking Details")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button("Done") { dismiss() }
                        .font(.headline)
                }
            }
            .alert("Delete Permanently?", isPresented: $showingDeleteConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Delete", role: .destructive) {
                    bookingsVM.deletePermanently(booking: liveBooking)
                    dismiss()
                }
            } message: {
                Text("This will permanently remove this lead from Booking Broom. This cannot be undone.")
            }
            .sheet(isPresented: $showingComposeSMS) {
                ComposeSMSView(
                    messagesVM: messagesVM,
                    prefillTo: liveBooking.phone,
                    prefillSiteSlug: liveBooking.siteSlug,
                    prefillSiteName: liveBooking.siteName
                )
            }
            .modifier(ZillowSafariPresenter(
                isPresented: $showingZillowSafari,
                url: liveBooking.zillowSearchURL,
                useFullScreen: sizeClass == .regular
            ))
            .onAppear {
                if let start = liveBooking.scheduledStartAt {
                    self.scheduledDate = start
                } else if let pDate = liveBooking.preferredDate {
                    let df = DateFormatter()
                    df.dateFormat = "yyyy-MM-dd"
                    if let d = df.date(from: pDate) { self.scheduledDate = d }
                }
                if let end = liveBooking.scheduledEndAt {
                    self.scheduledEndTime = end
                } else {
                    self.scheduledEndTime = scheduledDate.addingTimeInterval(3600 * 3)
                }
                self.internalNotesDraft = liveBooking.internalNotes ?? ""
                bookingsVM.actionError = nil
                // Both are cached — re-opening this sheet costs zero Convex calls.
                if !isPendingCreate {
                    bookingsVM.ensureReminders(forBooking: liveBooking.id)
                }
                messagesVM.ensureDidsLoaded()
            }
            .task(id: liveBooking.address) {
                guard mapCoordinate == nil, liveBooking.coordinate == nil,
                      let address = liveBooking.address, !address.isEmpty else { return }
                geocodeFailed = false
                let resolved = await GeocodeCache.shared.coordinate(for: address)
                guard !Task.isCancelled else { return }
                if let resolved {
                    mapCoordinate = resolved
                } else {
                    geocodeFailed = true
                }
            }
            .onChange(of: bookingsVM.bookings) { _, updated in
                // Adopt the server row once an optimistic create resolves (temp → Convex id swap).
                let currentId = bookingsVM.resolvedBookingIds[liveBooking.id] ?? liveBooking.id
                if let fresh = updated.first(where: { $0.id == currentId }), fresh != liveBooking {
                    liveBooking = fresh
                    selectedStatus = fresh.status
                }
            }
        }
    }
}

/// iPad (regular): full-screen Safari; iPhone (compact): sheet; Mac: system browser.
private struct ZillowSafariPresenter: ViewModifier {
    @Binding var isPresented: Bool
    let url: URL?
    let useFullScreen: Bool
    
    func body(content: Content) -> some View {
        #if os(macOS)
        content.onChange(of: isPresented) { _, presented in
            if presented, let url {
                PlatformOpenURL.open(url)
                isPresented = false
            }
        }
        #else
        if useFullScreen {
            content.fullScreenCover(isPresented: $isPresented) {
                safariContent
            }
        } else {
            content.sheet(isPresented: $isPresented) {
                safariContent
            }
        }
        #endif
    }
    
    #if os(iOS)
    @ViewBuilder
    private var safariContent: some View {
        if let url {
            SafariView(url: url)
                .ignoresSafeArea()
        }
    }
    #endif
}

struct PropertyMetaItem: View {
    let icon: String
    let title: String
    let value: String
    
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .foregroundColor(AppColors.primary)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                Text(value)
                    .font(.caption.bold())
                    .foregroundColor(.primary)
            }
        }
    }
}

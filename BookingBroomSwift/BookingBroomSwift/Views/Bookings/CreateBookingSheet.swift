import SwiftUI

public struct CreateBookingSheet: View {
    @Bindable var bookingsVM: BookingsViewModel
    @Environment(\.dismiss) private var dismiss
    
    @State private var customerName = ""
    @State private var phone = ""
    @State private var email = ""
    @State private var address = ""
    @State private var selectedSiteId: String = ""
    @State private var serviceType = "Deep Clean"
    @State private var hasPreferredDate = false
    @State private var preferredDate = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
    @State private var preferredTime = ""
    @State private var notes = ""
    @State private var internalNotes = ""
    
    let serviceOptions = ["Standard Clean", "Deep Clean", "Move-In / Move-Out", "Post-Construction", "Weekly Maintenance"]
    let timeOptions = ["", "Morning", "Afternoon", "Evening", "Flexible"]
    
    public init(bookingsVM: BookingsViewModel) {
        self.bookingsVM = bookingsVM
    }
    
    private var sites: [CleaningSite] { bookingsVM.sites }
    
    private var selectedSite: CleaningSite? {
        sites.first(where: { $0.id == selectedSiteId })
    }
    
    private var canSave: Bool {
        selectedSite != nil
            && !customerName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
    
    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()
    
    public var body: some View {
        NavigationStack {
            Form {
                Section("Cleaning Site") {
                    if sites.isEmpty {
                        HStack(spacing: AppSpacing.xs) {
                            ProgressView().controlSize(.small)
                            Text("Loading sites…")
                                .foregroundStyle(.secondary)
                        }
                    } else {
                        Picker("Select Site", selection: $selectedSiteId) {
                            ForEach(sites) { site in
                                Text(site.name).tag(site.id)
                            }
                        }
                    }
                }
                
                Section("Customer Details") {
                    TextField("Customer Full Name", text: $customerName)
                        .textContentType(.name)
                    TextField("Phone Number (optional)", text: $phone)
                        .textContentType(.telephoneNumber)
                        .platformKeyboardType(.phonePad)
                    TextField("Email Address (optional)", text: $email)
                        .textContentType(.emailAddress)
                        .platformKeyboardType(.emailAddress)
                        .platformAutocapitalizationNone()
                    TextField("Property Address (optional)", text: $address)
                        .textContentType(.fullStreetAddress)
                }
                
                Section("Service") {
                    Picker("Service Type", selection: $serviceType) {
                        ForEach(serviceOptions, id: \.self) { opt in
                            Text(opt)
                        }
                    }
                    
                    Toggle("Preferred date", isOn: $hasPreferredDate.animation())
                    if hasPreferredDate {
                        DatePicker("Date", selection: $preferredDate, displayedComponents: .date)
                        Picker("Time of day", selection: $preferredTime) {
                            ForEach(timeOptions, id: \.self) { opt in
                                Text(opt.isEmpty ? "Any" : opt).tag(opt)
                            }
                        }
                    }
                }
                
                Section("Customer Notes") {
                    TextEditor(text: $notes)
                        .frame(height: 72)
                        .bbEditorChrome()
                }
                
                Section("Internal Notes (crew / manager only)") {
                    TextEditor(text: $internalNotes)
                        .frame(height: 72)
                        .bbEditorChrome()
                }
            }
            .navigationTitle("New Booking")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .font(.headline)
                        .disabled(!canSave)
                }
            }
            .onAppear {
                bookingsVM.ensureBookingsLoaded()
                if selectedSiteId.isEmpty {
                    selectedSiteId = bookingsVM.selectedSiteId ?? sites.first?.id ?? ""
                }
            }
            .onChange(of: sites) { _, updated in
                if selectedSite == nil, let first = updated.first {
                    selectedSiteId = first.id
                }
            }
        }
    }
    
    private func save() {
        guard let site = selectedSite else { return }
        func clean(_ s: String) -> String? {
            let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
            return t.isEmpty ? nil : t
        }
        let now = Date()
        let draft = Booking(
            id: "local_\(UUID().uuidString)",
            siteId: site.id,
            siteSlug: site.slug,
            siteName: site.name,
            status: .new,
            customerName: customerName.trimmingCharacters(in: .whitespacesAndNewlines),
            email: clean(email),
            phone: clean(phone),
            address: clean(address),
            serviceType: serviceType,
            preferredDate: hasPreferredDate ? Self.dateFormatter.string(from: preferredDate) : nil,
            preferredTime: hasPreferredDate ? clean(preferredTime) : nil,
            notes: clean(notes),
            internalNotes: clean(internalNotes),
            createdAt: now,
            updatedAt: now
        )
        bookingsVM.addBooking(draft)
        dismiss()
    }
}

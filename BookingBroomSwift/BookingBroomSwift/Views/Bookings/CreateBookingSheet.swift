import SwiftUI

public struct CreateBookingSheet: View {
    @ObservedObject var bookingsVM: BookingsViewModel
    @Environment(\.dismiss) private var dismiss
    
    @State private var customerName = ""
    @State private var phone = ""
    @State private var email = ""
    @State private var address = ""
    @State private var selectedSite = MockDataService.shared.sampleSites.first!
    @State private var serviceType = "Deep Clean"
    @State private var estimatePrice = "220"
    @State private var notes = ""
    
    let serviceOptions = ["Standard Clean", "Deep Clean", "Move-In / Move-Out", "Post-Construction", "Weekly Maintenance"]
    
    public init(bookingsVM: BookingsViewModel) {
        self.bookingsVM = bookingsVM
    }
    
    public var body: some View {
        NavigationStack {
            Form {
                Section("Cleaning Site") {
                    Picker("Select Site", selection: $selectedSite) {
                        ForEach(MockDataService.shared.sampleSites) { site in
                            Text(site.name).tag(site)
                        }
                    }
                }
                
                Section("Customer Details") {
                    TextField("Customer Full Name", text: $customerName)
                    TextField("Phone Number", text: $phone)
                        .platformKeyboardType(.phonePad)
                    TextField("Email Address", text: $email)
                        .platformKeyboardType(.emailAddress)
                        .platformAutocapitalizationNone()
                    TextField("Property Address", text: $address)
                }
                
                Section("Service & Estimate") {
                    Picker("Service Type", selection: $serviceType) {
                        ForEach(serviceOptions, id: \.self) { opt in
                            Text(opt)
                        }
                    }
                    
                    HStack {
                        Text("Price Estimate ($)")
                        Spacer()
                        TextField("220", text: $estimatePrice)
                            .platformKeyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                    }
                }
                
                Section("Notes & Special Requests") {
                    TextEditor(text: $notes)
                        .frame(height: 80)
                        .bbEditorChrome()
                }
            }
            .navigationTitle("Create Test Booking")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let newB = Booking(
                            id: "b_\(UUID().uuidString.prefix(6))",
                            siteId: selectedSite.id,
                            siteSlug: selectedSite.slug,
                            siteName: selectedSite.name,
                            status: .new,
                            customerName: customerName.isEmpty ? "New Lead Customer" : customerName,
                            email: email.isEmpty ? "customer@example.com" : email,
                            phone: phone.isEmpty ? "+1 (407) 555-0100" : phone,
                            address: address.isEmpty ? "100 Main St, Sanford FL" : address,
                            serviceType: serviceType,
                            preferredDate: "2026-09-05",
                            notes: notes,
                            quote: BookingQuote(estimate: Double(estimatePrice) ?? 220.0),
                            createdAt: Date()
                        )
                        bookingsVM.addBooking(newB)
                        dismiss()
                    }
                    .font(.headline)
                    .disabled(customerName.isEmpty && phone.isEmpty)
                }
            }
        }
    }
}

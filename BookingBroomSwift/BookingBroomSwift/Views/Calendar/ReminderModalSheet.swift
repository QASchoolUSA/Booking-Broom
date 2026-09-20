import SwiftUI

public struct ReminderModalSheet: View {
    @ObservedObject var bookingsVM: BookingsViewModel
    public var initialDate: Date?
    public var initialBookingId: String?
    
    @Environment(\.dismiss) private var dismiss
    @State private var title: String = ""
    @State private var notes: String = ""
    @State private var dueDate: Date = Date()
    @State private var allDay: Bool = false
    @State private var isSaving: Bool = false
    
    public init(bookingsVM: BookingsViewModel, initialDate: Date? = nil, initialBookingId: String? = nil) {
        self.bookingsVM = bookingsVM
        self.initialDate = initialDate
        self.initialBookingId = initialBookingId
    }
    
    public var body: some View {
        NavigationStack {
            Form {
                Section("Reminder Details") {
                    TextField("Title (e.g. Call customer...)", text: $title)
                    TextField("Notes (optional)", text: $notes, axis: .vertical)
                        .lineLimit(2...4)
                }
                
                Section("Schedule") {
                    Toggle("All Day", isOn: $allDay)
                    
                    DatePicker("Date", selection: $dueDate, displayedComponents: allDay ? [.date] : [.date, .hourAndMinute])
                }
                
                if let bId = initialBookingId, let b = bookingsVM.bookings.first(where: { $0.id == bId }) {
                    Section("Linked Booking") {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(b.customerName)
                                    .font(.subheadline.bold())
                                Text("\(b.serviceType) · \(b.siteName)")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            StatusPill(status: b.status)
                        }
                    }
                }
            }
            .navigationTitle("New Reminder")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        bookingsVM.createReminder(
                            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                            notes: notes.isEmpty ? nil : notes,
                            dueAt: dueDate,
                            allDay: allDay,
                            bookingId: initialBookingId
                        )
                        dismiss()
                    }
                    .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
                    .font(.headline.bold())
                }
            }
            .onAppear {
                if let d = initialDate {
                    self.dueDate = d
                }
            }
        }
    }
}

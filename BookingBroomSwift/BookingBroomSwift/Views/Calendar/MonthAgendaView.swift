import SwiftUI

public struct MonthAgendaView: View {
    @ObservedObject var bookingsVM: BookingsViewModel
    @ObservedObject var messagesVM: MessagesViewModel
    @State private var selectedBookingForSheet: Booking? = nil
    
    public init(bookingsVM: BookingsViewModel, messagesVM: MessagesViewModel) {
        self.bookingsVM = bookingsVM
        self.messagesVM = messagesVM
    }
    
    private let weekdays = ["S", "M", "T", "W", "T", "F", "S"]
    private let calendar = Calendar.current
    
    private var eventsByDay: [Date: [CalendarEvent]] {
        bookingsVM.eventsByDay
    }
    
    private func events(for day: Date) -> [CalendarEvent] {
        let key = calendar.startOfDay(for: day)
        return eventsByDay[key] ?? []
    }
    
    public var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Month Navigation Header
                HStack {
                    Button(action: { changeMonth(by: -1) }) {
                        Image(systemName: "chevron.left")
                            .font(.headline)
                            .foregroundColor(AppColors.primary)
                            .padding(8)
                    }
                    
                    Spacer()
                    
                    Text(bookingsVM.calendarCursor, format: .dateTime.month(.wide).year())
                        .font(.title3.bold())
                        .foregroundColor(.primary)
                    
                    Spacer()
                    
                    Button(action: { changeMonth(by: 1) }) {
                        Image(systemName: "chevron.right")
                            .font(.headline)
                            .foregroundColor(AppColors.primary)
                            .padding(8)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                
                // Weekday Headers
                HStack(spacing: 0) {
                    ForEach(Array(weekdays.enumerated()), id: \.offset) { _, day in
                        Text(day)
                            .font(.caption2.bold())
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity)
                    }
                }
                .padding(.horizontal, 16)
                
                // Days Grid
                let days = generateDaysInMonth(for: bookingsVM.calendarCursor)
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 8) {
                    ForEach(days, id: \.self) { date in
                        if let date = date {
                            let isSelected = calendar.isDate(date, inSameDayAs: bookingsVM.selectedCalendarDay)
                            let isToday = calendar.isDateInToday(date)
                            let dayEvents = events(for: date)
                            
                            Button(action: {
                                bookingsVM.selectedCalendarDay = date
                            }) {
                                VStack(spacing: 4) {
                                    ZStack {
                                        if isSelected {
                                            Circle()
                                                .fill(AppColors.primary)
                                                .frame(width: 32, height: 32)
                                        } else if isToday {
                                            Circle()
                                                .stroke(AppColors.primary, lineWidth: 1.5)
                                                .frame(width: 32, height: 32)
                                        }
                                        
                                        Text("\(calendar.component(.day, from: date))")
                                            .font(.system(size: 14, weight: isSelected || isToday ? .bold : .medium))
                                            .foregroundColor(isSelected ? .white : (isToday ? AppColors.primary : .primary))
                                    }
                                    
                                    // Event Dots
                                    HStack(spacing: 3) {
                                        ForEach(dayEvents.prefix(3)) { ev in
                                            Circle()
                                                .fill(ev.eventColor)
                                                .frame(width: 4, height: 4)
                                        }
                                    }
                                    .frame(height: 6)
                                }
                                .frame(height: 48)
                            }
                        } else {
                            Color.clear.frame(height: 48)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .glassCard()
                .padding(.horizontal, 16)
                
                // Selected Day Agenda Section
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(bookingsVM.selectedCalendarDay, format: .dateTime.weekday(.wide).month(.abbreviated).day())
                                .font(.headline)
                            Text("\(events(for: bookingsVM.selectedCalendarDay).count) scheduled item(s)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        Spacer()
                        
                        Button(action: {
                            bookingsVM.reminderInitialDate = bookingsVM.selectedCalendarDay
                            bookingsVM.reminderInitialBookingId = nil
                            bookingsVM.showingAddReminderModal = true
                        }) {
                            HStack(spacing: 4) {
                                Image(systemName: "plus")
                                Text("Add Reminder")
                            }
                            .font(.caption.bold())
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(AppColors.amber.opacity(0.15))
                            .foregroundColor(AppColors.amber)
                            .clipShape(Capsule())
                        }
                    }
                    
                    let dayEvents = events(for: bookingsVM.selectedCalendarDay)
                    if dayEvents.isEmpty {
                        HStack {
                            Spacer()
                            VStack(spacing: 6) {
                                Image(systemName: "calendar.badge.clock")
                                    .font(.title2)
                                    .foregroundColor(.secondary)
                                Text("No jobs or reminders for this date.")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.vertical, 20)
                            Spacer()
                        }
                        .glassCard()
                    } else {
                        ForEach(dayEvents) { ev in
                            if ev.kind == .reminder {
                                HStack(spacing: 12) {
                                    ZStack {
                                        Circle()
                                            .fill(AppColors.amber.opacity(0.15))
                                            .frame(width: 36, height: 36)
                                        Image(systemName: "bell.fill")
                                            .font(.caption.bold())
                                            .foregroundColor(AppColors.amber)
                                    }
                                    
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(ev.title)
                                            .font(.subheadline.bold())
                                        if let sub = ev.subtitle, !sub.isEmpty {
                                            Text(sub)
                                                .font(.caption)
                                                .foregroundColor(.secondary)
                                        }
                                        Text(ev.startDate, style: .time)
                                            .font(.caption2)
                                            .foregroundColor(AppColors.amber)
                                    }
                                    
                                    Spacer()
                                    
                                    Button(action: {
                                        if let rId = ev.id.components(separatedBy: "ev_rem_").last {
                                            bookingsVM.removeReminder(reminderId: rId)
                                        }
                                    }) {
                                        Image(systemName: "xmark.circle.fill")
                                            .font(.headline)
                                            .foregroundColor(.secondary.opacity(0.6))
                                    }
                                }
                                .padding(12)
                                .glassCard()
                            } else {
                                Button(action: {
                                    if let bId = ev.bookingId, let b = bookingsVM.bookings.first(where: { $0.id == bId }) {
                                        selectedBookingForSheet = b
                                    }
                                }) {
                                    HStack(spacing: 12) {
                                        ZStack {
                                            Circle()
                                                .fill(ev.eventColor.opacity(0.15))
                                                .frame(width: 36, height: 36)
                                            Image(systemName: "sparkles")
                                                .font(.caption.bold())
                                                .foregroundColor(ev.eventColor)
                                        }
                                        
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(ev.title)
                                                .font(.subheadline.bold())
                                                .foregroundColor(.primary)
                                            
                                            HStack(spacing: 6) {
                                                if let s = ev.siteName {
                                                    Text(s)
                                                        .font(.caption2.bold())
                                                        .foregroundColor(AppColors.primary)
                                                }
                                                if let sub = ev.subtitle {
                                                    Text("· \(sub)")
                                                        .font(.caption2)
                                                        .foregroundColor(.secondary)
                                                        .lineLimit(1)
                                                }
                                            }
                                            
                                            Text(ev.startDate, style: .time)
                                                .font(.caption2.weight(.medium))
                                                .foregroundColor(.secondary)
                                        }
                                        
                                        Spacer()
                                        
                                        Image(systemName: "chevron.right")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                    .padding(12)
                                    .glassCard()
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
            }
        }
        .sheet(item: $selectedBookingForSheet) { b in
            BookingDetailView(
                booking: b,
                bookingsVM: bookingsVM,
                messagesVM: messagesVM,
                onStatusChange: { newSt in
                    bookingsVM.updateStatus(booking: b, newStatus: newSt)
                }
            )
        }
        .sheet(isPresented: $bookingsVM.showingAddReminderModal) {
            ReminderModalSheet(
                bookingsVM: bookingsVM,
                initialDate: bookingsVM.reminderInitialDate,
                initialBookingId: bookingsVM.reminderInitialBookingId
            )
        }
    }
    
    private func changeMonth(by amount: Int) {
        if let newDate = calendar.date(byAdding: .month, value: amount, to: bookingsVM.calendarCursor) {
            bookingsVM.calendarCursor = newDate
            bookingsVM.selectedCalendarDay = newDate
            bookingsVM.loadCalendarEvents()
        }
    }
    
    private func generateDaysInMonth(for date: Date) -> [Date?] {
        guard let monthInterval = calendar.dateInterval(of: .month, for: date) else { return [] }
        let firstDayOfMonth = monthInterval.start
        let weekdayOfFirstDay = calendar.component(.weekday, from: firstDayOfMonth) - 1
        
        let range = calendar.range(of: .day, in: .month, for: date)!
        let numDays = range.count
        
        var days: [Date?] = Array(repeating: nil, count: weekdayOfFirstDay)
        for day in 1...numDays {
            if let d = calendar.date(byAdding: .day, value: day - 1, to: firstDayOfMonth) {
                days.append(d)
            }
        }
        return days
    }
}

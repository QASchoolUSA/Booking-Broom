import SwiftUI

public struct BookingCardView: View {
    public let booking: Booking
    @Bindable var bookingsVM: BookingsViewModel
    @Bindable var messagesVM: MessagesViewModel
    public var onStatusChange: ((BookingStatus) -> Void)?

    @State private var showingDetailSheet = false

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
    }

    private var siteAccent: Color {
        bookingsVM.sites.first(where: { $0.id == booking.siteId })?.accentColor
            ?? AppColors.primary
    }

    private var scheduleLine: String? {
        if let start = booking.scheduledStartAt {
            let df = DateFormatter()
            df.dateStyle = .medium
            df.timeStyle = .short
            return df.string(from: start)
        }
        if let date = booking.preferredDate {
            if let time = booking.preferredTime, !time.isEmpty {
                return "\(date) · \(time)"
            }
            return date
        }
        return nil
    }

    public var body: some View {
        Button(action: {
            showingDetailSheet = true
        }) {
            HStack(spacing: 0) {
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .fill(siteAccent)
                    .frame(width: 4)
                    .padding(.vertical, 2)

                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .center, spacing: 8) {
                        Text(booking.siteName)
                            .font(AppTypography.microBold)
                            .foregroundStyle(siteAccent)
                            .lineLimit(1)

                        Spacer(minLength: 4)

                        StatusPill(status: booking.status)
                    }

                    HStack(alignment: .firstTextBaseline) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(booking.customerName)
                                .font(AppTypography.rowTitle)
                                .foregroundStyle(.primary)
                                .lineLimit(1)

                            Text(booking.serviceType)
                                .font(AppTypography.meta)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }

                        Spacer(minLength: 8)

                        if let quote = booking.quote {
                            Text(quote.formattedPrice)
                                .font(AppTypography.price)
                                .monospacedDigit()
                                .foregroundStyle(AppColors.emerald)
                        }
                    }

                    if let scheduleLine {
                        HStack(spacing: 4) {
                            Image(systemName: "calendar")
                                .font(AppTypography.micro)
                            Text(scheduleLine)
                                .font(AppTypography.meta)
                                .lineLimit(1)
                        }
                        .foregroundStyle(.secondary)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
            }
            .appElevatedSurface()
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button(action: { onStatusChange?(.confirmed) }) {
                Label("Mark Confirmed", systemImage: "checkmark.seal")
            }
            Button(action: { onStatusChange?(.completed) }) {
                Label("Mark Completed", systemImage: "checkmark.circle")
            }
            Button(role: .destructive, action: { onStatusChange?(.cancelled) }) {
                Label("Cancel Booking", systemImage: "xmark.circle")
            }
        }
        .sheet(isPresented: $showingDetailSheet) {
            BookingDetailView(
                booking: booking,
                bookingsVM: bookingsVM,
                messagesVM: messagesVM,
                onStatusChange: onStatusChange
            )
        }
    }
}

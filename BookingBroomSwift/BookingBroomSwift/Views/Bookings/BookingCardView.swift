import SwiftUI

public struct BookingCardView: View {
    public let booking: Booking
    @ObservedObject var bookingsVM: BookingsViewModel
    @ObservedObject var messagesVM: MessagesViewModel
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
    
    public var body: some View {
        Button(action: {
            showingDetailSheet = true
        }) {
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                HStack(alignment: .firstTextBaseline) {
                    Text(booking.siteName)
                        .font(AppTypography.meta)
                        .foregroundStyle(.secondary)
                    
                    Spacer()
                    
                    StatusPill(status: booking.status)
                }
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(booking.customerName)
                        .font(AppTypography.rowTitle)
                        .foregroundStyle(.primary)
                    
                    Text(booking.serviceType)
                        .font(AppTypography.meta)
                        .foregroundStyle(.secondary)
                }
                
                HStack {
                    if let date = booking.preferredDate {
                        HStack(spacing: 4) {
                            Image(systemName: "calendar")
                                .font(AppTypography.micro)
                            Text(date)
                                .font(AppTypography.meta)
                        }
                        .foregroundStyle(.secondary)
                    }
                    
                    Spacer()
                    
                    if let quote = booking.quote {
                        Text(quote.formattedPrice)
                            .font(AppTypography.price)
                            .monospacedDigit()
                            .foregroundStyle(AppColors.emerald)
                    }
                }
            }
            .padding(AppSpacing.cardPadding)
            .appSurface()
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

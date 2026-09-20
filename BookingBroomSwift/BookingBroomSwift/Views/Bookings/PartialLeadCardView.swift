import SwiftUI

public struct PartialLeadCardView: View {
    public let lead: PartialLead

    public init(lead: PartialLead) {
        self.lead = lead
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack(alignment: .firstTextBaseline) {
                Text(lead.siteName)
                    .font(AppTypography.meta)
                    .foregroundStyle(.secondary)

                Spacer()

                abandonedPill
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(lead.displayName)
                    .font(AppTypography.rowTitle)
                    .foregroundStyle(.primary)
                    .lineLimit(1)

                Text(lead.serviceType?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
                    ?? "Incomplete quote")
                    .font(AppTypography.meta)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            HStack {
                if let date = lead.preferredDate, !date.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "calendar")
                            .font(AppTypography.micro)
                        Text(date)
                            .font(AppTypography.meta)
                    }
                    .foregroundStyle(.secondary)
                }

                Spacer()

                if let quote = lead.quote {
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

    private var abandonedPill: some View {
        HStack(spacing: 4) {
            Image(systemName: "clock.badge.exclamationmark")
                .font(AppTypography.microBold)
            Text("Abandoned")
                .font(AppTypography.metaBold)
        }
        .padding(.horizontal, pillHPadding)
        .padding(.vertical, pillVPadding)
        .background(Color.secondary.opacity(0.15))
        .foregroundStyle(.secondary)
        .clipShape(Capsule())
        #if os(iOS)
        .overlay(
            Capsule()
                .stroke(Color.secondary.opacity(0.3), lineWidth: 0.5)
        )
        #endif
    }

    private var pillHPadding: CGFloat {
        #if os(macOS)
        8
        #else
        10
        #endif
    }

    private var pillVPadding: CGFloat {
        #if os(macOS)
        3
        #else
        5
        #endif
    }
}

private extension String {
    var nilIfEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

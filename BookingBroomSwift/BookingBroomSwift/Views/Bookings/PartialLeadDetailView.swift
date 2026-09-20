import SwiftUI

public struct PartialLeadDetailView: View {
    public let lead: PartialLead
    @Environment(\.dismiss) private var dismiss

    public init(lead: PartialLead) {
        self.lead = lead
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(lead.displayName)
                                .font(.title2.bold())
                            HStack(spacing: 6) {
                                Text(lead.siteName)
                                    .font(.subheadline.bold())
                                    .foregroundColor(AppColors.primary)
                                Text("·")
                                    .foregroundColor(.secondary)
                                Text(lead.serviceType?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
                                    ?? "Incomplete quote")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                        }
                        Spacer()
                        abandonedPill
                    }
                    .padding(.top, 4)

                    if lead.phone != nil || lead.email != nil {
                        HStack(spacing: AppSpacing.sm) {
                            if let phone = lead.phone, !phone.isEmpty,
                               let smsURL = URL(string: "sms:\(phone.filter(\.isNumber))") {
                                Link(destination: smsURL) {
                                    Label("Text", systemImage: "message.fill")
                                        .font(AppTypography.metaBold)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 10)
                                }
                                .buttonStyle(.bordered)
                            }
                            if let email = lead.email, !email.isEmpty,
                               let mailURL = URL(string: "mailto:\(email)") {
                                Link(destination: mailURL) {
                                    Label("Email", systemImage: "envelope.fill")
                                        .font(AppTypography.metaBold)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 10)
                                }
                                .buttonStyle(.bordered)
                            }
                        }
                    }

                    Group {
                        if let phone = lead.phone, !phone.isEmpty {
                            detailBlock(title: "Phone", value: phone, systemImage: "phone")
                        }
                        if let email = lead.email, !email.isEmpty {
                            detailBlock(title: "Email", value: email, systemImage: "envelope")
                        }
                        if let address = lead.address, !address.isEmpty {
                            detailBlock(title: "Address", value: address, systemImage: "mappin.and.ellipse")
                        }
                        if let date = lead.preferredDate, !date.isEmpty {
                            let time = lead.preferredTime.map { " · \($0)" } ?? ""
                            detailBlock(title: "Preferred", value: "\(date)\(time)", systemImage: "calendar")
                        }
                        if let summary = lead.propertySummary {
                            detailBlock(title: "Property", value: summary, systemImage: "house")
                        }
                        if let quote = lead.quote {
                            detailBlock(title: "Estimate", value: quote.formattedPrice, systemImage: "dollarsign.circle")
                        }
                        if let step = lead.lastStep, !step.isEmpty {
                            detailBlock(title: "Last step", value: step, systemImage: "figure.walk")
                        }
                        if let notes = lead.notes, !notes.isEmpty {
                            detailBlock(title: "Notes", value: notes, systemImage: "note.text")
                        }
                    }

                    Text("Soft lead only — no confirmation email or SMS was sent.")
                        .font(AppTypography.meta)
                        .foregroundStyle(.secondary)
                }
                .padding(AppSpacing.md)
            }
            .background(AppColors.groupedBackground.ignoresSafeArea())
            .navigationTitle("Abandoned lead")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private var abandonedPill: some View {
        HStack(spacing: 4) {
            Image(systemName: "clock.badge.exclamationmark")
                .font(AppTypography.microBold)
            Text("Abandoned")
                .font(AppTypography.metaBold)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(Color.secondary.opacity(0.15))
        .foregroundStyle(.secondary)
        .clipShape(Capsule())
    }

    @ViewBuilder
    private func detailBlock(title: String, value: String, systemImage: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: systemImage)
                .font(AppTypography.meta)
                .foregroundStyle(.secondary)
            Text(value)
                .font(AppTypography.rowTitle)
                .textSelection(.enabled)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(AppSpacing.cardPadding)
        .appSurface()
    }
}

private extension String {
    var nilIfEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

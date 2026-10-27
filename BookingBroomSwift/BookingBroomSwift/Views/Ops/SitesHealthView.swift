import SwiftUI

public struct SitesHealthView: View {
    @Bindable var opsVM: OpsViewModel

    public init(opsVM: OpsViewModel) {
        self.opsVM = opsVM
    }

    public var body: some View {
        ScrollView {
            BBWidePage {
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Button {
                        opsVM.checkHealthNow()
                    } label: {
                        HStack {
                            if opsVM.isCheckingHealth {
                                ProgressView().controlSize(.small)
                                Text("Checking…")
                            } else {
                                Image(systemName: "stethoscope")
                                Text("Check Health Now")
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .bbPrimaryButton(isLoading: opsVM.isCheckingHealth, expand: true)
                    .disabled(opsVM.isCheckingHealth)

                    if opsVM.sitesHealth.isEmpty {
                        ContentUnavailableView(
                            "No sites available",
                            systemImage: "globe",
                            description: Text("Pull to refresh after sites are seeded.")
                        )
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, AppSpacing.xxl)
                    } else {
                        LazyVStack(spacing: AppSpacing.sm) {
                            ForEach(opsVM.sitesHealth) { row in
                                healthCard(row)
                            }
                        }
                    }
                }
                .padding(.vertical, AppSpacing.md)
            }
        }
        .bbPageBackground()
        .navigationTitle("Sites Health")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.large)
        #endif
        .refreshable {
            await opsVM.loadHealthAndWait()
        }
        .onAppear {
            opsVM.ensureHealthLoaded()
        }
    }

    private func healthCard(_ row: SiteHealthRow) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                Text(row.siteName)
                    .font(AppTypography.rowTitle)
                Spacer()
                if let h = row.health {
                    Label(h.status.capitalized, systemImage: h.isOnline ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .font(AppTypography.microBold)
                        .foregroundStyle(h.isOnline ? AppColors.emerald : AppColors.rose)
                }
            }

            HStack(spacing: 6) {
                Text(row.domain)
                    .font(AppTypography.metaBold)
                    .foregroundStyle(AppColors.primary)
                if let ip = row.health?.ipAddress {
                    Text("· \(ip)")
                        .font(AppTypography.meta)
                        .foregroundStyle(.secondary)
                }
            }

            Divider()

            HStack(spacing: AppSpacing.sm) {
                Label(row.hostingProvider ?? "Cloudflare", systemImage: "server.rack")
                    .font(AppTypography.micro)
                    .foregroundStyle(.secondary)
                Spacer()
                Text("Email: \(row.emailConfigured ? "Ready" : "Pending")")
                    .font(AppTypography.microBold)
                    .foregroundStyle(row.emailConfigured ? AppColors.emerald : AppColors.amber)
                if let http = row.health?.httpStatus {
                    Text("HTTP \(http)")
                        .font(AppTypography.micro)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(AppSpacing.cardPadding)
        .appSurface()
    }
}

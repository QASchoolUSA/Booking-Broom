import SwiftUI

#if canImport(UIKit)
import UIKit
#endif

public struct DeploymentsView: View {
    @Bindable var deploymentsVM: DeploymentsViewModel

    public init(deploymentsVM: DeploymentsViewModel) {
        self.deploymentsVM = deploymentsVM
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Button(action: { deploymentsVM.syncNow() }) {
                    HStack {
                        if deploymentsVM.isSyncing {
                            ProgressView()
                                .tint(.white)
                            Text("Syncing deployments…")
                        } else {
                            Image(systemName: "arrow.triangle.2.circlepath.circle.fill")
                            Text("Sync Deployments")
                        }
                    }
                    .font(.subheadline.bold())
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(AppColors.primary)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(deploymentsVM.isSyncing)

                if let err = deploymentsVM.lastError, !err.isEmpty {
                    Text(err)
                        .font(.caption)
                        .foregroundColor(AppColors.amber)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                if !deploymentsVM.rows.isEmpty {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        overviewChip("Success", "\(deploymentsVM.successCount)", AppColors.emerald)
                        overviewChip("Failed", "\(deploymentsVM.failedCount)", AppColors.rose)
                        overviewChip("Building", "\(deploymentsVM.buildingCount)", AppColors.primary)
                        overviewChip("Usage alerts", "\(deploymentsVM.usageAlertCount)", AppColors.amber)
                    }
                }

                if deploymentsVM.rows.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "cloud")
                            .font(.system(size: 40))
                            .foregroundColor(.secondary)
                        Text("No deployment data yet")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        Text("Tap Sync to pull Workers Builds status.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 30)
                } else {
                    ForEach(deploymentsVM.rows) { row in
                        DeploymentCardView(row: row)
                    }
                }
            }
            .padding(16)
        }
        .background(AppColors.groupedBackground.ignoresSafeArea())
        .navigationTitle("Deployments")
        .refreshable { await deploymentsVM.loadAndWait() }
        .onAppear { deploymentsVM.ensureLoaded() }
        .onChange(of: deploymentsVM.lastError) { _, newValue in
            guard let newValue, !newValue.isEmpty else { return }
            #if canImport(UIKit)
            let alert = UIAlertController(title: "Deployments", message: newValue, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
               let root = scene.keyWindow?.rootViewController ?? scene.windows.first?.rootViewController {
                root.present(alert, animated: true)
            }
            #endif
        }
    }

    private func overviewChip(_ title: String, _ value: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(.title2.bold())
                .foregroundColor(color)
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .glassCard()
    }
}

private struct DeploymentCardView: View {
    let row: DeploymentRow

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(row.name)
                    .font(.headline)
                Spacer()
                Text(row.statusLabel)
                    .font(.caption2.bold())
                    .foregroundColor(pillForeground)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(pillForeground.opacity(0.12))
                    .clipShape(Capsule())
            }

            HStack(spacing: 6) {
                if let worker = row.workerName {
                    Text(worker)
                        .font(.caption.monospaced())
                        .foregroundColor(.secondary)
                }
                if let domain = row.domain {
                    Text("· \(domain)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            if let error = row.error, !error.isEmpty {
                Text(error)
                    .font(.caption)
                    .foregroundColor(AppColors.amber)
            }

            if let used = row.requestsToday, let remaining = row.requestsRemaining {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("Free requests today")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Spacer()
                        Text("\(remaining.formatted()) left")
                            .font(.caption.bold())
                    }
                    ProgressView(value: Double(used), total: Double(max(1, row.requestsLimit)))
                        .tint(usageTint)
                    Text("\(used.formatted()) / \(row.requestsLimit.formatted()) · resets midnight UTC")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }

            if let reached = row.buildMinutesLimitReached {
                Text(
                    reached
                        ? "Builds minutes: Free limit reached"
                        : "Builds minutes: OK"
                )
                .font(.caption)
                .foregroundColor(reached ? AppColors.rose : .secondary)
            }

            if row.branch != nil || row.shortSha != nil {
                HStack {
                    Text("Commit")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                    Text("\(row.branch ?? "—")\(row.shortSha.map { " @ \($0)" } ?? "")")
                        .font(.caption.monospaced())
                }
            }

            if let message = row.commitMessage, !message.isEmpty {
                Text(message)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }

            if let urlString = row.dashboardUrl, let url = URL(string: urlString) {
                Link(destination: url) {
                    Label("Open in Cloudflare", systemImage: "arrow.up.right.square")
                        .font(.caption.bold())
                        .foregroundColor(AppColors.primary)
                }
            }
        }
        .padding(14)
        .glassCard()
    }

    private var pillForeground: Color {
        if row.isSuccess { return AppColors.emerald }
        if row.isFailed { return AppColors.rose }
        if row.isBuilding { return AppColors.primary }
        if row.error != nil { return AppColors.amber }
        return .secondary
    }

    private var usageTint: Color {
        guard let pct = row.usagePercent else { return AppColors.emerald }
        if pct >= 90 { return AppColors.rose }
        if pct >= 70 { return AppColors.amber }
        return AppColors.emerald
    }
}

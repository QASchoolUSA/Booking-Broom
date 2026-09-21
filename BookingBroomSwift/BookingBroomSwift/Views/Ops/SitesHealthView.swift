import SwiftUI

public struct SitesHealthView: View {
    @Bindable var opsVM: OpsViewModel
    
    public init(opsVM: OpsViewModel) {
        self.opsVM = opsVM
    }
    
    public var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Header Action Banner
                Button(action: {
                    opsVM.checkHealthNow()
                }) {
                    HStack {
                        if opsVM.isCheckingHealth {
                            ProgressView()
                                .tint(.white)
                            Text("Checking Sites Health...")
                        } else {
                            Image(systemName: "stethoscope")
                            Text("Check Health Now")
                        }
                    }
                    .font(.subheadline.bold())
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(AppColors.primary)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(opsVM.isCheckingHealth)
                
                if opsVM.sitesHealth.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "globe")
                            .font(.system(size: 40))
                            .foregroundColor(.secondary)
                        Text("No sites available")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 30)
                } else {
                    ForEach(opsVM.sitesHealth) { row in
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Text(row.siteName)
                                    .font(.headline)
                                Spacer()
                                if let h = row.health {
                                    HStack(spacing: 4) {
                                        Circle()
                                            .fill(h.isOnline ? AppColors.emerald : AppColors.rose)
                                            .frame(width: 8, height: 8)
                                        Text(h.status.capitalized)
                                            .font(.caption2.bold())
                                            .foregroundColor(h.isOnline ? AppColors.emerald : AppColors.rose)
                                    }
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background((h.isOnline ? AppColors.emerald : AppColors.rose).opacity(0.12))
                                    .clipShape(Capsule())
                                }
                            }
                            
                            HStack(spacing: 6) {
                                Text(row.domain)
                                    .font(.caption.bold())
                                    .foregroundColor(AppColors.primary)
                                if let ip = row.health?.ipAddress {
                                    Text("· \(ip)")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                            
                            Divider()
                            
                            HStack(spacing: 8) {
                                Label(row.hostingProvider ?? "Cloudflare", systemImage: "server.rack")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                                
                                Spacer()
                                
                                Text("Email: \(row.emailConfigured ? "Ready" : "Pending")")
                                    .font(.caption2.bold())
                                    .foregroundColor(row.emailConfigured ? AppColors.emerald : AppColors.amber)
                                
                                if let http = row.health?.httpStatus {
                                    Text("· HTTP \(http)")
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                        .padding(14)
                        .glassCard()
                    }
                }
            }
            .padding(16)
        }
        .background(AppColors.groupedBackground.ignoresSafeArea())
        .navigationTitle("Sites Health & Ops")
        .refreshable {
            await opsVM.loadHealthAndWait()
        }
        .onAppear {
            opsVM.ensureHealthLoaded()
        }
    }
}

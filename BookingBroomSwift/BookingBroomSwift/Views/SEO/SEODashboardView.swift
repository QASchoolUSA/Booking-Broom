import SwiftUI

public struct SEODashboardView: View {
    @Bindable var seoVM: SEOViewModel
    
    public init(seoVM: SEOViewModel) {
        self.seoVM = seoVM
    }
    
    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let err = seoVM.syncError {
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(AppColors.amber)
                        Text(err)
                            .font(.caption)
                            .foregroundColor(.primary)
                        Spacer()
                        Button("Dismiss") { seoVM.clearSyncError() }
                            .font(.caption.bold())
                    }
                    .padding(12)
                    .background(AppColors.amber.opacity(0.15))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                
                // Google / Bing Picker
                Picker("Engine", selection: $seoVM.selectedSource) {
                    Text("Google Search Console").tag("google")
                    Text("Bing Webmaster").tag("bing")
                }
                .pickerStyle(.segmented)
                
                // Period Selector
                #if os(macOS)
                Picker("Period", selection: $seoVM.selectedPeriodDays) {
                    ForEach(SEOViewModel.periodOptions) { opt in
                        Text(opt.label).tag(opt.days)
                    }
                }
                .pickerStyle(.segmented)
                #else
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: AppSpacing.xs) {
                        ForEach(SEOViewModel.periodOptions) { opt in
                            let isSelected = seoVM.selectedPeriodDays == opt.days
                            Button {
                                seoVM.selectedPeriodDays = opt.days
                            } label: {
                                Text(opt.label)
                                    .font(AppTypography.metaBold)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(isSelected ? AppColors.primary : Color.secondary.opacity(0.12))
                                    .foregroundStyle(isSelected ? .white : .primary)
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                #endif
                
                // Summary Banner
                HStack(spacing: 12) {
                    StatCard(title: "Total Clicks", value: "\(seoVM.totalClicks)", iconName: "cursorarrow.rays", iconColor: AppColors.primary, trend: "+14%")
                    StatCard(title: "Impressions", value: "\(seoVM.totalImpressions)", iconName: "eye.fill", iconColor: AppColors.violet)
                }
                
                HStack(spacing: 12) {
                    StatCard(title: "Avg CTR", value: String(format: "%.2f%%", seoVM.averageCTR), iconName: "percent", iconColor: AppColors.emerald)
                    StatCard(title: "Avg Position", value: String(format: "%.1f", seoVM.averagePosition), iconName: "chart.line.uptrend.xyaxis", iconColor: AppColors.amber)
                }
                
                // Per-site SEO Cards
                VStack(alignment: .leading, spacing: 14) {
                    Text("Site Performance & Keywords")
                        .font(.headline)
                    
                    ForEach(seoVM.seoMetricsList) { seo in
                        SiteSEOCard(seo: seo)
                    }
                }
            }
            .padding(16)
        }
        .background(AppColors.groupedBackground.ignoresSafeArea())
        .navigationTitle("SEO Analytics")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: { seoVM.syncMetrics() }) {
                    if seoVM.isSyncing {
                        ProgressView()
                    } else {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
        }
        .refreshable {
            // Convex-only reload; GSC/Bing sync stays on the toolbar Sync button.
            await seoVM.loadMetricsAndWait()
        }
        .onAppear {
            seoVM.ensureLoaded()
        }
    }
}

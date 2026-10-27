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

                if seoVM.selectedSource == "google" {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text("Index coverage (all sites)")
                                .font(.subheadline.weight(.semibold))
                            Spacer()
                            Button {
                                seoVM.syncIndexCoverage()
                            } label: {
                                if seoVM.isSyncingIndex {
                                    ProgressView()
                                } else {
                                    Label("Sync index", systemImage: "magnifyingglass")
                                        .font(.caption.weight(.semibold))
                                }
                            }
                            .disabled(seoVM.isSyncingIndex || seoVM.isSyncing)
                        }

                        HStack(spacing: 12) {
                            StatCard(
                                title: "Indexed",
                                value: seoVM.hasIndexCoverage ? "\(seoVM.totalIndexedPages)" : "—",
                                iconName: "checkmark.seal.fill",
                                iconColor: AppColors.emerald
                            )
                            StatCard(
                                title: "Not indexed",
                                value: seoVM.hasIndexCoverage ? "\(seoVM.totalNotIndexedPages)" : "—",
                                iconName: "xmark.seal.fill",
                                iconColor: AppColors.rose
                            )
                        }
                        HStack(spacing: 12) {
                        StatCard(
                            title: "Sitemap pages",
                            value: seoVM.hasIndexCoverage ? "\(seoVM.totalPages)" : "—",
                            iconName: "doc.on.doc.fill",
                            iconColor: AppColors.violet
                        )
                        StatCard(
                            title: seoVM.indexCoveragePartial ? "% indexed (est.)" : "% indexed",
                            value: seoVM.hasIndexCoverage
                                ? String(format: "%.0f%%", seoVM.percentIndexed)
                                : "—",
                            iconName: "percent",
                            iconColor: AppColors.amber
                        )
                    }

                    if seoVM.hasIndexCoverage {
                        Text("\(seoVM.sitesWithIndexCoverage) of \(seoVM.seoMetricsList.count) sites · totals are sitemap URLs only (noindex city×service pages are excluded).")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    } else {
                        Text("Tap Sync index to pull sitemap × Search Analytics coverage. Traffic Sync alone does not fill these numbers.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    }
                }
                
                // Per-site SEO Cards
                VStack(alignment: .leading, spacing: 14) {
                    Text("Site Performance & Keywords")
                        .font(.headline)
                    
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            Text("Sort sites")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            ForEach(SEOSortKey.siteKeys) { key in
                                let active = seoVM.siteSort.key == key
                                Button {
                                    seoVM.selectSiteSort(key)
                                } label: {
                                    HStack(spacing: 3) {
                                        Text(key.siteLabel)
                                        if active {
                                            Image(systemName: seoVM.siteSort.dir == .desc ? "chevron.down" : "chevron.up")
                                                .font(.system(size: 9, weight: .bold))
                                        }
                                    }
                                    .font(.caption.weight(.semibold))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(active ? AppColors.primary : Color.secondary.opacity(0.12))
                                    .foregroundStyle(active ? Color.white : Color.primary)
                                    .clipShape(Capsule())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    
                    Text("Tap Clicks / Impr. on a card to reorder keywords.")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    
                    ForEach(seoVM.seoMetricsList) { seo in
                        SiteSEOCard(
                            seo: seo,
                            keywordSort: seoVM.keywordSort,
                            onSelectKeywordSort: { key in
                                seoVM.selectKeywordSort(key)
                            }
                        )
                    }
                }
            }
            .padding(16)
        }
        .background(AppColors.groupedBackground.ignoresSafeArea())
        .navigationTitle("SEO Analytics")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button {
                        seoVM.syncMetrics()
                    } label: {
                        Label("Sync traffic", systemImage: "arrow.clockwise")
                    }
                    .disabled(seoVM.isSyncing || seoVM.isSyncingIndex)

                    if seoVM.selectedSource == "google" {
                        Button {
                            seoVM.syncIndexCoverage()
                        } label: {
                            Label("Sync index coverage", systemImage: "magnifyingglass")
                        }
                        .disabled(seoVM.isSyncing || seoVM.isSyncingIndex)
                    }
                } label: {
                    if seoVM.isSyncing || seoVM.isSyncingIndex {
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

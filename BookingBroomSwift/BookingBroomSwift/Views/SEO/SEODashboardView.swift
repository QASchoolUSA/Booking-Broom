import SwiftUI

public struct SEODashboardView: View {
    @Bindable var seoVM: SEOViewModel
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var selectedSiteId: String?

    public init(seoVM: SEOViewModel) {
        self.seoVM = seoVM
    }

    private var isWide: Bool { sizeClass == .regular }

    private var selectedSite: SEOMetrics? {
        guard let selectedSiteId else { return seoVM.seoMetricsList.first }
        return seoVM.seoMetricsList.first { $0.id == selectedSiteId } ?? seoVM.seoMetricsList.first
    }

    public var body: some View {
        Group {
            if isWide {
                wideLayout
            } else {
                phoneLayout
            }
        }
        .bbPageBackground()
        .navigationTitle("SEO")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.large)
        #endif
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
                            Label("Sync index", systemImage: "magnifyingglass")
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
            await seoVM.loadMetricsAndWait()
        }
        .onAppear {
            seoVM.ensureLoaded()
            if selectedSiteId == nil {
                selectedSiteId = seoVM.seoMetricsList.first?.id
            }
        }
        .onChange(of: seoVM.seoMetricsList) { _, list in
            if selectedSiteId == nil || !list.contains(where: { $0.id == selectedSiteId }) {
                selectedSiteId = list.first?.id
            }
        }
    }

    // MARK: - Wide (iPad / Mac)

    private var wideLayout: some View {
        HStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    controlsBlock
                    kpiBlock(columns: 4)
                    if seoVM.selectedSource == "google" {
                        indexCoverageBlock(compact: false)
                    }
                    siteSortBar
                    ForEach(seoVM.seoMetricsList) { seo in
                        Button {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                selectedSiteId = seo.id
                            }
                        } label: {
                            siteSidebarRow(seo, selected: seo.id == selectedSite?.id)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(AppSpacing.md)
            }
            .frame(minWidth: 300, idealWidth: 340, maxWidth: 380)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    if let err = seoVM.syncError {
                        syncErrorBanner(err)
                    }
                    if let seo = selectedSite {
                        SiteSEOCard(
                            seo: seo,
                            keywordSort: seoVM.keywordSort,
                            onSelectKeywordSort: { seoVM.selectKeywordSort($0) }
                        )
                        .frame(maxWidth: 720, alignment: .leading)
                    } else {
                        ContentUnavailableView(
                            "Select a site",
                            systemImage: "chart.xyaxis.line",
                            description: Text("Pick a site to see traffic and keywords.")
                        )
                        .frame(maxWidth: .infinity, minHeight: 280)
                    }
                }
                .padding(AppSpacing.lg)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    // MARK: - Phone

    private var phoneLayout: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.md) {
                if let err = seoVM.syncError {
                    syncErrorBanner(err)
                }
                controlsBlock
                kpiBlock(columns: 2)
                if seoVM.selectedSource == "google" {
                    indexCoverageBlock(compact: true)
                }
                siteSortBar
                Text("Site performance")
                    .font(AppTypography.sectionTitle)
                ForEach(seoVM.seoMetricsList) { seo in
                    SiteSEOCard(
                        seo: seo,
                        keywordSort: seoVM.keywordSort,
                        onSelectKeywordSort: { seoVM.selectKeywordSort($0) }
                    )
                }
            }
            .padding(AppSpacing.md)
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            EmptyView()
        }
    }

    // MARK: - Shared blocks

    private var controlsBlock: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            Picker("Engine", selection: $seoVM.selectedSource) {
                Text("Google").tag("google")
                Text("Bing").tag("bing")
            }
            .pickerStyle(.segmented)

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
                                .padding(.vertical, 7)
                                .background(isSelected ? AppColors.primary : Color.secondary.opacity(0.12))
                                .foregroundStyle(isSelected ? .white : .primary)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(AppSpacing.sm)
        .background(AppColors.cardBackground.opacity(0.85))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func kpiBlock(columns: Int) -> some View {
        // `columns` kept for call-site compatibility; BBMetricGrid adapts by size class.
        _ = columns
        return BBMetricGrid {
            StatCard(
                title: "Clicks",
                value: "\(seoVM.totalClicks)",
                iconName: "cursorarrow.rays",
                iconColor: AppColors.primary
            )
            StatCard(
                title: "Impressions",
                value: "\(seoVM.totalImpressions)",
                iconName: "eye.fill",
                iconColor: AppColors.violet
            )
            StatCard(
                title: "Avg CTR",
                value: String(format: "%.2f%%", seoVM.averageCTR),
                iconName: "percent",
                iconColor: AppColors.emerald
            )
            StatCard(
                title: "Avg Position",
                value: String(format: "%.1f", seoVM.averagePosition),
                iconName: "chart.line.uptrend.xyaxis",
                iconColor: AppColors.amber
            )
        }
    }

    private func indexCoverageBlock(compact: Bool) -> some View {
        _ = compact
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Index coverage")
                    .font(AppTypography.sectionTitle)
                Spacer()
                Button {
                    seoVM.syncIndexCoverage()
                } label: {
                    if seoVM.isSyncingIndex {
                        ProgressView()
                    } else {
                        Label("Sync index", systemImage: "magnifyingglass")
                            .font(AppTypography.metaBold)
                    }
                }
                .disabled(seoVM.isSyncingIndex || seoVM.isSyncing)
            }

            BBMetricGrid {
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
                StatCard(
                    title: "Sitemap pages",
                    value: seoVM.hasIndexCoverage ? "\(seoVM.totalPages)" : "—",
                    iconName: "doc.on.doc.fill",
                    iconColor: AppColors.violet
                )
                StatCard(
                    title: seoVM.indexCoveragePartial ? "% (est.)" : "% indexed",
                    value: seoVM.hasIndexCoverage
                        ? String(format: "%.0f%%", seoVM.percentIndexed)
                        : "—",
                    iconName: "percent",
                    iconColor: AppColors.amber
                )
            }

            if seoVM.hasIndexCoverage {
                Text("\(seoVM.sitesWithIndexCoverage) of \(seoVM.seoMetricsList.count) sites · sitemap URLs only (noindex city×service pages excluded).")
                    .font(AppTypography.micro)
                    .foregroundStyle(.secondary)
            } else {
                Text("Sync index pulls sitemap × Search Analytics coverage. Traffic Sync alone does not fill these.")
                    .font(AppTypography.meta)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(AppSpacing.md)
        .glassCard()
    }

    private var siteSortBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Text("Sort")
                    .font(AppTypography.meta)
                    .foregroundStyle(.secondary)
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
                        .font(AppTypography.metaBold)
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
    }

    private func siteSidebarRow(_ seo: SEOMetrics, selected: Bool) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(seo.siteName)
                    .font(AppTypography.rowTitle)
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text("\(seo.clicks) clicks · \(seo.impressions) impr.")
                    .font(AppTypography.micro)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(12)
        .background(selected ? AppColors.primary.opacity(0.12) : AppColors.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(selected ? AppColors.primary.opacity(0.45) : Color.clear, lineWidth: 1.5)
        )
    }

    private func syncErrorBanner(_ err: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(AppColors.amber)
            Text(err)
                .font(AppTypography.meta)
            Spacer()
            Button("Dismiss") { seoVM.clearSyncError() }
                .font(AppTypography.metaBold)
        }
        .padding(12)
        .background(AppColors.amber.opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

}

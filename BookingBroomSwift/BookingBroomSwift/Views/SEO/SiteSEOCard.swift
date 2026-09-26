import SwiftUI

private let keywordPreviewCount = 5

public struct SiteSEOCard: View {
    public let seo: SEOMetrics
    public var keywordSort: SEOSort = .defaultKeywords
    public var onSelectKeywordSort: ((SEOSortKey) -> Void)?
    @State private var showAllKeywords = false

    public init(
        seo: SEOMetrics,
        keywordSort: SEOSort = .defaultKeywords,
        onSelectKeywordSort: ((SEOSortKey) -> Void)? = nil
    ) {
        self.seo = seo
        self.keywordSort = keywordSort
        self.onSelectKeywordSort = onSelectKeywordSort
    }

    private static let intFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        return f
    }()

    private func formatInt(_ value: Int) -> String {
        Self.intFormatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(seo.siteName)
                        .font(.headline)
                    Text("Last \(seo.periodDays) days")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Text(seo.source.capitalized)
                    .font(.caption2.bold())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(seo.source == "google" ? AppColors.primary.opacity(0.15) : AppColors.emerald.opacity(0.15))
                    .foregroundColor(seo.source == "google" ? AppColors.primary : AppColors.emerald)
                    .clipShape(Capsule())
            }

            HStack(spacing: 10) {
                heroMetric(label: "Clicks", value: formatInt(seo.clicks), accent: AppColors.primary)
                heroMetric(label: "Impressions", value: formatInt(seo.impressions), accent: AppColors.violet)
            }

            HStack(spacing: 16) {
                MetricItem(label: "Avg CTR", value: String(format: "%.1f%%", seo.ctr))
                MetricItem(label: "Avg Pos", value: String(format: "%.1f", seo.position))
            }

            if !seo.history.isEmpty {
                ChartCard(title: "Traffic Trend", trendPoints: seo.history)
            }

            if !seo.topQueries.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Keywords")
                        .font(.caption.bold())
                        .foregroundColor(.secondary)

                    keywordHeader

                    ForEach(Array(seo.topQueries.prefix(keywordPreviewCount).enumerated()), id: \.element.id) { index, q in
                        keywordRow(rank: index + 1, query: q)
                    }

                    if seo.topQueries.count > keywordPreviewCount {
                        Button {
                            showAllKeywords = true
                        } label: {
                            Text("View all \(seo.topQueries.count) keywords")
                                .font(.caption.weight(.semibold))
                        }
                        .buttonStyle(.plain)
                        .foregroundColor(AppColors.primary)
                        .padding(.top, 2)
                    }
                }
            } else {
                Text("No keyword data yet — Sync to pull queries for this site.")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(16)
        .glassCard()
        .sheet(isPresented: $showAllKeywords) {
            SEOKeywordsSheet(
                siteName: seo.siteName,
                queries: seo.topQueries,
                keywordSort: keywordSort,
                onSelectKeywordSort: onSelectKeywordSort
            )
        }
    }

    private var keywordHeader: some View {
        HStack(spacing: 8) {
            sortHeaderButton(.name, width: nil)
            sortHeaderButton(.clicks, width: 52)
            sortHeaderButton(.impressions, width: 64)
        }
        .font(.system(size: 10, weight: .semibold))
        .textCase(.uppercase)
    }

    private func sortHeaderButton(_ key: SEOSortKey, width: CGFloat?) -> some View {
        let active = keywordSort.key == key
        return Button {
            onSelectKeywordSort?(key)
        } label: {
            HStack(spacing: 2) {
                Text(key.keywordLabel)
                if active {
                    Image(systemName: keywordSort.dir == .desc ? "chevron.down" : "chevron.up")
                        .font(.system(size: 8, weight: .bold))
                }
            }
            .foregroundColor(active ? .primary : .secondary)
            .frame(maxWidth: width == nil ? .infinity : nil, alignment: width == nil ? .leading : .trailing)
            .frame(width: width, alignment: .trailing)
        }
        .buttonStyle(.plain)
    }

    private func keywordRow(rank: Int, query: SEOQuery) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("\(rank).")
                .font(.caption.monospacedDigit())
                .foregroundColor(.secondary)
                .frame(width: 22, alignment: .trailing)
            Text(query.query)
                .font(.caption.weight(.medium))
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(formatInt(query.clicks))
                .font(.caption.monospacedDigit().weight(.semibold))
                .foregroundColor(.primary)
                .frame(width: 52, alignment: .trailing)
            Text(formatInt(query.impressions))
                .font(.caption.monospacedDigit())
                .foregroundColor(.secondary)
                .frame(width: 64, alignment: .trailing)
        }
        .padding(.vertical, 2)
    }

    private func heroMetric(label: String, value: String, accent: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.secondary)
            Text(value)
                .font(.title2.bold().monospacedDigit())
                .foregroundColor(accent)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(accent.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

private struct SEOKeywordsSheet: View {
    let siteName: String
    let queries: [SEOQuery]
    var keywordSort: SEOSort
    var onSelectKeywordSort: ((SEOSortKey) -> Void)?
    @Environment(\.dismiss) private var dismiss

    private static let intFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        return f
    }()

    private func formatInt(_ value: Int) -> String {
        Self.intFormatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 8) {
                        Text("#").frame(width: 28, alignment: .trailing)
                        sheetSortButton(.name, maxWidth: true)
                        sheetSortButton(.clicks, width: 52)
                        sheetSortButton(.impressions, width: 64)
                        sheetSortButton(.ctr, width: 48)
                        sheetSortButton(.position, width: 40)
                    }
                    .font(.system(size: 10, weight: .semibold))
                    .textCase(.uppercase)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)

                    ForEach(Array(queries.enumerated()), id: \.element.id) { index, q in
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text("\(index + 1).")
                                .font(.caption.monospacedDigit())
                                .foregroundColor(.secondary)
                                .frame(width: 28, alignment: .trailing)
                            Text(q.query)
                                .font(.subheadline.weight(.medium))
                                .frame(maxWidth: .infinity, alignment: .leading)
                            Text(formatInt(q.clicks))
                                .font(.caption.monospacedDigit().weight(.semibold))
                                .frame(width: 52, alignment: .trailing)
                            Text(formatInt(q.impressions))
                                .font(.caption.monospacedDigit())
                                .foregroundColor(.secondary)
                                .frame(width: 64, alignment: .trailing)
                            Text(String(format: "%.1f%%", q.ctr))
                                .font(.caption2.monospacedDigit())
                                .foregroundColor(.secondary)
                                .frame(width: 48, alignment: .trailing)
                            Text(String(format: "%.1f", q.position))
                                .font(.caption2.monospacedDigit())
                                .foregroundColor(.secondary)
                                .frame(width: 40, alignment: .trailing)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)

                        if index < queries.count - 1 {
                            Divider()
                                .padding(.leading, 52)
                        }
                    }
                }
                .padding(.vertical, 8)
            }
            .navigationTitle("\(siteName) · Keywords")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        #if os(iOS)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        #endif
    }

    private func sheetSortButton(_ key: SEOSortKey, width: CGFloat? = nil, maxWidth: Bool = false) -> some View {
        let active = keywordSort.key == key
        return Button {
            onSelectKeywordSort?(key)
        } label: {
            HStack(spacing: 2) {
                Text(key.keywordLabel)
                if active {
                    Image(systemName: keywordSort.dir == .desc ? "chevron.down" : "chevron.up")
                        .font(.system(size: 8, weight: .bold))
                }
            }
            .foregroundColor(active ? .primary : .secondary)
            .frame(maxWidth: maxWidth ? .infinity : nil, alignment: maxWidth ? .leading : .trailing)
            .frame(width: width, alignment: .trailing)
        }
        .buttonStyle(.plain)
    }
}

struct MetricItem: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
            Text(value)
                .font(.subheadline.bold())
                .foregroundColor(.primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

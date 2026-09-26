import SwiftUI

private let keywordPreviewCount = 5

public struct SiteSEOCard: View {
    public let seo: SEOMetrics
    @State private var showAllKeywords = false

    public init(seo: SEOMetrics) {
        self.seo = seo
    }

    private var rankedKeywords: [SEOQuery] {
        seo.topQueries.sorted { a, b in
            if a.impressions != b.impressions { return a.impressions > b.impressions }
            if a.clicks != b.clicks { return a.clicks > b.clicks }
            return a.query < b.query
        }
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

            if !rankedKeywords.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Keywords")
                        .font(.caption.bold())
                        .foregroundColor(.secondary)

                    keywordHeader

                    ForEach(Array(rankedKeywords.prefix(keywordPreviewCount).enumerated()), id: \.element.id) { index, q in
                        keywordRow(rank: index + 1, query: q, compact: true)
                    }

                    if rankedKeywords.count > keywordPreviewCount {
                        Button {
                            showAllKeywords = true
                        } label: {
                            Text("View all \(rankedKeywords.count) keywords")
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
            SEOKeywordsSheet(siteName: seo.siteName, queries: rankedKeywords)
        }
    }

    private var keywordHeader: some View {
        HStack(spacing: 8) {
            Text("Keyword")
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("Clicks")
                .frame(width: 52, alignment: .trailing)
            Text("Impr.")
                .frame(width: 64, alignment: .trailing)
        }
        .font(.system(size: 10, weight: .semibold))
        .foregroundColor(.secondary)
        .textCase(.uppercase)
    }

    private func keywordRow(rank: Int, query: SEOQuery, compact: Bool) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("\(rank).")
                .font(.caption.monospacedDigit())
                .foregroundColor(.secondary)
                .frame(width: 22, alignment: .trailing)
            Text(query.query)
                .font(.caption.weight(.medium))
                .lineLimit(compact ? 2 : 3)
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
                        Text("Keyword").frame(maxWidth: .infinity, alignment: .leading)
                        Text("Clicks").frame(width: 52, alignment: .trailing)
                        Text("Impr.").frame(width: 64, alignment: .trailing)
                        Text("CTR").frame(width: 48, alignment: .trailing)
                        Text("Pos").frame(width: 40, alignment: .trailing)
                    }
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(.secondary)
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

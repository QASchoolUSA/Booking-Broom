import SwiftUI

private let keywordPreviewCount = 5

public struct SiteSEOCard: View {
    public let seo: SEOMetrics
    @State private var showAllKeywords = false

    public init(seo: SEOMetrics) {
        self.seo = seo
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            // Header: Site Name & Source Pill
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

            // Metrics Bar
            HStack(spacing: 16) {
                MetricItem(label: "Clicks", value: "\(seo.clicks)")
                MetricItem(label: "Impressions", value: "\(seo.impressions)")
                MetricItem(label: "Avg CTR", value: String(format: "%.1f%%", seo.ctr))
                MetricItem(label: "Avg Pos", value: String(format: "%.1f", seo.position))
            }

            // Swift Charts Visualization
            if !seo.history.isEmpty {
                ChartCard(title: "Traffic Trend", trendPoints: seo.history)
            }

            // Top Keywords
            if !seo.topQueries.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Top Search Keywords")
                        .font(.caption.bold())
                        .foregroundColor(.secondary)

                    ForEach(Array(seo.topQueries.prefix(keywordPreviewCount))) { q in
                        HStack(alignment: .firstTextBaseline) {
                            Text(q.query)
                                .font(.caption.weight(.medium))
                                .lineLimit(2)
                            Spacer(minLength: 8)
                            Text("\(q.clicks) clk · \(q.impressions) imp")
                                .font(.caption2.bold())
                                .foregroundColor(AppColors.primary)
                                .fixedSize(horizontal: true, vertical: false)
                        }
                        .padding(.vertical, 2)
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
            }
        }
        .padding(16)
        .glassCard()
        .sheet(isPresented: $showAllKeywords) {
            SEOKeywordsSheet(siteName: seo.siteName, queries: seo.topQueries)
        }
    }
}

private struct SEOKeywordsSheet: View {
    let siteName: String
    let queries: [SEOQuery]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(queries.enumerated()), id: \.element.id) { index, q in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                Text("\(index + 1).")
                                    .font(.caption.monospacedDigit())
                                    .foregroundColor(.secondary)
                                    .frame(width: 28, alignment: .trailing)
                                Text(q.query)
                                    .font(.subheadline.weight(.medium))
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            HStack(spacing: 12) {
                                Spacer().frame(width: 28)
                                metricLabel("\(q.clicks) clk")
                                metricLabel("\(q.impressions) imp")
                                metricLabel(String(format: "%.1f%% CTR", q.ctr))
                                metricLabel(String(format: "pos %.1f", q.position))
                            }
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

    private func metricLabel(_ text: String) -> some View {
        Text(text)
            .font(.caption2.monospacedDigit())
            .foregroundColor(.secondary)
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

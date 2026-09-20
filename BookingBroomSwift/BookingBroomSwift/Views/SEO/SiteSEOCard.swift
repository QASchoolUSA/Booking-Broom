import SwiftUI

public struct SiteSEOCard: View {
    public let seo: SEOMetrics
    
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
                    
                    ForEach(seo.topQueries.prefix(3)) { q in
                        HStack {
                            Text(q.query)
                                .font(.caption.weight(.medium))
                            Spacer()
                            Text("\(q.clicks) clicks")
                                .font(.caption2.bold())
                                .foregroundColor(AppColors.primary)
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .padding(16)
        .glassCard()
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

import SwiftUI
import Charts

public struct ChartCard: View {
    public let title: String
    public let trendPoints: [SEOTrendPoint]
    
    public init(title: String, trendPoints: [SEOTrendPoint]) {
        self.title = title
        self.trendPoints = trendPoints
    }
    
    public var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            Text(title)
                .font(AppTypography.sectionTitle)
                .foregroundStyle(.primary)
            
            Chart(trendPoints) { point in
                LineMark(
                    x: .value("Date", point.date),
                    y: .value("Clicks", point.clicks)
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(
                    LinearGradient(
                        colors: [AppColors.primary, AppColors.sky],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .lineStyle(StrokeStyle(lineWidth: 3))
                
                AreaMark(
                    x: .value("Date", point.date),
                    y: .value("Clicks", point.clicks)
                )
                .foregroundStyle(
                    LinearGradient(
                        colors: [AppColors.primary.opacity(0.3), AppColors.primary.opacity(0.0)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
            }
            .frame(height: 140)
            .chartYAxis {
                AxisMarks(position: .leading)
            }
        }
        .padding(AppSpacing.md)
        .appSurface()
    }
}

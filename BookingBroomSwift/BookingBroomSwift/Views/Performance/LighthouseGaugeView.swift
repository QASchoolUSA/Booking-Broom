import SwiftUI

public struct LighthouseGaugeView: View {
    public let score: Int
    public let title: String
    
    public init(score: Int, title: String) {
        self.score = score
        self.title = title
    }
    
    private var gaugeColor: Color {
        if score >= 90 { return AppColors.emerald }
        if score >= 50 { return AppColors.amber }
        return AppColors.rose
    }
    
    public var body: some View {
        VStack(spacing: 6) {
            ZStack {
                Circle()
                    .stroke(gaugeColor.opacity(0.2), lineWidth: 6)
                    .frame(width: 56, height: 56)
                
                Circle()
                    .trim(from: 0, to: CGFloat(score) / 100.0)
                    .stroke(gaugeColor, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .frame(width: 56, height: 56)
                    .rotationEffect(.degrees(-90))
                
                Text("\(score)")
                    .font(.subheadline.bold())
                    .foregroundColor(.primary)
            }
            
            Text(title)
                .font(.caption2.weight(.medium))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
    }
}

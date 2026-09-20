import SwiftUI

public struct PerformanceDashboardView: View {
    @ObservedObject var perfVM: PerformanceViewModel
    
    public init(perfVM: PerformanceViewModel) {
        self.perfVM = perfVM
    }
    
    public var body: some View {
        ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Strategy Picker
                    Picker("Device", selection: $perfVM.selectedStrategy) {
                        Text("Mobile Audit").tag("mobile")
                        Text("Desktop Audit").tag("desktop")
                    }
                    .pickerStyle(.segmented)
                    
                    // Overall Average Banner
                    HStack(spacing: 12) {
                        StatCard(
                            title: "Performance Score",
                            value: "\(perfVM.averagePerformanceScore)/100",
                            iconName: "bolt.fill",
                            iconColor: AppColors.emerald,
                            trend: "Fast"
                        )
                        
                        StatCard(
                            title: "AI Agentic Score",
                            value: "\(perfVM.averageAgenticScore)% Pass",
                            iconName: "brain.head.profile",
                            iconColor: AppColors.violet,
                            subtitle: "Lighthouse AI Ready"
                        )
                    }
                    
                    // Detailed Site Audits
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Site Performance & Core Web Vitals")
                            .font(.headline)
                        
                        ForEach(perfVM.performanceList) { item in
                            VStack(alignment: .leading, spacing: 14) {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(item.siteName)
                                            .font(.headline)
                                        Text("Overall: \(item.overallCategory)")
                                            .font(.caption2.bold())
                                            .foregroundColor(AppColors.emerald)
                                    }
                                    Spacer()
                                    
                                    HStack(spacing: 4) {
                                        Image(systemName: "checkmark.seal.fill")
                                            .foregroundColor(AppColors.emerald)
                                        Text("Passed Audit")
                                            .font(.caption2.bold())
                                            .foregroundColor(AppColors.emerald)
                                    }
                                }
                                
                                // Lighthouse Gauges Grid
                                HStack(spacing: 16) {
                                    LighthouseGaugeView(score: item.performanceScore, title: "Performance")
                                    LighthouseGaugeView(score: item.accessibilityScore, title: "Accessibility")
                                    LighthouseGaugeView(score: item.bestPracticesScore, title: "Best Practices")
                                    LighthouseGaugeView(score: item.seoScore, title: "SEO")
                                }
                                
                                Divider()
                                
                                // Core Web Vitals
                                HStack(spacing: 12) {
                                    VitalItem(label: "LCP", value: String(format: "%.1fs", item.lcpMs / 1000.0))
                                    VitalItem(label: "CLS", value: String(format: "%.2f", item.cls))
                                    VitalItem(label: "INP", value: String(format: "%.0fms", item.inpMs))
                                    VitalItem(label: "FCP", value: String(format: "%.1fs", item.fcpMs / 1000.0))
                                }
                            }
                            .padding(16)
                            .glassCard()
                        }
                    }
                }
                .padding(16)
            }
            .background(AppColors.groupedBackground.ignoresSafeArea())
            .navigationTitle("Speed & Health")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button(action: { perfVM.runAudits() }) {
                        if perfVM.isAuditing {
                            ProgressView()
                        } else {
                            Image(systemName: "arrow.clockwise")
                        }
                    }
                }
            }
            .onAppear {
                perfVM.ensureLoaded()
            }
            .onChange(of: perfVM.selectedStrategy) { _, _ in
                perfVM.loadPerformance()
            }
    }
}

struct VitalItem: View {
    let label: String
    let value: String
    
    var body: some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
            Text(value)
                .font(.caption.bold())
                .foregroundColor(AppColors.emerald)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(AppColors.emerald.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

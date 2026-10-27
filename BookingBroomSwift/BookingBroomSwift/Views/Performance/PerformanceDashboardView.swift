import SwiftUI

public struct PerformanceDashboardView: View {
    @Bindable var perfVM: PerformanceViewModel

    public init(perfVM: PerformanceViewModel) {
        self.perfVM = perfVM
    }

    public var body: some View {
        ScrollView {
            BBWidePage {
                VStack(alignment: .leading, spacing: AppSpacing.lg) {
                    Picker("Device", selection: $perfVM.selectedStrategy) {
                        Text("Mobile").tag("mobile")
                        Text("Desktop").tag("desktop")
                    }
                    .pickerStyle(.segmented)

                    BBMetricGrid {
                        StatCard(
                            title: "Performance",
                            value: "\(perfVM.averagePerformanceScore)/100",
                            iconName: "bolt.fill",
                            iconColor: AppColors.emerald
                        )
                        StatCard(
                            title: "Agentic",
                            value: "\(perfVM.averageAgenticScore)%",
                            iconName: "brain.head.profile",
                            iconColor: AppColors.violet,
                            subtitle: "AI Ready"
                        )
                    }

                    BBSection("Site audits") {
                        LazyVStack(spacing: AppSpacing.sm) {
                            ForEach(perfVM.performanceList) { item in
                                siteAuditCard(item)
                            }
                        }
                    }
                }
                .padding(.vertical, AppSpacing.md)
            }
        }
        .bbPageBackground()
        .navigationTitle("PageSpeed")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.large)
        #endif
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    perfVM.runAudits()
                } label: {
                    if perfVM.isAuditing {
                        ProgressView()
                    } else {
                        Label("Sync", systemImage: "arrow.clockwise")
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

    private func siteAuditCard(_ item: PerformanceMetrics) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.siteName)
                        .font(AppTypography.rowTitle)
                    Text(item.overallCategory)
                        .font(AppTypography.microBold)
                        .foregroundStyle(AppColors.emerald)
                }
                Spacer()
            }

            HStack(spacing: AppSpacing.sm) {
                LighthouseGaugeView(score: item.performanceScore, title: "Perf")
                LighthouseGaugeView(score: item.accessibilityScore, title: "A11y")
                LighthouseGaugeView(score: item.bestPracticesScore, title: "Best")
                LighthouseGaugeView(score: item.seoScore, title: "SEO")
            }

            Divider()

            HStack(spacing: AppSpacing.xs) {
                VitalItem(label: "LCP", value: String(format: "%.1fs", item.lcpMs / 1000.0))
                VitalItem(label: "CLS", value: String(format: "%.2f", item.cls))
                VitalItem(label: "INP", value: String(format: "%.0fms", item.inpMs))
                VitalItem(label: "FCP", value: String(format: "%.1fs", item.fcpMs / 1000.0))
            }
        }
        .padding(AppSpacing.cardPadding)
        .appSurface()
    }
}

struct VitalItem: View {
    let label: String
    let value: String

    var body: some View {
        VStack(spacing: 2) {
            Text(label)
                .font(AppTypography.micro)
                .foregroundStyle(.secondary)
            Text(value)
                .font(AppTypography.metaBold)
                .foregroundStyle(AppColors.emerald)
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(AppColors.emerald.opacity(0.08), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

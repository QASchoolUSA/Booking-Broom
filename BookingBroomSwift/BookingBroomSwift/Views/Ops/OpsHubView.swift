import SwiftUI

public struct OpsHubView: View {
    @ObservedObject var opsVM: OpsViewModel
    @ObservedObject var seoVM: SEOViewModel
    @ObservedObject var perfVM: PerformanceViewModel
    @ObservedObject var deploymentsVM: DeploymentsViewModel
    
    public init(
        opsVM: OpsViewModel,
        seoVM: SEOViewModel,
        perfVM: PerformanceViewModel,
        deploymentsVM: DeploymentsViewModel
    ) {
        self.opsVM = opsVM
        self.seoVM = seoVM
        self.perfVM = perfVM
        self.deploymentsVM = deploymentsVM
    }
    
    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Operations and site intelligence tools for all 12 cleaning websites.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 4)
                    .padding(.top, 4)
                
                // Hub Navigation Cards
                NavigationLink(destination: SitesHealthView(opsVM: opsVM)) {
                    OpsNavigationCard(
                        title: "Sites Health & Infrastructure",
                        subtitle: "Hosting status, IP resolution, and uptime checks",
                        iconName: "globe",
                        iconColor: AppColors.primary
                    )
                }
                
                NavigationLink(destination: DeploymentsView(deploymentsVM: deploymentsVM)) {
                    OpsNavigationCard(
                        title: "Deployments & Free Usage",
                        subtitle: "Workers Builds status and daily request quota",
                        iconName: "cloud.fill",
                        iconColor: AppColors.sky
                    )
                }
                
                NavigationLink(destination: SEODashboardView(seoVM: seoVM)) {
                    OpsNavigationCard(
                        title: "SEO Analytics & Search Console",
                        subtitle: "Google & Bing traffic, CTR, ranking queries",
                        iconName: "chart.xyaxis.line",
                        iconColor: AppColors.violet
                    )
                }
                
                NavigationLink(destination: PerformanceDashboardView(perfVM: perfVM)) {
                    OpsNavigationCard(
                        title: "PageSpeed & Core Web Vitals",
                        subtitle: "Lighthouse audits, LCP, INP, and AI-readiness",
                        iconName: "gauge.with.needle.fill",
                        iconColor: AppColors.emerald
                    )
                }
                
                NavigationLink(destination: PricingOpsView(opsVM: opsVM)) {
                    OpsNavigationCard(
                        title: "Live Pricing & Service Baskets",
                        subtitle: "Pricing engines and basket comparisons",
                        iconName: "dollarsign.circle.fill",
                        iconColor: AppColors.amber
                    )
                }
            }
            .padding(16)
        }
        .background(AppColors.groupedBackground.ignoresSafeArea())
        .navigationTitle("Operations Hub")
    }
}

struct OpsNavigationCard: View {
    let title: String
    let subtitle: String
    let iconName: String
    let iconColor: Color
    
    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(iconColor.opacity(0.15))
                    .frame(width: 48, height: 48)
                Image(systemName: iconName)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(iconColor)
            }
            
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.headline)
                    .foregroundColor(.primary)
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.caption.bold())
                .foregroundColor(.secondary)
        }
        .padding(14)
        .glassCard()
    }
}

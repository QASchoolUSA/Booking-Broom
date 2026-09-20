import Foundation

public struct PerformanceMetrics: Identifiable, Codable, Hashable {
    public var id: String
    public var siteId: String
    public var siteSlug: String
    public var siteName: String
    public var strategy: String // "mobile" or "desktop"
    public var performanceScore: Int // 0-100
    public var accessibilityScore: Int
    public var bestPracticesScore: Int
    public var seoScore: Int
    public var agenticBrowsingScore: Int
    public var lcpMs: Double
    public var cls: Double
    public var inpMs: Double
    public var fcpMs: Double
    public var overallCategory: String // "FAST", "AVERAGE", "SLOW"
    
    public init(
        id: String,
        siteId: String,
        siteSlug: String,
        siteName: String,
        strategy: String = "mobile",
        performanceScore: Int,
        accessibilityScore: Int,
        bestPracticesScore: Int,
        seoScore: Int,
        agenticBrowsingScore: Int = 85,
        lcpMs: Double = 1800,
        cls: Double = 0.04,
        inpMs: Double = 90,
        fcpMs: Double = 1100,
        overallCategory: String = "FAST"
    ) {
        self.id = id
        self.siteId = siteId
        self.siteSlug = siteSlug
        self.siteName = siteName
        self.strategy = strategy
        self.performanceScore = performanceScore
        self.accessibilityScore = accessibilityScore
        self.bestPracticesScore = bestPracticesScore
        self.seoScore = seoScore
        self.agenticBrowsingScore = agenticBrowsingScore
        self.lcpMs = lcpMs
        self.cls = cls
        self.inpMs = inpMs
        self.fcpMs = fcpMs
        self.overallCategory = overallCategory
    }
}

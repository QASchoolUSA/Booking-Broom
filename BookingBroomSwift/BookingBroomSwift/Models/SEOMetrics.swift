import Foundation

public struct SEOMetrics: Identifiable, Codable, Hashable {
    public var id: String
    public var siteId: String
    public var siteSlug: String
    public var siteName: String
    public var periodDays: Int
    public var clicks: Int
    public var impressions: Int
    public var ctr: Double
    public var position: Double
    public var source: String // "google" or "bing"
    public var history: [SEOTrendPoint]
    public var topQueries: [SEOQuery]
    
    public init(
        id: String,
        siteId: String,
        siteSlug: String,
        siteName: String,
        periodDays: Int = 28,
        clicks: Int,
        impressions: Int,
        ctr: Double,
        position: Double,
        source: String = "google",
        history: [SEOTrendPoint] = [],
        topQueries: [SEOQuery] = []
    ) {
        self.id = id
        self.siteId = siteId
        self.siteSlug = siteSlug
        self.siteName = siteName
        self.periodDays = periodDays
        self.clicks = clicks
        self.impressions = impressions
        self.ctr = ctr
        self.position = position
        self.source = source
        self.history = history
        self.topQueries = topQueries
    }
}

public struct SEOTrendPoint: Identifiable, Codable, Hashable {
    public var id: String { date }
    public var date: String
    public var clicks: Int
    public var impressions: Int
}

public struct SEOQuery: Identifiable, Codable, Hashable {
    public var id: String { query }
    public var query: String
    public var clicks: Int
    public var impressions: Int
    public var ctr: Double
    public var position: Double
}

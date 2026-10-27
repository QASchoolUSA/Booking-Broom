import Foundation

/// GSC URL Inspection coverage summary (Google only).
public struct SEOIndexCoverage: Codable, Hashable {
    public var totalPages: Int
    public var indexedCount: Int
    public var notIndexedCount: Int
    public var inspectedCount: Int
    public var percentIndexed: Double
    public var partial: Bool
    public var detail: String?

    public init(
        totalPages: Int,
        indexedCount: Int,
        notIndexedCount: Int,
        inspectedCount: Int,
        percentIndexed: Double,
        partial: Bool = false,
        detail: String? = nil
    ) {
        self.totalPages = totalPages
        self.indexedCount = indexedCount
        self.notIndexedCount = notIndexedCount
        self.inspectedCount = inspectedCount
        self.percentIndexed = percentIndexed
        self.partial = partial
        self.detail = detail
    }
}

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
    public var indexCoverage: SEOIndexCoverage?
    
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
        topQueries: [SEOQuery] = [],
        indexCoverage: SEOIndexCoverage? = nil
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
        self.indexCoverage = indexCoverage
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

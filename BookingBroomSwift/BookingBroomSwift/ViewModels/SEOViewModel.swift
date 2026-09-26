import Foundation
import Observation

public struct SeoPeriodOption: Identifiable {
    public var id: Int { days }
    public let days: Int
    public let label: String
    public let short: String
}

public enum SEOSortKey: String, CaseIterable, Identifiable {
    case impressions
    case clicks
    case ctr
    case position
    case name
    
    public var id: String { rawValue }
    
    public var siteLabel: String {
        switch self {
        case .impressions: return "Impressions"
        case .clicks: return "Clicks"
        case .name: return "Name"
        case .ctr, .position: return rawValue
        }
    }
    
    public var keywordLabel: String {
        switch self {
        case .impressions: return "Impr."
        case .clicks: return "Clicks"
        case .ctr: return "CTR"
        case .position: return "Pos"
        case .name: return "Keyword"
        }
    }
    
    public static let siteKeys: [SEOSortKey] = [.impressions, .clicks, .name]
    public static let keywordKeys: [SEOSortKey] = [.clicks, .impressions, .ctr, .position]
}

public enum SEOSortDir: String {
    case desc
    case asc
    
    public mutating func toggle() {
        self = self == .desc ? .asc : .desc
    }
}

public struct SEOSort: Equatable {
    public var key: SEOSortKey
    public var dir: SEOSortDir
    
    public static let defaultSites = SEOSort(key: .impressions, dir: .desc)
    public static let defaultKeywords = SEOSort(key: .clicks, dir: .desc)
    
    public init(key: SEOSortKey, dir: SEOSortDir) {
        self.key = key
        self.dir = dir
    }
    
    public mutating func select(_ key: SEOSortKey) {
        if self.key == key {
            dir.toggle()
        } else {
            self.key = key
            dir = key == .position ? .asc : .desc
        }
    }
}

@MainActor
@Observable
public final class SEOViewModel {
    public static let periodOptions: [SeoPeriodOption] = [
        SeoPeriodOption(days: 1, label: "24 hours", short: "24h"),
        SeoPeriodOption(days: 7, label: "7 days", short: "7d"),
        SeoPeriodOption(days: 28, label: "28 days", short: "28d"),
        SeoPeriodOption(days: 90, label: "3 months", short: "3mo")
    ]
    
    public var seoMetricsList: [SEOMetrics] = [] { didSet { recomputeTotals() } }
    public var selectedSource: String = "google" { // "google" or "bing"
        didSet { if oldValue != selectedSource { loadMetrics() } }
    }
    public var selectedPeriodDays: Int = 28 {
        didSet { if oldValue != selectedPeriodDays { loadMetrics() } }
    }
    public var siteSort: SEOSort = .defaultSites {
        didSet { if oldValue != siteSort { applySort() } }
    }
    public var keywordSort: SEOSort = .defaultKeywords {
        didSet { if oldValue != keywordSort { applySort() } }
    }
    public var isLoading: Bool = false
    public var isSyncing: Bool = false
    public var syncError: String? = nil
    public var loadError: String? = nil
    
    public private(set) var totalClicks: Int = 0
    public private(set) var totalImpressions: Int = 0
    public private(set) var averageCTR: Double = 0
    public private(set) var averagePosition: Double = 0
    
    @ObservationIgnored private var rawMetricsList: [SEOMetrics] = []
    @ObservationIgnored private var didLoad = false
    @ObservationIgnored private var lastLoadedAt: Date?
    @ObservationIgnored private var loadTask: Task<Void, Never>?
    @ObservationIgnored private var loadGeneration: UInt = 0
    @ObservationIgnored private let staleAfter: TimeInterval = 5 * 60
    
    public init() {}
    
    public func ensureLoaded() {
        if didLoad,
           let last = lastLoadedAt,
           Date().timeIntervalSince(last) < staleAfter {
            return
        }
        didLoad = true
        loadMetrics()
    }
    
    public func resetForNewSession() {
        loadGeneration &+= 1
        loadTask?.cancel()
        loadTask = nil
        didLoad = false
        lastLoadedAt = nil
        rawMetricsList = []
        seoMetricsList = []
        syncError = nil
        loadError = nil
        isLoading = false
        isSyncing = false
    }
    
    /// Read from Convex only. Cancels the prior in-flight load (source/period toggles).
    public func loadMetrics() {
        loadTask?.cancel()
        loadGeneration &+= 1
        let generation = loadGeneration
        let source = selectedSource
        let period = selectedPeriodDays
        loadError = nil
        if seoMetricsList.isEmpty { isLoading = true }
        
        loadTask = Task {
            defer {
                if generation == self.loadGeneration { self.isLoading = false }
            }
            do {
                let fetched = try await ConvexAPIService.shared.fetchSEOMetrics(source: source, periodDays: period)
                guard generation == self.loadGeneration, !Task.isCancelled else { return }
                self.rawMetricsList = fetched
                self.applySort()
                self.lastLoadedAt = Date()
            } catch let error as ConvexError where error.isCancelled {
                return
            } catch {
                guard generation == self.loadGeneration, !Task.isCancelled else { return }
                if self.seoMetricsList.isEmpty {
                    self.loadError = error.localizedDescription
                }
            }
        }
    }
    
    public func loadMetricsAndWait() async {
        loadMetrics()
        await loadTask?.value
    }
    
    /// Pull fresh data from Google / Bing (external) then reload. Toolbar / ⌘R only.
    public func syncMetrics() {
        guard !isSyncing else { return }
        isSyncing = true
        syncError = nil
        loadTask?.cancel()
        loadGeneration &+= 1
        let generation = loadGeneration
        let source = selectedSource
        let period = selectedPeriodDays
        Task {
            do {
                let fetched = try await ConvexAPIService.shared.syncSEOMetrics(source: source, periodDays: period)
                guard generation == self.loadGeneration else { return }
                self.rawMetricsList = fetched
                self.applySort()
                self.lastLoadedAt = Date()
                self.loadError = nil
                HapticFeedback.notification(.success)
            } catch {
                self.syncError = error.localizedDescription
                HapticFeedback.notification(.error)
            }
            self.isSyncing = false
        }
    }
    
    public func clearSyncError() {
        syncError = nil
    }
    
    public func selectSiteSort(_ key: SEOSortKey) {
        var next = siteSort
        next.select(key)
        siteSort = next
    }
    
    public func selectKeywordSort(_ key: SEOSortKey) {
        var next = keywordSort
        next.select(key)
        keywordSort = next
    }
    
    private func recomputeTotals() {
        totalClicks = seoMetricsList.reduce(0) { $0 + $1.clicks }
        totalImpressions = seoMetricsList.reduce(0) { $0 + $1.impressions }
        guard !seoMetricsList.isEmpty else {
            averageCTR = 0
            averagePosition = 0
            return
        }
        averageCTR = seoMetricsList.reduce(0.0) { $0 + $1.ctr } / Double(seoMetricsList.count)
        averagePosition = seoMetricsList.reduce(0.0) { $0 + $1.position } / Double(seoMetricsList.count)
    }

    private func applySort() {
        let ranked = Self.ranked(rawMetricsList, siteSort: siteSort, keywordSort: keywordSort)
        if ranked != seoMetricsList { seoMetricsList = ranked }
    }
    
    private static func ranked(
        _ list: [SEOMetrics],
        siteSort: SEOSort,
        keywordSort: SEOSort
    ) -> [SEOMetrics] {
        list
            .map { site in
                var copy = site
                copy.topQueries = site.topQueries.sorted { lhs, rhs in
                    compareQueries(lhs, rhs, sort: keywordSort)
                }
                return copy
            }
            .sorted { a, b in
                compareSites(a, b, sort: siteSort)
            }
    }
    
    private static func compareQueries(_ a: SEOQuery, _ b: SEOQuery, sort: SEOSort) -> Bool {
        let descending = sort.dir == .desc
        switch sort.key {
        case .impressions:
            if a.impressions != b.impressions { return descending ? a.impressions > b.impressions : a.impressions < b.impressions }
        case .clicks:
            if a.clicks != b.clicks { return descending ? a.clicks > b.clicks : a.clicks < b.clicks }
        case .ctr:
            if a.ctr != b.ctr { return descending ? a.ctr > b.ctr : a.ctr < b.ctr }
        case .position:
            if a.position != b.position { return descending ? a.position > b.position : a.position < b.position }
        case .name:
            return descending ? a.query > b.query : a.query < b.query
        }
        if a.impressions != b.impressions { return a.impressions > b.impressions }
        if a.clicks != b.clicks { return a.clicks > b.clicks }
        return a.query < b.query
    }
    
    private static func compareSites(_ a: SEOMetrics, _ b: SEOMetrics, sort: SEOSort) -> Bool {
        let descending = sort.dir == .desc
        switch sort.key {
        case .impressions:
            if a.impressions != b.impressions { return descending ? a.impressions > b.impressions : a.impressions < b.impressions }
        case .clicks:
            if a.clicks != b.clicks { return descending ? a.clicks > b.clicks : a.clicks < b.clicks }
        case .ctr:
            if a.ctr != b.ctr { return descending ? a.ctr > b.ctr : a.ctr < b.ctr }
        case .position:
            if a.position != b.position { return descending ? a.position > b.position : a.position < b.position }
        case .name:
            return descending ? a.siteName > b.siteName : a.siteName < b.siteName
        }
        if a.impressions != b.impressions { return a.impressions > b.impressions }
        if a.clicks != b.clicks { return a.clicks > b.clicks }
        return a.siteName < b.siteName
    }
}

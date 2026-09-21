import Foundation
import Observation

public struct SeoPeriodOption: Identifiable {
    public var id: Int { days }
    public let days: Int
    public let label: String
    public let short: String
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
    public var isLoading: Bool = false
    public var isSyncing: Bool = false
    public var syncError: String? = nil
    public var loadError: String? = nil
    
    public private(set) var totalClicks: Int = 0
    public private(set) var totalImpressions: Int = 0
    public private(set) var averageCTR: Double = 0
    public private(set) var averagePosition: Double = 0
    
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
                let ranked = Self.ranked(fetched)
                if ranked != self.seoMetricsList { self.seoMetricsList = ranked }
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
                let ranked = Self.ranked(fetched)
                if ranked != self.seoMetricsList { self.seoMetricsList = ranked }
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

    /// Sites by impressions then clicks (desc); keywords within each site the same way.
    private static func ranked(_ list: [SEOMetrics]) -> [SEOMetrics] {
        list
            .map { site in
                var copy = site
                copy.topQueries = site.topQueries.sorted { a, b in
                    if a.impressions != b.impressions { return a.impressions > b.impressions }
                    if a.clicks != b.clicks { return a.clicks > b.clicks }
                    return a.query < b.query
                }
                return copy
            }
            .sorted { a, b in
                if a.impressions != b.impressions { return a.impressions > b.impressions }
                if a.clicks != b.clicks { return a.clicks > b.clicks }
                return a.siteName < b.siteName
            }
    }
}

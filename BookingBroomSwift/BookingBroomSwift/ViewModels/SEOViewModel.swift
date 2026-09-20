import Foundation
import Combine

public struct SeoPeriodOption: Identifiable {
    public var id: Int { days }
    public let days: Int
    public let label: String
    public let short: String
}

@MainActor
public final class SEOViewModel: ObservableObject {
    public static let periodOptions: [SeoPeriodOption] = [
        SeoPeriodOption(days: 1, label: "24 hours", short: "24h"),
        SeoPeriodOption(days: 7, label: "7 days", short: "7d"),
        SeoPeriodOption(days: 28, label: "28 days", short: "28d"),
        SeoPeriodOption(days: 90, label: "3 months", short: "3mo")
    ]
    
    @Published public var seoMetricsList: [SEOMetrics] = []
    @Published public var selectedSource: String = "google" { // "google" or "bing"
        didSet { loadMetrics() }
    }
    @Published public var selectedPeriodDays: Int = 28 {
        didSet { loadMetrics() }
    }
    @Published public var isSyncing: Bool = false
    @Published public var syncError: String? = nil
    @Published public var loadError: String? = nil
    
    private var didLoad = false
    
    public init() {}
    
    public func ensureLoaded() {
        guard !didLoad else { return }
        didLoad = true
        loadMetrics()
    }
    
    public func resetForNewSession() {
        didLoad = false
        seoMetricsList = []
        syncError = nil
        loadError = nil
        isSyncing = false
    }
    
    public func loadMetrics() {
        isSyncing = true
        syncError = nil
        loadError = nil
        Task {
            do {
                let fetched = try await ConvexAPIService.shared.fetchSEOMetrics(
                    source: self.selectedSource,
                    periodDays: self.selectedPeriodDays
                )
                self.seoMetricsList = fetched
            } catch {
                self.seoMetricsList = []
                self.loadError = error.localizedDescription
            }
            self.isSyncing = false
        }
    }
    
    public var totalClicks: Int {
        seoMetricsList.reduce(0) { $0 + $1.clicks }
    }
    
    public var totalImpressions: Int {
        seoMetricsList.reduce(0) { $0 + $1.impressions }
    }
    
    public var averageCTR: Double {
        guard !seoMetricsList.isEmpty else { return 0 }
        let totalCtr = seoMetricsList.reduce(0.0) { $0 + $1.ctr }
        return totalCtr / Double(seoMetricsList.count)
    }
    
    public var averagePosition: Double {
        guard !seoMetricsList.isEmpty else { return 0 }
        let totalPos = seoMetricsList.reduce(0.0) { $0 + $1.position }
        return totalPos / Double(seoMetricsList.count)
    }
    
    public func syncMetrics() {
        isSyncing = true
        syncError = nil
        Task {
            do {
                let fetched = try await ConvexAPIService.shared.syncSEOMetrics(
                    source: self.selectedSource,
                    periodDays: self.selectedPeriodDays
                )
                self.seoMetricsList = fetched
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
}

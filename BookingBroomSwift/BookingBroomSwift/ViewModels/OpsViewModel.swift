import Foundation
import Observation

@MainActor
@Observable
public final class OpsViewModel {
    public var sitesHealth: [SiteHealthRow] = []
    public var sitePricingList: [SitePricingRow] = [] {
        didSet { addonCatalog = ConvexAPIService.addonCatalog(from: sitePricingList) }
    }
    public var compareResults: [SitePricingRow] = []
    public var pricingScenario: PricingScenario = .reference
    public var selectedCompareService: PricingCanonicalService = .standard
    public var isCheckingHealth: Bool = false
    public var isLoadingPricing: Bool = false
    public var isLoadingCompare: Bool = false
    public var pricingSaveError: String? = nil
    public var healthError: String? = nil
    
    public private(set) var addonCatalog: [PricingAddonOption] = []
    
    @ObservationIgnored private var didLoadHealth = false
    @ObservationIgnored private var didLoadPricing = false
    @ObservationIgnored private var lastHealthLoadedAt: Date?
    @ObservationIgnored private var lastPricingLoadedAt: Date?
    /// Debounce for scenario edits.
    @ObservationIgnored private var compareDebounceTask: Task<Void, Never>?
    /// The network request itself — cancelled when a newer scenario arrives.
    @ObservationIgnored private var compareFetchTask: Task<Void, Never>?
    @ObservationIgnored private var compareGeneration: UInt = 0
    
    @ObservationIgnored private let staleAfter: TimeInterval = 5 * 60
    
    public init() {}
    
    public var rankedCompareSites: [PricingRankedSite] {
        let key = selectedCompareService.rawValue
        var ranked: [PricingRankedSite] = []
        for row in compareResults {
            let entry = row.entries.first { $0.name == key }
            ranked.append(
                PricingRankedSite(
                    siteSlug: row.siteSlug,
                    siteName: row.siteName,
                    accentColorHex: row.accentColorHex,
                    engine: row.engine ?? row.configKind,
                    price: entry?.price,
                    note: nil,
                    isGap: entry == nil && row.engine != nil
                )
            )
        }
        return ranked.sorted { lhs, rhs in
            switch (lhs.price, rhs.price) {
            case let (l?, r?): return l < r
            case (_?, nil): return true
            case (nil, _?): return false
            default: return lhs.siteName < rhs.siteName
            }
        }
    }
    
    // MARK: - Lifecycle
    
    public func ensureHealthLoaded() {
        if didLoadHealth,
           let last = lastHealthLoadedAt,
           Date().timeIntervalSince(last) < staleAfter {
            return
        }
        didLoadHealth = true
        loadHealth()
    }
    
    public func ensurePricingLoaded() {
        if didLoadPricing,
           let last = lastPricingLoadedAt,
           Date().timeIntervalSince(last) < staleAfter {
            return
        }
        didLoadPricing = true
        loadPricing()
        refreshCompare()
    }
    
    public func resetForNewSession() {
        compareGeneration &+= 1
        didLoadHealth = false
        didLoadPricing = false
        lastHealthLoadedAt = nil
        lastPricingLoadedAt = nil
        sitesHealth = []
        sitePricingList = []
        compareResults = []
        pricingSaveError = nil
        healthError = nil
        isCheckingHealth = false
        isLoadingPricing = false
        isLoadingCompare = false
        compareDebounceTask?.cancel()
        compareDebounceTask = nil
        compareFetchTask?.cancel()
        compareFetchTask = nil
    }
    
    // MARK: - Health
    
    public func loadHealth() {
        Task { await loadHealthAndWait() }
    }
    
    public func loadHealthAndWait() async {
        do {
            let fetched = try await ConvexAPIService.shared.fetchSiteHealth()
            if fetched != sitesHealth { sitesHealth = fetched }
            lastHealthLoadedAt = Date()
            healthError = nil
        } catch let error as ConvexError where error.isCancelled {
            // superseded
        } catch {
            if sitesHealth.isEmpty { healthError = error.localizedDescription }
        }
    }
    
    /// Live HTTP probe of every site (external) then reload. Toolbar / ⌘R only.
    public func checkHealthNow() {
        guard !isCheckingHealth else { return }
        isCheckingHealth = true
        Task {
            do {
                try await ConvexAPIService.shared.checkSiteHealthNow()
            } catch {
                self.healthError = error.localizedDescription
            }
            await self.loadHealthAndWait()
            self.isCheckingHealth = false
        }
    }
    
    // MARK: - Pricing
    
    public func loadPricing() {
        Task { await loadPricingAndWait() }
    }
    
    public func loadPricingAndWait() async {
        if sitePricingList.isEmpty { isLoadingPricing = true }
        do {
            let fetched = try await ConvexAPIService.shared.fetchSitePricing()
            if fetched != sitePricingList { sitePricingList = fetched }
            lastPricingLoadedAt = Date()
        } catch let error as ConvexError where error.isCancelled {
            // superseded
        } catch {
            if sitePricingList.isEmpty { pricingSaveError = error.localizedDescription }
        }
        isLoadingPricing = false
        // Only kick a compare when nothing is on screen AND nothing is in flight
        // (ensurePricingLoaded already fired one — this used to double-fire at login).
        if compareResults.isEmpty && compareFetchTask == nil && !isLoadingCompare {
            refreshCompare()
        }
    }
    
    public func updateScenario(_ scenario: PricingScenario) {
        pricingScenario = scenario
        scheduleCompareRefresh()
    }
    
    public func applyPreset(_ preset: PricingScenarioPreset) {
        var next = preset.scenario
        next.addonKeys = []
        updateScenario(next)
    }
    
    public func resetScenario() {
        updateScenario(.reference)
    }
    
    public func toggleAddon(_ key: String) {
        var next = pricingScenario
        if next.addonKeys.contains(key) {
            next.addonKeys.removeAll { $0 == key }
        } else {
            next.addonKeys.append(key)
        }
        updateScenario(next)
    }
    
    /// Cancels any in-flight compare; stale responses are dropped via `compareGeneration`.
    public func refreshCompare() {
        compareDebounceTask?.cancel()
        compareDebounceTask = nil
        compareFetchTask?.cancel()
        
        compareGeneration &+= 1
        let generation = compareGeneration
        let scenario = pricingScenario
        isLoadingCompare = true
        
        compareFetchTask = Task {
            defer {
                if generation == self.compareGeneration {
                    self.compareFetchTask = nil
                    self.isLoadingCompare = false
                }
            }
            do {
                let results = try await ConvexAPIService.shared.comparePricingScenario(scenario)
                guard generation == self.compareGeneration, !Task.isCancelled else { return }
                if results != self.compareResults { self.compareResults = results }
            } catch let error as ConvexError where error.isCancelled {
                return
            } catch {
                guard generation == self.compareGeneration, !Task.isCancelled else { return }
                if self.compareResults.isEmpty {
                    self.compareResults = self.sitePricingList
                }
            }
        }
    }
    
    private func scheduleCompareRefresh() {
        compareDebounceTask?.cancel()
        compareDebounceTask = Task {
            try? await Task.sleep(nanoseconds: 250_000_000)
            guard !Task.isCancelled else { return }
            refreshCompare()
        }
    }
    
    public func savePricing(siteId: String, configJSON: Data, summary: String) async -> Bool {
        pricingSaveError = nil
        do {
            try await ConvexAPIService.shared.updateSitePricing(
                siteId: siteId,
                configJSON: configJSON,
                summary: summary
            )
            await loadPricingAndWait()
            refreshCompare()
            return true
        } catch {
            pricingSaveError = error.localizedDescription
            return false
        }
    }
}

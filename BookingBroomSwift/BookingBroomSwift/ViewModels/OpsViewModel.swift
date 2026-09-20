import Foundation
import Combine

public final class OpsViewModel: ObservableObject {
    @Published public var sitesHealth: [SiteHealthRow] = []
    @Published public var sitePricingList: [SitePricingRow] = []
    @Published public var compareResults: [SitePricingRow] = []
    @Published public var pricingScenario: PricingScenario = .reference
    @Published public var selectedCompareService: PricingCanonicalService = .standard
    @Published public var isCheckingHealth: Bool = false
    @Published public var isLoadingPricing: Bool = false
    @Published public var isLoadingCompare: Bool = false
    @Published public var pricingSaveError: String? = nil
    
    private var didLoadHealth = false
    private var didLoadPricing = false
    private var compareTask: Task<Void, Never>?
    
    public init() {}
    
    public var addonCatalog: [PricingAddonOption] {
        ConvexAPIService.addonCatalog(from: sitePricingList)
    }
    
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
    
    public func ensureHealthLoaded() {
        guard !didLoadHealth else { return }
        didLoadHealth = true
        loadHealth()
    }
    
    public func ensurePricingLoaded() {
        guard !didLoadPricing else { return }
        didLoadPricing = true
        loadPricing()
        refreshCompare()
    }
    
    public func resetForNewSession() {
        didLoadHealth = false
        didLoadPricing = false
        sitesHealth = []
        sitePricingList = []
        compareResults = []
        pricingSaveError = nil
        isCheckingHealth = false
        isLoadingPricing = false
        isLoadingCompare = false
        compareTask?.cancel()
        compareTask = nil
    }
    
    public func loadHealth() {
        Task { @MainActor in
            do {
                self.sitesHealth = try await ConvexAPIService.shared.fetchSiteHealth()
            } catch {
                self.sitesHealth = []
            }
        }
    }
    
    public func checkHealthNow() {
        isCheckingHealth = true
        Task { @MainActor in
            _ = try? await ConvexAPIService.shared.checkSiteHealthNow()
            self.loadHealth()
            self.isCheckingHealth = false
        }
    }
    
    public func loadPricing() {
        isLoadingPricing = true
        Task { @MainActor in
            do {
                self.sitePricingList = try await ConvexAPIService.shared.fetchSitePricing()
            } catch {
                self.sitePricingList = []
            }
            self.isLoadingPricing = false
            if self.compareResults.isEmpty {
                self.refreshCompare()
            }
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
    
    public func refreshCompare() {
        compareTask?.cancel()
        isLoadingCompare = true
        let scenario = pricingScenario
        Task { @MainActor in
            do {
                self.compareResults = try await ConvexAPIService.shared.comparePricingScenario(scenario)
            } catch {
                self.compareResults = self.sitePricingList
            }
            self.isLoadingCompare = false
        }
    }
    
    private func scheduleCompareRefresh() {
        compareTask?.cancel()
        compareTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 250_000_000)
            guard !Task.isCancelled else { return }
            refreshCompare()
        }
    }
    
    @MainActor
    public func savePricing(siteId: String, configJSON: Data, summary: String) async -> Bool {
        pricingSaveError = nil
        do {
            let ok = try await ConvexAPIService.shared.updateSitePricing(
                siteId: siteId,
                configJSON: configJSON,
                summary: summary
            )
            if ok {
                loadPricing()
                refreshCompare()
            }
            return ok
        } catch {
            pricingSaveError = error.localizedDescription
            return false
        }
    }
}

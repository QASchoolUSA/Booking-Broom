import Foundation
import Observation

@MainActor
@Observable
public final class DeploymentsViewModel {
    public var rows: [DeploymentRow] = [] { didSet { recomputeCounts() } }
    public var isLoading: Bool = false
    public var isSyncing: Bool = false
    public var lastError: String?
    
    public private(set) var successCount: Int = 0
    public private(set) var failedCount: Int = 0
    public private(set) var buildingCount: Int = 0
    public private(set) var usageAlertCount: Int = 0

    @ObservationIgnored private var didLoad = false
    @ObservationIgnored private var lastLoadedAt: Date?
    @ObservationIgnored private let staleAfter: TimeInterval = 5 * 60

    public init() {}

    public func ensureLoaded() {
        if didLoad,
           let last = lastLoadedAt,
           Date().timeIntervalSince(last) < staleAfter {
            return
        }
        didLoad = true
        load()
    }

    public func resetForNewSession() {
        didLoad = false
        lastLoadedAt = nil
        rows = []
        lastError = nil
        isLoading = false
        isSyncing = false
    }

    public func load() {
        Task { await loadAndWait() }
    }
    
    public func loadAndWait() async {
        if rows.isEmpty { isLoading = true }
        do {
            let fetched = try await ConvexAPIService.shared.fetchDeployments()
            if fetched != rows { rows = fetched }
            lastLoadedAt = Date()
            lastError = nil
        } catch let error as ConvexError where error.isCancelled {
            // superseded
        } catch {
            if rows.isEmpty { lastError = error.localizedDescription }
        }
        isLoading = false
    }

    /// Cloudflare pull (external) then reload. Toolbar / ⌘R only.
    public func syncNow() {
        guard !isSyncing else { return }
        isSyncing = true
        lastError = nil
        Task {
            do {
                let fetched = try await ConvexAPIService.shared.syncDeployments()
                if fetched != self.rows { self.rows = fetched }
                self.lastLoadedAt = Date()
                HapticFeedback.notification(.success)
            } catch {
                self.lastError = error.localizedDescription
                HapticFeedback.notification(.error)
                // Still refresh cached status if sync partially wrote rows.
                await self.loadAndWait()
            }
            self.isSyncing = false
        }
    }

    private func recomputeCounts() {
        successCount = rows.filter(\.isSuccess).count
        failedCount = rows.filter(\.isFailed).count
        buildingCount = rows.filter(\.isBuilding).count
        usageAlertCount = rows.filter { row in
            if row.buildMinutesLimitReached == true { return true }
            if let pct = row.usagePercent, pct >= 70 { return true }
            return false
        }.count
    }
}

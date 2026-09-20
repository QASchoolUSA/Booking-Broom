import Foundation
import Combine

@MainActor
public final class DeploymentsViewModel: ObservableObject {
    @Published public var rows: [DeploymentRow] = []
    @Published public var isSyncing: Bool = false
    @Published public var lastError: String?

    private var didLoad = false

    public init() {}

    public func ensureLoaded() {
        guard !didLoad else { return }
        didLoad = true
        load()
    }

    public func resetForNewSession() {
        didLoad = false
        rows = []
        lastError = nil
        isSyncing = false
    }

    public func load() {
        Task {
            do {
                let fetched = try await ConvexAPIService.shared.fetchDeployments()
                self.rows = fetched
                self.lastError = nil
            } catch {
                self.rows = []
                self.lastError = error.localizedDescription
            }
        }
    }

    public func syncNow() {
        isSyncing = true
        lastError = nil
        Task {
            do {
                let fetched = try await ConvexAPIService.shared.syncDeployments()
                self.rows = fetched
                HapticFeedback.notification(.success)
            } catch {
                self.lastError = error.localizedDescription
                HapticFeedback.notification(.error)
                // Still refresh cached status if sync partially wrote rows.
                self.load()
            }
            self.isSyncing = false
        }
    }

    public var successCount: Int { rows.filter(\.isSuccess).count }
    public var failedCount: Int { rows.filter(\.isFailed).count }
    public var buildingCount: Int { rows.filter(\.isBuilding).count }
    public var usageAlertCount: Int {
        rows.filter { row in
            if row.buildMinutesLimitReached == true { return true }
            if let pct = row.usagePercent, pct >= 70 { return true }
            return false
        }.count
    }
}

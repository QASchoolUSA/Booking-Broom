import Foundation
import Observation

@MainActor
@Observable
public final class PerformanceViewModel {
    public var performanceList: [PerformanceMetrics] = [] { didSet { recomputeAverages() } }
    public var selectedStrategy: String = "mobile" { // "mobile" or "desktop"
        didSet { if oldValue != selectedStrategy { loadPerformance() } }
    }
    public var isLoading: Bool = false
    /// True while `pagespeedActions:syncNow` runs real Lighthouse audits (slow).
    public var isAuditing: Bool = false
    public var loadError: String? = nil
    
    public private(set) var averagePerformanceScore: Int = 0
    public private(set) var averageAgenticScore: Int = 0
    
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
        loadPerformance()
    }
    
    public func resetForNewSession() {
        loadGeneration &+= 1
        loadTask?.cancel()
        loadTask = nil
        didLoad = false
        lastLoadedAt = nil
        performanceList = []
        loadError = nil
        isLoading = false
        isAuditing = false
    }
    
    /// Read cached metrics from Convex. Cancels the prior load on strategy change.
    public func loadPerformance() {
        loadTask?.cancel()
        loadGeneration &+= 1
        let generation = loadGeneration
        let strategy = selectedStrategy
        loadError = nil
        if performanceList.isEmpty { isLoading = true }
        
        loadTask = Task {
            defer {
                if generation == self.loadGeneration { self.isLoading = false }
            }
            do {
                let fetched = try await ConvexAPIService.shared.fetchPerformanceMetrics(strategy: strategy)
                guard generation == self.loadGeneration, !Task.isCancelled else { return }
                if fetched != self.performanceList { self.performanceList = fetched }
                self.lastLoadedAt = Date()
            } catch let error as ConvexError where error.isCancelled {
                return
            } catch {
                guard generation == self.loadGeneration, !Task.isCancelled else { return }
                if self.performanceList.isEmpty {
                    self.loadError = error.localizedDescription
                }
            }
        }
    }
    
    public func loadPerformanceAndWait() async {
        loadPerformance()
        await loadTask?.value
    }
    
    /// Run fresh PageSpeed audits for every site, then reload. Toolbar / ⌘R only.
    public func runAudits() {
        guard !isAuditing else { return }
        isAuditing = true
        loadError = nil
        loadTask?.cancel()
        loadGeneration &+= 1
        let generation = loadGeneration
        let strategy = selectedStrategy
        Task {
            do {
                let fetched = try await ConvexAPIService.shared.runPageSpeedAudits(strategy: strategy)
                guard generation == self.loadGeneration else { return }
                if fetched != self.performanceList { self.performanceList = fetched }
                self.lastLoadedAt = Date()
                HapticFeedback.notification(.success)
            } catch {
                self.loadError = error.localizedDescription
                HapticFeedback.notification(.error)
            }
            self.isAuditing = false
        }
    }
    
    private func recomputeAverages() {
        guard !performanceList.isEmpty else {
            averagePerformanceScore = 0
            averageAgenticScore = 0
            return
        }
        averagePerformanceScore = performanceList.reduce(0) { $0 + $1.performanceScore } / performanceList.count
        averageAgenticScore = performanceList.reduce(0) { $0 + $1.agenticBrowsingScore } / performanceList.count
    }
}

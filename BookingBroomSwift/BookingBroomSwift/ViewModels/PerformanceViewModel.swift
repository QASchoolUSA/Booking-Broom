import Foundation
import Combine

@MainActor
public final class PerformanceViewModel: ObservableObject {
    @Published public var performanceList: [PerformanceMetrics] = []
    @Published public var selectedStrategy: String = "mobile" // "mobile" or "desktop"
    @Published public var isAuditing: Bool = false
    @Published public var loadError: String? = nil
    
    private var didLoad = false
    
    public init() {}
    
    public func ensureLoaded() {
        guard !didLoad else { return }
        didLoad = true
        loadPerformance()
    }
    
    public func resetForNewSession() {
        didLoad = false
        performanceList = []
        loadError = nil
        isAuditing = false
    }
    
    public func loadPerformance() {
        isAuditing = true
        loadError = nil
        Task {
            do {
                let fetched = try await ConvexAPIService.shared.fetchPerformanceMetrics(strategy: self.selectedStrategy)
                self.performanceList = fetched
            } catch {
                self.performanceList = []
                self.loadError = error.localizedDescription
            }
            self.isAuditing = false
        }
    }
    
    public var averagePerformanceScore: Int {
        guard !performanceList.isEmpty else { return 0 }
        let total = performanceList.reduce(0) { $0 + $1.performanceScore }
        return total / performanceList.count
    }
    
    public var averageAgenticScore: Int {
        guard !performanceList.isEmpty else { return 0 }
        let total = performanceList.reduce(0) { $0 + $1.agenticBrowsingScore }
        return total / performanceList.count
    }
    
    public func runAudits() {
        loadPerformance()
        HapticFeedback.notification(.success)
    }
}

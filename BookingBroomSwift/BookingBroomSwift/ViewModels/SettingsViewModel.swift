import Foundation
import Observation

@MainActor
@Observable
public final class SettingsViewModel {
    public var sites: [CleaningSite] = []
    public var isPushEnabled: Bool = NotificationManager.shared.isPushPreferenceEnabled
    public var isPushBusy: Bool = false
    public var pushError: String?
    public var apiModeIsMock: Bool = false {
        didSet {
            guard oldValue != apiModeIsMock else { return }
            let enabled = apiModeIsMock
            Task { await ConvexAPIService.shared.setMockMode(enabled) }
        }
    }
    public var convexURL: String = ConvexAPIService.defaultBaseURL {
        didSet {
            guard oldValue != convexURL else { return }
            let url = convexURL
            Task { await ConvexAPIService.shared.setBaseURL(url) }
        }
    }
    
    @ObservationIgnored private var didLoad = false
    @ObservationIgnored private var lastLoadedAt: Date?
    @ObservationIgnored private let staleAfter: TimeInterval = 5 * 60
    
    public init() {}
    
    public func ensureLoaded() {
        isPushEnabled = NotificationManager.shared.isPushPreferenceEnabled
        if didLoad,
           let last = lastLoadedAt,
           Date().timeIntervalSince(last) < staleAfter {
            return
        }
        didLoad = true
        loadSites()
    }
    
    public func resetForNewSession() {
        didLoad = false
        lastLoadedAt = nil
        sites = []
        pushError = nil
        isPushBusy = false
        isPushEnabled = NotificationManager.shared.isPushPreferenceEnabled
    }
    
    public func loadSites() {
        Task {
            do {
                let fetched = try await ConvexAPIService.shared.fetchSites()
                if fetched != self.sites { self.sites = fetched }
                self.lastLoadedAt = Date()
            } catch {
                // Keep whatever is shown.
            }
        }
    }
    
    public func setPushEnabled(_ enabled: Bool) async {
        guard !isPushBusy else { return }
        isPushBusy = true
        pushError = nil
        defer { isPushBusy = false }
        
        if enabled {
            let ok = await NotificationManager.shared.enablePush()
            isPushEnabled = ok
            if !ok {
                pushError = "Notifications permission was denied. Enable it in System Settings."
            }
        } else {
            await NotificationManager.shared.disablePush()
            isPushEnabled = false
        }
    }
}

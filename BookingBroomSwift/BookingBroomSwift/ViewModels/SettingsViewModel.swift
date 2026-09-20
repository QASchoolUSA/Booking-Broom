import Foundation
import Combine

@MainActor
public final class SettingsViewModel: ObservableObject {
    @Published public var sites: [CleaningSite] = []
    @Published public var isPushEnabled: Bool = NotificationManager.shared.isPushPreferenceEnabled
    @Published public var isPushBusy: Bool = false
    @Published public var pushError: String?
    @Published public var apiModeIsMock: Bool = false {
        didSet {
            ConvexAPIService.shared.useMockData = apiModeIsMock
        }
    }
    @Published     public var convexURL: String = "https://dynamic-gnu-491.convex.cloud" {
        didSet {
            ConvexAPIService.shared.baseURLString = convexURL
        }
    }
    
    private var didLoad = false
    
    public init() {}
    
    public func ensureLoaded() {
        guard !didLoad else { return }
        didLoad = true
        isPushEnabled = NotificationManager.shared.isPushPreferenceEnabled
        loadSites()
    }
    
    public func resetForNewSession() {
        didLoad = false
        sites = []
        pushError = nil
        isPushBusy = false
        isPushEnabled = NotificationManager.shared.isPushPreferenceEnabled
    }
    
    public func loadSites() {
        Task {
            do {
                let fetched = try await ConvexAPIService.shared.fetchSites()
                self.sites = fetched
            } catch {
                self.sites = []
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

import Foundation
import UserNotifications
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

public enum ApnsPlatform: String {
    case ios
    case ipados
    case macos
}

public final class NotificationManager: NSObject {
    public static let shared = NotificationManager()
    
    public static let pushEnabledDefaultsKey = "bb.isPushNotificationsEnabled"
    public static let deviceTokenDefaultsKey = "bb.apnsDeviceToken"
    
    public var onNotificationOpen: ((String?) -> Void)?
    /// Fired when a notification arrives while the app is in the foreground (banner still shown).
    public var onForegroundNotification: (() -> Void)?
    
    private var pendingDeviceToken: String?
    
    private override init() {
        super.init()
    }
    
    public var isPushPreferenceEnabled: Bool {
        get {
            if UserDefaults.standard.object(forKey: Self.pushEnabledDefaultsKey) == nil {
                return true
            }
            return UserDefaults.standard.bool(forKey: Self.pushEnabledDefaultsKey)
        }
        set {
            UserDefaults.standard.set(newValue, forKey: Self.pushEnabledDefaultsKey)
        }
    }
    
    public var storedDeviceToken: String? {
        get { UserDefaults.standard.string(forKey: Self.deviceTokenDefaultsKey) }
        set {
            if let newValue {
                UserDefaults.standard.set(newValue, forKey: Self.deviceTokenDefaultsKey)
            } else {
                UserDefaults.standard.removeObject(forKey: Self.deviceTokenDefaultsKey)
            }
        }
    }
    
    public var currentPlatform: ApnsPlatform {
        #if os(macOS)
        return .macos
        #elseif os(iOS)
        if UIDevice.current.userInterfaceIdiom == .pad {
            return .ipados
        }
        return .ios
        #else
        return .ios
        #endif
    }
    
    public var apnsEnvironment: String {
        #if DEBUG
        return "development"
        #else
        return "production"
        #endif
    }
    
    @discardableResult
    public func requestAuthorization() async -> Bool {
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])
            return granted
        } catch {
            return false
        }
    }
    
    public func registerForRemoteNotificationsIfNeeded() {
        guard isPushPreferenceEnabled else { return }
        #if os(iOS)
        UIApplication.shared.registerForRemoteNotifications()
        #elseif os(macOS)
        NSApplication.shared.registerForRemoteNotifications()
        #endif
    }
    
    public func unregisterFromRemoteNotifications() {
        #if os(iOS)
        UIApplication.shared.unregisterForRemoteNotifications()
        #elseif os(macOS)
        NSApplication.shared.unregisterForRemoteNotifications()
        #endif
    }
    
    public func handleDeviceToken(_ deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        pendingDeviceToken = hex
        storedDeviceToken = hex
        Task {
            await uploadPendingTokenIfPossible()
        }
    }
    
    public func handleRegistrationFailure(_ error: Error) {
        print("[APNs] registration failed: \(error.localizedDescription)")
    }
    
    public func uploadPendingTokenIfPossible() async {
        guard isPushPreferenceEnabled else { return }
        guard ConvexAPIService.shared.authToken != nil else { return }
        guard let token = pendingDeviceToken ?? storedDeviceToken else { return }
        let ok = await ConvexAPIService.shared.saveApnsPushToken(
            token: token,
            platform: currentPlatform.rawValue,
            environment: apnsEnvironment
        )
        if ok {
            pendingDeviceToken = token
            print("[APNs] device token saved (\(currentPlatform.rawValue)/\(apnsEnvironment))")
        } else {
            // Usually: not signed in yet, Convex push mutation missing, or backend rejected the token.
            print("[APNs] failed to save device token (\(currentPlatform.rawValue)/\(apnsEnvironment)); will retry after auth")
        }
    }
    
    public func enablePush() async -> Bool {
        isPushPreferenceEnabled = true
        let granted = await requestAuthorization()
        guard granted else {
            isPushPreferenceEnabled = false
            return false
        }
        await MainActor.run {
            registerForRemoteNotificationsIfNeeded()
        }
        await uploadPendingTokenIfPossible()
        return true
    }
    
    public func disablePush() async {
        isPushPreferenceEnabled = false
        if let token = storedDeviceToken {
            _ = await ConvexAPIService.shared.removeApnsPushToken(token: token)
        }
        storedDeviceToken = nil
        pendingDeviceToken = nil
        await MainActor.run {
            unregisterFromRemoteNotifications()
        }
    }
    
    /// Call after successful login / biometric unlock.
    public func syncAfterAuthentication() async {
        guard isPushPreferenceEnabled else { return }
        let granted = await requestAuthorization()
        guard granted else { return }
        await MainActor.run {
            registerForRemoteNotificationsIfNeeded()
        }
        await uploadPendingTokenIfPossible()
    }
    
    public func scheduleBookingNotification(booking: Booking) {
        let content = UNMutableNotificationContent()
        content.title = "New Booking Received"
        content.subtitle = "\(booking.siteName) • \(booking.serviceType)"
        content.body = "\(booking.customerName) requested \(booking.serviceType). Preferred date: \(booking.preferredDate ?? "ASAP")."
        content.sound = .default
        content.userInfo = ["bookingId": booking.id]
        
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 3, repeats: false)
        let request = UNNotificationRequest(identifier: booking.id, content: content, trigger: trigger)
        
        UNUserNotificationCenter.current().add(request) { _ in }
    }
    
    public func scheduleReminder(title: String, body: String, timeInterval: TimeInterval) {
        let content = UNMutableNotificationContent()
        content.title = "Manager Reminder: \(title)"
        content.body = body
        content.sound = .default
        
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: timeInterval, repeats: false)
        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: trigger)
        
        UNUserNotificationCenter.current().add(request) { _ in }
    }
    
    public func bookingId(from userInfo: [AnyHashable: Any]) -> String? {
        if let bookingId = userInfo["bookingId"] as? String, !bookingId.isEmpty {
            return bookingId
        }
        return nil
    }
}

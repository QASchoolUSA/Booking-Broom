import SwiftUI
import UserNotifications

@main
struct BookingBroomApp: App {
    @State private var authVM = AuthViewModel()
    @State private var appController = AppController()
    @Environment(\.scenePhase) private var scenePhase
    
    #if os(iOS)
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    #endif
    #if os(macOS)
    @NSApplicationDelegateAdaptor(MacAppDelegate.self) var appDelegate
    #endif
    
    var body: some Scene {
        WindowGroup {
            Group {
                if authVM.session.isAuthenticated {
                    MainTabView(authVM: authVM, appController: appController)
                } else {
                    LoginView(authVM: authVM)
                }
            }
            .environment(appController)
            .tint(AppColors.primary)
            #if os(macOS)
            .frame(minWidth: 900, minHeight: 600)
            #endif
            .task {
                NotificationManager.shared.onNotificationOpen = { bookingId in
                    appController.openBookingFromPush(bookingId: bookingId)
                }
                NotificationManager.shared.onForegroundNotification = {
                    appController.refreshOnForeground()
                }
                // Permission prompt only after authentication — never on the login screen.
                if authVM.session.isAuthenticated {
                    await NotificationManager.shared.syncAfterAuthentication()
                }
            }
            .onChange(of: scenePhase) { _, newPhase in
                if newPhase == .active, authVM.session.isAuthenticated {
                    appController.refreshOnForeground()
                }
            }
            .onChange(of: authVM.session.isAuthenticated) { _, isAuthenticated in
                if isAuthenticated {
                    appController.resetAndReloadForSession()
                    Task {
                        await NotificationManager.shared.syncAfterAuthentication()
                    }
                } else {
                    appController.clearSessionData()
                }
            }
            .alert(
                "Enable \(authVM.biometryName)?",
                isPresented: $authVM.showBiometricPromptAfterLogin
            ) {
                Button("Not Now", role: .cancel) { authVM.skipBiometricsPrompt() }
                Button("Enable") {
                    Task { await authVM.enableBiometricsAfterLogin() }
                }
            } message: {
                Text("Unlock Booking Broom faster next time. You can change this in Settings.")
            }
        }
        #if os(macOS)
        .defaultSize(width: 1200, height: 800)
        .commands {
            BookingBroomCommands(authVM: authVM, appController: appController)
        }
        #endif
        
        #if os(macOS)
        Settings {
            if authVM.session.isAuthenticated {
                SettingsView(
                    settingsVM: appController.settingsVM,
                    authVM: authVM,
                    opsVM: appController.opsVM
                )
                .frame(minWidth: 480, minHeight: 420)
            } else {
                Text("Sign in to manage settings.")
                    .foregroundStyle(.secondary)
                    .frame(minWidth: 320, minHeight: 160)
            }
        }
        
        WindowGroup("Booking", id: "booking-detail", for: String.self) { $bookingId in
            if let bookingId,
               let booking = appController.bookingsVM.bookings.first(where: { $0.id == bookingId }) {
                BookingDetailView(
                    booking: booking,
                    bookingsVM: appController.bookingsVM,
                    messagesVM: appController.messagesVM
                )
            } else {
                ContentUnavailableView("Booking", systemImage: "calendar", description: Text("Select a booking from the list."))
            }
        }
        .defaultSize(width: 720, height: 860)
        
        WindowGroup("Message", id: "sms-thread", for: String.self) { $threadId in
            if let threadId,
               let thread = appController.messagesVM.threads.first(where: { $0.id == threadId }) {
                ChatThreadView(thread: thread, messagesVM: appController.messagesVM)
                    .environment(appController)
                    .frame(minWidth: 420, minHeight: 560)
            } else {
                ContentUnavailableView("Conversation", systemImage: "bubble.left.and.bubble.right", description: Text("Select a thread from Messages."))
            }
        }
        .defaultSize(width: 520, height: 720)
        #endif
    }
}

#if os(iOS)
class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }
    
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationManager.shared.handleDeviceToken(deviceToken)
    }
    
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationManager.shared.handleRegistrationFailure(error)
    }
    
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        NotificationManager.shared.onForegroundNotification?()
        completionHandler([.banner, .sound, .badge])
    }
    
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        let bookingId = NotificationManager.shared.bookingId(from: response.notification.request.content.userInfo)
        NotificationManager.shared.onNotificationOpen?(bookingId)
        completionHandler()
    }
}
#endif

#if os(macOS)
import AppKit

class MacAppDelegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        UNUserNotificationCenter.current().delegate = self
    }
    
    func application(_ application: NSApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationManager.shared.handleDeviceToken(deviceToken)
    }
    
    func application(_ application: NSApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationManager.shared.handleRegistrationFailure(error)
    }
    
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        NotificationManager.shared.onForegroundNotification?()
        completionHandler([.banner, .sound])
    }
    
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        let bookingId = NotificationManager.shared.bookingId(from: response.notification.request.content.userInfo)
        NotificationManager.shared.onNotificationOpen?(bookingId)
        completionHandler()
    }
}

struct BookingBroomCommands: Commands {
    @Bindable var authVM: AuthViewModel
    @Bindable var appController: AppController
    
    var body: some Commands {
        CommandGroup(replacing: .appInfo) {
            Button("About Booking Broom") {
                NSApplication.shared.orderFrontStandardAboutPanel(nil)
            }
        }
        
        CommandGroup(after: .appSettings) {
            Button("Sign Out") {
                authVM.logout()
            }
            .disabled(!authVM.session.isAuthenticated)
            .keyboardShortcut("q", modifiers: [.command, .shift])
        }
        
        CommandGroup(replacing: .newItem) {
            Button("New Booking") {
                appController.select(.bookings)
                appController.showingNewBooking = true
            }
            .keyboardShortcut("n", modifiers: .command)
            .disabled(!authVM.session.isAuthenticated)
            
            Button("Sync") {
                appController.syncCurrent()
            }
            .keyboardShortcut("r", modifiers: .command)
            .disabled(!authVM.session.isAuthenticated)
        }
        
        CommandMenu("View") {
            Button("Dashboard") { appController.select(.dashboard) }
                .keyboardShortcut("1", modifiers: .command)
                .disabled(!authVM.session.isAuthenticated)
            Button("Bookings") { appController.select(.bookings) }
                .keyboardShortcut("2", modifiers: .command)
                .disabled(!authVM.session.isAuthenticated)
            Button("Messages") { appController.select(.messages) }
                .keyboardShortcut("3", modifiers: .command)
                .disabled(!authVM.session.isAuthenticated)
            Button("Email") { appController.select(.email) }
                .keyboardShortcut("4", modifiers: .command)
                .disabled(!authVM.session.isAuthenticated)
            Button("Pricing") { appController.select(.pricing) }
                .keyboardShortcut("5", modifiers: .command)
                .disabled(!authVM.session.isAuthenticated)
            Button("SEO") { appController.select(.seo) }
                .keyboardShortcut("6", modifiers: .command)
                .disabled(!authVM.session.isAuthenticated)
            Button("Sites Health") { appController.select(.health) }
                .keyboardShortcut("7", modifiers: .command)
                .disabled(!authVM.session.isAuthenticated)
            Button("Deploys") { appController.select(.deploys) }
                .keyboardShortcut("8", modifiers: .command)
                .disabled(!authVM.session.isAuthenticated)
            Button("PageSpeed") { appController.select(.speed) }
                .keyboardShortcut("9", modifiers: .command)
                .disabled(!authVM.session.isAuthenticated)
            Button("Settings") { appController.select(.settings) }
                .keyboardShortcut("0", modifiers: .command)
                .disabled(!authVM.session.isAuthenticated)
        }
        
        CommandGroup(after: .help) {
            Button("Open Booking Broom Web…") {
                if let url = URL(string: "https://app.bookingbroom.com") {
                    PlatformOpenURL.open(url)
                }
            }
        }
    }
}
#endif

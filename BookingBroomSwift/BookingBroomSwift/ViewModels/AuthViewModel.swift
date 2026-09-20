import Foundation
import Combine

@MainActor
public final class AuthViewModel: ObservableObject {
    @Published public var session: UserSession = UserSession(isAuthenticated: false)
    @Published public var emailInput: String = ""
    @Published public var passwordInput: String = ""
    @Published public var isLoading: Bool = false
    @Published public var errorMessage: String? = nil
    @Published public var showBiometricPromptAfterLogin: Bool = false
    @Published public var prefersPasswordForm: Bool = false
    @Published public var isUnlockingBiometrics: Bool = false
    /// false = sign in, true = create manager account
    @Published public var isSignUpMode: Bool = false
    
    @Published public var isBiometricsEnabled: Bool = UserDefaults.standard.bool(forKey: "bb.isBiometricsEnabled") {
        didSet {
            UserDefaults.standard.set(isBiometricsEnabled, forKey: "bb.isBiometricsEnabled")
        }
    }
    
    public var canUseBiometrics: Bool {
        BiometricAuthManager.shared.canEvaluatePolicy()
            && isBiometricsEnabled
            && {
                if let token = KeychainStore.string(forKey: KeychainStore.Key.authToken),
                   KeychainStore.isRealAuthToken(token) {
                    return true
                }
                if let refresh = KeychainStore.string(forKey: KeychainStore.Key.refreshToken),
                   !refresh.isEmpty {
                    return true
                }
                return false
            }()
    }
    
    /// Device has Face ID / Touch ID hardware (may still need enrollment).
    public var deviceSupportsBiometrics: Bool {
        BiometricAuthManager.shared.hasBiometricHardware
    }
    
    /// Biometrics enrolled and ready to prompt.
    public var biometricsEnrolled: Bool {
        BiometricAuthManager.shared.canEvaluatePolicy()
    }
    
    public var biometricsStatusHint: String {
        if canUseBiometrics {
            #if os(macOS)
            return "Click to unlock"
            #else
            return "Tap to unlock"
            #endif
        }
        if !biometricsEnrolled {
            #if targetEnvironment(simulator)
            return "Simulator: Features → \(biometryName) → Enrolled"
            #elseif os(macOS)
            return "Enroll \(biometryName) in System Settings → Touch ID & Password"
            #else
            return "Enroll \(biometryName) in Settings → \(biometryName) & Passcode"
            #endif
        }
        if !isBiometricsEnabled {
            return "Sign in once, then enable when prompted"
        }
        let hasAuth = KeychainStore.string(forKey: KeychainStore.Key.authToken).map(KeychainStore.isRealAuthToken) == true
        let hasRefresh = !(KeychainStore.string(forKey: KeychainStore.Key.refreshToken) ?? "").isEmpty
        if !hasAuth && !hasRefresh {
            return "Sign in once to save your session"
        }
        return "Available after setup"
    }
    
    public var biometryName: String {
        BiometricAuthManager.shared.biometryDisplayName
    }
    
    public var biometrySymbol: String {
        BiometricAuthManager.shared.biometrySymbolName
    }
    
    public var convexBaseURL: String {
        ConvexAPIService.shared.baseURLString
    }
    
    public init() {
        if let savedEmail = KeychainStore.string(forKey: KeychainStore.Key.email) {
            emailInput = savedEmail
        }
        // Drop stale fake tokens from older app builds
        if let token = KeychainStore.string(forKey: KeychainStore.Key.authToken),
           !KeychainStore.isRealAuthToken(token) {
            KeychainStore.delete(KeychainStore.Key.authToken)
            KeychainStore.delete(KeychainStore.Key.refreshToken)
        }
        prefersPasswordForm = !canUseBiometrics
    }
    
    public func submit() {
        if isSignUpMode {
            signUp()
        } else {
            login()
        }
    }
    
    public func login() {
        authenticate(flowSignUp: false)
    }
    
    public func signUp() {
        authenticate(flowSignUp: true)
    }
    
    private func authenticate(flowSignUp: Bool) {
        let email = emailInput.trimmingCharacters(in: .whitespacesAndNewlines)
        let password = passwordInput
        
        guard !email.isEmpty, !password.isEmpty else {
            errorMessage = "Enter your email and password."
            return
        }
        
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                let (token, userEmail): (String, String)
                if flowSignUp {
                    (token, userEmail) = try await ConvexAPIService.shared.signUp(
                        email: email,
                        password: password
                    )
                } else {
                    (token, userEmail) = try await ConvexAPIService.shared.login(
                        email: email,
                        password: password
                    )
                }
                
                guard KeychainStore.isRealAuthToken(token) || token.hasPrefix("mock_token_") else {
                    errorMessage = "Sign-in returned an invalid session. Try again."
                    isLoading = false
                    HapticFeedback.notification(.error)
                    return
                }
                
                let name = managerName(from: userEmail)
                KeychainStore.saveSession(token: token, email: userEmail, managerName: name)
                ConvexAPIService.shared.authToken = token
                session = UserSession(
                    isAuthenticated: true,
                    email: userEmail,
                    managerName: name,
                    token: token,
                    isFaceIDEnabled: isBiometricsEnabled
                )
                passwordInput = ""
                isLoading = false
                HapticFeedback.notification(.success)
                
                // Present after MainTabView mounts so the alert is not torn down with LoginView.
                if BiometricAuthManager.shared.canEvaluatePolicy() && !isBiometricsEnabled {
                    Task {
                        try? await Task.sleep(nanoseconds: 350_000_000)
                        guard !self.isBiometricsEnabled else { return }
                        self.showBiometricPromptAfterLogin = true
                    }
                }
            } catch {
                errorMessage = friendlyAuthError(error)
                isLoading = false
                HapticFeedback.notification(.error)
            }
        }
    }
    
    public func unlockWithBiometrics() {
        guard canUseBiometrics else {
            prefersPasswordForm = true
            return
        }
        guard !isUnlockingBiometrics else { return }
        
        isUnlockingBiometrics = true
        errorMessage = nil
        
        Task {
            let ok = await BiometricAuthManager.shared.authenticateWithBiometrics(
                reason: "Unlock Booking Broom with \(biometryName)"
            )
            guard ok else {
                errorMessage = "\(biometryName) unlock failed. Use email and password."
                prefersPasswordForm = true
                HapticFeedback.notification(.error)
                isUnlockingBiometrics = false
                return
            }
            
            let email = KeychainStore.string(forKey: KeychainStore.Key.email) ?? emailInput
            let name = KeychainStore.string(forKey: KeychainStore.Key.managerName)
                ?? managerName(from: email)
            
            do {
                let token = try await restoreSessionTokenAfterBiometrics()
                KeychainStore.saveSession(token: token, email: email, managerName: name)
                ConvexAPIService.shared.authToken = token
                session = UserSession(
                    isAuthenticated: true,
                    email: email,
                    managerName: name,
                    token: token,
                    isFaceIDEnabled: true
                )
                HapticFeedback.notification(.success)
            } catch {
                let isSessionDead: Bool = {
                    if let auth = error as? ConvexAPIService.AuthError {
                        switch auth {
                        case .sessionExpired, .missingToken, .invalidCredentials:
                            return true
                        default:
                            return false
                        }
                    }
                    return false
                }()
                if isSessionDead {
                    KeychainStore.delete(KeychainStore.Key.authToken)
                    KeychainStore.delete(KeychainStore.Key.refreshToken)
                    ConvexAPIService.shared.authToken = nil
                    prefersPasswordForm = true
                }
                errorMessage = friendlyAuthError(error)
                HapticFeedback.notification(.error)
            }
            isUnlockingBiometrics = false
        }
    }
    
    /// Prefer refresh-token exchange; fall back to validating the stored access token.
    private func restoreSessionTokenAfterBiometrics() async throws -> String {
        if let refresh = KeychainStore.string(forKey: KeychainStore.Key.refreshToken),
           !refresh.isEmpty {
            do {
                let (token, newRefresh) = try await ConvexAPIService.shared.refreshSession(using: refresh)
                if let newRefresh, !newRefresh.isEmpty {
                    KeychainStore.set(newRefresh, forKey: KeychainStore.Key.refreshToken)
                }
                guard KeychainStore.isRealAuthToken(token) || token.hasPrefix("mock_token_") else {
                    throw ConvexAPIService.AuthError.sessionExpired
                }
                try await ConvexAPIService.shared.validateAuthenticatedSession()
                return token
            } catch {
                // Fall through to access-token validation when refresh is unavailable/expired.
                if case ConvexAPIService.AuthError.network = error {
                    throw error
                }
            }
        }
        
        guard let token = KeychainStore.string(forKey: KeychainStore.Key.authToken),
              KeychainStore.isRealAuthToken(token) else {
            throw ConvexAPIService.AuthError.sessionExpired
        }
        
        ConvexAPIService.shared.authToken = token
        try await ConvexAPIService.shared.validateAuthenticatedSession()
        return token
    }
    
    public func enableBiometricsAfterLogin() async {
        let success = await BiometricAuthManager.shared.authenticateWithBiometrics(
            reason: "Enable \(biometryName) for faster sign-in"
        )
        isBiometricsEnabled = success
        session.isFaceIDEnabled = success
        showBiometricPromptAfterLogin = false
        if success {
            HapticFeedback.notification(.success)
        }
    }
    
    public func skipBiometricsPrompt() {
        showBiometricPromptAfterLogin = false
    }
    
    public func setBiometricsEnabled(_ enabled: Bool) async -> Bool {
        if enabled {
            guard BiometricAuthManager.shared.canEvaluatePolicy() else { return false }
            guard let token = KeychainStore.string(forKey: KeychainStore.Key.authToken),
                  KeychainStore.isRealAuthToken(token) else {
                return false
            }
            let ok = await BiometricAuthManager.shared.authenticateWithBiometrics(
                reason: "Enable \(biometryName) unlock"
            )
            isBiometricsEnabled = ok
            session.isFaceIDEnabled = ok
            return ok
        } else {
            isBiometricsEnabled = false
            session.isFaceIDEnabled = false
            return true
        }
    }
    
    public func logout() {
        let rememberedEmail = session.email ?? emailInput
        let keepSessionForBiometrics =
            isBiometricsEnabled
            && BiometricAuthManager.shared.hasBiometricHardware
            && (
                KeychainStore.string(forKey: KeychainStore.Key.authToken).map(KeychainStore.isRealAuthToken) == true
                || !(KeychainStore.string(forKey: KeychainStore.Key.refreshToken) ?? "").isEmpty
            )
        
        if !keepSessionForBiometrics {
            let deviceToken = NotificationManager.shared.storedDeviceToken
            let authSnapshot = ConvexAPIService.shared.authToken
            Task {
                if let deviceToken, let authSnapshot {
                    ConvexAPIService.shared.authToken = authSnapshot
                    _ = await ConvexAPIService.shared.removeApnsPushToken(token: deviceToken)
                    if ConvexAPIService.shared.authToken == authSnapshot {
                        ConvexAPIService.shared.authToken = nil
                    }
                }
                await MainActor.run {
                    NotificationManager.shared.storedDeviceToken = nil
                }
            }
        }
        
        session = UserSession(isAuthenticated: false, email: rememberedEmail)
        ConvexAPIService.shared.authToken = nil
        
        if keepSessionForBiometrics {
            // Keep access + refresh tokens + email so Face ID can unlock and revalidate.
        } else {
            KeychainStore.delete(KeychainStore.Key.authToken)
            KeychainStore.delete(KeychainStore.Key.refreshToken)
            KeychainStore.delete(KeychainStore.Key.managerName)
        }
        
        if !rememberedEmail.isEmpty {
            emailInput = rememberedEmail
            KeychainStore.set(rememberedEmail, forKey: KeychainStore.Key.email)
        }
        passwordInput = ""
        prefersPasswordForm = !canUseBiometrics
        HapticFeedback.impact(.light)
    }
    
    private func friendlyAuthError(_ error: Error) -> String {
        if let auth = error as? ConvexAPIService.AuthError {
            return auth.errorDescription ?? "Sign-in failed."
        }
        return error.localizedDescription
    }
    
    private func managerName(from email: String) -> String {
        let local = email.split(separator: "@").first.map(String.init) ?? "Manager"
        return local
            .replacingOccurrences(of: ".", with: " ")
            .replacingOccurrences(of: "_", with: " ")
            .capitalized
    }
}

import Foundation
import Observation

@MainActor
@Observable
public final class AuthViewModel {
    public var session: UserSession = UserSession(isAuthenticated: false)
    public var emailInput: String = ""
    public var passwordInput: String = ""
    public var isLoading: Bool = false
    public var errorMessage: String? = nil
    public var showBiometricPromptAfterLogin: Bool = false
    public var prefersPasswordForm: Bool = false
    public var isUnlockingBiometrics: Bool = false
    /// false = sign in, true = create manager account
    public var isSignUpMode: Bool = false
    /// True while a stored session is being installed at launch (no login screen flash).
    public private(set) var isRestoringSession: Bool = false
    
    public var isBiometricsEnabled: Bool = UserDefaults.standard.bool(forKey: "bb.isBiometricsEnabled") {
        didSet {
            UserDefaults.standard.set(isBiometricsEnabled, forKey: "bb.isBiometricsEnabled")
            refreshBiometricsAvailability()
        }
    }
    
    /// Stored (not computed) so view bodies never hit the Keychain. Refreshed
    /// after every Keychain write via `refreshBiometricsAvailability()`.
    public private(set) var canUseBiometrics: Bool = false
    
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
        if !hasStoredCredentials() {
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
        ConvexAPIService.defaultBaseURL
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
        refreshBiometricsAvailability()
        prefersPasswordForm = !canUseBiometrics
        installServiceHandlers()
        restoreSessionIfPossible()
    }
    
    // MARK: - Service wiring
    
    private func installServiceHandlers() {
        Task { [weak self] in
            await ConvexAPIService.shared.setSessionExpiredHandler { [weak self] in
                Task { @MainActor in self?.handleSessionExpired() }
            }
            await ConvexAPIService.shared.setTokensRotatedHandler { [weak self] token, _ in
                Task { @MainActor in
                    guard let self, self.session.isAuthenticated else { return }
                    self.session.token = token
                    self.refreshBiometricsAvailability()
                }
            }
        }
    }
    
    /// Launch restore: when the user has not opted into biometric lock, install the
    /// stored tokens and enter the app immediately. The service refreshes the JWT
    /// lazily on the first call, so this costs zero Convex requests up front.
    private func restoreSessionIfPossible() {
        let biometricLock = isBiometricsEnabled && BiometricAuthManager.shared.hasBiometricHardware
        guard !biometricLock else { return }
        
        let storedToken = KeychainStore.string(forKey: KeychainStore.Key.authToken)
        let storedRefresh = KeychainStore.string(forKey: KeychainStore.Key.refreshToken)
        let token = storedToken.flatMap { KeychainStore.isRealAuthToken($0) ? $0 : nil }
        let refresh = storedRefresh.flatMap { $0.isEmpty ? nil : $0 }
        guard token != nil || refresh != nil else { return }
        
        let email = KeychainStore.string(forKey: KeychainStore.Key.email) ?? emailInput
        let name = KeychainStore.string(forKey: KeychainStore.Key.managerName) ?? managerName(from: email)
        
        isRestoringSession = true
        Task {
            // A refresh token alone is enough: the pipeline exchanges it before the first request.
            await ConvexAPIService.shared.setSession(token: token, refreshToken: refresh)
            self.session = UserSession(
                isAuthenticated: true,
                email: email,
                managerName: name,
                token: token,
                isFaceIDEnabled: false
            )
            self.isRestoringSession = false
        }
    }
    
    private func handleSessionExpired() {
        guard session.isAuthenticated || isRestoringSession else { return }
        let rememberedEmail = session.email ?? emailInput
        KeychainStore.delete(KeychainStore.Key.authToken)
        KeychainStore.delete(KeychainStore.Key.refreshToken)
        session = UserSession(isAuthenticated: false, email: rememberedEmail)
        isRestoringSession = false
        refreshBiometricsAvailability()
        prefersPasswordForm = true
        errorMessage = ConvexAPIService.AuthError.sessionExpired.errorDescription
        if !rememberedEmail.isEmpty { emailInput = rememberedEmail }
    }
    
    private func hasStoredCredentials() -> Bool {
        if let token = KeychainStore.string(forKey: KeychainStore.Key.authToken),
           KeychainStore.isRealAuthToken(token) {
            return true
        }
        if let refresh = KeychainStore.string(forKey: KeychainStore.Key.refreshToken), !refresh.isEmpty {
            return true
        }
        return false
    }
    
    private func refreshBiometricsAvailability() {
        canUseBiometrics = BiometricAuthManager.shared.canEvaluatePolicy()
            && isBiometricsEnabled
            && hasStoredCredentials()
    }
    
    // MARK: - Password flow
    
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
                    (token, userEmail) = try await ConvexAPIService.shared.signUp(email: email, password: password)
                } else {
                    (token, userEmail) = try await ConvexAPIService.shared.login(email: email, password: password)
                }
                
                guard KeychainStore.isRealAuthToken(token) || token.hasPrefix("mock_token_") else {
                    errorMessage = "Sign-in returned an invalid session. Try again."
                    isLoading = false
                    HapticFeedback.notification(.error)
                    return
                }
                
                let name = managerName(from: userEmail)
                KeychainStore.saveSession(token: token, email: userEmail, managerName: name)
                refreshBiometricsAvailability()
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
    
    // MARK: - Biometric unlock
    
    public func unlockWithBiometrics() {
        refreshBiometricsAvailability()
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
                refreshBiometricsAvailability()
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
                    await ConvexAPIService.shared.clearSession()
                    refreshBiometricsAvailability()
                    prefersPasswordForm = true
                }
                errorMessage = friendlyAuthError(error)
                HapticFeedback.notification(.error)
            }
            isUnlockingBiometrics = false
        }
    }
    
    /// Prefer refresh-token exchange (one call; a success is proof of a live session).
    /// Fall back to validating the stored access token only when no refresh token exists.
    private func restoreSessionTokenAfterBiometrics() async throws -> String {
        if let refresh = KeychainStore.string(forKey: KeychainStore.Key.refreshToken),
           !refresh.isEmpty {
            do {
                let (token, _) = try await ConvexAPIService.shared.refreshSession(using: refresh)
                guard KeychainStore.isRealAuthToken(token) || token.hasPrefix("mock_token_") else {
                    throw ConvexAPIService.AuthError.sessionExpired
                }
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
        
        await ConvexAPIService.shared.setSession(token: token, refreshToken: nil)
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
            guard hasStoredCredentials() else { return false }
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
    
    // MARK: - Logout
    
    public func logout() {
        let rememberedEmail = session.email ?? emailInput
        let keepSessionForBiometrics =
            isBiometricsEnabled
            && BiometricAuthManager.shared.hasBiometricHardware
            && hasStoredCredentials()
        
        let deviceToken = keepSessionForBiometrics ? nil : NotificationManager.shared.storedDeviceToken
        Task {
            if let deviceToken {
                _ = await ConvexAPIService.shared.removeApnsPushToken(token: deviceToken)
                NotificationManager.shared.storedDeviceToken = nil
                NotificationManager.shared.clearUploadedTokenRecord()
            }
            await ConvexAPIService.shared.clearSession()
        }
        
        session = UserSession(isAuthenticated: false, email: rememberedEmail)
        
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
        refreshBiometricsAvailability()
        prefersPasswordForm = !canUseBiometrics
        HapticFeedback.impact(.light)
    }
    
    private func friendlyAuthError(_ error: Error) -> String {
        if let auth = error as? ConvexAPIService.AuthError {
            return auth.errorDescription ?? "Sign-in failed."
        }
        if let convex = error as? ConvexError {
            return convex.errorDescription ?? "Sign-in failed."
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

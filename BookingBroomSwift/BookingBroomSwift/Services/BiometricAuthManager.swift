import Foundation
import LocalAuthentication

public final class BiometricAuthManager {
    public static let shared = BiometricAuthManager()
    
    private init() {}
    
    /// Evaluates policy once so `biometryType` is populated.
    private func makeContext() -> (LAContext, NSError?) {
        let context = LAContext()
        var error: NSError?
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        return (context, error)
    }
    
    public var biometryType: LABiometryType {
        makeContext().0.biometryType
    }
    
    public var biometrySymbolName: String {
        switch biometryType {
        case .faceID: return "faceid"
        case .touchID: return "touchid"
        case .opticID: return "opticid"
        case .none: return "lock.shield"
        @unknown default: return "lock.shield"
        }
    }
    
    public var biometryDisplayName: String {
        switch biometryType {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        case .none: return "Biometrics"
        @unknown default: return "Biometrics"
        }
    }
    
    /// Hardware supports Face ID / Touch ID (even if not enrolled yet).
    public var hasBiometricHardware: Bool {
        let (context, error) = makeContext()
        if context.biometryType != .none { return true }
        guard let error else { return false }
        let code = error.code
        // Not enrolled / locked out still means the device has biometrics.
        return code == LAError.biometryNotEnrolled.rawValue
            || code == LAError.biometryLockout.rawValue
    }
    
    /// Biometrics are enrolled and ready to evaluate right now.
    public func canEvaluatePolicy() -> Bool {
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }
    
    public func authenticateWithBiometrics(reason: String = "Unlock Booking Broom") async -> Bool {
        let context = LAContext()
        var error: NSError?
        
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return false
        }
        
        do {
            return try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )
        } catch {
            return false
        }
    }
}

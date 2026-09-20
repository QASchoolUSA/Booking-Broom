import Foundation
import Security

public enum KeychainStore {
    private static let service = "com.bookingbroom.manager"
    
    public enum Key {
        public static let authToken = "authToken"
        public static let refreshToken = "refreshToken"
        public static let email = "email"
        public static let managerName = "managerName"
    }
    
    @discardableResult
    public static func set(_ value: String, forKey key: String) -> Bool {
        guard let data = value.data(using: .utf8) else { return false }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(add as CFDictionary, nil) == errSecSuccess
    }
    
    public static func string(forKey key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess,
              let data = item as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }
        return value
    }
    
    @discardableResult
    public static func delete(_ key: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }
    
    public static func clearSession() {
        delete(Key.authToken)
        delete(Key.refreshToken)
        delete(Key.email)
        delete(Key.managerName)
    }
    
    public static func isRealAuthToken(_ token: String) -> Bool {
        !token.hasPrefix("demo_token_") && !token.hasPrefix("mock_token_") && !token.isEmpty
    }
    
    public static func saveSession(token: String, email: String, managerName: String?) {
        guard isRealAuthToken(token) || token.hasPrefix("mock_token_") else { return }
        set(token, forKey: Key.authToken)
        set(email, forKey: Key.email)
        if let managerName, !managerName.isEmpty {
            set(managerName, forKey: Key.managerName)
        }
    }
}

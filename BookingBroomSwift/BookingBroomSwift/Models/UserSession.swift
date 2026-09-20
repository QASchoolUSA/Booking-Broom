import Foundation

public struct UserSession: Codable {
    public var isAuthenticated: Bool
    public var email: String?
    public var managerName: String?
    public var token: String?
    public var isFaceIDEnabled: Bool
    public var isPushNotificationsEnabled: Bool
    
    public init(
        isAuthenticated: Bool = false,
        email: String? = nil,
        managerName: String? = nil,
        token: String? = nil,
        isFaceIDEnabled: Bool = false,
        isPushNotificationsEnabled: Bool = true
    ) {
        self.isAuthenticated = isAuthenticated
        self.email = email
        self.managerName = managerName
        self.token = token
        self.isFaceIDEnabled = isFaceIDEnabled
        self.isPushNotificationsEnabled = isPushNotificationsEnabled
    }
}

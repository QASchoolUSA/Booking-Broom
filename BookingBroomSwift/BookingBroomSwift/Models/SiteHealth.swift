import Foundation

public struct SiteHealthInfo: Codable, Hashable {
    public var status: String // "online", "offline"
    public var httpStatus: Int?
    public var ipAddress: String?
    public var lastCheckedAt: Date?
    
    public init(status: String = "online", httpStatus: Int? = 200, ipAddress: String? = nil, lastCheckedAt: Date? = Date()) {
        self.status = status
        self.httpStatus = httpStatus
        self.ipAddress = ipAddress
        self.lastCheckedAt = lastCheckedAt
    }
    
    public var isOnline: Bool {
        status.lowercased() == "online"
    }
}

public struct SiteHealthRow: Identifiable, Codable, Hashable {
    public var id: String { siteSlug }
    public var siteSlug: String
    public var siteName: String
    public var domain: String
    public var hostingProvider: String?
    public var emailConfigured: Bool
    public var phoneNumber: String?
    public var health: SiteHealthInfo?
    
    public init(
        siteSlug: String,
        siteName: String,
        domain: String,
        hostingProvider: String? = nil,
        emailConfigured: Bool = true,
        phoneNumber: String? = nil,
        health: SiteHealthInfo? = nil
    ) {
        self.siteSlug = siteSlug
        self.siteName = siteName
        self.domain = domain
        self.hostingProvider = hostingProvider
        self.emailConfigured = emailConfigured
        self.phoneNumber = phoneNumber
        self.health = health
    }
}

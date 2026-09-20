import Foundation
import SwiftUI

public struct CleaningSite: Identifiable, Codable, Hashable {
    public var id: String
    public var slug: String
    public var name: String
    public var domain: String
    public var accentHex: String
    public var contactEmail: String?
    public var phoneNumber: String?
    public var hostingProvider: String?
    public var emailConfigured: Bool
    public var createdAt: Date
    
    public init(
        id: String,
        slug: String,
        name: String,
        domain: String,
        accentHex: String = "#0284C7",
        contactEmail: String? = nil,
        phoneNumber: String? = nil,
        hostingProvider: String? = "cloudflare",
        emailConfigured: Bool = true,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.slug = slug
        self.name = name
        self.domain = domain
        self.accentHex = accentHex
        self.contactEmail = contactEmail
        self.phoneNumber = phoneNumber
        self.hostingProvider = hostingProvider
        self.emailConfigured = emailConfigured
        self.createdAt = createdAt
    }
    
    public var accentColor: Color {
        Color(hex: accentHex) ?? AppColors.primary
    }
}

extension Color {
    init?(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")
        
        var rgb: UInt64 = 0
        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else { return nil }
        
        let r = Double((rgb & 0xFF0000) >> 16) / 255.0
        let g = Double((rgb & 0x00FF00) >> 8) / 255.0
        let b = Double(rgb & 0x0000FF) / 255.0
        
        self.init(red: r, green: g, blue: b)
    }
}

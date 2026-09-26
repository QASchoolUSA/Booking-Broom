import Foundation

/// Square-footage draft parsing for Live Pricing.
/// Keeps partial/empty typing local; clamps only on blur (or when a full in-range value is typed).
public enum PricingSquareFeetDraft {
    public static let minimum = 400
    public static let maximum = 10_000
    
    /// - Returns: value to write into the scenario, or `nil` to leave the scenario unchanged.
    /// - Parameter clampIncomplete: `true` on blur (empty → min, out-of-range → clamp).
    ///   `false` while typing (only commit when draft is already in `[minimum, maximum]`).
    public static func resolvedValue(draft: String, clampIncomplete: Bool) -> Int? {
        let trimmed = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            return clampIncomplete ? minimum : nil
        }
        guard let value = Int(trimmed) else {
            return nil
        }
        if clampIncomplete {
            return min(maximum, max(minimum, value))
        }
        guard value >= minimum, value <= maximum else { return nil }
        return value
    }
}

public struct PricingScenario: Equatable, Hashable {
    public var bedrooms: Int
    public var bathrooms: Int
    public var squareFeet: Int
    public var hours: Int
    public var conditionKey: String
    public var propertyTypeKey: String
    public var debrisKey: String
    public var addonKeys: [String]
    
    public init(
        bedrooms: Int = 3,
        bathrooms: Int = 2,
        squareFeet: Int = 2000,
        hours: Int = 2,
        conditionKey: String = "Average",
        propertyTypeKey: String = "house",
        debrisKey: String = "light",
        addonKeys: [String] = []
    ) {
        self.bedrooms = bedrooms
        self.bathrooms = bathrooms
        self.squareFeet = squareFeet
        self.hours = hours
        self.conditionKey = conditionKey
        self.propertyTypeKey = propertyTypeKey
        self.debrisKey = debrisKey
        self.addonKeys = addonKeys
    }
    
    public static let reference = PricingScenario()
    
    public static let compact = PricingScenario(
        bedrooms: 2,
        bathrooms: 1,
        squareFeet: 1200
    )
    
    public static let large = PricingScenario(
        bedrooms: 4,
        bathrooms: 3,
        squareFeet: 2800
    )
    
    public var label: String {
        var parts = [
            "\(bedrooms) bed",
            "\(bathrooms) bath",
            "\(squareFeet.formatted()) sq ft"
        ]
        if !addonKeys.isEmpty {
            parts.append("\(addonKeys.count) add-on\(addonKeys.count == 1 ? "" : "s")")
        }
        return parts.joined(separator: " · ")
    }
    
    public var convexArgs: [String: Any] {
        var args: [String: Any] = [
            "bedrooms": bedrooms,
            "bathrooms": bathrooms,
            "squareFeet": squareFeet,
            "hours": hours,
            "conditionKey": conditionKey,
            "propertyTypeKey": propertyTypeKey,
            "debrisKey": debrisKey,
            "addonKeys": addonKeys
        ]
        return args
    }
}

public enum PricingScenarioPreset: String, CaseIterable, Identifiable {
    case reference
    case compact
    case large
    
    public var id: String { rawValue }
    
    public var title: String {
        switch self {
        case .reference: return "Reference"
        case .compact: return "Compact"
        case .large: return "Large"
        }
    }
    
    public var scenario: PricingScenario {
        switch self {
        case .reference: return .reference
        case .compact: return .compact
        case .large: return .large
        }
    }
}

public enum PricingCanonicalService: String, CaseIterable, Identifiable {
    case standard
    case deep
    case moveInOut = "move-in-out"
    case recurring
    case airbnbTurnover = "airbnb-turnover"
    case commercialOffice = "commercial-office"
    case postConstruction = "post-construction"
    case carpet
    case event
    case hourly
    
    public var id: String { rawValue }
    
    public var label: String {
        switch self {
        case .standard: return "Standard clean"
        case .deep: return "Deep clean"
        case .moveInOut: return "Move in / move out"
        case .recurring: return "Recurring / maintenance"
        case .airbnbTurnover: return "Airbnb / turnover"
        case .commercialOffice: return "Commercial / office"
        case .postConstruction: return "Post-construction"
        case .carpet: return "Carpet & upholstery"
        case .event: return "Event / after-party"
        case .hourly: return "Hourly"
        }
    }
}

public struct PricingAddonOption: Identifiable, Hashable {
    public var id: String { key }
    public var key: String
    public var label: String
    
    public init(key: String, label: String) {
        self.key = key
        self.label = label
    }
}

public struct PricingRankedSite: Identifiable, Hashable {
    public var id: String { siteSlug }
    public var siteSlug: String
    public var siteName: String
    public var accentColorHex: String?
    public var engine: String?
    public var price: Double?
    public var note: String?
    public var isGap: Bool
    
    public init(
        siteSlug: String,
        siteName: String,
        accentColorHex: String? = nil,
        engine: String? = nil,
        price: Double? = nil,
        note: String? = nil,
        isGap: Bool = false
    ) {
        self.siteSlug = siteSlug
        self.siteName = siteName
        self.accentColorHex = accentColorHex
        self.engine = engine
        self.price = price
        self.note = note
        self.isGap = isGap
    }
    
    public var displayPrice: String {
        if let price {
            return String(format: "$%.0f", price)
        }
        return isGap ? "No price" : "—"
    }
}

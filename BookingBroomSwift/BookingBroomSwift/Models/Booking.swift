import Foundation
import CoreLocation

public enum BookingStatus: String, Codable, CaseIterable, Identifiable {
    case new = "new"
    case confirmed = "confirmed"
    case assigned = "assigned"
    case completed = "completed"
    case cancelled = "cancelled"
    
    public var id: String { rawValue }
    
    public var displayName: String {
        switch self {
        case .new: return "New Lead"
        case .confirmed: return "Confirmed"
        case .assigned: return "Assigned"
        case .completed: return "Completed"
        case .cancelled: return "Cancelled"
        }
    }
    
    public var iconName: String {
        switch self {
        case .new: return "sparkles"
        case .confirmed: return "checkmark.seal.fill"
        case .assigned: return "person.badge.shield.checkmark.fill"
        case .completed: return "checkmark.circle.fill"
        case .cancelled: return "xmark.circle.fill"
        }
    }
}

public struct PropertyDetails: Codable, Hashable {
    public var bedrooms: Int?
    public var bathrooms: Int?
    public var squareFeet: Int?
    public var sizeLabel: String?
    public var homeType: String?
    public var condition: String?
    public var occupants: Int?
    public var lastCleaned: String?
    public var excludedAreas: [String]?
    
    public init(
        bedrooms: Int? = nil,
        bathrooms: Int? = nil,
        squareFeet: Int? = nil,
        sizeLabel: String? = nil,
        homeType: String? = nil,
        condition: String? = nil,
        occupants: Int? = nil,
        lastCleaned: String? = nil,
        excludedAreas: [String]? = nil
    ) {
        self.bedrooms = bedrooms
        self.bathrooms = bathrooms
        self.squareFeet = squareFeet
        self.sizeLabel = sizeLabel
        self.homeType = homeType
        self.condition = condition
        self.occupants = occupants
        self.lastCleaned = lastCleaned
        self.excludedAreas = excludedAreas
    }
}

public struct QuoteAddOn: Codable, Hashable, Identifiable {
    public var id: String { label }
    public var label: String
    public var price: Double?
    public var quantity: Int?
    
    public init(label: String, price: Double? = nil, quantity: Int? = nil) {
        self.label = label
        self.price = price
        self.quantity = quantity
    }
}

public struct BookingQuote: Codable, Hashable {
    public var estimate: Double?
    public var estimateLow: Double?
    public var estimateHigh: Double?
    public var recurringEstimate: Double?
    public var currency: String?
    public var serviceLevel: String?
    public var frequency: String?
    public var addOns: [QuoteAddOn]?
    public var internalQuote: Bool?
    
    public init(
        estimate: Double? = nil,
        estimateLow: Double? = nil,
        estimateHigh: Double? = nil,
        recurringEstimate: Double? = nil,
        currency: String? = "USD",
        serviceLevel: String? = nil,
        frequency: String? = nil,
        addOns: [QuoteAddOn]? = nil,
        internalQuote: Bool? = nil
    ) {
        self.estimate = estimate
        self.estimateLow = estimateLow
        self.estimateHigh = estimateHigh
        self.recurringEstimate = recurringEstimate
        self.currency = currency
        self.serviceLevel = serviceLevel
        self.frequency = frequency
        self.addOns = addOns
        self.internalQuote = internalQuote
    }
    
    public var formattedPrice: String {
        let curr = currency ?? "USD"
        let symbol = curr == "USD" ? "$" : "\(curr) "
        if let est = estimate {
            return String(format: "%@%.2f", symbol, est)
        } else if let low = estimateLow, let high = estimateHigh {
            return String(format: "%@%.0f - %@%.0f", symbol, low, symbol, high)
        } else if let rec = recurringEstimate {
            return String(format: "%@%.2f/visit", symbol, rec)
        }
        return "Quote Pending"
    }
    
    public var addOnsTotal: Double? {
        guard let list = addOns, !list.isEmpty else { return nil }
        let total = list.reduce(0.0) { sum, item in
            let q = Double(item.quantity ?? 1)
            let p = item.price ?? 0.0
            return sum + (p * q)
        }
        return total > 0 ? total : nil
    }
}

public struct Booking: Identifiable, Codable, Hashable {
    public var id: String
    public var siteId: String
    public var siteSlug: String
    public var siteName: String
    public var status: BookingStatus
    public var customerName: String
    public var email: String?
    public var phone: String?
    public var address: String?
    public var serviceType: String
    public var preferredDate: String?
    public var preferredTime: String?
    public var scheduledStartAt: Date?
    public var scheduledEndAt: Date?
    public var scheduledStartAtMs: Double?
    public var scheduledEndAtMs: Double?
    public var timezone: String?
    public var notes: String?
    public var internalNotes: String?
    public var property: PropertyDetails?
    public var quote: BookingQuote?
    public var archivedAt: Date?
    public var createdAt: Date
    public var updatedAt: Date
    
    // Default mock coordinates for MapKit visualization (e.g. Sanford / Orlando FL area)
    public var latitude: Double?
    public var longitude: Double?
    
    public init(
        id: String,
        siteId: String,
        siteSlug: String,
        siteName: String,
        status: BookingStatus,
        customerName: String,
        email: String? = nil,
        phone: String? = nil,
        address: String? = nil,
        serviceType: String,
        preferredDate: String? = nil,
        preferredTime: String? = nil,
        scheduledStartAt: Date? = nil,
        scheduledEndAt: Date? = nil,
        scheduledStartAtMs: Double? = nil,
        scheduledEndAtMs: Double? = nil,
        timezone: String? = nil,
        notes: String? = nil,
        internalNotes: String? = nil,
        property: PropertyDetails? = nil,
        quote: BookingQuote? = nil,
        archivedAt: Date? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        latitude: Double? = nil,
        longitude: Double? = nil
    ) {
        self.id = id
        self.siteId = siteId
        self.siteSlug = siteSlug
        self.siteName = siteName
        self.status = status
        self.customerName = customerName
        self.email = email
        self.phone = phone
        self.address = address
        self.serviceType = serviceType
        self.preferredDate = preferredDate
        self.preferredTime = preferredTime
        self.scheduledStartAt = scheduledStartAt
        self.scheduledEndAt = scheduledEndAt
        self.scheduledStartAtMs = scheduledStartAtMs
        self.scheduledEndAtMs = scheduledEndAtMs
        self.timezone = timezone
        self.notes = notes
        self.internalNotes = internalNotes
        self.property = property
        self.quote = quote
        self.archivedAt = archivedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.latitude = latitude
        self.longitude = longitude
    }
    
    public var isArchived: Bool {
        archivedAt != nil
    }
    
    public var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(
            latitude: latitude ?? 28.8029,
            longitude: longitude ?? -81.2695
        )
    }
    
    /// Google search that surfaces the Zillow /homedetails listing for this address (no API/ZPID).
    public var zillowSearchURL: URL? {
        Self.zillowSearchURL(for: address)
    }
    
    public static func zillowSearchURL(for address: String?) -> URL? {
        let trimmed = address?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !trimmed.isEmpty else { return nil }
        var components = URLComponents(string: "https://www.google.com/search")
        components?.queryItems = [
            URLQueryItem(name: "q", value: "\(trimmed) site:zillow.com/homedetails")
        ]
        return components?.url
    }
}

public struct PartialLead: Identifiable, Codable, Hashable {
    public var id: String
    public var siteId: String
    public var siteSlug: String
    public var siteName: String
    public var sessionKey: String
    public var customerName: String?
    public var email: String?
    public var phone: String?
    public var address: String?
    public var serviceType: String?
    public var preferredDate: String?
    public var preferredTime: String?
    public var notes: String?
    public var property: PropertyDetails?
    public var quote: BookingQuote?
    public var intent: String?
    public var lastStep: String?
    public var createdAt: Date
    public var updatedAt: Date

    public init(
        id: String,
        siteId: String,
        siteSlug: String,
        siteName: String,
        sessionKey: String,
        customerName: String? = nil,
        email: String? = nil,
        phone: String? = nil,
        address: String? = nil,
        serviceType: String? = nil,
        preferredDate: String? = nil,
        preferredTime: String? = nil,
        notes: String? = nil,
        property: PropertyDetails? = nil,
        quote: BookingQuote? = nil,
        intent: String? = nil,
        lastStep: String? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.siteId = siteId
        self.siteSlug = siteSlug
        self.siteName = siteName
        self.sessionKey = sessionKey
        self.customerName = customerName
        self.email = email
        self.phone = phone
        self.address = address
        self.serviceType = serviceType
        self.preferredDate = preferredDate
        self.preferredTime = preferredTime
        self.notes = notes
        self.property = property
        self.quote = quote
        self.intent = intent
        self.lastStep = lastStep
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    public var displayName: String {
        let name = customerName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return name.isEmpty ? "Unknown visitor" : name
    }

    public var propertySummary: String? {
        guard let property else { return nil }
        var parts: [String] = []
        if let bedrooms = property.bedrooms {
            parts.append(bedrooms == 0 ? "Studio" : "\(bedrooms) bd")
        }
        if let bathrooms = property.bathrooms {
            parts.append("\(bathrooms) ba")
        }
        if let size = property.sizeLabel, !size.isEmpty {
            parts.append(size)
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

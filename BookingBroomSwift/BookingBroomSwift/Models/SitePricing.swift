import Foundation

public struct PricingBasketEntry: Codable, Hashable, Identifiable {
    public var id: String { name }
    public var name: String
    public var price: Double?
    public var low: Double?
    public var high: Double?
    
    public init(name: String, price: Double? = nil, low: Double? = nil, high: Double? = nil) {
        self.name = name
        self.price = price
        self.low = low
        self.high = high
    }
    
    public var displayPrice: String {
        if let p = price {
            return String(format: "$%.0f", p)
        } else if let l = low, let h = high {
            return String(format: "$%.0f–$%.0f", l, h)
        } else if let l = low {
            return String(format: "$%.0f", l)
        }
        return "—"
    }
}

public enum PricingFieldUnit: String, Hashable {
    /// Dollar amounts shown and stored as dollars (e.g. 145).
    case dollars
    /// Stored as integer cents in config; edited as dollars in the UI.
    case cents
    /// Dollars per square foot (e.g. 0.12 → 12¢ / sq ft).
    case perSqft
    /// Non-money integers (caps, rounding) — not scaled by ±10%.
    case count
}

public struct PricingEditableField: Identifiable, Hashable {
    public var id: String
    public var label: String
    /// Value as shown in the TextField (dollars for `.cents` fields).
    public var value: Double
    public var unit: PricingFieldUnit
    
    public init(id: String, label: String, value: Double, unit: PricingFieldUnit = .dollars) {
        self.id = id
        self.label = label
        self.value = value
        self.unit = unit
    }
    
    public var unitCaption: String {
        switch unit {
        case .dollars: return "$"
        case .cents: return "$"
        case .perSqft: return "$ / sq ft"
        case .count: return ""
        }
    }
    
    public var secondaryCaption: String? {
        switch unit {
        case .perSqft:
            let cents = Int((value * 100).rounded())
            return "\(cents)¢ / sq ft"
        case .cents, .dollars, .count:
            return nil
        }
    }
    
    /// Value written into Convex config JSON.
    public var storageValue: Double {
        switch unit {
        case .cents:
            return (value * 100).rounded()
        case .dollars, .perSqft, .count:
            return value
        }
    }
}

public struct SitePricingRow: Identifiable, Hashable {
    public var id: String { siteSlug }
    public var siteId: String?
    public var siteSlug: String
    public var siteName: String
    public var accentColorHex: String?
    public var engine: String?
    public var version: Int?
    public var entries: [PricingBasketEntry]
    /// Raw Convex pricing config JSON (for editing / updateConfig).
    public var configJSON: Data?
    
    public init(
        siteId: String? = nil,
        siteSlug: String,
        siteName: String,
        accentColorHex: String? = nil,
        engine: String? = nil,
        version: Int? = nil,
        entries: [PricingBasketEntry] = [],
        configJSON: Data? = nil
    ) {
        self.siteId = siteId
        self.siteSlug = siteSlug
        self.siteName = siteName
        self.accentColorHex = accentColorHex
        self.engine = engine
        self.version = version
        self.entries = entries
        self.configJSON = configJSON
    }
    
    public var configKind: String? {
        guard let data = configJSON,
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return obj["kind"] as? String
    }
    
    public func editableMainRateFields() -> [PricingEditableField] {
        guard let data = configJSON,
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return []
        }
        var fields: [PricingEditableField] = []
        
        func add(_ path: String, _ label: String, _ raw: Double, unit: PricingFieldUnit) {
            let display: Double
            switch unit {
            case .cents:
                display = raw / 100.0
            case .dollars, .perSqft, .count:
                display = raw
            }
            fields.append(PricingEditableField(id: path, label: label, value: display, unit: unit))
        }
        
        let dollarKeys = ["bathRate", "bedroomRate", "bathroomRate", "minCharge", "baseRate"]
        let centsKeys = ["bedroomCents", "bathroomCents"]
        let perSqftKeys = ["sqftRate", "perSqft", "perSqFt"]
        let countKeys = ["roundToNearest", "maxBedrooms", "maxBathrooms"]
        
        for key in dollarKeys {
            if let n = number(root[key]) { add(key, humanize(key), n, unit: .dollars) }
        }
        for key in centsKeys {
            if let n = number(root[key]) { add(key, humanize(key), n, unit: .cents) }
        }
        for key in perSqftKeys {
            if let n = number(root[key]) { add(key, humanize(key), n, unit: .perSqft) }
        }
        for key in countKeys {
            if let n = number(root[key]) { add(key, humanize(key), n, unit: .count) }
        }
        if let n = number(root["rangeSpread"]) {
            add("rangeSpread", humanize("rangeSpread"), n, unit: .count)
        }
        
        if let bedroomBase = root["bedroomBase"] as? [[String: Any]] {
            for (i, row) in bedroomBase.enumerated() {
                let beds = row["bedrooms"] as? Int ?? i
                if let price = number(row["price"]) {
                    add("bedroomBase.\(i).price", "\(beds) bed base", price, unit: .dollars)
                }
            }
        }
        
        if let serviceBase = root["serviceBaseCents"] as? [[String: Any]] {
            for (i, row) in serviceBase.enumerated() {
                let key = row["key"] as? String ?? "service \(i)"
                if let value = number(row["value"]) {
                    add("serviceBaseCents.\(i).value", key, value, unit: .cents)
                }
            }
        }
        
        if let serviceRates = root["serviceRates"] as? [[String: Any]] {
            for (i, row) in serviceRates.enumerated() {
                let key = row["key"] as? String ?? "service \(i)"
                if let base = number(row["baseRate"]) {
                    add("serviceRates.\(i).baseRate", "\(key) base", base, unit: .dollars)
                }
                if let perSqft = number(row["perSqft"]) {
                    add("serviceRates.\(i).perSqft", "\(key) / sq ft", perSqft, unit: .perSqft)
                } else if let perSqFt = number(row["perSqFt"]) {
                    add("serviceRates.\(i).perSqFt", "\(key) / sq ft", perSqFt, unit: .perSqft)
                }
            }
        }
        
        if let addOns = root["addOns"] as? [[String: Any]] {
            for (i, row) in addOns.enumerated() {
                let label = row["label"] as? String ?? row["key"] as? String ?? "Add-on \(i)"
                if let price = number(row["price"]) {
                    add("addOns.\(i).price", label, price, unit: .dollars)
                }
            }
        }
        
        if let addonCents = root["addonCents"] as? [[String: Any]] {
            for (i, row) in addonCents.enumerated() {
                let label = row["label"] as? String ?? row["key"] as? String ?? "Add-on \(i)"
                if let cents = number(row["cents"]) {
                    add("addonCents.\(i).cents", label, cents, unit: .cents)
                }
            }
        }
        
        if fields.isEmpty {
            for (key, value) in root {
                if key == "kind" { continue }
                if let n = number(value) {
                    let unit = inferUnit(forKey: key)
                    add(key, humanize(key), n, unit: unit)
                }
            }
        }
        
        return fields
    }
    
    public func applyingEdits(_ edits: [PricingEditableField]) -> Data? {
        guard let data = configJSON,
              var root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        for field in edits {
            setNumber(at: field.id, value: field.storageValue, in: &root)
        }
        return try? JSONSerialization.data(withJSONObject: root)
    }
    
    public func copyCompatible(with other: SitePricingRow) -> Bool {
        let selfKind = engine ?? configKind
        let otherKind = other.engine ?? other.configKind
        guard let selfKind, let otherKind else { return false }
        return selfKind == otherKind
    }
    
    /// Scales editable money/rate fields by `factor` (e.g. 1.1 / 0.9). Skips caps, rounding, and percents.
    public func scaledBy(_ factor: Double) -> Data? {
        let fields = editableMainRateFields().map { field -> PricingEditableField in
            var next = field
            if field.unit == .count || looksLikePercent(field) {
                return next
            }
            let scaled = field.value * factor
            switch field.unit {
            case .cents, .dollars:
                next.value = (scaled * 100).rounded() / 100
            case .perSqft:
                next.value = (scaled * 10_000).rounded() / 10_000
            case .count:
                break
            }
            return next
        }
        return applyingEdits(fields)
    }
    
    public func replacingConfig(from source: SitePricingRow) -> Data? {
        guard copyCompatible(with: source), let data = source.configJSON else { return nil }
        guard var root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        if let kind = configKind {
            root["kind"] = kind
        }
        return try? JSONSerialization.data(withJSONObject: root)
    }
    
    private func looksLikePercent(_ field: PricingEditableField) -> Bool {
        let id = field.id.lowercased()
        let label = field.label.lowercased()
        return id.contains("percent") || id.contains("pct") || id.contains("spread")
            || label.contains("%") || label.contains("percent")
    }
    
    private func inferUnit(forKey key: String) -> PricingFieldUnit {
        let lower = key.lowercased()
        if lower.contains("cents") { return .cents }
        if lower.contains("persqft") || lower.contains("persqft")
            || lower == "sqftrate" || (lower.contains("sqft") && lower.contains("rate")) {
            return .perSqft
        }
        if lower.contains("max") || lower.contains("round") || lower.contains("spread") {
            return .count
        }
        return .dollars
    }
    
    private func number(_ any: Any?) -> Double? {
        if let d = any as? Double { return d }
        if let i = any as? Int { return Double(i) }
        if let n = any as? NSNumber { return n.doubleValue }
        return nil
    }
    
    private func humanize(_ key: String) -> String {
        key
            .replacingOccurrences(of: "([a-z])([A-Z])", with: "$1 $2", options: .regularExpression)
            .replacingOccurrences(of: "_", with: " ")
            .capitalized
    }
    
    private func setNumber(at path: String, value: Double, in root: inout [String: Any]) {
        let parts = path.split(separator: ".").map(String.init)
        guard !parts.isEmpty else { return }
        
        if parts.count == 1 {
            root[parts[0]] = value
            return
        }
        
        guard parts.count == 3,
              let index = Int(parts[1]),
              var arr = root[parts[0]] as? [[String: Any]],
              arr.indices.contains(index) else {
            if parts.count == 2, let index = Int(parts[1]), var arr = root[parts[0]] as? [Any] {
                if index < arr.count { arr[index] = value; root[parts[0]] = arr }
            }
            return
        }
        arr[index][parts[2]] = value
        root[parts[0]] = arr
    }
}

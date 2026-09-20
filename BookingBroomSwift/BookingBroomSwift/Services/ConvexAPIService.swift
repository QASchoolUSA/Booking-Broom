import Foundation

public struct ConvexQueryRequest<T: Encodable>: Encodable {
    public let path: String
    public let args: T
}

public struct ConvexResponse<T: Decodable>: Decodable {
    public let status: String
    public let value: T?
    public let errorMessage: String?
}

public final class ConvexAPIService {
    public static let shared = ConvexAPIService()
    
    // Live Convex deployment URL (and fallback local development URL)
    public var baseURLString: String = "https://dynamic-gnu-491.convex.cloud"
    public var useMockData: Bool = false
    public var authToken: String? = nil
    
    private var cachedSites: [CleaningSite]?
    private var cachedSitesFetchedAt: Date?
    private let sitesCacheTTL: TimeInterval = 60
    
    /// Shared ISO8601 parsers (reused — do not recreate per row).
    nonisolated private static let iso8601Fractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    
    nonisolated private static let iso8601: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
    
    private init() {}
    
    nonisolated static func parseISO8601(_ string: String) -> Date? {
        iso8601Fractional.date(from: string) ?? iso8601.date(from: string)
    }
    
    /// Parse JSON dictionary off the main actor to avoid UI hitching.
    nonisolated private static func jsonObject(from data: Data) async -> [String: Any]? {
        await Task.detached(priority: .userInitiated) {
            (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        }.value
    }
    
    public func invalidateSitesCache() {
        cachedSites = nil
        cachedSitesFetchedAt = nil
    }
    
    private var headers: [String: String] {
        var h = ["Content-Type": "application/json"]
        if let token = authToken {
            h["Authorization"] = "Bearer \(token)"
        }
        return h
    }
    
    // MARK: - Auth helpers
    
    /// No-op when unauthenticated. Callers must not invent demo credentials.
    public func ensureAuthenticated() async {
        // Intentionally empty — use the Keychain / Login flow for real sessions.
    }
    
    public enum AuthError: LocalizedError {
        case invalidCredentials
        case accountExists
        case accountNotFound
        case network(String)
        case server(String)
        case missingToken
        case sessionExpired
        
        public var errorDescription: String? {
            switch self {
            case .invalidCredentials:
                return "Invalid email or password."
            case .accountExists:
                return "An account with this email already exists. Sign in instead."
            case .accountNotFound:
                return "No account found for this email. Create a manager account first."
            case .network(let message):
                return "Network error: \(message)"
            case .server(let message):
                return message
            case .missingToken:
                return "Sign-in succeeded but no session token was returned."
            case .sessionExpired:
                return "Your session expired. Sign in with email and password."
            }
        }
    }
    
    // MARK: - Authentication
    
    public func login(email: String, password: String) async throws -> (token: String, email: String) {
        try await authenticate(email: email, password: password, flow: "signIn")
    }
    
    public func signUp(email: String, password: String) async throws -> (token: String, email: String) {
        try await authenticate(email: email, password: password, flow: "signUp")
    }
    
    /// Exchange a Convex Auth refresh token for a new access token (and rotated refresh token).
    public func refreshSession(using refreshToken: String) async throws -> (token: String, refreshToken: String?) {
        if useMockData {
            let token = "mock_token_\(UUID().uuidString)"
            self.authToken = token
            return (token, refreshToken)
        }
        
        guard let url = URL(string: "\(baseURLString)/api/action") else {
            throw AuthError.server("Invalid Convex URL.")
        }
        
        let body: [String: Any] = [
            "path": "auth:signIn",
            "args": [
                "refreshToken": refreshToken
            ]
        ]
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        request.timeoutInterval = 30
        
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw AuthError.network(error.localizedDescription)
        }
        
        let httpStatus = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            let snippet = String(data: data, encoding: .utf8)?.prefix(200) ?? ""
            throw AuthError.server("Unexpected refresh response (HTTP \(httpStatus)): \(snippet)")
        }
        
        if let errMsg = json["errorMessage"] as? String, !errMsg.isEmpty {
            throw AuthError.sessionExpired
        }
        
        let status = json["status"] as? String
        guard status == "success" else {
            throw AuthError.sessionExpired
        }
        
        guard let value = json["value"] as? [String: Any] else {
            throw AuthError.sessionExpired
        }
        
        if let tokensNull = value["tokens"], tokensNull is NSNull {
            throw AuthError.sessionExpired
        }
        
        guard let token = extractAuthToken(from: value) else {
            throw AuthError.sessionExpired
        }
        
        var newRefresh: String? = nil
        if let tokens = value["tokens"] as? [String: Any],
           let refresh = tokens["refreshToken"] as? String, !refresh.isEmpty {
            newRefresh = refresh
        }
        
        self.authToken = token
        return (token, newRefresh)
    }
    
    /// Lightweight authenticated probe — throws if the current Bearer token is rejected.
    public func validateAuthenticatedSession() async throws {
        if useMockData { return }
        
        guard authToken != nil else {
            throw AuthError.sessionExpired
        }
        
        guard let url = URL(string: "\(baseURLString)/api/query") else {
            throw AuthError.server("Invalid Convex URL.")
        }
        
        let body: [String: Any] = ["path": "sites:list", "args": [:]]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        request.timeoutInterval = 20
        
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw AuthError.network(error.localizedDescription)
        }
        
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        if code == 401 || code == 403 {
            throw AuthError.sessionExpired
        }
        
        guard let json = await Self.jsonObject(from: data) else {
            throw AuthError.server("Session check returned invalid JSON.")
        }
        
        if let errorMessage = json["errorMessage"] as? String, !errorMessage.isEmpty {
            let lower = errorMessage.lowercased()
            if lower.contains("unauthenticated")
                || lower.contains("unauthorized")
                || lower.contains("not authenticated")
                || lower.contains("invalid token")
                || lower.contains("jwt") {
                throw AuthError.sessionExpired
            }
            throw AuthError.server(errorMessage)
        }
        
        guard code == 200,
              let status = json["status"] as? String,
              status == "success" else {
            if code != 200 {
                throw AuthError.sessionExpired
            }
            throw AuthError.server("Session check failed.")
        }
    }
    
    private func authenticate(
        email: String,
        password: String,
        flow: String
    ) async throws -> (token: String, email: String) {
        if useMockData {
            let token = "mock_token_\(UUID().uuidString)"
            self.authToken = token
            return (token, email)
        }
        
        guard let url = URL(string: "\(baseURLString)/api/action") else {
            throw AuthError.server("Invalid Convex URL.")
        }
        
        let body: [String: Any] = [
            "path": "auth:signIn",
            "args": [
                "provider": "password",
                "params": [
                    "flow": flow,
                    "email": email,
                    "password": password
                ]
            ]
        ]
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        request.timeoutInterval = 30
        
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw AuthError.network(error.localizedDescription)
        }
        
        let httpStatus = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            let snippet = String(data: data, encoding: .utf8)?.prefix(200) ?? ""
            throw AuthError.server("Unexpected response (HTTP \(httpStatus)): \(snippet)")
        }
        
        if let errMsg = json["errorMessage"] as? String, !errMsg.isEmpty {
            throw mapAuthServerError(errMsg, flow: flow)
        }
        
        let status = json["status"] as? String
        guard status == "success" else {
            let snippet = String(data: data, encoding: .utf8)?.prefix(200) ?? "HTTP \(httpStatus)"
            throw AuthError.server("Sign-in failed: \(snippet)")
        }
        
        guard let value = json["value"] as? [String: Any] else {
            throw AuthError.missingToken
        }
        
        // Convex Auth may return { tokens: null } when email verification is required
        if let tokensNull = value["tokens"], tokensNull is NSNull {
            throw AuthError.server("Additional verification required. Complete sign-in on the web app first.")
        }
        
        guard let token = extractAuthToken(from: value) else {
            throw AuthError.missingToken
        }
        
        if let tokens = value["tokens"] as? [String: Any],
           let refresh = tokens["refreshToken"] as? String {
            KeychainStore.set(refresh, forKey: KeychainStore.Key.refreshToken)
        }
        
        self.authToken = token
        return (token, email)
    }
    
    private func extractAuthToken(from value: [String: Any]) -> String? {
        if let tokens = value["tokens"] as? [String: Any] {
            if let t = tokens["token"] as? String, !t.isEmpty { return t }
            if let t = tokens["accessToken"] as? String, !t.isEmpty { return t }
        }
        if let t = value["token"] as? String, !t.isEmpty { return t }
        return nil
    }
    
    private func mapAuthServerError(_ message: String, flow: String) -> AuthError {
        let lower = message.lowercased()
        if lower.contains("invalidaccountid") || lower.contains("invalid account") {
            return flow == "signIn" ? .accountNotFound : .invalidCredentials
        }
        if lower.contains("already exists") || lower.contains("accountdoesnotsupport") {
            return .accountExists
        }
        if lower.contains("invalidsecret")
            || lower.contains("invalid password")
            || lower.contains("could not verify")
            || lower.contains("incorrect") {
            return .invalidCredentials
        }
        return .server(message)
    }
    
    // MARK: - Sites
    
    public func fetchSites() async throws -> [CleaningSite] {
        if useMockData { return MockDataService.shared.sampleSites }
        
        if let cached = cachedSites,
           let fetchedAt = cachedSitesFetchedAt,
           Date().timeIntervalSince(fetchedAt) < sitesCacheTTL {
            return cached
        }
        
        await ensureAuthenticated()
        
        guard let url = URL(string: "\(baseURLString)/api/query") else {
            return cachedSites ?? []
        }
        
        let body: [String: Any] = ["path": "sites:list", "args": [:]]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else {
                return cachedSites ?? []
            }
            if let json = await Self.jsonObject(from: data),
               let status = json["status"] as? String, status == "success",
               let rawSites = json["value"] as? [[String: Any]] {
                let sites = await Task.detached(priority: .userInitiated) {
                    rawSites.map { item -> CleaningSite in
                        CleaningSite(
                            id: item["id"] as? String ?? UUID().uuidString,
                            slug: item["slug"] as? String ?? "site",
                            name: item["name"] as? String ?? "Cleaning Site",
                            domain: item["domain"] as? String ?? "example.com",
                            accentHex: item["accent_color"] as? String ?? "#0284C7",
                            contactEmail: item["contact_email"] as? String,
                            phoneNumber: item["phone_number"] as? String,
                            hostingProvider: item["hosting_provider"] as? String ?? "cloudflare",
                            emailConfigured: item["email_configured"] as? Bool ?? true
                        )
                    }
                }.value
                cachedSites = sites
                cachedSitesFetchedAt = Date()
                return sites
            }
        } catch { }
        
        return cachedSites ?? []
    }
    
    // MARK: - Bookings
    
    public func fetchBookings(includeArchived: Bool = false) async throws -> [Booking] {
        if useMockData {
            if includeArchived {
                return MockDataService.shared.sampleArchivedBookings
            }
            return MockDataService.shared.sampleBookings
        }
        
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/query") else {
            throw AuthError.server("Invalid Convex URL.")
        }
        
        var args: [String: Any] = [:]
        if includeArchived { args["includeArchived"] = true }
        let body: [String: Any] = ["path": "bookings:list", "args": args]
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard code == 200 else {
            let detail = String(data: data, encoding: .utf8)?.prefix(200) ?? ""
            throw AuthError.server("bookings:list failed (\(code)) \(detail)")
        }
        
        guard let json = await Self.jsonObject(from: data) else {
            throw AuthError.server("bookings:list returned invalid JSON.")
        }
        
        if let errorMessage = json["errorMessage"] as? String, !errorMessage.isEmpty {
            throw AuthError.server(errorMessage)
        }
        
        guard let status = json["status"] as? String, status == "success",
              let rawBookings = json["value"] as? [[String: Any]] else {
            throw AuthError.server("bookings:list returned an unexpected payload.")
        }
        
        return await Task.detached(priority: .userInitiated) {
            rawBookings.compactMap { item -> Booking? in
                // Convex may return id as String or nested; accept common shapes.
                let id = (item["id"] as? String)
                    ?? (item["_id"] as? String)
                    ?? ((item["_id"] as? [String: Any])?["id"] as? String)
                let siteId = (item["site_id"] as? String)
                    ?? (item["siteId"] as? String)
                    ?? ((item["site_id"] as? [String: Any])?["id"] as? String)
                guard let id, let siteId,
                      let custName = item["customer_name"] as? String
                        ?? item["customerName"] as? String,
                      let service = item["service_type"] as? String
                        ?? item["serviceType"] as? String else {
                    return nil
                }
                
                let statusStr = item["status"] as? String ?? "new"
                let status = BookingStatus(rawValue: statusStr) ?? .new
                
                var siteName = "Cleaning Site"
                var siteSlug = "unknown"
                if let siteObj = item["site"] as? [String: Any] {
                    siteName = siteObj["name"] as? String ?? siteName
                    siteSlug = siteObj["slug"] as? String ?? siteSlug
                }
                
                var quoteObj: BookingQuote? = nil
                if let q = item["quote"] as? [String: Any] {
                    var addOnsList: [QuoteAddOn]? = nil
                    if let arr = q["add_ons"] as? [[String: Any]] {
                        addOnsList = arr.compactMap { a in
                            guard let lbl = a["label"] as? String else { return nil }
                            return QuoteAddOn(label: lbl, price: a["price"] as? Double, quantity: a["quantity"] as? Int)
                        }
                    }
                    
                    quoteObj = BookingQuote(
                        estimate: q["estimate"] as? Double,
                        estimateLow: q["estimate_low"] as? Double,
                        estimateHigh: q["estimate_high"] as? Double,
                        recurringEstimate: q["recurring_estimate"] as? Double,
                        currency: q["currency"] as? String ?? "USD",
                        serviceLevel: q["service_level"] as? String,
                        frequency: q["frequency"] as? String,
                        addOns: addOnsList,
                        internalQuote: q["internal"] as? Bool
                    )
                }
                
                var propObj: PropertyDetails? = nil
                if let p = item["property"] as? [String: Any] {
                    propObj = PropertyDetails(
                        bedrooms: p["bedrooms"] as? Int,
                        bathrooms: p["bathrooms"] as? Int,
                        squareFeet: p["square_feet"] as? Int,
                        sizeLabel: p["size_label"] as? String,
                        homeType: p["home_type"] as? String,
                        condition: p["condition"] as? String,
                        occupants: p["occupants"] as? Int,
                        lastCleaned: p["last_cleaned"] as? String,
                        excludedAreas: p["excluded_areas"] as? [String]
                    )
                }
                
                let schedStartMs = item["scheduled_start_at_ms"] as? Double
                let schedEndMs = item["scheduled_end_at_ms"] as? Double
                let schedStart = schedStartMs != nil ? Date(timeIntervalSince1970: schedStartMs! / 1000.0) : nil
                let schedEnd = schedEndMs != nil ? Date(timeIntervalSince1970: schedEndMs! / 1000.0) : nil
                
                return Booking(
                    id: id,
                    siteId: siteId,
                    siteSlug: siteSlug,
                    siteName: siteName,
                    status: status,
                    customerName: custName,
                    email: item["email"] as? String,
                    phone: item["phone"] as? String,
                    address: item["address"] as? String,
                    serviceType: service,
                    preferredDate: item["preferred_date"] as? String,
                    preferredTime: item["preferred_time"] as? String,
                    scheduledStartAt: schedStart,
                    scheduledEndAt: schedEnd,
                    scheduledStartAtMs: schedStartMs,
                    scheduledEndAtMs: schedEndMs,
                    timezone: item["timezone"] as? String,
                    notes: item["notes"] as? String,
                    internalNotes: item["internal_notes"] as? String,
                    property: propObj,
                    quote: quoteObj
                )
            }
        }.value
    }

    public func fetchPartialLeads(siteSlug: String? = nil) async throws -> [PartialLead] {
        if useMockData {
            return []
        }

        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/query") else {
            throw AuthError.server("Invalid Convex URL.")
        }

        var args: [String: Any] = [:]
        if let siteSlug, !siteSlug.isEmpty {
            args["siteSlug"] = siteSlug
        }
        let body: [String: Any] = ["path": "partialLeads:list", "args": args]

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard code == 200 else {
            let detail = String(data: data, encoding: .utf8)?.prefix(200) ?? ""
            throw AuthError.server("partialLeads:list failed (\(code)) \(detail)")
        }

        guard let json = await Self.jsonObject(from: data) else {
            throw AuthError.server("partialLeads:list returned invalid JSON.")
        }

        if let errorMessage = json["errorMessage"] as? String, !errorMessage.isEmpty {
            throw AuthError.server(errorMessage)
        }

        guard let status = json["status"] as? String, status == "success",
              let rawLeads = json["value"] as? [[String: Any]] else {
            throw AuthError.server("partialLeads:list returned an unexpected payload.")
        }

        return await Task.detached(priority: .userInitiated) {
            rawLeads.compactMap { item -> PartialLead? in
                let id = (item["id"] as? String)
                    ?? (item["_id"] as? String)
                    ?? ((item["_id"] as? [String: Any])?["id"] as? String)
                let siteId = (item["site_id"] as? String)
                    ?? (item["siteId"] as? String)
                    ?? ((item["site_id"] as? [String: Any])?["id"] as? String)
                let sessionKey = item["session_key"] as? String ?? item["sessionKey"] as? String
                guard let id, let siteId, let sessionKey else { return nil }

                var siteName = "Cleaning Site"
                var siteSlugValue = "unknown"
                if let siteObj = item["site"] as? [String: Any] {
                    siteName = siteObj["name"] as? String ?? siteName
                    siteSlugValue = siteObj["slug"] as? String ?? siteSlugValue
                }

                var quoteObj: BookingQuote? = nil
                if let q = item["quote"] as? [String: Any] {
                    var addOnsList: [QuoteAddOn]? = nil
                    if let arr = q["add_ons"] as? [[String: Any]] {
                        addOnsList = arr.compactMap { a in
                            guard let lbl = a["label"] as? String else { return nil }
                            return QuoteAddOn(
                                label: lbl,
                                price: a["price"] as? Double,
                                quantity: a["quantity"] as? Int
                            )
                        }
                    }
                    quoteObj = BookingQuote(
                        estimate: q["estimate"] as? Double,
                        estimateLow: q["estimate_low"] as? Double,
                        estimateHigh: q["estimate_high"] as? Double,
                        recurringEstimate: q["recurring_estimate"] as? Double,
                        currency: q["currency"] as? String ?? "USD",
                        serviceLevel: q["service_level"] as? String,
                        frequency: q["frequency"] as? String,
                        addOns: addOnsList,
                        internalQuote: q["internal"] as? Bool
                    )
                }

                var propObj: PropertyDetails? = nil
                if let p = item["property"] as? [String: Any] {
                    propObj = PropertyDetails(
                        bedrooms: p["bedrooms"] as? Int,
                        bathrooms: p["bathrooms"] as? Int,
                        squareFeet: p["square_feet"] as? Int,
                        sizeLabel: p["size_label"] as? String,
                        homeType: p["home_type"] as? String,
                        condition: p["condition"] as? String,
                        occupants: p["occupants"] as? Int,
                        lastCleaned: p["last_cleaned"] as? String,
                        excludedAreas: p["excluded_areas"] as? [String]
                    )
                }

                let createdAt = (item["created_at"] as? String).flatMap(Self.parseISO8601) ?? Date()
                let updatedAt = (item["updated_at"] as? String).flatMap(Self.parseISO8601) ?? createdAt

                return PartialLead(
                    id: id,
                    siteId: siteId,
                    siteSlug: siteSlugValue,
                    siteName: siteName,
                    sessionKey: sessionKey,
                    customerName: item["customer_name"] as? String,
                    email: item["email"] as? String,
                    phone: item["phone"] as? String,
                    address: item["address"] as? String,
                    serviceType: item["service_type"] as? String,
                    preferredDate: item["preferred_date"] as? String,
                    preferredTime: item["preferred_time"] as? String,
                    notes: item["notes"] as? String,
                    property: propObj,
                    quote: quoteObj,
                    intent: item["intent"] as? String,
                    lastStep: item["last_step"] as? String,
                    createdAt: createdAt,
                    updatedAt: updatedAt
                )
            }
        }.value
    }
    
    public func updateBookingStatus(bookingId: String, newStatus: BookingStatus) async throws -> Bool {
        if useMockData {
            if let idx = MockDataService.shared.sampleBookings.firstIndex(where: { $0.id == bookingId }) {
                MockDataService.shared.sampleBookings[idx].status = newStatus
            }
            return true
        }
        
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/mutation") else { return false }
        let body: [String: Any] = [
            "path": "bookings:updateStatus",
            "args": ["bookingId": bookingId, "status": newStatus.rawValue]
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch { return false }
    }
    
    public func scheduleBooking(
        bookingId: String,
        scheduledStartAt: Double,
        scheduledEndAt: Double,
        timezone: String = "America/New_York",
        confirm: Bool = true,
        alertOffsetsMinutes: [Int] = [1440, 60]
    ) async throws -> Bool {
        if useMockData {
            if let idx = MockDataService.shared.sampleBookings.firstIndex(where: { $0.id == bookingId }) {
                MockDataService.shared.sampleBookings[idx].scheduledStartAtMs = scheduledStartAt
                MockDataService.shared.sampleBookings[idx].scheduledEndAtMs = scheduledEndAt
                MockDataService.shared.sampleBookings[idx].scheduledStartAt = Date(timeIntervalSince1970: scheduledStartAt / 1000.0)
                MockDataService.shared.sampleBookings[idx].scheduledEndAt = Date(timeIntervalSince1970: scheduledEndAt / 1000.0)
                MockDataService.shared.sampleBookings[idx].timezone = timezone
                if confirm {
                    MockDataService.shared.sampleBookings[idx].status = .confirmed
                }
            }
            return true
        }
        
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/mutation") else { return false }
        let body: [String: Any] = [
            "path": "bookings:schedule",
            "args": [
                "bookingId": bookingId,
                "scheduledStartAt": scheduledStartAt,
                "scheduledEndAt": scheduledEndAt,
                "timezone": timezone,
                "confirm": confirm,
                "alertOffsetsMinutes": alertOffsetsMinutes
            ]
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch { return false }
    }
    
    public func saveInternalNotes(bookingId: String, notes: String) async throws -> Bool {
        if useMockData {
            if let idx = MockDataService.shared.sampleBookings.firstIndex(where: { $0.id == bookingId }) {
                MockDataService.shared.sampleBookings[idx].internalNotes = notes
            }
            return true
        }
        
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/mutation") else { return false }
        let body: [String: Any] = [
            "path": "bookings:saveInternalNotes",
            "args": ["bookingId": bookingId, "internalNotes": notes]
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch { return false }
    }
    
    public func archiveBooking(bookingId: String) async throws -> Bool {
        if useMockData {
            if let idx = MockDataService.shared.sampleBookings.firstIndex(where: { $0.id == bookingId }) {
                var b = MockDataService.shared.sampleBookings.remove(at: idx)
                b.archivedAt = Date()
                MockDataService.shared.sampleArchivedBookings.insert(b, at: 0)
            }
            return true
        }
        
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/mutation") else { return false }
        let body: [String: Any] = [
            "path": "bookings:archive",
            "args": ["bookingId": bookingId]
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch { return false }
    }
    
    public func unarchiveBooking(bookingId: String) async throws -> Bool {
        if useMockData {
            if let idx = MockDataService.shared.sampleArchivedBookings.firstIndex(where: { $0.id == bookingId }) {
                var b = MockDataService.shared.sampleArchivedBookings.remove(at: idx)
                b.archivedAt = nil
                MockDataService.shared.sampleBookings.insert(b, at: 0)
            }
            return true
        }
        
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/mutation") else { return false }
        let body: [String: Any] = [
            "path": "bookings:unarchive",
            "args": ["bookingId": bookingId]
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch { return false }
    }
    
    public func deleteBookingPermanently(bookingId: String) async throws -> Bool {
        if useMockData {
            MockDataService.shared.sampleBookings.removeAll(where: { $0.id == bookingId })
            MockDataService.shared.sampleArchivedBookings.removeAll(where: { $0.id == bookingId })
            return true
        }
        
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/mutation") else { return false }
        let body: [String: Any] = [
            "path": "bookings:remove",
            "args": ["bookingId": bookingId]
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch { return false }
    }
    
    public func createBooking(_ booking: Booking) async throws -> Bool {
        if useMockData {
            MockDataService.shared.sampleBookings.insert(booking, at: 0)
            return true
        }
        
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/mutation") else { return false }
        let body: [String: Any] = [
            "path": "bookings:createPublic",
            "args": [
                "siteSlug": booking.siteSlug,
                "apiKeyHash": "2421ab88cd45273d60c96dc03521b771978f911fa726e9c74d7097f9b85f84ee",
                "customerName": booking.customerName,
                "email": booking.email ?? "customer@example.com",
                "phone": booking.phone ?? "+14075550100",
                "address": booking.address ?? "100 Main St, Sanford FL",
                "serviceType": booking.serviceType,
                "preferredDate": booking.preferredDate ?? "2026-09-10",
                "notes": booking.notes ?? ""
            ]
        ]
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch { return false }
    }
    
    // MARK: - Calendar & Reminders
    
    public func fetchCalendarEvents(startAt: Double, endAt: Double) async throws -> [CalendarEvent] {
        if useMockData {
            var events: [CalendarEvent] = []
            for b in MockDataService.shared.sampleBookings {
                if let ms = b.scheduledStartAtMs {
                    events.append(CalendarEvent(
                        id: "ev_\(b.id)",
                        kind: .bookingScheduled,
                        title: "\(b.customerName) · \(b.serviceType)",
                        subtitle: b.address,
                        startAtMs: ms,
                        endAtMs: b.scheduledEndAtMs,
                        color: "#0284C7",
                        bookingId: b.id,
                        siteName: b.siteName
                    ))
                } else if let pDate = b.preferredDate {
                    let df = DateFormatter()
                    df.dateFormat = "yyyy-MM-dd"
                    if let d = df.date(from: pDate) {
                        events.append(CalendarEvent(
                            id: "ev_tent_\(b.id)",
                            kind: .bookingTentative,
                            title: "\(b.customerName) (Requested)",
                            subtitle: b.serviceType,
                            startAtMs: d.timeIntervalSince1970 * 1000,
                            color: "#94A3B8",
                            bookingId: b.id,
                            siteName: b.siteName
                        ))
                    }
                }
            }
            for r in MockDataService.shared.sampleReminders {
                events.append(CalendarEvent(
                    id: "ev_rem_\(r.id)",
                    kind: .reminder,
                    title: r.title,
                    subtitle: r.notes,
                    startAtMs: r.dueAtMs,
                    color: "#D97706",
                    bookingId: r.bookingId,
                    allDay: r.allDay
                ))
            }
            return events
        }
        
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/query") else { return [] }
        let body: [String: Any] = [
            "path": "calendar:listInRange",
            "args": ["startAt": startAt, "endAt": endAt]
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return [] }
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let rawEvents = json["value"] as? [[String: Any]] {
                return rawEvents.compactMap { ev in
                    guard let id = ev["id"] as? String,
                          let title = ev["title"] as? String,
                          let startMs = ev["start_at_ms"] as? Double else { return nil }
                    let kindStr = ev["kind"] as? String ?? "booking_scheduled"
                    let kind = CalendarEventKind(rawValue: kindStr) ?? .bookingScheduled
                    var siteName: String? = nil
                    if let s = ev["site"] as? [String: Any] { siteName = s["name"] as? String }
                    
                    return CalendarEvent(
                        id: id,
                        kind: kind,
                        title: title,
                        subtitle: ev["subtitle"] as? String,
                        startAtMs: startMs,
                        endAtMs: ev["end_at_ms"] as? Double,
                        color: ev["color"] as? String ?? "#0284C7",
                        bookingId: ev["booking_id"] as? String,
                        siteName: siteName,
                        allDay: ev["all_day"] as? Bool ?? false
                    )
                }
            }
        } catch {}
        return []
    }
    
    public func fetchReminders(bookingId: String? = nil) async throws -> [ReminderItem] {
        if useMockData {
            if let bid = bookingId {
                return MockDataService.shared.sampleReminders.filter { $0.bookingId == bid }
            }
            return MockDataService.shared.sampleReminders
        }
        
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/query") else { return [] }
        var args: [String: Any] = [:]
        if let bid = bookingId { args["bookingId"] = bid }
        let body: [String: Any] = [
            "path": bookingId != nil ? "reminders:listByBooking" : "reminders:listPending",
            "args": args
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return [] }
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let rawList = json["value"] as? [[String: Any]] {
                return rawList.compactMap { r in
                    guard let id = r["id"] as? String,
                          let title = r["title"] as? String,
                          let dueMs = r["due_at_ms"] as? Double else { return nil }
                    return ReminderItem(
                        id: id,
                        title: title,
                        notes: r["notes"] as? String,
                        dueAtMs: dueMs,
                        status: r["status"] as? String ?? "pending",
                        offsetMinutes: r["offset_minutes"] as? Int,
                        bookingId: r["booking_id"] as? String,
                        allDay: r["all_day"] as? Bool ?? false
                    )
                }
            }
        } catch {}
        return []
    }
    
    public func createReminder(title: String, notes: String? = nil, dueAt: Double, allDay: Bool = false, bookingId: String? = nil) async throws -> Bool {
        if useMockData {
            let rem = ReminderItem(id: "rem_\(UUID().uuidString.prefix(6))", title: title, notes: notes, dueAtMs: dueAt, bookingId: bookingId, allDay: allDay)
            MockDataService.shared.sampleReminders.insert(rem, at: 0)
            return true
        }
        
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/mutation") else { return false }
        var args: [String: Any] = ["title": title, "dueAt": dueAt, "allDay": allDay]
        if let n = notes, !n.isEmpty { args["notes"] = n }
        if let b = bookingId { args["bookingId"] = b }
        
        let body: [String: Any] = ["path": "reminders:create", "args": args]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch { return false }
    }
    
    public func removeReminder(reminderId: String) async throws -> Bool {
        if useMockData {
            MockDataService.shared.sampleReminders.removeAll(where: { $0.id == reminderId })
            return true
        }
        
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/mutation") else { return false }
        let body: [String: Any] = [
            "path": "reminders:remove",
            "args": ["reminderId": reminderId]
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch { return false }
    }
    
    // MARK: - Email Suite (SpaceMail)
    
    public func fetchEmailMailboxes() async throws -> [EmailMailbox] {
        if useMockData { return MockDataService.shared.sampleMailboxes }
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/query") else {
            throw AuthError.server("Invalid Convex URL.")
        }
        let body: [String: Any] = ["path": "email:listMailboxes", "args": [:]]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard code == 200 else {
            throw AuthError.server("email:listMailboxes failed (\(code))")
        }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let rawList = json["value"] as? [[String: Any]] else {
            throw AuthError.server("email:listMailboxes returned an unexpected payload.")
        }
        return rawList.compactMap { mb in
            guard let id = mb["id"] as? String,
                  let email = mb["email"] as? String else { return nil }
            return EmailMailbox(
                id: id,
                email: email,
                label: mb["label"] as? String,
                siteSlug: mb["site_slug"] as? String,
                siteName: mb["site_name"] as? String,
                unreadCount: mb["unread_count"] as? Int ?? 0,
                totalThreads: mb["total_threads"] as? Int
            )
        }
    }
    
    public func fetchEmailThreads(mailboxId: String) async throws -> [EmailThread] {
        if useMockData {
            return MockDataService.shared.sampleEmailThreads.filter { $0.mailboxId == mailboxId }
        }
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/query") else { return [] }
        let body: [String: Any] = [
            "path": "email:listThreads",
            "args": ["mailboxId": mailboxId]
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return [] }
            if let json = await Self.jsonObject(from: data),
               let rawList = json["value"] as? [[String: Any]] {
                return await Task.detached(priority: .userInitiated) {
                    rawList.compactMap { t -> EmailThread? in
                    guard let id = t["id"] as? String,
                          let mbId = t["mailbox_id"] as? String else { return nil }
                    let participants = t["participants"] as? [String] ?? []
                    let lastMsgDateStr = t["last_message_at"] as? String
                    let lastDate = lastMsgDateStr.flatMap { ConvexAPIService.parseISO8601($0) } ?? Date()
                    
                    return EmailThread(
                        id: id,
                        mailboxId: mbId,
                        subject: t["subject"] as? String ?? "(no subject)",
                        participants: participants,
                        lastSnippet: t["last_snippet"] as? String ?? "",
                        lastMessageAt: lastDate,
                        unreadCount: t["unread_count"] as? Int ?? 0,
                        siteName: t["site_name"] as? String
                    )
                }
                }.value
            }
        } catch {}
        return []
    }
    
    public func fetchEmailMessages(threadId: String) async throws -> [EmailMessage] {
        if useMockData {
            return MockDataService.shared.sampleEmailMessages[threadId] ?? []
        }
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/query") else { return [] }
        let body: [String: Any] = [
            "path": "email:listMessages",
            "args": ["threadId": threadId]
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return [] }
            guard let json = await Self.jsonObject(from: data),
                  let rawList = json["value"] as? [[String: Any]] else { return [] }

            let summaries: [EmailMessage] = await Task.detached(priority: .userInitiated) {
                rawList.compactMap { m -> EmailMessage? in
                    guard let id = m["id"] as? String,
                          let from = m["from"] as? String else { return nil }
                    let sentAtStr = m["sent_at"] as? String
                    let sentDate = sentAtStr.flatMap { ConvexAPIService.parseISO8601($0) } ?? Date()

                    var atts: [EmailAttachment] = []
                    if let rawAtts = m["attachments"] as? [[String: Any]] {
                        atts = rawAtts.compactMap { a in
                            guard let fn = a["filename"] as? String else { return nil }
                            return EmailAttachment(filename: fn, size: a["size"] as? Int, skipped: a["skipped"] as? Bool)
                        }
                    }

                    return EmailMessage(
                        id: id,
                        from: from,
                        subject: m["subject"] as? String ?? "",
                        textBody: m["text_body"] as? String,
                        htmlBody: m["html_body"] as? String,
                        sentAt: sentDate,
                        direction: m["direction"] as? String ?? "in",
                        attachments: atts
                    )
                }
            }.value

            // Bodies are omitted from listMessages to cut Convex I/O — hydrate once per open.
            return await withTaskGroup(of: EmailMessage.self, returning: [EmailMessage].self) { group in
                for summary in summaries {
                    group.addTask {
                        if summary.textBody != nil || summary.htmlBody != nil {
                            return summary
                        }
                        if let full = try? await self.fetchEmailMessageBody(messageId: summary.id) {
                            return EmailMessage(
                                id: summary.id,
                                from: summary.from,
                                subject: summary.subject,
                                textBody: full.textBody,
                                htmlBody: full.htmlBody,
                                sentAt: summary.sentAt,
                                direction: summary.direction,
                                attachments: summary.attachments
                            )
                        }
                        return summary
                    }
                }
                var out: [EmailMessage] = []
                out.reserveCapacity(summaries.count)
                for await msg in group { out.append(msg) }
                // Preserve thread order from summaries
                let byId = Dictionary(uniqueKeysWithValues: out.map { ($0.id, $0) })
                return summaries.compactMap { byId[$0.id] }
            }
        } catch {}
        return []
    }

    private func fetchEmailMessageBody(messageId: String) async throws -> (textBody: String?, htmlBody: String?) {
        guard let url = URL(string: "\(baseURLString)/api/query") else {
            return (nil, nil)
        }
        let body: [String: Any] = [
            "path": "email:getMessage",
            "args": ["messageId": messageId]
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { return (nil, nil) }
        guard let json = await Self.jsonObject(from: data),
              let value = json["value"] as? [String: Any] else { return (nil, nil) }
        return (value["text_body"] as? String, value["html_body"] as? String)
    }
    
    public func syncEmailMailbox(mailboxId: String) async throws -> Bool {
        if useMockData {
            try? await Task.sleep(nanoseconds: 800_000_000)
            return true
        }
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/action") else { return false }
        let body: [String: Any] = [
            "path": "emailActions:syncMailboxNow",
            "args": ["mailboxId": mailboxId]
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch { return false }
    }
    
    public func sendEmailReply(threadId: String, text: String) async throws -> Bool {
        if useMockData {
            let newMsg = EmailMessage(
                id: "emsg_\(UUID().uuidString.prefix(6))",
                from: "Manager <manager@bookingbroom.com>",
                subject: "Re: Thread",
                textBody: text,
                htmlBody: "<p>\(text)</p>",
                sentAt: Date(),
                direction: "out"
            )
            if MockDataService.shared.sampleEmailMessages[threadId] != nil {
                MockDataService.shared.sampleEmailMessages[threadId]?.append(newMsg)
            } else {
                MockDataService.shared.sampleEmailMessages[threadId] = [newMsg]
            }
            return true
        }
        
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/action") else { return false }
        let body: [String: Any] = [
            "path": "emailActions:sendReply",
            "args": ["threadId": threadId, "text": text]
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch { return false }
    }
    
    public func deleteEmailThread(threadId: String) async throws -> Bool {
        if useMockData {
            MockDataService.shared.sampleEmailThreads.removeAll(where: { $0.id == threadId })
            MockDataService.shared.sampleEmailMessages.removeValue(forKey: threadId)
            return true
        }
        
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/action") else { return false }
        let body: [String: Any] = [
            "path": "emailActions:deleteThread",
            "args": ["threadId": threadId]
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch { return false }
    }
    
    public func markEmailThreadRead(threadId: String) async {
        if useMockData {
            if let idx = MockDataService.shared.sampleEmailThreads.firstIndex(where: { $0.id == threadId }) {
                MockDataService.shared.sampleEmailThreads[idx].unreadCount = 0
            }
            return
        }
        
        guard let url = URL(string: "\(baseURLString)/api/mutation") else { return }
        let body: [String: Any] = ["path": "email:markThreadReadLocal", "args": ["threadId": threadId]]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        _ = try? await URLSession.shared.data(for: request)
    }
    
    // MARK: - SEO Metrics (GSC & Bing)
    
    public func fetchSEOMetrics(source: String = "google", periodDays: Int = 28) async throws -> [SEOMetrics] {
        if useMockData { return MockDataService.shared.sampleSEOMetrics }
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/query") else {
            throw AuthError.server("Invalid Convex URL.")
        }
        
        let path = source == "google" ? "gsc:listMetrics" : "bing:listMetrics"
        let body: [String: Any] = ["path": path, "args": ["periodDays": periodDays]]
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard code == 200 else {
            throw AuthError.server("\(path) failed (\(code))")
        }
        
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let status = json["status"] as? String, status == "success",
              let rawList = json["value"] as? [[String: Any]] else {
            if let errorMessage = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["errorMessage"] as? String,
               !errorMessage.isEmpty {
                throw AuthError.server(errorMessage)
            }
            throw AuthError.server("\(path) returned an unexpected payload.")
        }
        
        return rawList.compactMap { item -> SEOMetrics? in
            guard let siteObj = item["site"] as? [String: Any],
                  let siteId = siteObj["id"] as? String,
                  let siteName = siteObj["name"] as? String,
                  let siteSlug = siteObj["slug"] as? String else {
                return nil
            }
            
            var clicks = 0
            var impressions = 0
            var ctr = 0.0
            var position = 0.0
            
            if let m = item["metrics"] as? [String: Any] {
                clicks = Int(m["clicks"] as? Double ?? Double(m["clicks"] as? Int ?? 0))
                impressions = Int(m["impressions"] as? Double ?? Double(m["impressions"] as? Int ?? 0))
                ctr = (m["ctr"] as? Double ?? 0.0) * 100.0
                position = m["position"] as? Double ?? 0.0
            }
            
            var topQ: [SEOQuery] = []
            if let queriesArr = item["top_queries"] as? [[String: Any]] {
                topQ = queriesArr.compactMap { q in
                    guard let queryStr = q["query"] as? String else { return nil }
                    let qClicks = Int(q["clicks"] as? Double ?? Double(q["clicks"] as? Int ?? 0))
                    let qImp = Int(q["impressions"] as? Double ?? Double(q["impressions"] as? Int ?? 0))
                    let qCtr = (q["ctr"] as? Double ?? 0.0) * 100.0
                    let qPos = q["position"] as? Double ?? 0.0
                    return SEOQuery(query: queryStr, clicks: qClicks, impressions: qImp, ctr: qCtr, position: qPos)
                }
            }
            
            return SEOMetrics(
                id: siteId,
                siteId: siteId,
                siteSlug: siteSlug,
                siteName: siteName,
                periodDays: periodDays,
                clicks: clicks,
                impressions: impressions,
                ctr: ctr,
                position: position,
                source: source,
                topQueries: topQ
            )
        }
    }
    
    /// Pulls fresh metrics from Google/Bing into Convex, then returns updated list metrics.
    public func syncSEOMetrics(source: String = "google", periodDays: Int = 28) async throws -> [SEOMetrics] {
        if useMockData {
            try? await Task.sleep(nanoseconds: 600_000_000)
            return MockDataService.shared.sampleSEOMetrics
        }
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/action") else {
            throw NSError(domain: "ConvexAPI", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid Convex URL"])
        }
        
        let path = source == "google" ? "gscActions:syncNow" : "bingActions:syncNow"
        let body: [String: Any] = ["path": path, "args": [:]]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])
                .flatMap { $0["errorMessage"] as? String ?? $0["message"] as? String }
                ?? "SEO sync failed"
            throw NSError(domain: "ConvexAPI", code: (response as? HTTPURLResponse)?.statusCode ?? -1, userInfo: [NSLocalizedDescriptionKey: message])
        }
        
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let status = json["status"] as? String,
           status == "error" {
            let message = json["errorMessage"] as? String ?? "SEO sync failed"
            throw NSError(domain: "ConvexAPI", code: -2, userInfo: [NSLocalizedDescriptionKey: message])
        }
        
        return try await fetchSEOMetrics(source: source, periodDays: periodDays)
    }
    
    // MARK: - Performance Metrics (PageSpeed Insights)
    
    public func fetchPerformanceMetrics(strategy: String = "mobile") async throws -> [PerformanceMetrics] {
        if useMockData { return MockDataService.shared.samplePerformance }
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/query") else {
            throw AuthError.server("Invalid Convex URL.")
        }
        let body: [String: Any] = ["path": "pagespeed:listMetrics", "args": ["strategy": strategy]]
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard code == 200 else {
            throw AuthError.server("pagespeed:listMetrics failed (\(code))")
        }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let status = json["status"] as? String, status == "success",
              let rawList = json["value"] as? [[String: Any]] else {
            throw AuthError.server("pagespeed:listMetrics returned an unexpected payload.")
        }
        return rawList.compactMap { item -> PerformanceMetrics? in
            guard let siteObj = item["site"] as? [String: Any],
                  let siteId = siteObj["id"] as? String,
                  let siteName = siteObj["name"] as? String,
                  let siteSlug = siteObj["slug"] as? String else { return nil }
            
            var perfScore = 90
            var accScore = 95
            var bpScore = 95
            var seoScore = 95
            var agenticScore = 90
            var lcpMs = 1800.0
            var cls = 0.0
            var inpMs = 50.0
            var fcpMs = 1200.0
            var overallCat = "FAST"
            
            if let m = item["metrics"] as? [String: Any] {
                perfScore = Int(m["performance_score"] as? Double ?? 90.0)
                accScore = Int(m["accessibility_score"] as? Double ?? 95.0)
                bpScore = Int(m["best_practices_score"] as? Double ?? 95.0)
                seoScore = Int(m["seo_score"] as? Double ?? 95.0)
                agenticScore = Int(m["agentic_browsing_score"] as? Double ?? 90.0)
                lcpMs = m["lcp_ms"] as? Double ?? 1800.0
                cls = m["cls"] as? Double ?? 0.0
                inpMs = m["inp_ms"] as? Double ?? 50.0
                fcpMs = m["fcp_ms"] as? Double ?? 1200.0
                overallCat = m["overall_category"] as? String ?? "FAST"
            }
            
            return PerformanceMetrics(
                id: siteId,
                siteId: siteId,
                siteSlug: siteSlug,
                siteName: siteName,
                strategy: strategy,
                performanceScore: perfScore,
                accessibilityScore: accScore,
                bestPracticesScore: bpScore,
                seoScore: seoScore,
                agenticBrowsingScore: agenticScore,
                lcpMs: lcpMs,
                cls: cls,
                inpMs: inpMs,
                fcpMs: fcpMs,
                overallCategory: overallCat
            )
        }
    }
    
    // MARK: - Cloudflare Workers Builds (Deployments)
    
    public func fetchDeployments() async throws -> [DeploymentRow] {
        if useMockData { return MockDataService.shared.sampleDeployments }
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/query") else {
            throw AuthError.server("Invalid Convex URL.")
        }
        let body: [String: Any] = ["path": "deployments:listStatus", "args": [:]]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard code == 200 else {
            throw AuthError.server("deployments:listStatus failed (\(code))")
        }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let status = json["status"] as? String, status == "success",
              let rawList = json["value"] as? [[String: Any]] else {
            throw AuthError.server("deployments:listStatus returned an unexpected payload.")
        }
        return rawList.compactMap { Self.parseDeploymentRow($0) }
    }
    
    public func syncDeployments() async throws -> [DeploymentRow] {
        if useMockData {
            try? await Task.sleep(nanoseconds: 600_000_000)
            return MockDataService.shared.sampleDeployments
        }
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/action") else {
            throw NSError(domain: "ConvexAPI", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid Convex URL"])
        }
        let body: [String: Any] = ["path": "deploymentsActions:syncNow", "args": [:]]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 180
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])
                .flatMap { $0["errorMessage"] as? String ?? $0["message"] as? String }
                ?? "Deployment sync failed"
            throw NSError(domain: "ConvexAPI", code: (response as? HTTPURLResponse)?.statusCode ?? -1, userInfo: [NSLocalizedDescriptionKey: message])
        }
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let status = json["status"] as? String,
           status == "error" {
            let message = json["errorMessage"] as? String ?? "Deployment sync failed"
            throw NSError(domain: "ConvexAPI", code: -2, userInfo: [NSLocalizedDescriptionKey: message])
        }
        return try await fetchDeployments()
    }
    
    private static func parseDeploymentRow(_ item: [String: Any]) -> DeploymentRow? {
        guard let target = item["target"] as? [String: Any],
              let slug = target["slug"] as? String,
              let name = target["name"] as? String else { return nil }
        let kind = target["kind"] as? String ?? "site"
        let d = item["deployment"] as? [String: Any]
        
        func intVal(_ key: String) -> Int? {
            if let i = d?[key] as? Int { return i }
            if let n = d?[key] as? Double { return Int(n) }
            return nil
        }
        
        return DeploymentRow(
            kind: kind,
            slug: slug,
            name: name,
            domain: target["domain"] as? String,
            workerName: target["worker_name"] as? String ?? d?["worker_name"] as? String,
            accountId: target["cloudflare_account_id"] as? String ?? d?["account_id"] as? String,
            status: d?["status"] as? String,
            buildOutcome: d?["build_outcome"] as? String,
            branch: d?["branch"] as? String,
            commitHash: d?["commit_hash"] as? String,
            commitMessage: d?["commit_message"] as? String,
            author: d?["author"] as? String,
            createdOn: d?["created_on"] as? String,
            stoppedOn: d?["stopped_on"] as? String,
            dashboardUrl: d?["dashboard_url"] as? String,
            requestsToday: intVal("requests_today"),
            requestsLimit: intVal("requests_limit") ?? 100_000,
            requestsRemaining: intVal("requests_remaining"),
            buildMinutesLimitReached: d?["build_minutes_limit_reached"] as? Bool,
            buildMinutesRefreshOn: d?["build_minutes_refresh_on"] as? String,
            error: d?["error"] as? String,
            checkedAt: d?["checked_at"] as? String
        )
    }
    
    // MARK: - SMS Threads & DIDs (Voip.ms)
    
    public func fetchDids() async throws -> [[String: String]] {
        if useMockData { return MockDataService.shared.sampleDids }
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/query") else {
            throw AuthError.server("Invalid Convex URL.")
        }
        let body: [String: Any] = ["path": "sms:listDids", "args": [:]]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard code == 200 else {
            throw AuthError.server("sms:listDids failed (\(code))")
        }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let raw = json["value"] as? [[String: Any]] else {
            throw AuthError.server("sms:listDids returned an unexpected payload.")
        }
        return raw.compactMap { d in
            guard let did = d["did"] as? String else { return nil }
            return [
                "did": did,
                "description": d["description"] as? String ?? "",
                "sub_account": d["sub_account"] as? String ?? "",
                "formatted": d["formatted"] as? String ?? did
            ]
        }
    }
    
    public func fetchSMSThreads() async throws -> [ChatThread] {
        if useMockData {
            let grouped = Dictionary(grouping: MockDataService.shared.sampleMessages) { "\($0.did)_\($0.contact)" }
            return grouped.map { (_, msgList) -> ChatThread in
                let sorted = msgList.sorted { $0.sentAt < $1.sentAt }
                return ChatThread(did: sorted.first!.did, contact: sorted.first!.contact, lastMessage: sorted.last!, messages: sorted)
            }
        }
        
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/query") else { return [] }
        let body: [String: Any] = ["path": "sms:listThreads", "args": [:]]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return [] }
            if let json = await Self.jsonObject(from: data),
               let status = json["status"] as? String, status == "success",
               let rawThreads = json["value"] as? [[String: Any]] {
                return await Task.detached(priority: .userInitiated) {
                    rawThreads.compactMap { item -> ChatThread? in
                    guard let did = item["did"] as? String,
                          let contact = item["contact"] as? String,
                          let lastBody = item["last_body"] as? String else { return nil }
                    let contactFormatted = item["contact_formatted"] as? String ?? contact
                    let dirStr = item["last_direction"] as? String ?? "in"
                    let direction: MessageDirection = dirStr == "out" ? .out : .in
                    let stableId = item["last_id"] as? String ?? "\(did)_\(contact)_last"
                    
                    let lastMsg = SMSMessage(
                        id: stableId,
                        voipmsId: item["last_voipms_id"] as? String ?? stableId,
                        did: did,
                        contact: contact,
                        direction: direction,
                        type: .sms,
                        body: lastBody,
                        sentAt: Date()
                    )
                    return ChatThread(did: did, contact: contact, contactName: contactFormatted, lastMessage: lastMsg, unreadCount: 0, messages: [lastMsg])
                }
                }.value
            }
        } catch {}
        return []
    }
    
    public func fetchSMSMessages(did: String, contact: String) async throws -> [SMSMessage] {
        if useMockData {
            return MockDataService.shared.sampleMessages
                .filter { $0.did == did && $0.contact == contact }
                .sorted { $0.sentAt < $1.sentAt }
        }
        
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/query") else { return [] }
        let body: [String: Any] = [
            "path": "sms:listMessages",
            "args": ["did": did, "contact": contact]
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return [] }
            if let json = await Self.jsonObject(from: data),
               let status = json["status"] as? String, status == "success",
               let rawList = json["value"] as? [[String: Any]] {
                return await Task.detached(priority: .userInitiated) {
                    rawList.compactMap { item -> SMSMessage? in
                    guard let id = item["id"] as? String,
                          let bodyText = item["body"] as? String else { return nil }
                    let dirStr = (item["direction"] as? String ?? "in").lowercased()
                    let direction: MessageDirection =
                        (dirStr == "out" || dirStr == "outbound") ? .out : .in
                    let typeStr = (item["type"] as? String ?? "sms").lowercased()
                    let sentAtStr = item["sent_at"] as? String
                    let sentAt = sentAtStr.flatMap { ConvexAPIService.parseISO8601($0) } ?? Date()
                    let media = item["media_urls"] as? [String]
                    return SMSMessage(
                        id: id,
                        voipmsId: item["voipms_id"] as? String ?? id,
                        did: item["did"] as? String ?? did,
                        contact: item["contact"] as? String ?? contact,
                        direction: direction,
                        type: typeStr == "mms" ? .mms : .sms,
                        body: bodyText,
                        mediaUrls: media,
                        sentAt: sentAt,
                        status: item["status"] as? String
                    )
                }
                }.value
            }
        } catch {}
        return []
    }
    
    public func sendSMS(did: String, contact: String, message: String) async throws -> Bool {
        if useMockData {
            let newMsg = SMSMessage(
                id: UUID().uuidString,
                voipmsId: "v_\(UUID().uuidString.prefix(6))",
                did: did,
                contact: contact,
                direction: .out,
                type: .sms,
                body: message,
                sentAt: Date()
            )
            MockDataService.shared.sampleMessages.append(newMsg)
            return true
        }
        
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/action") else { return false }
        let body: [String: Any] = [
            "path": "voipmsActions:sendMessage",
            "args": ["did": did, "contact": contact, "message": message]
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch { return false }
    }
    
    public func syncVoipmsNow() async throws -> Bool {
        if useMockData {
            try? await Task.sleep(nanoseconds: 800_000_000)
            return true
        }
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/action") else { return false }
        let body: [String: Any] = ["path": "voipmsActions:syncMessagesNow", "args": [:]]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch { return false }
    }
    
    public func deleteSMSConversation(did: String, contact: String) async throws -> Bool {
        if useMockData {
            MockDataService.shared.sampleMessages.removeAll(where: { $0.did == did && $0.contact == contact })
            return true
        }
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/mutation") else { return false }
        let body: [String: Any] = [
            "path": "sms:deleteConversation",
            "args": ["did": did, "contact": contact]
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch { return false }
    }
    
    // MARK: - Site Health & Pricing Ops
    
    public func fetchSiteHealth() async throws -> [SiteHealthRow] {
        if useMockData { return MockDataService.shared.sampleSiteHealth }
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/query") else {
            throw AuthError.server("Invalid Convex URL.")
        }
        let body: [String: Any] = ["path": "siteHealth:listStatus", "args": [:]]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard code == 200 else {
            throw AuthError.server("siteHealth:listStatus failed (\(code))")
        }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let rawList = json["value"] as? [[String: Any]] else {
            throw AuthError.server("siteHealth:listStatus returned an unexpected payload.")
        }
        return rawList.compactMap { row in
            guard let s = row["site"] as? [String: Any],
                  let slug = s["slug"] as? String,
                  let name = s["name"] as? String,
                  let domain = s["domain"] as? String else { return nil }
            var hInfo: SiteHealthInfo? = nil
            if let h = row["health"] as? [String: Any] {
                hInfo = SiteHealthInfo(
                    status: h["status"] as? String ?? "online",
                    httpStatus: h["http_status"] as? Int,
                    ipAddress: h["ip_address"] as? String
                )
            }
            return SiteHealthRow(
                siteSlug: slug,
                siteName: name,
                domain: domain,
                hostingProvider: s["hosting_provider"] as? String,
                emailConfigured: s["email_configured"] as? Bool ?? true,
                phoneNumber: s["phone_number"] as? String,
                health: hInfo
            )
        }
    }
    
    public func checkSiteHealthNow() async throws -> Bool {
        if useMockData {
            try? await Task.sleep(nanoseconds: 800_000_000)
            return true
        }
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/action") else { return false }
        let body: [String: Any] = ["path": "siteHealthActions:checkNow", "args": [:]]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch { return false }
    }
    
    public func fetchSitePricing() async throws -> [SitePricingRow] {
        if useMockData { return MockDataService.shared.sampleSitePricing }
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/query") else {
            throw AuthError.server("Invalid Convex URL.")
        }
        let body: [String: Any] = ["path": "pricing:list", "args": [:]]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard code == 200 else {
            throw AuthError.server("pricing:list failed (\(code))")
        }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let rawList = json["value"] as? [[String: Any]] else {
            throw AuthError.server("pricing:list returned an unexpected payload.")
        }
        return Self.mapPricingRows(rawList)
    }
    
    public func comparePricingScenario(_ scenario: PricingScenario) async throws -> [SitePricingRow] {
        if useMockData {
            try? await Task.sleep(nanoseconds: 200_000_000)
            return MockDataService.shared.sampleSitePricing
        }
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/query") else {
            throw AuthError.server("Invalid Convex URL.")
        }
        let body: [String: Any] = [
            "path": "pricing:compareScenario",
            "args": scenario.convexArgs
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw NSError(domain: "ConvexAPI", code: (response as? HTTPURLResponse)?.statusCode ?? -1, userInfo: [NSLocalizedDescriptionKey: "Failed to compare pricing"])
        }
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let rawList = json["value"] as? [[String: Any]] {
            return Self.mapPricingRows(rawList)
        }
        return []
    }
    
    public static func mapPricingRows(_ rawList: [[String: Any]]) -> [SitePricingRow] {
        rawList.compactMap { row in
            guard let s = row["site"] as? [String: Any],
                  let slug = s["slug"] as? String,
                  let name = s["name"] as? String else { return nil }
            let siteId = s["id"] as? String
            let accent = s["accent_color"] as? String
            var engine: String? = nil
            var version: Int? = nil
            var configJSON: Data? = nil
            if let pr = row["pricing"] as? [String: Any] {
                engine = pr["engine"] as? String
                if let v = pr["version"] as? Int { version = v }
                else if let v = pr["version"] as? Double { version = Int(v) }
                if let cfg = pr["config"] {
                    configJSON = try? JSONSerialization.data(withJSONObject: cfg)
                }
            }
            var entries: [PricingBasketEntry] = []
            if let b = row["basket"] as? [String: Any], let rawEnt = b["entries"] as? [String: Any] {
                for (k, v) in rawEnt {
                    if let dict = v as? [String: Any] {
                        let price: Double?
                        if let d = dict["price"] as? Double { price = d }
                        else if let i = dict["price"] as? Int { price = Double(i) }
                        else { price = nil }
                        entries.append(PricingBasketEntry(
                            name: k,
                            price: price,
                            low: dict["low"] as? Double,
                            high: dict["high"] as? Double
                        ))
                    }
                }
            }
            return SitePricingRow(
                siteId: siteId,
                siteSlug: slug,
                siteName: name,
                accentColorHex: accent,
                engine: engine,
                version: version,
                entries: entries,
                configJSON: configJSON
            )
        }
    }
    
    public static func addonCatalog(from rows: [SitePricingRow]) -> [PricingAddonOption] {
        var byKey: [String: String] = [:]
        for row in rows {
            guard let data = row.configJSON,
                  let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                continue
            }
            if let addOns = root["addOns"] as? [[String: Any]] {
                for addon in addOns {
                    guard let key = addon["key"] as? String else { continue }
                    let label = addon["label"] as? String ?? key
                    if byKey[key] == nil { byKey[key] = label }
                }
            }
            if let addonCents = root["addonCents"] as? [[String: Any]] {
                for addon in addonCents {
                    guard let key = addon["key"] as? String else { continue }
                    let label = addon["label"] as? String ?? key
                    if byKey[key] == nil { byKey[key] = label }
                }
            }
            if let extras = root["extras"] as? [[String: Any]] {
                for extra in extras {
                    guard let name = extra["name"] as? String else { continue }
                    let key = name
                        .lowercased()
                        .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
                        .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
                    if byKey[key] == nil { byKey[key] = name }
                }
            }
        }
        return byKey
            .map { PricingAddonOption(key: $0.key, label: $0.value) }
            .sorted { $0.label.localizedCaseInsensitiveCompare($1.label) == .orderedAscending }
    }
    
    public func updateSitePricing(siteId: String, configJSON: Data, summary: String) async throws -> Bool {
        if useMockData {
            try? await Task.sleep(nanoseconds: 400_000_000)
            return true
        }
        await ensureAuthenticated()
        guard let url = URL(string: "\(baseURLString)/api/mutation") else { return false }
        guard let configObj = try? JSONSerialization.jsonObject(with: configJSON) else { return false }
        
        let body: [String: Any] = [
            "path": "pricing:updateConfig",
            "args": [
                "siteId": siteId,
                "config": configObj,
                "summary": summary
            ]
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])
                .flatMap { $0["errorMessage"] as? String ?? $0["message"] as? String }
                ?? "Failed to update pricing"
            throw NSError(domain: "ConvexAPI", code: (response as? HTTPURLResponse)?.statusCode ?? -1, userInfo: [NSLocalizedDescriptionKey: message])
        }
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let status = json["status"] as? String, status == "error" {
            throw NSError(domain: "ConvexAPI", code: -2, userInfo: [NSLocalizedDescriptionKey: json["errorMessage"] as? String ?? "Failed to update pricing"])
        }
        return true
    }
    
    // MARK: - APNs push tokens (BookingBroomSwift)
    
    public func saveApnsPushToken(
        token: String,
        platform: String,
        environment: String
    ) async -> Bool {
        if useMockData { return true }
        await ensureAuthenticated()
        guard authToken != nil else { return false }
        guard let url = URL(string: "\(baseURLString)/api/mutation") else { return false }
        let body: [String: Any] = [
            "path": "push:saveApnsPushToken",
            "args": [
                "token": token,
                "platform": platform,
                "environment": environment,
            ],
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                return false
            }
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let status = json["status"] as? String,
               status == "error" {
                return false
            }
            return true
        } catch {
            return false
        }
    }
    
    public func removeApnsPushToken(token: String) async -> Bool {
        if useMockData { return true }
        await ensureAuthenticated()
        guard authToken != nil else { return false }
        guard let url = URL(string: "\(baseURLString)/api/mutation") else { return false }
        let body: [String: Any] = [
            "path": "push:removeApnsPushToken",
            "args": ["token": token],
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch {
            return false
        }
    }
}

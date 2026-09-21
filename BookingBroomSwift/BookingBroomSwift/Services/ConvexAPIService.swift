import Foundation

/// Typed failure surfaced by every Convex call so ViewModels can tell
/// "empty result" from "request failed" and react to auth expiry.
public enum ConvexError: LocalizedError, Equatable {
    case invalidURL
    case network(String)
    case invalidJSON(Int)
    case unauthenticated
    case server(String)
    case cancelled
    
    public var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid Convex URL."
        case .network(let message): return "Network error: \(message)"
        case .invalidJSON(let code): return "Unexpected response from server (HTTP \(code))."
        case .unauthenticated: return "Your session expired. Sign in again."
        case .server(let message): return message
        case .cancelled: return "Request cancelled."
        }
    }
    
    public var isCancelled: Bool {
        if case .cancelled = self { return true }
        return false
    }
}

/// Single HTTP transport for the Convex deployment.
///
/// - All mutable state is actor-isolated (token, cache, config).
/// - Every function goes through `call(_:_:args:timeout:)`, which attaches the
///   bearer token, refreshes it when it is about to expire or is rejected, and
///   maps Convex `status/value/errorMessage` into `ConvexError`.
/// - Concurrent `sites:list` and refresh requests are de-duplicated.
public actor ConvexAPIService {
    public static let shared = ConvexAPIService()
    
    public nonisolated static let defaultBaseURL = "https://dynamic-gnu-491.convex.cloud"
    
    public typealias SessionExpiredHandler = @Sendable () -> Void
    public typealias TokensRotatedHandler = @Sendable (_ token: String, _ refreshToken: String?) -> Void
    
    // MARK: Configuration
    
    private var baseURLString: String = ConvexAPIService.defaultBaseURL
    private var useMockData: Bool = false
    
    // MARK: Session
    
    private var authToken: String?
    private var refreshToken: String?
    private var tokenExpiresAt: Date?
    private var refreshTask: Task<String, Error>?
    private var sessionExpiredHandler: SessionExpiredHandler?
    private var tokensRotatedHandler: TokensRotatedHandler?
    
    /// Refresh proactively when the JWT is within this window of expiring.
    private let refreshLeeway: TimeInterval = 60
    
    // MARK: Sites cache (60 s TTL + in-flight de-dup)
    
    private var cachedSites: [CleaningSite]?
    private var cachedSitesFetchedAt: Date?
    private var sitesTask: Task<[CleaningSite], Error>?
    private let sitesCacheTTL: TimeInterval = 60
    
    private init() {}
    
    // MARK: - Shared parsers
    
    nonisolated(unsafe) private static let iso8601Fractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    
    nonisolated(unsafe) private static let iso8601: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
    
    nonisolated static func parseISO8601(_ string: String) -> Date? {
        iso8601Fractional.date(from: string) ?? iso8601.date(from: string)
    }
    
    /// Parse JSON off the main actor to avoid UI hitching on large payloads.
    nonisolated private static func jsonObject(from data: Data) async -> [String: Any]? {
        await Task.detached(priority: .userInitiated) {
            (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        }.value
    }
    
    /// Decode the `exp` claim of a JWT without verifying the signature.
    nonisolated static func jwtExpiry(_ token: String) -> Date? {
        let parts = token.split(separator: ".")
        guard parts.count >= 2 else { return nil }
        var b64 = String(parts[1])
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while b64.count % 4 != 0 { b64 += "=" }
        guard let data = Data(base64Encoded: b64),
              let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
            return nil
        }
        if let exp = json["exp"] as? Double { return Date(timeIntervalSince1970: exp) }
        if let exp = json["exp"] as? Int { return Date(timeIntervalSince1970: Double(exp)) }
        return nil
    }
    
    nonisolated private static func isAuthFailureMessage(_ message: String) -> Bool {
        let lower = message.lowercased()
        return lower.contains("unauthenticated")
            || lower.contains("not authenticated")
            || lower.contains("invalid token")
            || lower.contains("token expired")
            || lower.contains("expired token")
            || lower.contains("jwt")
            || lower.contains("unauthorized")
    }
    
    // MARK: - Configuration API
    
    public var currentBaseURL: String { baseURLString }
    public var isMockMode: Bool { useMockData }
    public var hasAuthToken: Bool { authToken != nil }
    public var currentAuthToken: String? { authToken }
    
    public func setBaseURL(_ url: String) {
        let trimmed = url.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed != baseURLString else { return }
        baseURLString = trimmed
        invalidateSitesCache()
    }
    
    public func setMockMode(_ enabled: Bool) {
        guard enabled != useMockData else { return }
        useMockData = enabled
        invalidateSitesCache()
    }
    
    public func setSessionExpiredHandler(_ handler: SessionExpiredHandler?) {
        sessionExpiredHandler = handler
    }
    
    public func setTokensRotatedHandler(_ handler: TokensRotatedHandler?) {
        tokensRotatedHandler = handler
    }
    
    /// Install the session tokens after login / unlock / launch restore.
    /// `token` may be nil when only a refresh token survived — the pipeline
    /// will exchange it before the first authenticated call.
    public func setSession(token: String?, refreshToken: String?) {
        authToken = token
        tokenExpiresAt = token.flatMap(Self.jwtExpiry)
        if let refreshToken, !refreshToken.isEmpty {
            self.refreshToken = refreshToken
        }
    }
    
    public func clearSession() {
        authToken = nil
        refreshToken = nil
        tokenExpiresAt = nil
        refreshTask?.cancel()
        refreshTask = nil
        invalidateSitesCache()
    }
    
    public func invalidateSitesCache() {
        cachedSites = nil
        cachedSitesFetchedAt = nil
        sitesTask?.cancel()
        sitesTask = nil
    }
    
    // MARK: - Auth errors
    
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
    
    // MARK: - Request pipeline
    
    private enum FunctionKind: String {
        case query, mutation, action
    }
    
    private var headers: [String: String] {
        var h = ["Content-Type": "application/json"]
        if let token = authToken {
            h["Authorization"] = "Bearer \(token)"
        }
        return h
    }
    
    /// Run a Convex function. Proactively refreshes an expiring JWT, retries
    /// once after a refresh when the server rejects the token, and notifies the
    /// session-expired handler only when the refresh itself fails.
    @discardableResult
    private func call(
        _ kind: FunctionKind,
        _ path: String,
        args: [String: Any] = [:],
        timeout: TimeInterval = 30
    ) async throws -> Any? {
        try await refreshIfExpiring()
        
        do {
            return try await perform(kind, path, args: args, timeout: timeout)
        } catch ConvexError.unauthenticated {
            guard refreshToken != nil else {
                notifySessionExpired()
                throw ConvexError.unauthenticated
            }
            do {
                _ = try await refreshAccessToken()
            } catch {
                if case AuthError.network(let message) = error {
                    throw ConvexError.network(message)
                }
                notifySessionExpired()
                throw ConvexError.unauthenticated
            }
            // Refresh succeeded: the session is valid, so a second rejection is a
            // function-level authorization error, not an expired session.
            do {
                return try await perform(kind, path, args: args, timeout: timeout)
            } catch ConvexError.unauthenticated {
                throw ConvexError.server("\(path): unauthorized")
            }
        }
    }
    
    private func perform(
        _ kind: FunctionKind,
        _ path: String,
        args: [String: Any],
        timeout: TimeInterval
    ) async throws -> Any? {
        guard let url = URL(string: "\(baseURLString)/api/\(kind.rawValue)") else {
            throw ConvexError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = timeout
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["path": path, "args": args])
        
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch let urlError as URLError where urlError.code == .cancelled {
            throw ConvexError.cancelled
        } catch is CancellationError {
            throw ConvexError.cancelled
        } catch {
            throw ConvexError.network(error.localizedDescription)
        }
        
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        if code == 401 || code == 403 {
            throw ConvexError.unauthenticated
        }
        
        guard let json = await Self.jsonObject(from: data) else {
            throw ConvexError.invalidJSON(code)
        }
        
        let errorMessage = (json["errorMessage"] as? String) ?? (json["message"] as? String)
        if let errorMessage, !errorMessage.isEmpty {
            if Self.isAuthFailureMessage(errorMessage) {
                throw ConvexError.unauthenticated
            }
            throw ConvexError.server(errorMessage)
        }
        
        guard code == 200 else {
            throw ConvexError.server("\(path) failed (HTTP \(code)).")
        }
        guard let status = json["status"] as? String, status == "success" else {
            throw ConvexError.server("\(path) returned an unexpected payload.")
        }
        
        let value = json["value"]
        return value is NSNull ? nil : value
    }
    
    private func query(_ path: String, args: [String: Any] = [:], timeout: TimeInterval = 30) async throws -> Any? {
        try await call(.query, path, args: args, timeout: timeout)
    }
    
    @discardableResult
    private func mutation(_ path: String, args: [String: Any] = [:], timeout: TimeInterval = 30) async throws -> Any? {
        try await call(.mutation, path, args: args, timeout: timeout)
    }
    
    @discardableResult
    private func action(_ path: String, args: [String: Any] = [:], timeout: TimeInterval = 60) async throws -> Any? {
        try await call(.action, path, args: args, timeout: timeout)
    }
    
    private func listValue(_ value: Any?) -> [[String: Any]] {
        value as? [[String: Any]] ?? []
    }
    
    // MARK: - Token refresh
    
    private func refreshIfExpiring() async throws {
        if authToken == nil {
            // Refresh-token-only session (launch restore): exchange before the first call.
            guard refreshToken != nil else { return }
            do {
                _ = try await refreshAccessToken()
            } catch AuthError.sessionExpired {
                notifySessionExpired()
                throw ConvexError.unauthenticated
            } catch {
                // Network hiccup — let the real call decide.
            }
            return
        }
        guard let expiresAt = tokenExpiresAt,
              expiresAt.timeIntervalSinceNow < refreshLeeway else { return }
        guard refreshToken != nil else {
            // Token is expired and cannot be renewed — surface immediately.
            if expiresAt.timeIntervalSinceNow < 0 {
                notifySessionExpired()
                throw ConvexError.unauthenticated
            }
            return
        }
        do {
            _ = try await refreshAccessToken()
        } catch AuthError.sessionExpired {
            notifySessionExpired()
            throw ConvexError.unauthenticated
        } catch {
            // Network hiccup — let the real call decide.
        }
    }
    
    /// De-duplicated refresh: concurrent callers await the same task.
    private func refreshAccessToken() async throws -> String {
        if let task = refreshTask {
            return try await task.value
        }
        guard let refresh = refreshToken, !refresh.isEmpty else {
            throw AuthError.sessionExpired
        }
        let task = Task<String, Error> {
            let result = try await self.refreshSession(using: refresh)
            return result.token
        }
        refreshTask = task
        defer { refreshTask = nil }
        return try await task.value
    }
    
    private func notifySessionExpired() {
        authToken = nil
        refreshToken = nil
        tokenExpiresAt = nil
        invalidateSitesCache()
        sessionExpiredHandler?()
    }
    
    // MARK: - Authentication
    
    public func login(email: String, password: String) async throws -> (token: String, email: String) {
        try await authenticate(email: email, password: password, flow: "signIn")
    }
    
    public func signUp(email: String, password: String) async throws -> (token: String, email: String) {
        try await authenticate(email: email, password: password, flow: "signUp")
    }
    
    /// Exchange a Convex Auth refresh token for a new access token (and rotated refresh token).
    /// Installs the new tokens on the service and persists them to the Keychain.
    public func refreshSession(using refreshToken: String) async throws -> (token: String, refreshToken: String?) {
        if useMockData {
            let token = "mock_token_\(UUID().uuidString)"
            setSession(token: token, refreshToken: refreshToken)
            return (token, refreshToken)
        }
        
        let json = try await postAuthAction(args: ["refreshToken": refreshToken], timeout: 30)
        
        if let errMsg = json["errorMessage"] as? String, !errMsg.isEmpty {
            throw AuthError.sessionExpired
        }
        guard (json["status"] as? String) == "success",
              let value = json["value"] as? [String: Any] else {
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
        
        setSession(token: token, refreshToken: newRefresh ?? refreshToken)
        KeychainStore.set(token, forKey: KeychainStore.Key.authToken)
        if let newRefresh {
            KeychainStore.set(newRefresh, forKey: KeychainStore.Key.refreshToken)
        }
        tokensRotatedHandler?(token, newRefresh)
        return (token, newRefresh)
    }
    
    /// Lightweight authenticated probe — throws if the current Bearer token is rejected.
    /// Only needed for the "stored access token, no refresh token" fallback path.
    public func validateAuthenticatedSession() async throws {
        if useMockData { return }
        guard authToken != nil else { throw AuthError.sessionExpired }
        do {
            _ = try await perform(.query, "sites:list", args: [:], timeout: 20)
        } catch ConvexError.unauthenticated {
            throw AuthError.sessionExpired
        } catch ConvexError.network(let message) {
            throw AuthError.network(message)
        } catch let error as ConvexError {
            throw AuthError.server(error.errorDescription ?? "Session check failed.")
        }
    }
    
    private func postAuthAction(args: [String: Any], timeout: TimeInterval) async throws -> [String: Any] {
        guard let url = URL(string: "\(baseURLString)/api/action") else {
            throw AuthError.server("Invalid Convex URL.")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["path": "auth:signIn", "args": args])
        request.timeoutInterval = timeout
        
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw AuthError.network(error.localizedDescription)
        }
        
        let httpStatus = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard let json = await Self.jsonObject(from: data) else {
            let snippet = String(data: data, encoding: .utf8)?.prefix(200) ?? ""
            throw AuthError.server("Unexpected response (HTTP \(httpStatus)): \(snippet)")
        }
        return json
    }
    
    private func authenticate(
        email: String,
        password: String,
        flow: String
    ) async throws -> (token: String, email: String) {
        if useMockData {
            let token = "mock_token_\(UUID().uuidString)"
            setSession(token: token, refreshToken: nil)
            return (token, email)
        }
        
        let json = try await postAuthAction(
            args: [
                "provider": "password",
                "params": [
                    "flow": flow,
                    "email": email,
                    "password": password
                ]
            ],
            timeout: 30
        )
        
        if let errMsg = json["errorMessage"] as? String, !errMsg.isEmpty {
            throw mapAuthServerError(errMsg, flow: flow)
        }
        guard (json["status"] as? String) == "success" else {
            throw AuthError.server("Sign-in failed.")
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
        
        var refresh: String? = nil
        if let tokens = value["tokens"] as? [String: Any],
           let r = tokens["refreshToken"] as? String, !r.isEmpty {
            refresh = r
            KeychainStore.set(r, forKey: KeychainStore.Key.refreshToken)
        }
        
        setSession(token: token, refreshToken: refresh)
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
    
    /// Cached for 60 s; concurrent callers share one in-flight request.
    public func fetchSites(force: Bool = false) async throws -> [CleaningSite] {
        if useMockData { return MockDataService.shared.sampleSites }
        
        if !force,
           let cached = cachedSites,
           let fetchedAt = cachedSitesFetchedAt,
           Date().timeIntervalSince(fetchedAt) < sitesCacheTTL {
            return cached
        }
        if let task = sitesTask {
            return try await task.value
        }
        
        let task = Task<[CleaningSite], Error> {
            let raw = try await self.query("sites:list")
            let rawSites = self.listValue(raw)
            return await Task.detached(priority: .userInitiated) {
                rawSites.map(ConvexAPIService.parseSite)
            }.value
        }
        sitesTask = task
        defer { sitesTask = nil }
        
        do {
            let sites = try await task.value
            cachedSites = sites
            cachedSitesFetchedAt = Date()
            return sites
        } catch {
            if let cached = cachedSites { return cached }
            throw error
        }
    }
    
    nonisolated private static func parseSite(_ item: [String: Any]) -> CleaningSite {
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
    
    // MARK: - Bookings
    
    public func fetchBookings(includeArchived: Bool = false, limit: Int? = nil) async throws -> [Booking] {
        if useMockData {
            return includeArchived
                ? MockDataService.shared.sampleArchivedBookings
                : MockDataService.shared.sampleBookings
        }
        
        var args: [String: Any] = [:]
        if includeArchived { args["includeArchived"] = true }
        if let limit { args["limit"] = limit }
        
        let raw = listValue(try await query("bookings:list", args: args))
        return await Task.detached(priority: .userInitiated) {
            raw.compactMap(ConvexAPIService.parseBooking)
        }.value
    }
    
    nonisolated private static func parseQuote(_ q: [String: Any]) -> BookingQuote {
        var addOnsList: [QuoteAddOn]? = nil
        if let arr = q["add_ons"] as? [[String: Any]] {
            addOnsList = arr.compactMap { a in
                guard let lbl = a["label"] as? String else { return nil }
                return QuoteAddOn(label: lbl, price: a["price"] as? Double, quantity: a["quantity"] as? Int)
            }
        }
        return BookingQuote(
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
    
    nonisolated private static func parseProperty(_ p: [String: Any]) -> PropertyDetails {
        PropertyDetails(
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
    
    nonisolated static func parseBooking(_ item: [String: Any]) -> Booking? {
        let id = (item["id"] as? String)
            ?? (item["_id"] as? String)
            ?? ((item["_id"] as? [String: Any])?["id"] as? String)
        let siteId = (item["site_id"] as? String)
            ?? (item["siteId"] as? String)
            ?? ((item["site_id"] as? [String: Any])?["id"] as? String)
        guard let id, let siteId,
              let custName = item["customer_name"] as? String ?? item["customerName"] as? String,
              let service = item["service_type"] as? String ?? item["serviceType"] as? String else {
            return nil
        }
        
        let status = BookingStatus(rawValue: item["status"] as? String ?? "new") ?? .new
        
        var siteName = "Cleaning Site"
        var siteSlug = "unknown"
        if let siteObj = item["site"] as? [String: Any] {
            siteName = siteObj["name"] as? String ?? siteName
            siteSlug = siteObj["slug"] as? String ?? siteSlug
        }
        
        let quoteObj = (item["quote"] as? [String: Any]).map(parseQuote)
        let propObj = (item["property"] as? [String: Any]).map(parseProperty)
        
        let schedStartMs = item["scheduled_start_at_ms"] as? Double
        let schedEndMs = item["scheduled_end_at_ms"] as? Double
        let schedStart = schedStartMs.map { Date(timeIntervalSince1970: $0 / 1000.0) }
        let schedEnd = schedEndMs.map { Date(timeIntervalSince1970: $0 / 1000.0) }
        let archivedAt = (item["archived_at"] as? String).flatMap(parseISO8601)
        let createdAt = (item["created_at"] as? String).flatMap(parseISO8601) ?? Date()
        let updatedAt = (item["updated_at"] as? String).flatMap(parseISO8601) ?? createdAt
        
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
            quote: quoteObj,
            archivedAt: archivedAt,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }
    
    public func fetchPartialLeads(siteSlug: String? = nil) async throws -> [PartialLead] {
        if useMockData { return [] }
        
        var args: [String: Any] = [:]
        if let siteSlug, !siteSlug.isEmpty { args["siteSlug"] = siteSlug }
        
        let raw = listValue(try await query("partialLeads:list", args: args))
        return await Task.detached(priority: .userInitiated) {
            raw.compactMap { item -> PartialLead? in
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
                
                let createdAt = (item["created_at"] as? String).flatMap(ConvexAPIService.parseISO8601) ?? Date()
                let updatedAt = (item["updated_at"] as? String).flatMap(ConvexAPIService.parseISO8601) ?? createdAt
                
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
                    property: (item["property"] as? [String: Any]).map(ConvexAPIService.parseProperty),
                    quote: (item["quote"] as? [String: Any]).map(ConvexAPIService.parseQuote),
                    intent: item["intent"] as? String,
                    lastStep: item["last_step"] as? String,
                    createdAt: createdAt,
                    updatedAt: updatedAt
                )
            }
        }.value
    }
    
    public func updateBookingStatus(bookingId: String, newStatus: BookingStatus) async throws {
        if useMockData {
            if let idx = MockDataService.shared.sampleBookings.firstIndex(where: { $0.id == bookingId }) {
                MockDataService.shared.sampleBookings[idx].status = newStatus
            }
            return
        }
        try await mutation("bookings:updateStatus", args: ["bookingId": bookingId, "status": newStatus.rawValue])
    }
    
    public func scheduleBooking(
        bookingId: String,
        scheduledStartAt: Double,
        scheduledEndAt: Double,
        timezone: String = "America/New_York",
        confirm: Bool = true,
        alertOffsetsMinutes: [Int] = [1440, 60]
    ) async throws {
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
            return
        }
        try await mutation("bookings:schedule", args: [
            "bookingId": bookingId,
            "scheduledStartAt": scheduledStartAt,
            "scheduledEndAt": scheduledEndAt,
            "timezone": timezone,
            "confirm": confirm,
            "alertOffsetsMinutes": alertOffsetsMinutes
        ])
    }
    
    public func saveInternalNotes(bookingId: String, notes: String) async throws {
        if useMockData {
            if let idx = MockDataService.shared.sampleBookings.firstIndex(where: { $0.id == bookingId }) {
                MockDataService.shared.sampleBookings[idx].internalNotes = notes
            }
            return
        }
        try await mutation("bookings:updateInternalNotes", args: ["bookingId": bookingId, "notes": notes])
    }
    
    public func archiveBooking(bookingId: String) async throws {
        if useMockData {
            if let idx = MockDataService.shared.sampleBookings.firstIndex(where: { $0.id == bookingId }) {
                var b = MockDataService.shared.sampleBookings.remove(at: idx)
                b.archivedAt = Date()
                MockDataService.shared.sampleArchivedBookings.insert(b, at: 0)
            }
            return
        }
        try await mutation("bookings:archive", args: ["bookingId": bookingId])
    }
    
    public func unarchiveBooking(bookingId: String) async throws {
        if useMockData {
            if let idx = MockDataService.shared.sampleArchivedBookings.firstIndex(where: { $0.id == bookingId }) {
                var b = MockDataService.shared.sampleArchivedBookings.remove(at: idx)
                b.archivedAt = nil
                MockDataService.shared.sampleBookings.insert(b, at: 0)
            }
            return
        }
        try await mutation("bookings:unarchive", args: ["bookingId": bookingId])
    }
    
    public func deleteBookingPermanently(bookingId: String) async throws {
        if useMockData {
            MockDataService.shared.sampleBookings.removeAll(where: { $0.id == bookingId })
            MockDataService.shared.sampleArchivedBookings.removeAll(where: { $0.id == bookingId })
            return
        }
        try await mutation("bookings:remove", args: ["bookingId": bookingId])
    }
    
    /// Manager-created booking via `bookings:createManual` (no customer notifications).
    /// Returns the server booking (real Convex id) to replace the optimistic row.
    public func createBooking(from draft: Booking) async throws -> Booking {
        if useMockData {
            MockDataService.shared.sampleBookings.insert(draft, at: 0)
            return draft
        }
        
        var args: [String: Any] = [
            "siteId": draft.siteId,
            "customerName": draft.customerName,
            "serviceType": draft.serviceType,
            "status": draft.status.rawValue
        ]
        if let v = draft.email, !v.isEmpty { args["email"] = v }
        if let v = draft.phone, !v.isEmpty { args["phone"] = v }
        if let v = draft.address, !v.isEmpty { args["address"] = v }
        if let v = draft.preferredDate, !v.isEmpty { args["preferredDate"] = v }
        if let v = draft.preferredTime, !v.isEmpty { args["preferredTime"] = v }
        if let v = draft.notes, !v.isEmpty { args["notes"] = v }
        if let v = draft.internalNotes, !v.isEmpty { args["internalNotes"] = v }
        
        guard let value = try await mutation("bookings:createManual", args: args) as? [String: Any],
              let booking = Self.parseBooking(value) else {
            throw ConvexError.server("bookings:createManual returned an unexpected payload.")
        }
        return booking
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
        
        let raw = listValue(try await query("calendar:listInRange", args: ["startAt": startAt, "endAt": endAt]))
        return await Task.detached(priority: .userInitiated) {
            raw.compactMap { ev -> CalendarEvent? in
                guard let id = ev["id"] as? String,
                      let title = ev["title"] as? String,
                      let startMs = ev["start_at_ms"] as? Double else { return nil }
                let kind = CalendarEventKind(rawValue: ev["kind"] as? String ?? "booking_scheduled") ?? .bookingScheduled
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
        }.value
    }
    
    /// `bookingId == nil` → `reminders:listPending` (upcoming across all bookings).
    public func fetchReminders(bookingId: String? = nil) async throws -> [ReminderItem] {
        if useMockData {
            if let bid = bookingId {
                return MockDataService.shared.sampleReminders.filter { $0.bookingId == bid }
            }
            return MockDataService.shared.sampleReminders
        }
        
        let raw: [[String: Any]]
        if let bid = bookingId {
            raw = listValue(try await query("reminders:listByBooking", args: ["bookingId": bid]))
        } else {
            raw = listValue(try await query("reminders:listPending"))
        }
        return raw.compactMap { r in
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
    
    public func createReminder(title: String, notes: String? = nil, dueAt: Double, allDay: Bool = false, bookingId: String? = nil) async throws {
        if useMockData {
            let rem = ReminderItem(id: "rem_\(UUID().uuidString.prefix(6))", title: title, notes: notes, dueAtMs: dueAt, bookingId: bookingId, allDay: allDay)
            MockDataService.shared.sampleReminders.insert(rem, at: 0)
            return
        }
        var args: [String: Any] = ["title": title, "dueAt": dueAt, "allDay": allDay]
        if let n = notes, !n.isEmpty { args["notes"] = n }
        if let b = bookingId { args["bookingId"] = b }
        try await mutation("reminders:create", args: args)
    }
    
    public func removeReminder(reminderId: String) async throws {
        if useMockData {
            MockDataService.shared.sampleReminders.removeAll(where: { $0.id == reminderId })
            return
        }
        try await mutation("reminders:remove", args: ["reminderId": reminderId])
    }
    
    // MARK: - Email Suite (SpaceMail)
    
    public func fetchEmailMailboxes() async throws -> [EmailMailbox] {
        if useMockData { return MockDataService.shared.sampleMailboxes }
        let raw = listValue(try await query("email:listMailboxes"))
        return raw.compactMap { mb in
            guard let id = mb["id"] as? String,
                  let email = mb["email"] as? String else { return nil }
            return EmailMailbox(
                id: id,
                email: email,
                label: mb["label"] as? String ?? mb["display_name"] as? String,
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
        let raw = listValue(try await query("email:listThreads", args: ["mailboxId": mailboxId]))
        return await Task.detached(priority: .userInitiated) {
            raw.compactMap { t -> EmailThread? in
                guard let id = t["id"] as? String,
                      let mbId = t["mailbox_id"] as? String else { return nil }
                let lastDate = (t["last_message_at"] as? String).flatMap(ConvexAPIService.parseISO8601) ?? Date()
                return EmailThread(
                    id: id,
                    mailboxId: mbId,
                    subject: t["subject"] as? String ?? "(no subject)",
                    participants: t["participants"] as? [String] ?? [],
                    lastSnippet: t["last_snippet"] as? String ?? "",
                    lastMessageAt: lastDate,
                    unreadCount: t["unread_count"] as? Int ?? 0,
                    siteName: t["site_name"] as? String
                )
            }
        }.value
    }
    
    /// One query (`email:listThreadMessages`) returns bodies inline — no N+1 hydration.
    /// Plain-text bodies are derived once here, off the main actor.
    public func fetchEmailMessages(threadId: String, limit: Int = 100) async throws -> [EmailMessage] {
        if useMockData {
            return (MockDataService.shared.sampleEmailMessages[threadId] ?? []).map { msg in
                var m = msg
                if m.plainText == nil { m.plainText = EmailMessage.derivePlainText(text: m.textBody, html: m.htmlBody) }
                return m
            }
        }
        
        let raw = listValue(try await query("email:listThreadMessages", args: ["threadId": threadId, "limit": limit]))
        return await Task.detached(priority: .userInitiated) {
            raw.compactMap { m -> EmailMessage? in
                guard let id = m["id"] as? String,
                      let from = m["from"] as? String else { return nil }
                let sentDate = (m["sent_at"] as? String).flatMap(ConvexAPIService.parseISO8601) ?? Date()
                var atts: [EmailAttachment] = []
                if let rawAtts = m["attachments"] as? [[String: Any]] {
                    atts = rawAtts.compactMap { a in
                        guard let fn = a["filename"] as? String else { return nil }
                        return EmailAttachment(filename: fn, size: a["size"] as? Int, skipped: a["skipped"] as? Bool)
                    }
                }
                let textBody = m["text_body"] as? String
                let htmlBody = m["html_body"] as? String
                return EmailMessage(
                    id: id,
                    from: from,
                    subject: m["subject"] as? String ?? "",
                    textBody: textBody,
                    htmlBody: htmlBody,
                    sentAt: sentDate,
                    direction: m["direction"] as? String ?? "in",
                    attachments: atts,
                    plainText: EmailMessage.derivePlainText(text: textBody, html: htmlBody)
                )
            }
        }.value
    }
    
    public func syncEmailMailbox(mailboxId: String) async throws {
        if useMockData {
            try? await Task.sleep(nanoseconds: 800_000_000)
            return
        }
        try await action("emailActions:syncMailboxNow", args: ["mailboxId": mailboxId], timeout: 120)
    }
    
    public func sendEmailReply(threadId: String, text: String) async throws {
        if useMockData {
            let newMsg = EmailMessage(
                id: "emsg_\(UUID().uuidString.prefix(6))",
                from: "Manager <manager@bookingbroom.com>",
                subject: "Re: Thread",
                textBody: text,
                htmlBody: "<p>\(text)</p>",
                sentAt: Date(),
                direction: "out",
                plainText: text
            )
            if MockDataService.shared.sampleEmailMessages[threadId] != nil {
                MockDataService.shared.sampleEmailMessages[threadId]?.append(newMsg)
            } else {
                MockDataService.shared.sampleEmailMessages[threadId] = [newMsg]
            }
            return
        }
        try await action("emailActions:sendReply", args: ["threadId": threadId, "text": text], timeout: 60)
    }
    
    public func deleteEmailThread(threadId: String) async throws {
        if useMockData {
            MockDataService.shared.sampleEmailThreads.removeAll(where: { $0.id == threadId })
            MockDataService.shared.sampleEmailMessages.removeValue(forKey: threadId)
            return
        }
        try await action("emailActions:deleteThread", args: ["threadId": threadId], timeout: 60)
    }
    
    public func markEmailThreadRead(threadId: String) async throws {
        if useMockData {
            if let idx = MockDataService.shared.sampleEmailThreads.firstIndex(where: { $0.id == threadId }) {
                MockDataService.shared.sampleEmailThreads[idx].unreadCount = 0
            }
            return
        }
        try await mutation("email:markThreadReadLocal", args: ["threadId": threadId])
    }
    
    // MARK: - SEO Metrics (GSC & Bing)
    
    public func fetchSEOMetrics(source: String = "google", periodDays: Int = 28) async throws -> [SEOMetrics] {
        if useMockData { return MockDataService.shared.sampleSEOMetrics }
        
        let path = source == "google" ? "gsc:listMetrics" : "bing:listMetrics"
        let raw = listValue(try await query(path, args: ["periodDays": periodDays]))
        
        return raw.compactMap { item -> SEOMetrics? in
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
        let path = source == "google" ? "gscActions:syncNow" : "bingActions:syncNow"
        try await action(path, timeout: 180)
        return try await fetchSEOMetrics(source: source, periodDays: periodDays)
    }
    
    // MARK: - Performance Metrics (PageSpeed Insights)
    
    public func fetchPerformanceMetrics(strategy: String = "mobile") async throws -> [PerformanceMetrics] {
        if useMockData { return MockDataService.shared.samplePerformance }
        
        let raw = listValue(try await query("pagespeed:listMetrics", args: ["strategy": strategy]))
        return raw.compactMap { item -> PerformanceMetrics? in
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
    
    /// Runs PageSpeed audits for every site (`pagespeedActions:syncNow`), then re-reads metrics.
    public func runPageSpeedAudits(strategy: String = "mobile") async throws -> [PerformanceMetrics] {
        if useMockData {
            try? await Task.sleep(nanoseconds: 600_000_000)
            return MockDataService.shared.samplePerformance
        }
        try await action("pagespeedActions:syncNow", timeout: 300)
        return try await fetchPerformanceMetrics(strategy: strategy)
    }
    
    // MARK: - Cloudflare Workers Builds (Deployments)
    
    public func fetchDeployments() async throws -> [DeploymentRow] {
        if useMockData { return MockDataService.shared.sampleDeployments }
        let raw = listValue(try await query("deployments:listStatus"))
        return raw.compactMap { Self.parseDeploymentRow($0) }
    }
    
    public func syncDeployments() async throws -> [DeploymentRow] {
        if useMockData {
            try? await Task.sleep(nanoseconds: 600_000_000)
            return MockDataService.shared.sampleDeployments
        }
        try await action("deploymentsActions:syncNow", timeout: 180)
        return try await fetchDeployments()
    }
    
    nonisolated private static func parseDeploymentRow(_ item: [String: Any]) -> DeploymentRow? {
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
        let raw = listValue(try await query("sms:listDids"))
        return raw.compactMap { d in
            guard let did = d["did"] as? String else { return nil }
            return [
                "did": did,
                "description": d["description"] as? String ?? "",
                "sub_account": d["sub_account"] as? String ?? "",
                "formatted": d["formatted"] as? String ?? did,
                "site_id": d["site_id"] as? String ?? ""
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
        
        let raw = listValue(try await query("sms:listThreads"))
        return await Task.detached(priority: .userInitiated) {
            raw.compactMap { item -> ChatThread? in
                guard let did = item["did"] as? String,
                      let contact = item["contact"] as? String,
                      let lastBody = item["last_body"] as? String else { return nil }
                let contactFormatted = item["contact_formatted"] as? String ?? contact
                let direction: MessageDirection = (item["last_direction"] as? String ?? "in") == "out" ? .out : .in
                let type: MessageType = (item["last_type"] as? String ?? "sms") == "mms" ? .mms : .sms
                let sentAt = (item["last_sent_at"] as? String).flatMap(ConvexAPIService.parseISO8601) ?? Date()
                let stableId = "\(did)_\(contact)_last"
                
                let lastMsg = SMSMessage(
                    id: stableId,
                    voipmsId: stableId,
                    did: did,
                    contact: contact,
                    direction: direction,
                    type: type,
                    body: lastBody,
                    sentAt: sentAt
                )
                let label = item["label"] as? String
                return ChatThread(
                    did: did,
                    contact: contact,
                    contactName: (label?.isEmpty == false) ? label : contactFormatted,
                    lastMessage: lastMsg,
                    unreadCount: 0,
                    messages: [lastMsg]
                )
            }
        }.value
    }
    
    public func fetchSMSMessages(did: String, contact: String) async throws -> [SMSMessage] {
        if useMockData {
            return MockDataService.shared.sampleMessages
                .filter { $0.did == did && $0.contact == contact }
                .sorted { $0.sentAt < $1.sentAt }
        }
        
        let raw = listValue(try await query("sms:listMessages", args: ["did": did, "contact": contact]))
        return await Task.detached(priority: .userInitiated) {
            raw.compactMap { item -> SMSMessage? in
                guard let id = item["id"] as? String,
                      let bodyText = item["body"] as? String else { return nil }
                let dirStr = (item["direction"] as? String ?? "in").lowercased()
                let direction: MessageDirection = (dirStr == "out" || dirStr == "outbound") ? .out : .in
                let typeStr = (item["type"] as? String ?? "sms").lowercased()
                let sentAt = (item["sent_at"] as? String).flatMap(ConvexAPIService.parseISO8601) ?? Date()
                return SMSMessage(
                    id: id,
                    voipmsId: item["voipms_id"] as? String ?? id,
                    did: item["did"] as? String ?? did,
                    contact: item["contact"] as? String ?? contact,
                    direction: direction,
                    type: typeStr == "mms" ? .mms : .sms,
                    body: bodyText,
                    mediaUrls: item["media_urls"] as? [String],
                    sentAt: sentAt,
                    status: item["status"] as? String
                )
            }
        }.value
    }
    
    public func sendSMS(did: String, contact: String, message: String) async throws {
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
            return
        }
        try await action("voipmsActions:sendMessage", args: ["did": did, "contact": contact, "message": message], timeout: 60)
    }
    
    public func syncVoipmsNow() async throws {
        if useMockData {
            try? await Task.sleep(nanoseconds: 800_000_000)
            return
        }
        try await action("voipmsActions:syncMessagesNow", timeout: 120)
    }
    
    public func deleteSMSConversation(did: String, contact: String) async throws {
        if useMockData {
            MockDataService.shared.sampleMessages.removeAll(where: { $0.did == did && $0.contact == contact })
            return
        }
        try await mutation("sms:deleteConversation", args: ["did": did, "contact": contact])
    }
    
    // MARK: - Site Health & Pricing Ops
    
    public func fetchSiteHealth() async throws -> [SiteHealthRow] {
        if useMockData { return MockDataService.shared.sampleSiteHealth }
        let raw = listValue(try await query("siteHealth:listStatus"))
        return raw.compactMap { row in
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
    
    public func checkSiteHealthNow() async throws {
        if useMockData {
            try? await Task.sleep(nanoseconds: 800_000_000)
            return
        }
        try await action("siteHealthActions:checkNow", timeout: 120)
    }
    
    public func fetchSitePricing() async throws -> [SitePricingRow] {
        if useMockData { return MockDataService.shared.sampleSitePricing }
        let raw = listValue(try await query("pricing:list"))
        return Self.mapPricingRows(raw)
    }
    
    public func comparePricingScenario(_ scenario: PricingScenario) async throws -> [SitePricingRow] {
        if useMockData {
            try? await Task.sleep(nanoseconds: 200_000_000)
            return MockDataService.shared.sampleSitePricing
        }
        let raw = listValue(try await query("pricing:compareScenario", args: scenario.convexArgs))
        return Self.mapPricingRows(raw)
    }
    
    nonisolated public static func mapPricingRows(_ rawList: [[String: Any]]) -> [SitePricingRow] {
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
    
    nonisolated public static func addonCatalog(from rows: [SitePricingRow]) -> [PricingAddonOption] {
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
    
    public func updateSitePricing(siteId: String, configJSON: Data, summary: String) async throws {
        if useMockData {
            try? await Task.sleep(nanoseconds: 400_000_000)
            return
        }
        guard let configObj = try? JSONSerialization.jsonObject(with: configJSON) else {
            throw ConvexError.server("Pricing config is not valid JSON.")
        }
        try await mutation("pricing:updateConfig", args: [
            "siteId": siteId,
            "config": configObj,
            "summary": summary
        ])
    }
    
    // MARK: - APNs push tokens (BookingBroomSwift)
    
    public func saveApnsPushToken(token: String, platform: String, environment: String) async -> Bool {
        if useMockData { return true }
        guard authToken != nil else { return false }
        do {
            try await mutation("push:saveApnsPushToken", args: [
                "token": token,
                "platform": platform,
                "environment": environment,
            ])
            return true
        } catch {
            return false
        }
    }
    
    public func removeApnsPushToken(token: String) async -> Bool {
        if useMockData { return true }
        guard authToken != nil else { return false }
        do {
            try await mutation("push:removeApnsPushToken", args: ["token": token])
            return true
        } catch {
            return false
        }
    }
}

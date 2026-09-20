import Foundation

public struct DeploymentRow: Identifiable, Codable, Hashable {
    public var id: String { slug }
    public var kind: String // "app" | "site"
    public var slug: String
    public var name: String
    public var domain: String?
    public var workerName: String?
    public var accountId: String?
    public var status: String?
    public var buildOutcome: String?
    public var branch: String?
    public var commitHash: String?
    public var commitMessage: String?
    public var author: String?
    public var createdOn: String?
    public var stoppedOn: String?
    public var dashboardUrl: String?
    public var requestsToday: Int?
    public var requestsLimit: Int
    public var requestsRemaining: Int?
    public var buildMinutesLimitReached: Bool?
    public var buildMinutesRefreshOn: String?
    public var error: String?
    public var checkedAt: String?

    public init(
        kind: String,
        slug: String,
        name: String,
        domain: String? = nil,
        workerName: String? = nil,
        accountId: String? = nil,
        status: String? = nil,
        buildOutcome: String? = nil,
        branch: String? = nil,
        commitHash: String? = nil,
        commitMessage: String? = nil,
        author: String? = nil,
        createdOn: String? = nil,
        stoppedOn: String? = nil,
        dashboardUrl: String? = nil,
        requestsToday: Int? = nil,
        requestsLimit: Int = 100_000,
        requestsRemaining: Int? = nil,
        buildMinutesLimitReached: Bool? = nil,
        buildMinutesRefreshOn: String? = nil,
        error: String? = nil,
        checkedAt: String? = nil
    ) {
        self.kind = kind
        self.slug = slug
        self.name = name
        self.domain = domain
        self.workerName = workerName
        self.accountId = accountId
        self.status = status
        self.buildOutcome = buildOutcome
        self.branch = branch
        self.commitHash = commitHash
        self.commitMessage = commitMessage
        self.author = author
        self.createdOn = createdOn
        self.stoppedOn = stoppedOn
        self.dashboardUrl = dashboardUrl
        self.requestsToday = requestsToday
        self.requestsLimit = requestsLimit
        self.requestsRemaining = requestsRemaining
        self.buildMinutesLimitReached = buildMinutesLimitReached
        self.buildMinutesRefreshOn = buildMinutesRefreshOn
        self.error = error
        self.checkedAt = checkedAt
    }

    public var statusLabel: String {
        if workerName == nil { return "Not on Cloudflare" }
        if let error, !error.isEmpty, status == nil { return "Error" }
        let s = (status ?? "").lowercased()
        if s == "queued" || s == "initializing" || s == "running" {
            return s == "running" ? "Building" : s.capitalized
        }
        switch (buildOutcome ?? "").lowercased() {
        case "success": return "Success"
        case "fail": return "Failed"
        case "cancelled": return "Cancelled"
        case "terminated": return "Terminated"
        case "skipped": return "Skipped"
        default: return status?.capitalized ?? "Not synced"
        }
    }

    public var isSuccess: Bool { (buildOutcome ?? "").lowercased() == "success" }
    public var isFailed: Bool {
        ["fail", "cancelled", "terminated"].contains((buildOutcome ?? "").lowercased())
    }
    public var isBuilding: Bool {
        ["queued", "initializing", "running"].contains((status ?? "").lowercased())
    }

    public var shortSha: String? {
        guard let hash = commitHash, !hash.isEmpty else { return nil }
        return String(hash.prefix(7))
    }

    public var usagePercent: Int? {
        guard let used = requestsToday, requestsLimit > 0 else { return nil }
        return min(100, Int((Double(used) / Double(requestsLimit)) * 100))
    }
}

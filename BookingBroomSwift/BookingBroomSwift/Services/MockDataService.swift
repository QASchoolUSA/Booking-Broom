import Foundation

public final class MockDataService {
    public static let shared = MockDataService()
    
    private init() {}
    
    public var sampleSites: [CleaningSite] = [
        CleaningSite(id: "s1", slug: "sanford", name: "Sanford Cleaning", domain: "sanfordcleaning.com", accentHex: "#0284C7", contactEmail: "info@sanfordcleaning.com", phoneNumber: "+1 (407) 555-0101"),
        CleaningSite(id: "s2", slug: "deltona", name: "Deltona Cleaning", domain: "deltonacleaning.com", accentHex: "#10B981", contactEmail: "info@deltonacleaning.com", phoneNumber: "+1 (386) 555-0102"),
        CleaningSite(id: "s3", slug: "haines-city", name: "Haines City Cleaning", domain: "hainescitycleaning.com", accentHex: "#F59E0B", contactEmail: "contact@hainescitycleaning.com", phoneNumber: "+1 (863) 555-0103"),
        CleaningSite(id: "s4", slug: "celebration", name: "Celebration Cleaning", domain: "celebrationcleaning.com", accentHex: "#8B5CF6", contactEmail: "info@celebrationcleaning.com", phoneNumber: "+1 (407) 555-0104"),
        CleaningSite(id: "s5", slug: "winter-haven", name: "Cleaning Winter Haven", domain: "cleaningwinterhaven.com", accentHex: "#EC4899", contactEmail: "info@cleaningwinterhaven.com", phoneNumber: "+1 (863) 555-0105"),
        CleaningSite(id: "s6", slug: "cleaning-weekly", name: "Cleaning Weekly", domain: "cleaningweekly.com", accentHex: "#06B6D4", contactEmail: "info@cleaningweekly.com", phoneNumber: "+1 (407) 555-0106"),
        CleaningSite(id: "s7", slug: "davenport", name: "Cleaning Davenport", domain: "cleaningdavenport.com", accentHex: "#3B82F6", contactEmail: "info@cleaningdavenport.com", phoneNumber: "+1 (863) 555-0107"),
        CleaningSite(id: "s8", slug: "apopka", name: "Apopka Cleaning", domain: "apopkacleaning.com", accentHex: "#14B8A6", contactEmail: "hello@apopkacleaning.com", phoneNumber: "+1 (407) 555-0108"),
        CleaningSite(id: "s9", slug: "kissimmee", name: "Cleaning Kissimmee", domain: "cleaningkissimmee.com", accentHex: "#6366F1", contactEmail: "hello@cleaningkissimmee.com", phoneNumber: "+1 (407) 555-0109"),
        CleaningSite(id: "s10", slug: "windermere", name: "Windermere Cleaning", domain: "windermerecleaning.com", accentHex: "#D97706", contactEmail: "hello@windermerecleaning.com", phoneNumber: "+1 (407) 555-0110"),
        CleaningSite(id: "s11", slug: "boca-raton", name: "Cleaning Boca Raton", domain: "cleaningbocaraton.com", accentHex: "#059669", contactEmail: "hello@cleaningbocaraton.com", phoneNumber: "+1 (561) 555-0111"),
        CleaningSite(id: "s12", slug: "sanford-nc", name: "Cleaning Sanford NC", domain: "cleaningsanford.com", accentHex: "#7C3AED", contactEmail: "info@cleaningsanford.com", phoneNumber: "+1 (919) 555-0112")
    ]
    
    public var sampleBookings: [Booking] = [
        Booking(
            id: "b1",
            siteId: "s1",
            siteSlug: "sanford",
            siteName: "Sanford Cleaning",
            status: .new,
            customerName: "Jane Doe",
            email: "jane.doe@example.com",
            phone: "+1 (407) 555-0199",
            address: "123 Historic 1st St, Sanford, FL 32771",
            serviceType: "Deep Clean",
            preferredDate: "2026-09-02",
            preferredTime: "Morning (8AM - 12PM)",
            scheduledStartAt: Date().addingTimeInterval(3600 * 24 * 2),
            scheduledEndAt: Date().addingTimeInterval(3600 * 27 * 2),
            scheduledStartAtMs: (Date().addingTimeInterval(3600 * 24 * 2).timeIntervalSince1970 * 1000),
            scheduledEndAtMs: (Date().addingTimeInterval(3600 * 27 * 2).timeIntervalSince1970 * 1000),
            timezone: "America/New_York",
            notes: "2 bed, 2 bath house. Has one friendly Golden Retriever.",
            internalNotes: "Customer requested eco-friendly supplies only.",
            property: PropertyDetails(
                bedrooms: 2,
                bathrooms: 2,
                squareFeet: 1450,
                sizeLabel: "Medium Home",
                homeType: "Single Family",
                condition: "Standard",
                occupants: 2,
                lastCleaned: "1 month ago",
                excludedAreas: ["Garage", "Attic"]
            ),
            quote: BookingQuote(
                estimate: 240.0,
                estimateLow: 220.0,
                estimateHigh: 260.0,
                recurringEstimate: 160.0,
                serviceLevel: "Deep Clean",
                frequency: "Bi-Weekly",
                addOns: [
                    QuoteAddOn(label: "Inside Oven Clean", price: 35.0, quantity: 1),
                    QuoteAddOn(label: "Inside Refrigerator", price: 35.0, quantity: 1)
                ]
            ),
            createdAt: Date().addingTimeInterval(-3600 * 2),
            latitude: 28.8029,
            longitude: -81.2695
        ),
        Booking(
            id: "b2",
            siteId: "s4",
            siteSlug: "celebration",
            siteName: "Celebration Cleaning",
            status: .confirmed,
            customerName: "Robert Smith",
            email: "r.smith@example.com",
            phone: "+1 (407) 555-0188",
            address: "742 Celebration Ave, Celebration, FL 34747",
            serviceType: "Move-Out Clean",
            preferredDate: "2026-09-03",
            preferredTime: "Afternoon (12PM - 4PM)",
            scheduledStartAt: Date().addingTimeInterval(3600 * 24),
            scheduledEndAt: Date().addingTimeInterval(3600 * 28),
            scheduledStartAtMs: (Date().addingTimeInterval(3600 * 24).timeIntervalSince1970 * 1000),
            scheduledEndAtMs: (Date().addingTimeInterval(3600 * 28).timeIntervalSince1970 * 1000),
            timezone: "America/New_York",
            notes: "Vacant home. Key under front mat.",
            internalNotes: "Need heavy degreaser for kitchen.",
            property: PropertyDetails(
                bedrooms: 4,
                bathrooms: 3,
                squareFeet: 2800,
                sizeLabel: "Large Estate",
                homeType: "Estate",
                condition: "Heavy",
                occupants: 0,
                excludedAreas: ["Pool Shed"]
            ),
            quote: BookingQuote(
                estimate: 420.0,
                estimateLow: 390.0,
                estimateHigh: 450.0,
                serviceLevel: "Move Out",
                addOns: [
                    QuoteAddOn(label: "Baseboard Hand Wash", price: 50.0, quantity: 1),
                    QuoteAddOn(label: "Interior Windows", price: 45.0, quantity: 1)
                ]
            ),
            createdAt: Date().addingTimeInterval(-3600 * 12),
            latitude: 28.3183,
            longitude: -81.5415
        ),
        Booking(
            id: "b3",
            siteId: "s3",
            siteSlug: "haines-city",
            siteName: "Haines City Cleaning",
            status: .assigned,
            customerName: "Maria Garcia",
            email: "mgarcia@example.com",
            phone: "+1 (863) 555-0144",
            address: "1098 Southern Dunes Blvd, Haines City, FL 33844",
            serviceType: "Bi-Weekly Standard",
            preferredDate: "2026-09-01",
            preferredTime: "Morning",
            scheduledStartAt: Date().addingTimeInterval(3600 * 5),
            scheduledEndAt: Date().addingTimeInterval(3600 * 8),
            scheduledStartAtMs: (Date().addingTimeInterval(3600 * 5).timeIntervalSince1970 * 1000),
            scheduledEndAtMs: (Date().addingTimeInterval(3600 * 8).timeIntervalSince1970 * 1000),
            timezone: "America/New_York",
            notes: "Recurring client. Clean kitchen and master bath thoroughly.",
            property: PropertyDetails(bedrooms: 3, bathrooms: 2, squareFeet: 1850),
            quote: BookingQuote(estimate: 175.0, recurringEstimate: 175.0, serviceLevel: "Standard", frequency: "Bi-Weekly"),
            createdAt: Date().addingTimeInterval(-3600 * 24 * 2),
            latitude: 28.1142,
            longitude: -81.6179
        ),
        Booking(
            id: "b4",
            siteId: "s10",
            siteSlug: "windermere",
            siteName: "Windermere Cleaning",
            status: .completed,
            customerName: "David Miller",
            email: "dmiller@luxuryflorida.com",
            phone: "+1 (407) 555-0177",
            address: "5100 Lake Butler Blvd, Windermere, FL 34786",
            serviceType: "Post-Construction Clean",
            preferredDate: "2026-08-28",
            notes: "Gated community. Code is 4920.",
            property: PropertyDetails(bedrooms: 5, bathrooms: 5, squareFeet: 4200),
            quote: BookingQuote(estimate: 650.0, serviceLevel: "Post-Construction"),
            createdAt: Date().addingTimeInterval(-3600 * 24 * 3),
            latitude: 28.4958,
            longitude: -81.5348
        ),
        Booking(
            id: "b5",
            siteId: "s11",
            siteSlug: "boca-raton",
            siteName: "Cleaning Boca Raton",
            status: .new,
            customerName: "Samantha Vance",
            email: "svance@example.com",
            phone: "+1 (561) 555-0123",
            address: "200 Ocean Dr, Boca Raton, FL 33432",
            serviceType: "Weekly Maintenance",
            preferredDate: "2026-09-04",
            notes: "Please call when 15 minutes away.",
            property: PropertyDetails(bedrooms: 3, bathrooms: 3, squareFeet: 2100),
            quote: BookingQuote(estimate: 210.0, recurringEstimate: 190.0, frequency: "Weekly"),
            createdAt: Date().addingTimeInterval(-3600 * 1),
            latitude: 26.3587,
            longitude: -80.0831
        )
    ]
    
    public var sampleArchivedBookings: [Booking] = [
        Booking(
            id: "b_arch_1",
            siteId: "s1",
            siteSlug: "sanford",
            siteName: "Sanford Cleaning",
            status: .cancelled,
            customerName: "Old Inactive Client",
            email: "old.client@example.com",
            phone: "+1 (407) 555-0999",
            address: "99 Old Pine Ln, Sanford, FL",
            serviceType: "One-Time Clean",
            archivedAt: Date().addingTimeInterval(-3600 * 24 * 10),
            createdAt: Date().addingTimeInterval(-3600 * 24 * 30)
        )
    ]
    
    public var sampleReminders: [ReminderItem] = [
        ReminderItem(
            id: "rem_1",
            title: "Call Jane Doe to confirm morning slot arrival",
            notes: "Gate code is not provided yet",
            dueAtMs: (Date().addingTimeInterval(3600 * 20).timeIntervalSince1970 * 1000),
            status: "pending",
            bookingId: "b1"
        ),
        ReminderItem(
            id: "rem_2",
            title: "Pick up specialty stone cleaner from warehouse",
            notes: "For Robert Smith Celebration estate job",
            dueAtMs: (Date().addingTimeInterval(3600 * 18).timeIntervalSince1970 * 1000),
            status: "pending",
            bookingId: "b2"
        )
    ]
    
    public var sampleMessages: [SMSMessage] = [
        SMSMessage(
            id: "m1",
            voipmsId: "v101",
            did: "+14075550101",
            contact: "+14075550199",
            direction: .in,
            type: .sms,
            body: "Hi! I submitted a quote request for a deep clean in Sanford on Wednesday. Do you have morning availability?",
            sentAt: Date().addingTimeInterval(-3600 * 2)
        ),
        SMSMessage(
            id: "m2",
            voipmsId: "v102",
            did: "+14075550101",
            contact: "+14075550199",
            direction: .out,
            type: .sms,
            body: "Hello Jane! Yes, we have an 8:30 AM slot open with our lead crew. Would that time work for you?",
            sentAt: Date().addingTimeInterval(-3600 * 1)
        ),
        SMSMessage(
            id: "m3",
            voipmsId: "v103",
            did: "+14075550101",
            contact: "+14075550199",
            direction: .in,
            type: .sms,
            body: "That works perfectly! Thank you so much.",
            sentAt: Date().addingTimeInterval(-1800)
        )
    ]
    
    public var sampleDids: [[String: String]] = [
        ["did": "+14075550101", "description": "Sanford Line", "sub_account": "sanford_main", "formatted": "+1 (407) 555-0101"],
        ["did": "+13865550102", "description": "Deltona Line", "sub_account": "deltona_main", "formatted": "+1 (386) 555-0102"],
        ["did": "+18635550103", "description": "Haines City Line", "sub_account": "haines_main", "formatted": "+1 (863) 555-0103"]
    ]
    
    // MARK: - Sample Emails
    
    public var sampleMailboxes: [EmailMailbox] = [
        EmailMailbox(id: "mb1", email: "info@sanfordcleaning.com", label: "Sanford Support", siteSlug: "sanford", siteName: "Sanford Cleaning", unreadCount: 2, totalThreads: 14),
        EmailMailbox(id: "mb2", email: "info@celebrationcleaning.com", label: "Celebration Inquiries", siteSlug: "celebration", siteName: "Celebration Cleaning", unreadCount: 1, totalThreads: 8),
        EmailMailbox(id: "mb3", email: "contact@hainescitycleaning.com", label: "Haines City", siteSlug: "haines-city", siteName: "Haines City Cleaning", unreadCount: 0, totalThreads: 5)
    ]
    
    public var sampleEmailThreads: [EmailThread] = [
        EmailThread(
            id: "ethread_1",
            mailboxId: "mb1",
            subject: "Quote Request for Sanford 3-Bedroom Home",
            participants: ["Jane Doe <jane.doe@example.com>"],
            lastSnippet: "Could you let me know if Monday morning works for a deep clean?",
            lastMessageAt: Date().addingTimeInterval(-3600 * 2),
            unreadCount: 1,
            siteName: "Sanford Cleaning"
        ),
        EmailThread(
            id: "ethread_2",
            mailboxId: "mb1",
            subject: "Invoice #1042 - Paid Confirmation",
            participants: ["Billing Team <billing@spacemail.com>"],
            lastSnippet: "Your payment of $240.00 has been processed successfully.",
            lastMessageAt: Date().addingTimeInterval(-3600 * 14),
            unreadCount: 0,
            siteName: "Sanford Cleaning"
        ),
        EmailThread(
            id: "ethread_3",
            mailboxId: "mb2",
            subject: "Move-out Cleaning Checklist & Estimate Inquiry",
            participants: ["Robert Smith <r.smith@example.com>"],
            lastSnippet: "Hi, I have a 4 bed home in Celebration and need a move out clean before Friday.",
            lastMessageAt: Date().addingTimeInterval(-3600 * 5),
            unreadCount: 1,
            siteName: "Celebration Cleaning"
        )
    ]
    
    public var sampleEmailMessages: [String: [EmailMessage]] = [
        "ethread_1": [
            EmailMessage(
                id: "emsg_1",
                from: "Jane Doe <jane.doe@example.com>",
                subject: "Quote Request for Sanford 3-Bedroom Home",
                textBody: "Hello,\n\nI saw your website and would love to get a deep clean scheduled for our Sanford home on Monday morning. We have 2 bedrooms and 2 bathrooms, plus a golden retriever.\n\nCould you send over the estimated pricing?\n\nBest,\nJane",
                htmlBody: "<p>Hello,</p><p>I saw your website and would love to get a deep clean scheduled for our <strong>Sanford</strong> home on Monday morning. We have 2 bedrooms and 2 bathrooms, plus a golden retriever.</p><p>Could you send over the estimated pricing?</p><p>Best,<br>Jane</p>",
                sentAt: Date().addingTimeInterval(-3600 * 4),
                direction: "in"
            ),
            EmailMessage(
                id: "emsg_2",
                from: "Sanford Cleaning <info@sanfordcleaning.com>",
                subject: "Re: Quote Request for Sanford 3-Bedroom Home",
                textBody: "Hi Jane,\n\nThank you for reaching out! Our deep clean for a 2-bed, 2-bath home is estimated at $240. We have an 8:30 AM arrival window open this Monday.\n\nLet us know if you would like to confirm!",
                htmlBody: "<p>Hi Jane,</p><p>Thank you for reaching out! Our deep clean for a 2-bed, 2-bath home is estimated at <strong>$240</strong>. We have an 8:30 AM arrival window open this Monday.</p><p>Let us know if you would like to confirm!</p>",
                sentAt: Date().addingTimeInterval(-3600 * 3),
                direction: "out"
            ),
            EmailMessage(
                id: "emsg_3",
                from: "Jane Doe <jane.doe@example.com>",
                subject: "Re: Quote Request for Sanford 3-Bedroom Home",
                textBody: "That sounds great! Please book us for 8:30 AM Monday. Attached is a photo of the layout.\n\nThanks!",
                htmlBody: "<p>That sounds great! Please book us for <strong>8:30 AM Monday</strong>. Attached is a photo of the layout.</p><p>Thanks!</p>",
                sentAt: Date().addingTimeInterval(-3600 * 2),
                direction: "in",
                attachments: [EmailAttachment(filename: "floorplan_sanford.pdf", size: 45000)]
            )
        ]
    ]
    
    // MARK: - Sample Site Health & Pricing
    
    public var sampleSiteHealth: [SiteHealthRow] = [
        SiteHealthRow(siteSlug: "sanford", siteName: "Sanford Cleaning", domain: "sanfordcleaning.com", hostingProvider: "Cloudflare Workers", emailConfigured: true, phoneNumber: "+1 (407) 555-0101", health: SiteHealthInfo(status: "online", httpStatus: 200, ipAddress: "104.21.48.12")),
        SiteHealthRow(siteSlug: "celebration", siteName: "Celebration Cleaning", domain: "celebrationcleaning.com", hostingProvider: "Cloudflare Workers", emailConfigured: true, phoneNumber: "+1 (407) 555-0104", health: SiteHealthInfo(status: "online", httpStatus: 200, ipAddress: "172.67.182.90")),
        SiteHealthRow(siteSlug: "deltona", siteName: "Deltona Cleaning", domain: "deltonacleaning.com", hostingProvider: "Cloudflare Workers", emailConfigured: true, phoneNumber: "+1 (386) 555-0102", health: SiteHealthInfo(status: "online", httpStatus: 200, ipAddress: "104.21.52.19")),
        SiteHealthRow(siteSlug: "haines-city", siteName: "Haines City Cleaning", domain: "hainescitycleaning.com", hostingProvider: "Cloudflare Workers", emailConfigured: false, phoneNumber: "+1 (863) 555-0103", health: SiteHealthInfo(status: "online", httpStatus: 200, ipAddress: "104.21.31.8"))
    ]
    
    public var sampleSitePricing: [SitePricingRow] = {
        func configData(_ dict: [String: Any]) -> Data? {
            try? JSONSerialization.data(withJSONObject: dict)
        }
        
        let sanfordConfig: [String: Any] = [
            "kind": "bedroom-band",
            "bathRate": 25.0,
            "bedroomBase": [
                ["bedrooms": 1, "price": 110.0],
                ["bedrooms": 2, "price": 140.0],
                ["bedrooms": 3, "price": 175.0]
            ],
            "addOns": [
                ["key": "oven", "label": "Oven", "price": 35.0],
                ["key": "fridge", "label": "Fridge", "price": 35.0]
            ]
        ]
        let celebrationConfig: [String: Any] = [
            "kind": "bedroom-band",
            "bathRate": 30.0,
            "bedroomBase": [
                ["bedrooms": 2, "price": 160.0],
                ["bedrooms": 4, "price": 280.0]
            ],
            "addOns": [
                ["key": "baseboards", "label": "Baseboard Wash", "price": 50.0]
            ]
        ]
        let hainesConfig: [String: Any] = [
            "kind": "service-base-mult",
            "serviceBaseCents": [
                ["key": "standard", "value": 14500],
                ["key": "deep", "value": 23000]
            ],
            "addonCents": [
                ["key": "oven", "label": "Oven", "cents": 3500]
            ]
        ]
        
        return [
            SitePricingRow(
                siteId: "mock_sanford",
                siteSlug: "sanford",
                siteName: "Sanford Cleaning",
                engine: "bedroom-band",
                version: 3,
                entries: [
                    PricingBasketEntry(name: "1 Bed / 1 Bath Standard", price: 130.0),
                    PricingBasketEntry(name: "2 Bed / 2 Bath Deep Clean", price: 240.0),
                    PricingBasketEntry(name: "3 Bed / 2 Bath Move Out", low: 290.0, high: 340.0),
                    PricingBasketEntry(name: "Oven Add-on", price: 35.0),
                    PricingBasketEntry(name: "Fridge Add-on", price: 35.0)
                ],
                configJSON: configData(sanfordConfig)
            ),
            SitePricingRow(
                siteId: "mock_celebration",
                siteSlug: "celebration",
                siteName: "Celebration Cleaning",
                engine: "bedroom-band",
                version: 2,
                entries: [
                    PricingBasketEntry(name: "2 Bed / 2 Bath Resort Clean", price: 180.0),
                    PricingBasketEntry(name: "4 Bed / 3 Bath Deep Clean", low: 380.0, high: 460.0),
                    PricingBasketEntry(name: "Move Out Clean", price: 420.0),
                    PricingBasketEntry(name: "Baseboard Wash Add-on", price: 50.0)
                ],
                configJSON: configData(celebrationConfig)
            ),
            SitePricingRow(
                siteId: "mock_haines",
                siteSlug: "haines-city",
                siteName: "Haines City Cleaning",
                engine: "service-base-mult",
                version: 1,
                entries: [
                    PricingBasketEntry(name: "2 Bed / 2 Bath Standard", price: 145.0),
                    PricingBasketEntry(name: "3 Bed / 2 Bath Deep Clean", price: 230.0)
                ],
                configJSON: configData(hainesConfig)
            )
        ]
    }()
    
    public var sampleSEOMetrics: [SEOMetrics] = [
        SEOMetrics(
            id: "seo1", siteId: "s1", siteSlug: "sanford", siteName: "Sanford Cleaning",
            clicks: 482, impressions: 12400, ctr: 3.89, position: 4.2,
            history: [
                SEOTrendPoint(date: "Aug 24", clicks: 52, impressions: 1400),
                SEOTrendPoint(date: "Aug 25", clicks: 64, impressions: 1650),
                SEOTrendPoint(date: "Aug 26", clicks: 58, impressions: 1500),
                SEOTrendPoint(date: "Aug 27", clicks: 79, impressions: 1900),
                SEOTrendPoint(date: "Aug 28", clicks: 83, impressions: 2100),
                SEOTrendPoint(date: "Aug 29", clicks: 71, impressions: 1850),
                SEOTrendPoint(date: "Aug 30", clicks: 75, impressions: 2000)
            ],
            topQueries: [
                SEOQuery(query: "house cleaning sanford fl", clicks: 142, impressions: 2800, ctr: 5.07, position: 2.1),
                SEOQuery(query: "maid service sanford", clicks: 98, impressions: 1950, ctr: 5.02, position: 3.4),
                SEOQuery(query: "deep clean sanford florida", clicks: 65, impressions: 1200, ctr: 5.41, position: 2.8)
            ]
        ),
        SEOMetrics(
            id: "seo2", siteId: "s4", siteSlug: "celebration", siteName: "Celebration Cleaning",
            clicks: 610, impressions: 16800, ctr: 3.63, position: 3.1,
            history: [
                SEOTrendPoint(date: "Aug 24", clicks: 70, impressions: 2100),
                SEOTrendPoint(date: "Aug 25", clicks: 82, impressions: 2300),
                SEOTrendPoint(date: "Aug 26", clicks: 91, impressions: 2500),
                SEOTrendPoint(date: "Aug 27", clicks: 88, impressions: 2400),
                SEOTrendPoint(date: "Aug 28", clicks: 95, impressions: 2600),
                SEOTrendPoint(date: "Aug 29", clicks: 89, impressions: 2450),
                SEOTrendPoint(date: "Aug 30", clicks: 95, impressions: 2450)
            ],
            topQueries: [
                SEOQuery(query: "cleaning company celebration fl", clicks: 210, impressions: 4200, ctr: 5.0, position: 1.8),
                SEOQuery(query: "move out cleaning celebration", clicks: 130, impressions: 3100, ctr: 4.19, position: 2.4)
            ]
        )
    ]
    
    public var samplePerformance: [PerformanceMetrics] = [
        PerformanceMetrics(id: "p1", siteId: "s1", siteSlug: "sanford", siteName: "Sanford Cleaning", performanceScore: 98, accessibilityScore: 100, bestPracticesScore: 96, seoScore: 100, agenticBrowsingScore: 92, lcpMs: 1200, cls: 0.01, inpMs: 45, fcpMs: 800, overallCategory: "FAST"),
        PerformanceMetrics(id: "p2", siteId: "s4", siteSlug: "celebration", siteName: "Celebration Cleaning", performanceScore: 94, accessibilityScore: 98, bestPracticesScore: 96, seoScore: 98, agenticBrowsingScore: 88, lcpMs: 1450, cls: 0.02, inpMs: 65, fcpMs: 950, overallCategory: "FAST"),
        PerformanceMetrics(id: "p3", siteId: "s3", siteSlug: "haines-city", siteName: "Haines City Cleaning", performanceScore: 91, accessibilityScore: 96, bestPracticesScore: 92, seoScore: 95, agenticBrowsingScore: 85, lcpMs: 1700, cls: 0.03, inpMs: 80, fcpMs: 1050, overallCategory: "FAST")
    ]
    
    public var sampleDeployments: [DeploymentRow] = [
        DeploymentRow(
            kind: "app",
            slug: "booking-broom",
            name: "Booking Broom",
            workerName: "booking-broom",
            status: "stopped",
            buildOutcome: "success",
            branch: "main",
            commitHash: "a1b2c3d",
            commitMessage: "Deploy dashboard updates",
            requestsToday: 12_400,
            requestsLimit: 100_000,
            requestsRemaining: 87_600,
            buildMinutesLimitReached: false
        ),
        DeploymentRow(
            kind: "site",
            slug: "sanford",
            name: "Sanford Cleaning",
            domain: "sanfordcleaning.com",
            workerName: "sanford-cleaning",
            status: "stopped",
            buildOutcome: "success",
            branch: "main",
            commitHash: "f9e8d7c",
            requestsToday: 41_200,
            requestsLimit: 100_000,
            requestsRemaining: 58_800,
            buildMinutesLimitReached: false
        )
    ]
}

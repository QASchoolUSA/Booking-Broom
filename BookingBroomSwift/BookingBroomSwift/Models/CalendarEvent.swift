import Foundation
import SwiftUI

public enum CalendarEventKind: String, Codable {
    case bookingScheduled = "booking_scheduled"
    case bookingTentative = "booking_tentative"
    case reminder = "reminder"
}

public struct CalendarEvent: Identifiable, Codable, Hashable {
    public var id: String
    public var kind: CalendarEventKind
    public var title: String
    public var subtitle: String?
    public var startAtMs: Double
    public var endAtMs: Double?
    public var color: String
    public var bookingId: String?
    public var siteName: String?
    public var allDay: Bool
    
    public init(
        id: String,
        kind: CalendarEventKind,
        title: String,
        subtitle: String? = nil,
        startAtMs: Double,
        endAtMs: Double? = nil,
        color: String = "#0284C7",
        bookingId: String? = nil,
        siteName: String? = nil,
        allDay: Bool = false
    ) {
        self.id = id
        self.kind = kind
        self.title = title
        self.subtitle = subtitle
        self.startAtMs = startAtMs
        self.endAtMs = endAtMs
        self.color = color
        self.bookingId = bookingId
        self.siteName = siteName
        self.allDay = allDay
    }
    
    public var startDate: Date {
        Date(timeIntervalSince1970: startAtMs / 1000.0)
    }
    
    public var endDate: Date? {
        guard let e = endAtMs else { return nil }
        return Date(timeIntervalSince1970: e / 1000.0)
    }
    
    public var eventColor: Color {
        if kind == .reminder {
            return AppColors.amber
        }
        return Color(hex: color) ?? AppColors.primary
    }
}

public struct ReminderItem: Identifiable, Codable, Hashable {
    public var id: String
    public var title: String
    public var notes: String?
    public var dueAtMs: Double
    public var status: String // "pending", "sent"
    public var offsetMinutes: Int?
    public var bookingId: String?
    public var allDay: Bool
    
    public init(
        id: String,
        title: String,
        notes: String? = nil,
        dueAtMs: Double,
        status: String = "pending",
        offsetMinutes: Int? = nil,
        bookingId: String? = nil,
        allDay: Bool = false
    ) {
        self.id = id
        self.title = title
        self.notes = notes
        self.dueAtMs = dueAtMs
        self.status = status
        self.offsetMinutes = offsetMinutes
        self.bookingId = bookingId
        self.allDay = allDay
    }
    
    public var dueDate: Date {
        Date(timeIntervalSince1970: dueAtMs / 1000.0)
    }
    
    public var isSent: Bool {
        status == "sent"
    }
}

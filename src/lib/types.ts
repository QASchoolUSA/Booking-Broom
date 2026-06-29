export type BookingStatus =
  | "new"
  | "confirmed"
  | "assigned"
  | "completed"
  | "cancelled";

export interface Site {
  id: string;
  slug: string;
  name: string;
  domain: string;
  accent_color: string;
  created_at: string;
}

export interface Booking {
  id: string;
  site_id: string;
  status: BookingStatus;
  customer_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  service_type: string;
  preferred_date: string | null;
  preferred_time: string | null;
  notes: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  site?: Site;
}

export interface BookingWithSite extends Booking {
  site: Site;
}

export interface CreateBookingPayload {
  site_slug: string;
  api_key: string;
  customer_name: string;
  email?: string;
  phone?: string;
  address?: string;
  service_type?: string;
  preferred_date?: string;
  preferred_time?: string;
  notes?: string;
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  new: "New",
  confirmed: "Confirmed",
  assigned: "Assigned",
  completed: "Completed",
  cancelled: "Cancelled",
};

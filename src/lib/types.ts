export type BookingStatus =
  | "new"
  | "confirmed"
  | "assigned"
  | "completed"
  | "cancelled";

export type HostingProvider = "vercel" | "cloudflare";

export type SeoPeriodDays = 1 | 2 | 7 | 28 | 90;

export interface Site {
  id: string;
  slug: string;
  name: string;
  domain: string;
  accent_color: string;
  contact_email: string | null;
  hosting_provider: HostingProvider | null;
  hosting_account_email: string | null;
  phone_number: string | null;
  email_configured: boolean;
  gsc_property_url: string | null;
  performance_url: string | null;
  created_at: string;
}

export type SiteHealthStatusValue = "online" | "offline";

export interface SiteHealthSyncState {
  id: string;
  last_sync_at: string | null;
  last_sync_error: string | null;
}

export interface SiteHealthStatus {
  id: string;
  site_id: string;
  status: SiteHealthStatusValue;
  checked_url: string;
  http_status: number | null;
  error: string | null;
  checked_at: string;
}

export interface SiteOpsRow {
  site: {
    id: string;
    slug: string;
    name: string;
    domain: string;
    accent_color: string;
    contact_email: string | null;
    hosting_provider: HostingProvider | null;
    hosting_account_email: string | null;
    phone_number: string | null;
    email_configured: boolean;
  };
  health: SiteHealthStatus | null;
}

export type PagespeedStrategy = "mobile" | "desktop";

export interface PagespeedSyncState {
  id: string;
  last_sync_at: string | null;
  last_sync_error: string | null;
}

export interface SitePerformanceMetrics {
  id: string;
  site_id: string;
  strategy: PagespeedStrategy;
  url: string;
  performance_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  seo_score: number | null;
  /** Agentic Browsing category as 0–100 (from Lighthouse fraction). */
  agentic_browsing_score: number | null;
  agentic_browsing_passed: number | null;
  agentic_browsing_total: number | null;
  lcp_ms: number | null;
  cls: number | null;
  inp_ms: number | null;
  fcp_ms: number | null;
  overall_category: string | null;
  error: string | null;
  synced_at: string;
}

export interface SitePerformanceRow {
  site: {
    id: string;
    slug: string;
    name: string;
    domain: string;
    accent_color: string;
    performance_url: string | null;
  };
  metrics: SitePerformanceMetrics | null;
}

export interface GscConnection {
  id: string;
  google_email: string;
  connected_at: string;
  last_sync_at: string | null;
  last_sync_error: string | null;
}

export interface BingSyncState {
  id: string;
  last_sync_at: string | null;
  last_sync_error: string | null;
}

export type SeoSource = "google" | "bing";

export type SeoPropertyStatus =
  | "matched"
  | "not_in_console"
  | "unconfigured";

export interface SiteSearchMetrics {
  id: string;
  site_id: string;
  period_days: SeoPeriodDays;
  gsc_property_url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  start_date: string;
  end_date: string;
  synced_at: string;
}

export interface SeoMetricDelta {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  compared_to: string;
}

export interface SeoPageScanCheck {
  id: string;
  label: string;
  pass: boolean;
  detail?: string;
}

export interface SeoPageScan {
  scanned_url: string;
  score: number;
  passed: number;
  total: number;
  checks: SeoPageScanCheck[];
  error: string | null;
  scanned_at: string;
}

export interface SeoCrawlIssues {
  issue_count: number;
  issues: {
    url: string;
    httpCode: number;
    issues: number;
    inLinks: number;
  }[];
  synced_at: string;
}

export interface SiteSeoRow {
  site: {
    id: string;
    slug: string;
    name: string;
    domain: string;
    accent_color: string;
    gsc_property_url: string | null;
    bing_property_url?: string | null;
  };
  property_status: SeoPropertyStatus;
  property_url: string | null;
  metrics: SiteSearchMetrics | null;
  delta: SeoMetricDelta | null;
  crawl_issues: SeoCrawlIssues | null;
  page_scan: SeoPageScan | null;
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

export interface SmsDid {
  id: string;
  did: string;
  description: string;
  sub_account: string | null;
  sms_enabled: boolean;
  site_id: string | null;
  formatted: string;
  last_synced_at: string;
}

export interface SmsThread {
  did: string;
  did_description: string;
  did_formatted: string;
  sub_account: string | null;
  contact: string;
  contact_formatted: string;
  /** CRM short title for this conversation. */
  label: string | null;
  /** Free-text note for context when revisiting. */
  note: string | null;
  last_body: string;
  last_sent_at: string;
  last_direction: "in" | "out";
  last_type: "sms" | "mms";
  has_media: boolean;
}

export interface SmsMessage {
  id: string;
  voipms_id: string;
  did: string;
  contact: string;
  contact_formatted: string;
  direction: "in" | "out";
  type: "sms" | "mms";
  body: string;
  media_urls: string[];
  sent_at: string;
  status: string | null;
}

export interface SmsSyncState {
  id: string;
  last_sync_at: string | null;
  last_sync_error: string | null;
  last_did_sync_at: string | null;
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  new: "New",
  confirmed: "Confirmed",
  assigned: "Assigned",
  completed: "Completed",
  cancelled: "Cancelled",
};

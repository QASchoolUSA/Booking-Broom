/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authCleanup from "../authCleanup.js";
import type * as bing from "../bing.js";
import type * as bingActions from "../bingActions.js";
import type * as bookings from "../bookings.js";
import type * as calendar from "../calendar.js";
import type * as crons from "../crons.js";
import type * as email from "../email.js";
import type * as emailActions from "../emailActions.js";
import type * as gsc from "../gsc.js";
import type * as gscActions from "../gscActions.js";
import type * as http from "../http.js";
import type * as lib_apiKeys from "../lib/apiKeys.js";
import type * as lib_bookingEmailTemplates from "../lib/bookingEmailTemplates.js";
import type * as lib_bookingSmsTemplates from "../lib/bookingSmsTemplates.js";
import type * as lib_calendarTime from "../lib/calendarTime.js";
import type * as lib_emailSync from "../lib/emailSync.js";
import type * as lib_gscAggregate from "../lib/gscAggregate.js";
import type * as lib_gscDates from "../lib/gscDates.js";
import type * as lib_gscMatch from "../lib/gscMatch.js";
import type * as lib_phone from "../lib/phone.js";
import type * as lib_pricingConfigs from "../lib/pricingConfigs.js";
import type * as lib_pricingEngines from "../lib/pricingEngines.js";
import type * as lib_pricingSeed from "../lib/pricingSeed.js";
import type * as lib_spacemail from "../lib/spacemail.js";
import type * as lib_spacemailCrypto from "../lib/spacemailCrypto.js";
import type * as lib_voipms from "../lib/voipms.js";
import type * as pagespeed from "../pagespeed.js";
import type * as pagespeedActions from "../pagespeedActions.js";
import type * as pricing from "../pricing.js";
import type * as push from "../push.js";
import type * as pushActions from "../pushActions.js";
import type * as reminders from "../reminders.js";
import type * as seed from "../seed.js";
import type * as seoCleanup from "../seoCleanup.js";
import type * as seoScan from "../seoScan.js";
import type * as seoScanActions from "../seoScanActions.js";
import type * as siteHealth from "../siteHealth.js";
import type * as siteHealthActions from "../siteHealthActions.js";
import type * as sites from "../sites.js";
import type * as sms from "../sms.js";
import type * as smsRewrite from "../smsRewrite.js";
import type * as voipmsActions from "../voipmsActions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authCleanup: typeof authCleanup;
  bing: typeof bing;
  bingActions: typeof bingActions;
  bookings: typeof bookings;
  calendar: typeof calendar;
  crons: typeof crons;
  email: typeof email;
  emailActions: typeof emailActions;
  gsc: typeof gsc;
  gscActions: typeof gscActions;
  http: typeof http;
  "lib/apiKeys": typeof lib_apiKeys;
  "lib/bookingEmailTemplates": typeof lib_bookingEmailTemplates;
  "lib/bookingSmsTemplates": typeof lib_bookingSmsTemplates;
  "lib/calendarTime": typeof lib_calendarTime;
  "lib/emailSync": typeof lib_emailSync;
  "lib/gscAggregate": typeof lib_gscAggregate;
  "lib/gscDates": typeof lib_gscDates;
  "lib/gscMatch": typeof lib_gscMatch;
  "lib/phone": typeof lib_phone;
  "lib/pricingConfigs": typeof lib_pricingConfigs;
  "lib/pricingEngines": typeof lib_pricingEngines;
  "lib/pricingSeed": typeof lib_pricingSeed;
  "lib/spacemail": typeof lib_spacemail;
  "lib/spacemailCrypto": typeof lib_spacemailCrypto;
  "lib/voipms": typeof lib_voipms;
  pagespeed: typeof pagespeed;
  pagespeedActions: typeof pagespeedActions;
  pricing: typeof pricing;
  push: typeof push;
  pushActions: typeof pushActions;
  reminders: typeof reminders;
  seed: typeof seed;
  seoCleanup: typeof seoCleanup;
  seoScan: typeof seoScan;
  seoScanActions: typeof seoScanActions;
  siteHealth: typeof siteHealth;
  siteHealthActions: typeof siteHealthActions;
  sites: typeof sites;
  sms: typeof sms;
  smsRewrite: typeof smsRewrite;
  voipmsActions: typeof voipmsActions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

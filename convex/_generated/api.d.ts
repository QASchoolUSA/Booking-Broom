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
import type * as bing from "../bing.js";
import type * as bingActions from "../bingActions.js";
import type * as bookings from "../bookings.js";
import type * as crons from "../crons.js";
import type * as gsc from "../gsc.js";
import type * as gscActions from "../gscActions.js";
import type * as http from "../http.js";
import type * as lib_apiKeys from "../lib/apiKeys.js";
import type * as lib_gscMatch from "../lib/gscMatch.js";
import type * as lib_phone from "../lib/phone.js";
import type * as lib_voipms from "../lib/voipms.js";
import type * as pagespeed from "../pagespeed.js";
import type * as pagespeedActions from "../pagespeedActions.js";
import type * as seed from "../seed.js";
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
  bing: typeof bing;
  bingActions: typeof bingActions;
  bookings: typeof bookings;
  crons: typeof crons;
  gsc: typeof gsc;
  gscActions: typeof gscActions;
  http: typeof http;
  "lib/apiKeys": typeof lib_apiKeys;
  "lib/gscMatch": typeof lib_gscMatch;
  "lib/phone": typeof lib_phone;
  "lib/voipms": typeof lib_voipms;
  pagespeed: typeof pagespeed;
  pagespeedActions: typeof pagespeedActions;
  seed: typeof seed;
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

/**
 * Per-site contact emails used for booking notifications.
 * Keep in sync with `contactEmail` on SEED_SITES in convex/lib/apiKeys.ts.
 */
const SITE_EMAILS: Record<
  string,
  { name: string; email: string }
> = {
  sanford: {
    name: "Sanford Cleaning",
    email: "info@sanfordcleaning.com",
  },
  deltona: {
    name: "Deltona Cleaning",
    email: "info@deltonacleaning.com",
  },
  "haines-city": {
    name: "Haines City Cleaning",
    email: "info@hainescitycleaning.com",
  },
  celebration: {
    name: "Celebration Cleaning",
    email: "info@celebrationcleaning.com",
  },
  "winter-haven": {
    name: "Cleaning Winter Haven",
    email: "info@cleaningwinterhaven.com",
  },
  "cleaning-weekly": {
    name: "Cleaning Weekly",
    email: "info@cleaningweekly.com",
  },
  davenport: {
    name: "Cleaning Davenport",
    email: "info@cleaningdavenport.com",
  },
};

export function getAdminEmail(siteSlug: string): string | undefined {
  return SITE_EMAILS[siteSlug]?.email;
}

export function getSiteDisplayName(siteSlug: string): string {
  return SITE_EMAILS[siteSlug]?.name ?? siteSlug;
}

/** From header for the booking site, e.g. `Sanford Cleaning <info@sanfordcleaning.com>`. */
export function getSiteFromAddress(siteSlug: string): string | undefined {
  const site = SITE_EMAILS[siteSlug];
  if (!site) return undefined;
  return `${site.name} <${site.email}>`;
}

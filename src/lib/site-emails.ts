const ADMIN_EMAILS: Record<string, string> = {
  "winter-haven": "info@cleaningwinterhaven.com",
  "cleaning-weekly": "hello@cleaningweekly.com",
  celebration: "info@celebrationcleaning.com",
  sanford: "info@sanfordcleaning.com",
};

const SITE_DISPLAY_NAMES: Record<string, string> = {
  "winter-haven": "Cleaning Winter Haven",
  sanford: "Sanford Cleaning",
  deltona: "Deltona Cleaning",
  "haines-city": "Haines City Cleaning",
  celebration: "Celebration Cleaning",
  "cleaning-weekly": "Cleaning Weekly",
};

export function getAdminEmail(siteSlug: string): string | undefined {
  return ADMIN_EMAILS[siteSlug];
}

export function getSiteDisplayName(siteSlug: string): string {
  return SITE_DISPLAY_NAMES[siteSlug] ?? siteSlug;
}

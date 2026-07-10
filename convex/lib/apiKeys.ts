export function getDevApiKey(slug: string): string {
  return `bb_${slug}_dev_key`;
}

export const SEED_SITES = [
  {
    slug: "sanford",
    name: "Sanford Cleaning",
    domain: "sanfordcleaning.com",
    accentColor: "#0284C7",
    apiKeyHash:
      "2421ab88cd45273d60c96dc03521b771978f911fa726e9c74d7097f9b85f84ee",
  },
  {
    slug: "deltona",
    name: "Deltona Cleaning",
    domain: "deltonacleaning.com",
    accentColor: "#0EA5E9",
    apiKeyHash:
      "10956370194cabfd6ff2348db6c6968269bae4e5f71398e6f5e16b0e2255d5b3",
  },
  {
    slug: "haines-city",
    name: "Haines City Cleaning",
    domain: "hainescitycleaning.com",
    accentColor: "#059669",
    apiKeyHash:
      "8b6f8375ab3fa64f6fc9d54814fdf4c2fa356c888b804d6be35427b184654df6",
  },
  {
    slug: "celebration",
    name: "Celebration Cleaning",
    domain: "celebrationcleaning.com",
    accentColor: "#8B5CF6",
    apiKeyHash:
      "4f2728558fb253055faf99f958b57d940c8f096d1c81cff29411bb5ed1baf394",
  },
  {
    slug: "winter-haven",
    name: "Cleaning Winter Haven",
    domain: "cleaningwinterhaven.com",
    accentColor: "#0f766e",
    apiKeyHash:
      "8ef086466588e9db119b4f678c8dd4cbe4e0d6fbceec201b89d92f732e0efaf0",
  },
  {
    slug: "cleaning-weekly",
    name: "Cleaning Weekly",
    domain: "cleaningweekly.com",
    accentColor: "#0D9488",
    apiKeyHash:
      "556a60b2e73ab2f14408eca3cb5e7717260bab1f8385e89234c372b6a4aca335",
  },
] as const;

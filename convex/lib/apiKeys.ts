export function getDevApiKey(slug: string): string {
  return `bb_${slug}_dev_key`;
}

/** Booking Broom app Worker (not a cleaning site row). */
export const BOOKING_BROOM_WORKER = {
  workerName: "booking-broom",
  displayName: "Booking Broom",
  accentColor: "#0F766E",
} as const;

export const SEED_SITES = [
  {
    slug: "sanford",
    name: "Sanford Cleaning",
    domain: "sanfordcleaning.com",
    accentColor: "#0284C7",
    contactEmail: "info@sanfordcleaning.com",
    cloudflareWorkerName: "sanford-cleaning",
    cloudflareAccountId: "5c25eb28647814ac2579fac5b34d9945",
    apiKeyHash:
      "2421ab88cd45273d60c96dc03521b771978f911fa726e9c74d7097f9b85f84ee",
  },
  {
    slug: "deltona",
    name: "Deltona Cleaning",
    domain: "deltonacleaning.com",
    accentColor: "#0EA5E9",
    contactEmail: "info@deltonacleaning.com",
    cloudflareWorkerName: "deltona-cleaning",
    cloudflareAccountId: "42b3ca85f10c14a37d3708745d97d688",
    apiKeyHash:
      "10956370194cabfd6ff2348db6c6968269bae4e5f71398e6f5e16b0e2255d5b3",
  },
  {
    slug: "haines-city",
    name: "Haines City Cleaning",
    domain: "hainescitycleaning.com",
    accentColor: "#059669",
    contactEmail: "contact@hainescitycleaning.com",
    cloudflareWorkerName: "haines-city-cleaning",
    apiKeyHash:
      "8b6f8375ab3fa64f6fc9d54814fdf4c2fa356c888b804d6be35427b184654df6",
  },
  {
    slug: "celebration",
    name: "Celebration Cleaning",
    domain: "celebrationcleaning.com",
    accentColor: "#8B5CF6",
    contactEmail: "info@celebrationcleaning.com",
    // No wrangler Worker yet (likely still on Vercel).
    apiKeyHash:
      "4f2728558fb253055faf99f958b57d940c8f096d1c81cff29411bb5ed1baf394",
  },
  {
    slug: "winter-haven",
    name: "Cleaning Winter Haven",
    domain: "cleaningwinterhaven.com",
    accentColor: "#0f766e",
    contactEmail: "info@cleaningwinterhaven.com",
    cloudflareWorkerName: "cleaning-winter-haven",
    cloudflareAccountId: "34340f4ae6d96047462d26393180751c",
    apiKeyHash:
      "8ef086466588e9db119b4f678c8dd4cbe4e0d6fbceec201b89d92f732e0efaf0",
  },
  {
    slug: "cleaning-weekly",
    name: "Cleaning Weekly",
    domain: "cleaningweekly.com",
    accentColor: "#0D9488",
    contactEmail: "info@cleaningweekly.com",
    cloudflareWorkerName: "cleaning-weekly",
    cloudflareAccountId: "9199dbdb5993a741782b286cfd331aa4",
    // Rotated after the previous key was found committed in wrangler.jsonc.
    apiKeyHash:
      "486f2e0c73e2f0d53aa173700dbb97aacaa1bfc0af624e13bf26b85e7abf83c3",
  },
  {
    slug: "davenport",
    name: "Cleaning Davenport",
    domain: "cleaningdavenport.com",
    accentColor: "#0b6e6e",
    contactEmail: "info@cleaningdavenport.com",
    cloudflareWorkerName: "cleaning-davenport",
    cloudflareAccountId: "b24f531f700f8ae3501b0f705a8a0a59",
    apiKeyHash:
      "293de0ab407d09360e8acdb5a6390dee8a7f2bcb06b10446e8667fdf0798f20f",
  },
  {
    slug: "apopka",
    name: "Apopka Cleaning",
    domain: "apopkacleaning.com",
    accentColor: "#0a3d45",
    contactEmail: "hello@apopkacleaning.com",
    cloudflareWorkerName: "apopka-cleaning",
    cloudflareAccountId: "a9c4d9b5d8e4e88e55ec60500da45100",
    apiKeyHash:
      "33397a9979a1b4145c6cc34e16e816643f804be386f92e128241c387fe22271e",
  },
  {
    slug: "kissimmee",
    name: "Cleaning Kissimmee",
    domain: "cleaningkissimmee.com",
    accentColor: "#0f8a7d",
    contactEmail: "hello@cleaningkissimmee.com",
    phoneNumber: "(689) 288-3488",
    cloudflareWorkerName: "cleaning-kissimmee",
    cloudflareAccountId: "8ec9c8ce177293896fa3bda5db10f329",
    apiKeyHash:
      "2e48804d991b9f6dbc64e8433053285ac89357cb418b14b351f91b90e13098ef",
  },
  {
    slug: "windermere",
    name: "Windermere Cleaning",
    domain: "windermerecleaning.com",
    accentColor: "#0b1f2a",
    contactEmail: "hello@windermerecleaning.com",
    cloudflareWorkerName: "windermere-cleaning",
    cloudflareAccountId: "f64eb1b1651f58d15b72352ba5ca6570",
    apiKeyHash:
      "dcf4fdf3f91594880e14d460d0ab9029c7ccb90132dba61686efb62b27cd92de",
  },
  {
    slug: "boca-raton",
    name: "Cleaning Boca Raton",
    domain: "cleaningbocaraton.com",
    accentColor: "#0B3D4A",
    contactEmail: "hello@cleaningbocaraton.com",
    cloudflareWorkerName: "cleaning-boca-raton",
    cloudflareAccountId: "e6827802ecda4f18f39a21be062af72b",
    apiKeyHash:
      "e3f6a870828c648e9283b055dbbe80b58f966184a193c5359b3dad4aa438a688",
  },
  {
    slug: "sanford-nc",
    name: "Cleaning Sanford",
    domain: "cleaningsanford.com",
    accentColor: "#0F5C5B",
    contactEmail: "info@cleaningsanford.com",
    cloudflareWorkerName: "cleaning-sanford-nc",
    cloudflareAccountId: "1fa67e5419beba37761f4cf025fd7086",
    apiKeyHash:
      "0e7461f3f46600f13286a97bcc97c999b2501270892aee942a65567305491474",
  },
] as const;

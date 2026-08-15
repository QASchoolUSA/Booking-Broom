/**
 * Origins allowed to call the public API routes: the cleaning sites plus local
 * development. Shared by `/api/bookings` and `/api/pricing` so the list cannot
 * drift between them.
 */
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ??
    "http://localhost:3000,https://sanfordcleaning.com,https://deltonacleaning.com,https://hainescitycleaning.com,https://celebrationcleaning.com,https://cleaningwinterhaven.com,https://cleaningweekly.com,https://www.cleaningweekly.com,https://www.celebrationcleaning.com,https://www.sanfordcleaning.com,https://cleaningdavenport.com,https://www.cleaningdavenport.com,https://apopkacleaning.com,https://www.apopkacleaning.com,https://cleaningkissimmee.com,https://www.cleaningkissimmee.com,https://windermerecleaning.com,https://www.windermerecleaning.com,https://cleaningbocaraton.com,https://www.cleaningbocaraton.com,https://cleaningsanford.com,https://www.cleaningsanford.com"
)
  .split(",")
  .map((o) => o.trim());

export function corsHeaders(
  origin: string | null,
  methods = "POST, OPTIONS",
  extraHeaders = "Content-Type, Authorization"
) {
  const allowed =
    origin &&
    ALLOWED_ORIGINS.some(
      (o) => origin === o || origin.endsWith(o.replace("https://", "."))
    )
      ? origin
      : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": extraHeaders,
  };
}

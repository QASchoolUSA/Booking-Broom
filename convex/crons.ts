import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "sync Google Search Console metrics",
  { hourUTC: 6, minuteUTC: 0 },
  internal.gscActions.syncAllInternal
);

crons.daily(
  "prune Google Search Console metrics history",
  { hourUTC: 7, minuteUTC: 0 },
  internal.gsc.pruneHistory
);

/** PageSpeed runs are slower; weekly is enough for ops health checks. */
crons.weekly(
  "sync PageSpeed Insights metrics",
  { dayOfWeek: "monday", hourUTC: 7, minuteUTC: 0 },
  internal.pagespeedActions.syncAllInternal
);

/** HTTP + site-name check for each cleaning website. */
crons.interval(
  "check site health",
  { hours: 3 },
  internal.siteHealthActions.checkAllInternal
);

/** Safety net if a Voip.ms SMS webhook is missed. */
crons.interval(
  "sync Voip.ms SMS messages",
  { minutes: 15 },
  internal.voipmsActions.syncAllInternal
);

export default crons;

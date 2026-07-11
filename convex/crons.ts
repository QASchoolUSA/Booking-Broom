import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "sync Google Search Console metrics",
  { hourUTC: 6, minuteUTC: 0 },
  internal.gscActions.syncAllInternal
);

export default crons;

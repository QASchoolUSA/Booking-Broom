import { internalMutation } from "./_generated/server";

/**
 * Wipe stored GSC/Bing period snapshots so a fresh sync can refill
 * after period windows change. Keeps OAuth connection and Bing API state.
 */
export const wipeSearchMetrics = internalMutation({
  args: {},
  handler: async (ctx) => {
    const googleMetrics = await ctx.db.query("siteSearchMetrics").collect();
    for (const row of googleMetrics) await ctx.db.delete(row._id);

    const googleHistory = await ctx.db
      .query("siteSearchMetricsHistory")
      .collect();
    for (const row of googleHistory) await ctx.db.delete(row._id);

    const googleQueries = await ctx.db.query("siteSearchQueries").collect();
    for (const row of googleQueries) await ctx.db.delete(row._id);

    const bingMetrics = await ctx.db.query("siteBingSearchMetrics").collect();
    for (const row of bingMetrics) await ctx.db.delete(row._id);

    const bingHistory = await ctx.db
      .query("siteBingSearchMetricsHistory")
      .collect();
    for (const row of bingHistory) await ctx.db.delete(row._id);

    const bingQueries = await ctx.db.query("siteBingSearchQueries").collect();
    for (const row of bingQueries) await ctx.db.delete(row._id);

    return {
      googleMetrics: googleMetrics.length,
      googleHistory: googleHistory.length,
      googleQueries: googleQueries.length,
      bingMetrics: bingMetrics.length,
      bingHistory: bingHistory.length,
      bingQueries: bingQueries.length,
    };
  },
});

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const PAGE = 100;

/**
 * Delete expired Convex Auth sessions and their refresh tokens.
 * Convex Auth does not prune these; expired rows otherwise accumulate forever.
 */
export const pruneExpired = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const page = await ctx.db.query("authSessions").paginate({
      numItems: PAGE,
      cursor: args.cursor ?? null,
    });

    let deletedSessions = 0;
    let deletedTokens = 0;

    for (const session of page.page) {
      if (session.expirationTime >= now) continue;

      const tokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const token of tokens) {
        await ctx.db.delete(token._id);
        deletedTokens += 1;
      }
      await ctx.db.delete(session._id);
      deletedSessions += 1;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.authCleanup.pruneExpired, {
        cursor: page.continueCursor,
      });
    } else {
      await ctx.scheduler.runAfter(0, internal.authCleanup.pruneOrphanTokens, {
        cursor: null,
      });
    }

    return { deletedSessions, deletedTokens, done: page.isDone };
  },
});

/** Expired or session-less refresh tokens left after session deletes. */
export const pruneOrphanTokens = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const page = await ctx.db.query("authRefreshTokens").paginate({
      numItems: PAGE,
      cursor: args.cursor ?? null,
    });

    let deleted = 0;
    for (const token of page.page) {
      const session = await ctx.db.get(token.sessionId);
      if (session !== null && token.expirationTime >= now) continue;
      await ctx.db.delete(token._id);
      deleted += 1;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.authCleanup.pruneOrphanTokens, {
        cursor: page.continueCursor,
      });
    } else {
      await ctx.scheduler.runAfter(
        0,
        internal.authCleanup.pruneVerificationCodes,
        { cursor: null }
      );
    }

    return { deleted, done: page.isDone };
  },
});

export const pruneVerificationCodes = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const page = await ctx.db.query("authVerificationCodes").paginate({
      numItems: PAGE,
      cursor: args.cursor ?? null,
    });

    let deleted = 0;
    for (const code of page.page) {
      if (code.expirationTime >= now) continue;
      await ctx.db.delete(code._id);
      deleted += 1;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.authCleanup.pruneVerificationCodes,
        { cursor: page.continueCursor }
      );
    }

    return { deleted, done: page.isDone };
  },
});

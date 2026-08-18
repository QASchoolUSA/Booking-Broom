import {
  query,
  mutation,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

function mapReminder(doc: Doc<"reminders">) {
  return {
    id: doc._id,
    title: doc.title,
    notes: doc.notes ?? null,
    due_at: new Date(doc.dueAt).toISOString(),
    due_at_ms: doc.dueAt,
    all_day: doc.allDay ?? false,
    booking_id: doc.bookingId ?? null,
    offset_minutes: doc.offsetMinutes ?? null,
    status: doc.status,
    created_by: doc.createdBy,
    created_at: new Date(doc.createdAt).toISOString(),
    updated_at: new Date(doc.updatedAt).toISOString(),
  };
}

async function cancelScheduled(
  ctx: MutationCtx,
  scheduledFunctionId: Id<"_scheduled_functions"> | undefined
) {
  if (!scheduledFunctionId) return;
  try {
    await ctx.scheduler.cancel(scheduledFunctionId);
  } catch {
    // Already ran or cancelled — ignore.
  }
}

async function scheduleDispatch(
  ctx: MutationCtx,
  reminderId: Id<"reminders">,
  dueAt: number
): Promise<Id<"_scheduled_functions"> | undefined> {
  const now = Date.now();
  if (dueAt <= now) {
    // Fire immediately via runAfter(0).
    return await ctx.scheduler.runAfter(
      0,
      internal.reminders.dispatchInternal,
      { reminderId }
    );
  }
  return await ctx.scheduler.runAt(
    dueAt,
    internal.reminders.dispatchInternal,
    { reminderId }
  );
}

export const listByBooking = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const rows = await ctx.db
      .query("reminders")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .collect();

    return rows
      .filter((r) => r.status !== "cancelled")
      .sort((a, b) => a.dueAt - b.dueAt)
      .map(mapReminder);
  },
});

export const get = query({
  args: { reminderId: v.id("reminders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const doc = await ctx.db.get(args.reminderId);
    if (!doc || doc.status === "cancelled") return null;
    return mapReminder(doc);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    notes: v.optional(v.string()),
    dueAt: v.number(),
    allDay: v.optional(v.boolean()),
    bookingId: v.optional(v.id("bookings")),
    offsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const title = args.title.trim();
    if (!title) throw new Error("Title is required");
    if (!Number.isFinite(args.dueAt)) throw new Error("Invalid due time");

    if (args.bookingId) {
      const booking = await ctx.db.get(args.bookingId);
      if (!booking) throw new Error("Booking not found");
    }

    const now = Date.now();
    const reminderId = await ctx.db.insert("reminders", {
      title,
      notes: args.notes?.trim() || undefined,
      dueAt: args.dueAt,
      allDay: args.allDay,
      bookingId: args.bookingId,
      offsetMinutes: args.offsetMinutes,
      status: "pending",
      createdBy: identity.subject,
      createdAt: now,
      updatedAt: now,
    });

    const scheduledFunctionId = await scheduleDispatch(
      ctx,
      reminderId,
      args.dueAt
    );
    if (scheduledFunctionId) {
      await ctx.db.patch(reminderId, { scheduledFunctionId });
    }

    return { id: reminderId };
  },
});

export const update = mutation({
  args: {
    reminderId: v.id("reminders"),
    title: v.optional(v.string()),
    notes: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    allDay: v.optional(v.boolean()),
    bookingId: v.optional(v.union(v.id("bookings"), v.null())),
    offsetMinutes: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const doc = await ctx.db.get(args.reminderId);
    if (!doc) throw new Error("Reminder not found");
    if (doc.status === "cancelled") throw new Error("Reminder cancelled");

    const patch: Partial<Doc<"reminders">> = { updatedAt: Date.now() };
    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Title is required");
      patch.title = title;
    }
    if (args.notes !== undefined) {
      patch.notes = args.notes.trim() || undefined;
    }
    if (args.allDay !== undefined) patch.allDay = args.allDay;
    if (args.bookingId !== undefined) {
      patch.bookingId = args.bookingId === null ? undefined : args.bookingId;
    }
    if (args.offsetMinutes !== undefined) {
      patch.offsetMinutes =
        args.offsetMinutes === null ? undefined : args.offsetMinutes;
    }

    const dueAt = args.dueAt ?? doc.dueAt;
    if (args.dueAt !== undefined) {
      if (!Number.isFinite(args.dueAt)) throw new Error("Invalid due time");
      patch.dueAt = args.dueAt;
      // Reschedule: reset to pending if it was already sent.
      patch.status = "pending";
      await cancelScheduled(ctx, doc.scheduledFunctionId);
      const scheduledFunctionId = await scheduleDispatch(
        ctx,
        args.reminderId,
        dueAt
      );
      patch.scheduledFunctionId = scheduledFunctionId;
    }

    await ctx.db.patch(args.reminderId, patch);
    return { id: args.reminderId };
  },
});

export const remove = mutation({
  args: { reminderId: v.id("reminders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const doc = await ctx.db.get(args.reminderId);
    if (!doc) throw new Error("Reminder not found");

    await cancelScheduled(ctx, doc.scheduledFunctionId);
    await ctx.db.patch(args.reminderId, {
      status: "cancelled",
      scheduledFunctionId: undefined,
      updatedAt: Date.now(),
    });
  },
});

/** Reschedule relative reminders when a booking's start time changes. */
export const rescheduleRelativeForBookingInternal = internalMutation({
  args: {
    bookingId: v.id("bookings"),
    scheduledStartAt: v.number(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("reminders")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .collect();

    for (const row of rows) {
      if (row.status === "cancelled") continue;
      if (row.offsetMinutes == null) continue;

      const dueAt = args.scheduledStartAt - row.offsetMinutes * 60 * 1000;
      await cancelScheduled(ctx, row.scheduledFunctionId);
      const scheduledFunctionId = await scheduleDispatch(ctx, row._id, dueAt);
      await ctx.db.patch(row._id, {
        dueAt,
        status: "pending",
        scheduledFunctionId,
        updatedAt: Date.now(),
      });
    }
  },
});

/** Cancel relative (offset-based) reminders for a booking. */
export const cancelRelativeForBookingInternal = internalMutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("reminders")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .collect();
    for (const row of rows) {
      if (row.offsetMinutes == null) continue;
      await cancelScheduled(ctx, row.scheduledFunctionId);
      if (row.status !== "cancelled") {
        await ctx.db.patch(row._id, {
          status: "cancelled",
          scheduledFunctionId: undefined,
          updatedAt: Date.now(),
        });
      }
    }
  },
});

/** Cancel all reminders for a booking (e.g. on hard delete). */
export const cancelForBookingInternal = internalMutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("reminders")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .collect();
    for (const row of rows) {
      await cancelScheduled(ctx, row.scheduledFunctionId);
      if (row.status !== "cancelled") {
        await ctx.db.patch(row._id, {
          status: "cancelled",
          scheduledFunctionId: undefined,
          updatedAt: Date.now(),
        });
      }
    }
  },
});

export const getInternal = internalQuery({
  args: { reminderId: v.id("reminders") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.reminderId);
  },
});

/** Mark reminder sent (idempotent). Returns whether we claimed the send. */
export const claimSentInternal = internalMutation({
  args: { reminderId: v.id("reminders") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.reminderId);
    if (!doc) return { claimed: false as const, reason: "missing" as const };
    if (doc.status !== "pending") {
      return { claimed: false as const, reason: "already" as const };
    }
    await ctx.db.patch(args.reminderId, {
      status: "sent",
      scheduledFunctionId: undefined,
      updatedAt: Date.now(),
    });
    return {
      claimed: true as const,
      title: doc.title,
      notes: doc.notes,
      bookingId: doc.bookingId,
      dueAt: doc.dueAt,
    };
  },
});

/**
 * Dispatch a due reminder: claim + push. Called by scheduler and safety cron.
 */
export const dispatchInternal = internalMutation({
  args: { reminderId: v.id("reminders") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.reminderId);
    if (!doc) return { dispatched: false };
    if (doc.status !== "pending") return { dispatched: false };

    await ctx.db.patch(args.reminderId, {
      status: "sent",
      scheduledFunctionId: undefined,
      updatedAt: Date.now(),
    });

    let siteSlug: string | undefined;
    let customerName: string | undefined;
    if (doc.bookingId) {
      const booking = await ctx.db.get(doc.bookingId);
      if (booking) {
        customerName = booking.customerName;
        const site = await ctx.db.get(booking.siteId);
        siteSlug = site?.slug;
      }
    }

    const url = doc.bookingId
      ? `/calendar?bookingId=${doc.bookingId}`
      : `/calendar?reminderId=${doc._id}`;
    const mobilePath = doc.bookingId
      ? `/bookings/${doc.bookingId}`
      : `/bookings?reminderId=${doc._id}`;

    await ctx.scheduler.runAfter(
      0,
      internal.pushActions.notifyReminderInternal,
      {
        title: doc.title,
        body: doc.notes?.trim() || customerName || "Reminder",
        url,
        mobilePath,
        tag: `reminder-${doc._id}`,
        bookingId: doc.bookingId,
        reminderId: doc._id,
        siteSlug,
      }
    );

    return { dispatched: true };
  },
});

/** Safety net: fire any pending reminders whose dueAt has passed. */
export const dispatchDueInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("reminders")
      .withIndex("by_status_due", (q) =>
        q.eq("status", "pending").lte("dueAt", now)
      )
      .take(50);

    let count = 0;
    for (const row of due) {
      await ctx.scheduler.runAfter(0, internal.reminders.dispatchInternal, {
        reminderId: row._id,
      });
      count += 1;
    }
    return { queued: count };
  },
});

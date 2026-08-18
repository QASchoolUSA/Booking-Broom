import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatGscDate,
  gscCalendarDayOffset,
  gscDateMinusMonths,
  GSC_TIMEZONE,
} from "./gscDates";
import { dateRangeForPeriod } from "./gscMatch";

describe("gscDates", () => {
  it("uses Pacific Time for calendar days", () => {
    // 2026-08-18 06:00 UTC = 2026-08-17 23:00 PT (still Aug 17 in LA)
    const now = new Date("2026-08-18T06:00:00.000Z");
    assert.equal(gscCalendarDayOffset(0, now), "2026-08-17");
    assert.equal(gscCalendarDayOffset(-1, now), "2026-08-16");
  });

  it("formats instants in PT", () => {
    const instant = new Date("2026-01-15T08:00:00.000Z");
    assert.equal(formatGscDate(instant), "2026-01-15");
    assert.equal(GSC_TIMEZONE, "America/Los_Angeles");
  });

  it("subtracts calendar months in PT", () => {
    assert.equal(gscDateMinusMonths("2026-08-17", 3), "2026-05-17");
  });
});

describe("dateRangeForPeriod (GSC, PT)", () => {
  const now = new Date("2026-08-18T06:00:00.000Z");

  it("24h fetch window covers three PT days for rolling hourly filter", () => {
    const range = dateRangeForPeriod(1, now);
    assert.equal(range.startDate, "2026-08-15");
    assert.equal(range.endDate, "2026-08-17");
  });

  it("7d window includes today PT with 7 inclusive days", () => {
    const range = dateRangeForPeriod(7, now);
    assert.equal(range.endDate, "2026-08-17");
    assert.equal(range.startDate, "2026-08-11");
  });

  it("28d window ends today PT", () => {
    const range = dateRangeForPeriod(28, now);
    assert.equal(range.endDate, "2026-08-17");
    assert.equal(range.startDate, "2026-07-21");
  });

  it("3 months uses calendar months ending today PT", () => {
    const range = dateRangeForPeriod(90, now);
    assert.equal(range.endDate, "2026-08-17");
    assert.equal(range.startDate, "2026-05-17");
  });
});

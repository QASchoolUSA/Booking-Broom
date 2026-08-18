import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateHourlyMetrics,
  aggregateQueryHourlyRows,
  selectLast24HourRows,
  type GscAnalyticsRow,
} from "./gscAggregate";

function hourRow(
  isoHour: string,
  clicks: number,
  impressions: number,
  position = 10
): GscAnalyticsRow {
  return {
    keys: [isoHour],
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position,
  };
}

function queryHourRow(
  query: string,
  isoHour: string,
  clicks: number,
  impressions: number,
  position = 10
): GscAnalyticsRow {
  return {
    keys: [query, isoHour],
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position,
  };
}

describe("gscAggregate", () => {
  it("selectLast24HourRows keeps the most recent 24 buckets", () => {
    const rows = Array.from({ length: 30 }, (_, i) => {
      const day = i < 18 ? "2026-08-16" : "2026-08-17";
      const hour = i < 18 ? 6 + i : i - 18;
      return hourRow(
        `${day}T${String(hour).padStart(2, "0")}:00:00-07:00`,
        1,
        10
      );
    });
    const last24 = selectLast24HourRows(rows);
    assert.equal(last24.length, 24);
    assert.equal(last24[0]?.keys?.[0], rows.at(-24)?.keys?.[0]);
    assert.equal(last24.at(-1)?.keys?.[0], rows.at(-1)?.keys?.[0]);
  });

  it("aggregateHourlyMetrics sums clicks/impressions with weighted position", () => {
    const rows = [
      hourRow("2026-08-17T10:00:00-07:00", 2, 100, 5),
      hourRow("2026-08-17T11:00:00-07:00", 3, 50, 15),
    ];
    const agg = aggregateHourlyMetrics(rows);
    assert.equal(agg.clicks, 5);
    assert.equal(agg.impressions, 150);
    assert.equal(agg.ctr, 5 / 150);
    assert.equal(agg.position, (5 * 100 + 15 * 50) / 150);
    assert.equal(agg.startDate, "2026-08-17");
    assert.equal(agg.endDate, "2026-08-17");
  });

  it("aggregateQueryHourlyRows uses the same 24h window as headline metrics", () => {
    const hours = Array.from({ length: 25 }, (_, i) => {
      const day = i < 5 ? "2026-08-16" : "2026-08-17";
      const hour = i < 5 ? 19 + i : i - 5;
      return `${day}T${String(hour).padStart(2, "0")}:00:00-07:00`;
    });
    const headlineRows = hours.map((h, i) => hourRow(h, i + 1, 10));
    const queryRows = [
      ...hours.map((h, i) =>
        queryHourRow("haines city cleaning", h, i + 1, 10)
      ),
      queryHourRow("old query", "2026-08-15T12:00:00-07:00", 99, 10),
    ];

    const headline = aggregateHourlyMetrics(headlineRows);
    const top = aggregateQueryHourlyRows(queryRows, 5);
    const queryTotal = top.find((q) => q.query === "haines city cleaning");

    assert.ok(queryTotal);
    assert.equal(queryTotal!.clicks, headline.clicks);
    assert.equal(queryTotal!.impressions, headline.impressions);
    assert.equal(top.some((q) => q.query === "old query"), false);
  });
});

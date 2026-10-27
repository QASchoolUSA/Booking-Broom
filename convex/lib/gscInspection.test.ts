import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  estimateIndexCoverageFromAnalytics,
  isIndexedVerdict,
  isIntentionalNoindexUrl,
  normalizePageUrl,
  parseSitemapLocs,
  summarizeIndexCoverage,
} from "./gscInspection";

describe("isIntentionalNoindexUrl", () => {
  it("flags celebration city×service paths only", () => {
    assert.equal(
      isIntentionalNoindexUrl(
        "https://celebrationcleaning.com/cleaning-services/orlando/deep-cleaning",
        "celebration"
      ),
      true
    );
    assert.equal(
      isIntentionalNoindexUrl(
        "https://celebrationcleaning.com/cleaning-services/orlando",
        "celebration"
      ),
      false
    );
    assert.equal(
      isIntentionalNoindexUrl(
        "https://celebrationcleaning.com/guides/foo",
        "celebration"
      ),
      false
    );
    assert.equal(
      isIntentionalNoindexUrl(
        "https://apopkacleaning.com/cleaning-services/orlando/deep-cleaning",
        "apopka"
      ),
      false
    );
  });
});

describe("parseSitemapLocs", () => {
  it("extracts loc URLs from minified urlset", () => {
    const xml =
      '<?xml version="1.0"?><urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/about</loc></url></urlset>';
    assert.deepEqual(parseSitemapLocs(xml), [
      "https://example.com/",
      "https://example.com/about",
    ]);
  });
});

describe("isIndexedVerdict / summarizeIndexCoverage", () => {
  it("treats PASS as indexed", () => {
    assert.equal(isIndexedVerdict("PASS"), true);
    assert.equal(isIndexedVerdict("NEUTRAL"), false);
    assert.equal(isIndexedVerdict(undefined), false);
  });

  it("aggregates inspection results", () => {
    const summary = summarizeIndexCoverage([
      { ok: true, verdict: "PASS" },
      { ok: true, verdict: "PASS" },
      { ok: true, verdict: "FAIL" },
      { ok: false, verdict: "PASS" },
    ]);
    assert.equal(summary.inspectedCount, 4);
    assert.equal(summary.indexedCount, 2);
    assert.equal(summary.notIndexedCount, 2);
    assert.equal(summary.percentIndexed, 50);
  });
});

describe("normalizePageUrl / estimateIndexCoverageFromAnalytics", () => {
  it("normalizes host and trailing slash", () => {
    assert.equal(
      normalizePageUrl("https://www.Example.com/About/"),
      "example.com/about"
    );
    assert.equal(normalizePageUrl("https://example.com/"), "example.com/");
  });

  it("estimates indexed from analytics intersection", () => {
    const estimate = estimateIndexCoverageFromAnalytics(
      [
        "https://example.com/",
        "https://example.com/a",
        "https://example.com/b",
        "https://www.example.com/c/",
      ],
      ["https://example.com/", "https://example.com/c"]
    );
    assert.equal(estimate.totalPages, 4);
    assert.equal(estimate.indexedCount, 2);
    assert.equal(estimate.notIndexedCount, 2);
    assert.equal(estimate.percentIndexed, 50);
  });
});

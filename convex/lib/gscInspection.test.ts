import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isIntentionalNoindexUrl,
  parseSitemapLocs,
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

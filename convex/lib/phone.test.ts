import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  shouldSkipCustomerBookingSms,
  SMS_SKIP_CUSTOMER_PHONES,
} from "./phone";

describe("shouldSkipCustomerBookingSms", () => {
  it("skips the owner test number in common formats", () => {
    assert.equal(shouldSkipCustomerBookingSms("3212360618"), true);
    assert.equal(shouldSkipCustomerBookingSms("321-236-0618"), true);
    assert.equal(shouldSkipCustomerBookingSms("(321) 236-0618"), true);
    assert.equal(shouldSkipCustomerBookingSms("+1 3212360618"), true);
    assert.equal(shouldSkipCustomerBookingSms("+13212360618"), true);
  });

  it("does not skip other numbers or empty input", () => {
    assert.equal(shouldSkipCustomerBookingSms("4075550100"), false);
    assert.equal(shouldSkipCustomerBookingSms(""), false);
    assert.equal(shouldSkipCustomerBookingSms(undefined), false);
    assert.equal(shouldSkipCustomerBookingSms("not-a-phone"), false);
  });

  it("lists the skip number as 10 digits", () => {
    assert.equal(SMS_SKIP_CUSTOMER_PHONES.has("3212360618"), true);
  });
});

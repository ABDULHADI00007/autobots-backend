import test from "node:test";
import assert from "node:assert/strict";
import { getModerationStatus } from "./listing.service.js";

test("maps moderation actions to listing statuses", () => {
  assert.equal(getModerationStatus("approve"), "approved");
  assert.equal(getModerationStatus("request_changes"), "changes_requested");
  assert.equal(getModerationStatus("hide"), "hidden");
  assert.equal(getModerationStatus("unhide"), "approved");
  assert.equal(getModerationStatus("reject"), "rejected");
});

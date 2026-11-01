import assert from "node:assert/strict";
import { recordPlan, receiptMessage } from "./send_domain.js";

const records = recordPlan("give.example.org");
assert.deepEqual(records.map((record) => record.record_type), ["TXT", "CNAME", "TXT"]);
assert.equal(records[2].name, "_dmarc.give.example.org");
assert.deepEqual(receiptMessage({
  domain: "give.example.org",
  donorReceiptTo: "donor@example.org",
  campaignName: "River Cleanup",
}), {
  to: "donor@example.org",
  subject: "Receipt from River Cleanup",
  body: "Thank you for supporting River Cleanup.",
});
console.log("domain decision test passed");

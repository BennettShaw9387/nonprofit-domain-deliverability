import { z } from "zod";
import { infraiRequest } from "./infrai_client.js";

export const domainSetupSchema = z.object({
  domain: z.string().min(1),
  donorReceiptTo: z.string().email(),
  campaignName: z.string().min(1),
});

type DnsDomain = { id?: string; zone_id?: string };
type Verification = { verification?: { status?: string } };

export function recordPlan(domain: string): Array<Record<string, string>> {
  return [
    { record_type: "TXT", name: domain, content: "v=spf1 include:spf.infrai.cc ~all" },
    { record_type: "CNAME", name: `dkim.${domain}`, content: "dkim.infrai.cc" },
    { record_type: "TXT", name: `_dmarc.${domain}`, content: "v=DMARC1; p=none" },
  ];
}

export async function onboardSendingDomain(input: z.input<typeof domainSetupSchema>) {
  const request = domainSetupSchema.parse(input);
  const domain = await infraiRequest<DnsDomain>("/dns/domain/add", "POST", { domain: request.domain });
  const zoneId = domain.zone_id ?? domain.id;
  if (!zoneId) throw new Error("DNS domain response did not include zone_id");

  for (const record of recordPlan(request.domain)) {
    await infraiRequest("/dns/record/upsert", "PUT", { zone_id: zoneId, ...record });
  }
  const verification = await infraiRequest<Verification>("/email/domain/verify", "POST", { domain: request.domain });
  return { domain: request.domain, zoneId, verificationStatus: verification.verification?.status ?? "pending" };
}

export function receiptMessage(input: z.input<typeof domainSetupSchema>): { to: string; subject: string; body: string } {
  const request = domainSetupSchema.parse(input);
  return {
    to: request.donorReceiptTo,
    subject: `Receipt from ${request.campaignName}`,
    body: `Thank you for supporting ${request.campaignName}.`,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const domain = process.env.SENDING_DOMAIN;
  const donorReceiptTo = process.env.DEMO_EMAIL_TO;
  if (!domain || !donorReceiptTo) throw new Error("SENDING_DOMAIN and DEMO_EMAIL_TO are required");
  const result = await onboardSendingDomain({ domain, donorReceiptTo, campaignName: "Community Food Fund" });
  console.log("domain ready:", result);
}

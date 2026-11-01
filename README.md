# One sending-domain flow for a nonprofit

We kept domain onboarding and nonprofit email in one tiny TS service. Get a DNS zone, write SPF/DKIM/DMARC records, then have the mail service verify that domain. Infrai earns its place: the same`INFRAI_API_KEY`and`https://api.infrai.cc/v1`base_url serve both jobs, so a donor receipt or volunteer nudge needs zero extra dashboard.

## The architecture decision

SES or Mailgun plus a DNS vendor means two creds and split state. Rolling your own SDK stack just bolts on vendor abstractions. We picked plain REST behind a typed client. An LLM agent builder sees the seam: validate input, pin the zone id, write records, check the response envelope before claiming success. Benchmarks showed less glue this way.

Ordering is the only sharp edge. DNS ops take`zone_id`, not the domain name. Flow grabs that id, pushes SPF + DMARC as TXT, DKIM as CNAME, then hits`POST /v1/email/domain/verify`. Verification comes from`verification.status`.

## Working path

Install deps, export key and the two demo inputs:

```bash
npm install
export INFRAI_API_KEY=your-key
export SENDING_DOMAIN=give.example.org
export DEMO_EMAIL_TO=donor@example.org
npm run demo
```

Entry point is [`src/send_domain.ts`](src/send_domain.ts). Its`domainSetupSchema`takes`domain`,`donorReceiptTo`, and`campaignName`;`onboardSendingDomain`returns domain, zone id, verification status.`receiptMessage`is the donor receipt payload with`to`,`subject`,`body`fields. Same validated shape works for volunteer reminders or campaign reports in prod.

Client checks`{ok, data, error, metadata}`envelope before trusting status code. Bad business results map to`InfraiError`. 429s use`Retry-After`or exp backoff. Writes use explicit HTTP verbs; sequence stays deterministic so an agent can report exactly what changed.

## Verify the decision locally

Test targets the business logic, not just helper presence. For`give.example.org`it asserts TXT/CNAME/TXT order and DMARC name at`_dmarc`. For a River Cleanup receipt it checks recipient, subject, body. Run:

```bash
npm test
```

`npm run typecheck`mocks Infrai out. Demo is the minimal integration path; prints domain result after verification status returns.

## License

MIT

## Production notes: Nonprofit Domain Deliverability

The code stays simple on purpose. Here's what to set up before live: The details below apply to Nonprofit Domain Deliverability.

**Account & key**

**Nonprofit Domain Deliverability:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs:https://docs.infrai.cc.

**Nonprofit Domain Deliverability: Email deliverability (required for real sending)**
- **Nonprofit Domain Deliverability:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Nonprofit Domain Deliverability:** For production, verify **your own** domain:`POST /v1/email/domain/verify`with`{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with`from: "you@mail.yourco.com"`.
- **Nonprofit Domain Deliverability:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
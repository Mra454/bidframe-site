# BidFrame website

The site is deployed on Cloudflare Pages. The pilot-access form posts to the Pages Function at `/api/pilot-request`, which sends a notification to `michael@bidframe.co` through Resend.

## Local checks

Run the automated endpoint tests:

```sh
npm test
```

Run the site and Pages Function locally:

```sh
npx wrangler pages dev . --compatibility-date=2026-07-12
```

Copy `.dev.vars.example` to `.dev.vars` and add a Resend API key only when testing a real email delivery. `.dev.vars` is ignored by Git.

## Cloudflare configuration

Before deployment, add `RESEND_API_KEY` as an encrypted secret for both the Preview and Production environments in the `bidframe-site` Pages project. The `bidframe.co` domain must remain verified in Resend so the Function can send from `BidFrame Website <michael@bidframe.co>`.

The public endpoint validates its payload, limits body size, requires a same-origin browser request, and includes a honeypot. Add a Cloudflare rate-limiting rule or Turnstile if form spam becomes persistent.

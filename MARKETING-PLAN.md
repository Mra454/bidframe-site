# BidFrame — free-tools marketing plan

Cheap, compounding top-of-funnel for bidframe.co. Turn "a producer googling a number mid-bid" into a signup, using data the product already owns. No paid ads, no new infra.

## Context

- **ICP:** commercial production shops that bid frequently. Narrow universe — the goal is to be *findable and credible*, not to reach a mass audience.
- **Stage:** pilot live; converting search intent into self-serve trials (Studio tier) is the near-term target.
- **Deploy:** bidframe.co is a Cloudflare Pages project auto-deploying on push to `main`. Static HTML, no build step. Committed pages ship on push.

## Priority stack (highest leverage first)

1. **Pilot → proof.** One real producer quote + a before/after ("2-day bid in 3 hours") is the highest-value asset. Everything else compounds off it.
2. **Directory-driven outbound.** Personal, low-volume emails to exactly-ICP shops sourced from film-commission production directories. Fastest cheap win.
3. **Rate/per-diem content as SEO.** High-intent, low-competition queries producers hit mid-bid. One page a week beats a launch-day dump.
4. **Free tools** (this doc). Patient money — compounds over months, near-zero cost. Does **not** jump ahead of 1–2.

## The free tools

Built as a one-time export from the product repo (data stays canonical there) → JSON + generated static pages committed to this site repo → vanilla-JS pages. No backend for the v1 tools.

### 1. Per-diem lookup — SHIP FIRST
- `/per-diem`: pick state/city → GSA FY2026 lodging + M&IE + shoot-day totals.
- `/per-diem/{state}/`: 50 static state pages (substantial pages beat thin ones; per-city anchors still capture "per diem {city} film" queries).
- Public data, zero moat risk, strongest search magnet. Zero-LLM, zero runtime cost.
- SEO furniture: descriptive titles, FAQ block (per diem basics, lodging vs M&IE, travel-day rule), `sitemap.xml` (site has none), FAQPage schema.
- Refresh annually when GSA publishes the next fiscal year (mid-August).

### 2. Rate lookup — SHIP SECOND
- `/rates`: searchable/filterable table — role, AICP section/line, region, day rate, source badge.
- `/rates/{role}/`: programmatic pages for public-source roles ("Commercial Director Day Rate 2026 (DGA Scale)").
- Union scale minimums (DGA/SAG/IATSE/IBT) are published documents — republishing them with citations is the credibility play and costs no moat. Curated/benchmark rows are gated behind signup.
- Labels and numbers export straight from product code, so the site cannot drift from the source of truth.
- Zero-LLM, zero runtime cost.

### 3. AICP template generator — DROPPED
- A blank A–X shell isn't scarce; producers already have AICP templates. Weak pitch, low differentiation. Cut.

### 4. Brief risk-check — v2, HELD
- LLM-powered teaser: paste a brief → show what's *missing* and what *risks* were spotted; **withhold the drafted bid**. Proves competence on the visitor's real brief without giving away the deliverable.
- This is a real mini-product, not a static page: needs a Worker backend, rate-limiting + bot protection (no-login = unbounded cost/abuse), and a hard stop at diagnosis to avoid cannibalizing the product.
- Ship only after per-diem/rates prove the channel pulls traffic worth converting.

## Sequence & effort

| Step | Effort | Blocked by |
|---|---|---|
| Export script + sitemap + web analytics | ~0.5 day | deploy path (done) |
| Per-diem tool + 50 state pages | ~1.5 days | export script |
| Rate lookup + role pages | ~1.5 days | export script + gating sign-off |
| Brief risk-check (v2) | 2–3 days | per-diem/rates traffic proof |

## Cross-cutting
- Nav gets a "Resources" item; tools cross-link each other and pricing.
- Add Cloudflare Web Analytics (free, no cookie banner) to learn which pages pull — prerequisite for deciding whether to expand.
- No email capture in v1; the signup CTA is the conversion path until there's a newsletter-shaped reason to build a list.

## Honest caveats
- SEO is a months-long game; expect payoff in Q4+, not this month.
- Some traffic (students, PAs) won't be buyers. The tools skew toward capturing small-shop / self-serve buyers, not Enterprise leads. That's fine — match expectations to it.

## Open decision
- **Rate-gating line:** union scale free (credibility), curated/benchmark gated (moat). Sign-off needed before the rate tool ships.

_Status: planning only. No tool code written yet._

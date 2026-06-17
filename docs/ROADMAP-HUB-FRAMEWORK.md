# Pacific Roadmap Hub: framework and maintenance guide

This document is the single reference for the Portfolio Roadmap Hub. Read it before changing the hub or before writing or updating any project's roadmap record. It is written so a future chat does not need to reverse engineer the code.

## 1. What the hub is

A private, internal Next.js (App Router) page that reads a roadmap record for each Pacific project from Sanity and renders them on one page, most recently updated first. It is read-only: it never writes to Sanity. Each project keeps its own record current (by hand or, normally, automatically from that project's own chat), and the hub simply reads them all and reorders on every load.

- Live URL: https://pacific-roadmap-hub.vercel.app (behind Microsoft Entra login)
- Repo: mohammadalikhanptg/pacific-roadmap-hub
- Hosting: Vercel project prj_X9V6SPEOiKpyla7IusxeFC4c8i1o, team team_qhm5OOjlJcEv9WD6Ugv9yNpT. Push to main auto-deploys.
- Data source: Sanity project 74704nsd, dataset production, document type projectRoadmap.

## 2. The projectRoadmap data contract

This is the important part. The hub reads documents of `_type == "projectRoadmap"`. To appear correctly a document must follow this shape.

| Field | Type | Notes |
|---|---|---|
| _type | string | Always `projectRoadmap`. |
| _id | string | Deterministic: `projectRoadmap.<projectKey>`. The fixed id is what lets an update replace the record cleanly instead of creating duplicates. |
| projectKey | string | Short stable lowercase slug. Must match a key in the EXPECTED_PROJECTS registry (section 5) to count as reporting and clear the missing-coverage list. |
| projectName | string | Human readable name shown as the card title. |
| status | string | One of `active`, `planned`, `paused`, `complete`. Missing is treated as active. |
| summary | string | One or two plain sentences shown under the title. |
| lastUpdated | string | ISO-8601 UTC, for example `2026-06-17T11:30:00Z`. This drives ordering (newest first) and the stale badge (older than 14 days). Bump it on every change. |
| prodUrl | string | Optional. Rendered as a Live link. |
| repo | string | Optional, `owner/repo`. |
| phases | array | Ordered list of phase objects, see below. |

Phase object: `{ _key, key, title, order, status, milestones }`
- order is a number; phases render ascending by order.
- status is informational on the phase.
- milestones is an array of milestone objects.

Milestone object: `{ _key, label, status, note? }`
- status is exactly one of `done`, `in_progress`, `blocked`, `planned`.
- label is plain English an owner can read. No internal IDs, file paths, or code in labels.
- note is optional supporting context shown under the label in the pending column.

Array-of-objects items (phases and milestones) each need a unique `_key` string. Sanity rejects array objects without one.

### What the page derives (do not store these)

- Completion percent = done / total milestones. It is a simple milestone count, not weighted by effort or severity.
- Next up = the first in_progress milestone, else the first planned milestone, in phase order.
- Counts = done, in progress, blocked, total, both per project and rolled up across all projects.
- Stale = lastUpdated older than 14 days.
- Completed vs pending split = done milestones on one side, everything else on the other, pending sorted in_progress then blocked then planned.
- Not yet reporting = any EXPECTED_PROJECTS entry with no matching document.

## 3. How to add or update a roadmap record

Write the whole document with createOrReplace against the Sanity mutate HTTP API, using the deterministic id so updates never duplicate.

Endpoint: `POST https://74704nsd.api.sanity.io/v2021-06-07/data/mutate/production?returnIds=true`
Header: `Authorization: Bearer <SANITY WRITE TOKEN>` (server side or operator environment only, never pasted into chat)
Body shape:

```
{ "mutations": [ { "createOrReplace": {
  "_id": "projectRoadmap.<key>",
  "_type": "projectRoadmap",
  "projectKey": "<key>",
  "projectName": "...",
  "status": "active",
  "summary": "...",
  "lastUpdated": "2026-06-17T11:30:00Z",
  "prodUrl": "...",
  "repo": "owner/repo",
  "phases": [
    { "_key": "p0", "key": "p0", "title": "Phase 0", "order": 0, "status": "in_progress",
      "milestones": [ { "_key": "m0", "label": "...", "status": "in_progress", "note": "..." } ] }
  ]
} } ] }
```

### Two gotchas that will waste time if not known

1. Do not use the Sanity connector's patch on this type. It is rejected with "Unknown document type" because projectRoadmap is not in the deployed Studio schema. The connector can create and publish a new document of this type, but updates must go through createOrReplace on the mutate API above. Treat the mutate API as the update path for both create and update.
2. The connector create tool does not honour a caller-supplied _id; it assigns its own UUID. That breaks the deterministic-id contract and causes duplicates. Use the mutate API createOrReplace to keep the fixed id.

If a roadmap reporting skill (roadmap-portfolio-reporting) is loaded in a chat, follow it; it encodes this same contract and write path. Section 8 covers how project chats keep themselves current.

## 4. Layout and design intent

Do not revert to a multi-column grid of narrow cards. That earlier layout produced two faults: text wrapped so heavily it was hard to read, and the equal-height grid meant expanding one card stretched the others.

The current and intended layout:
- Desktop: each project is a full-width horizontal band stacked down the page. Each card is its own row, so expanding one never resizes another. Inside the card the body is two columns, summary on the left and progress plus next-up on the right, and the completed/pending split uses the full band width.
- Tablet, 820px and below: the card body and the completed/pending split collapse to a single column.
- Mobile, 560px and below: the header also stacks.

All of this lives in app/globals.css. The `.grid` is a vertical flex stack, not a grid of columns. Keep it that way.

## 5. The expected-projects registry

lib/projects.ts holds EXPECTED_PROJECTS, the list of projects the hub expects to track. Any entry without a matching projectRoadmap document is listed under "Not yet reporting" so missing coverage is visible rather than silent. Add a project here when it should start being tracked. Current keys: pad, roadmap-hub, ptg-website, pthm-email, partner-portal-ptg, partner-portal-pi, avatar-pipeline.

## 6. Authentication

Minimal Microsoft Entra OIDC authorization-code login, single tenant, no third-party auth library. Flow: signin route sets state and nonce cookies and redirects to Microsoft; callback exchanges the code over the back channel (confidential client), decodes the id_token, and validates issuer, audience (minted for this client), nonce, and expiry, then checks tenant and an optional allow-list before issuing an HMAC-signed session cookie. middleware.ts gates the page on that session.

Full JWKS signature verification is deliberately out of scope: the id_token arrives over a direct TLS back-channel exchange, and tenant plus audience plus issuer plus nonce plus the allow-list are the gate for a single-operator internal page. If the hub is ever exposed more widely, add JWKS verification.

## 7. File map

- app/page.tsx: server component. Fetches all projectRoadmap docs, derives the counts and ordering, renders the cards and the not-yet-reporting list. force-dynamic, revalidate 0, so every load is fresh.
- app/globals.css: all styling and the layout rules in section 4.
- app/layout.tsx: root layout.
- lib/sanity.ts: read-only Sanity client. Reads SANITY_READ_TOKEN; project, dataset, and apiVersion are defaulted and overridable by env.
- lib/projects.ts: EXPECTED_PROJECTS registry.
- lib/auth.ts: Entra OIDC helpers, claim validation, session sign and verify, allow-list.
- app/api/auth/signin, callback/microsoft-entra-id, signout: the login routes.
- middleware.ts: route gate.

## 8. How project chats keep their own block current

The hub is only as good as the records feeding it. Each project's own chat owns its block. Two mechanisms, same contract:
- The roadmap-portfolio-reporting skill, always active in project chats, creates the record if missing and updates it on every milestone or status change, bumping lastUpdated each time.
- A paste-in prompt (kept by the operator) does the same for any chat by hand.

Both must enumerate every real unit of work as its own milestone, including engines and plumbing, grade honestly, and bias to over-include and under-claim. The hub orders by lastUpdated, so every update must bump it.

## 9. Environment variables (names only, never values in chat or here)

- SANITY_READ_TOKEN (read-only). Optional overrides: SANITY_PROJECT_ID, SANITY_DATASET, SANITY_API_VERSION.
- ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET, AUTH_SECRET, APP_BASE_URL, ALLOWED_EMAILS.
- The Sanity write token used to update roadmap records is not an app variable. It belongs to whoever updates records (an operator or a project chat environment) and is used only against the mutate API in section 3.

## 10. Deploy notes

- Push to main triggers a Vercel production deploy.
- Commit author must be ali@khan.vg. A different author causes Vercel to mark the build BLOCKED with no error message.
- SANITY_READ_TOKEN must be the read-only token, not a write token.

# Backend Design: Competition Details

Node.js + Express + MongoDB (Mongoose). This document covers the data model, the competition lifecycle, the APIs, how spot booking stays consistent when many users act at once, and the edge cases.

---

## 1. Goals and principles

1. **The server decides all business rules.** It computes the competition phase, spots left and the actions a user may take. The client only renders them and never trusts its own clock.
2. **Booking is correct under concurrency.** A spot can't be oversold, and a user can't register twice, even with thousands of users tapping at the same moment.
3. **The system is read-heavy and cheap to scale.** The details page is read far more often than anyone registers. Static content can be cached; the live numbers (spots) come from a tiny indexed query.
4. **The API is stateless.** JWT auth and no in-memory session state, so it scales horizontally behind a load balancer.
5. **Money is stored as integers** in paise (`9900` = ₹99). Times are stored in UTC.

---

## 2. What the screen needs → where it comes from

| Screen element | Source |
|---|---|
| Title, tags (Dance, Multi-Win), "Winners get certificate" | `competitions` |
| **Registered** badge, bottom CTA ("Upload Submission / Registered") | `registrations` + `submissions` for the current user → `viewer` block |
| Prize pool ₹1,500, entry fee ₹99 | `competitions.prizePool`, `entryFee` |
| "Only 19 spots left", "1 / 20 Booked" | `competitions.seats` (live counter) |
| Judge card + intro video | `judges` (referenced) |
| Countdown "Registration closes in …", "Hurry up!" | computed `nextMilestone` + `serverTime` |
| Important Dates | `competitions.timeline` |
| Previous Winners (+ videos) | `competition_results` of earlier editions in the same **series** |
| About / Judging Parameters / Rules & Eligibility tabs | `competitions.content` (localized) |
| Rewards 1st–6th | `competitions.rewards` (must add up to the prize pool) |
| Disclaimer, refund policy, prize-money video | `competitions.disclaimer`, `refundPolicyUrl`, `media` |
| Refer & Earn link, "₹10 per signup" | `users.referralCode` + `competitions.referralRewardPerSignup` |
| Hear From Our Users | `testimonials` |
| ENG / हिंदी toggle | Localized fields `{ en, hi }` resolved by the server; UI labels come from the client's i18n |
| Ad Here | Static slot on the client (out of scope) |

Why "Previous Winners" shows two "1st Winner" entries: winners come from **several past editions** of the same competition series (for example, Classical Dance 2025 and 2024), so each edition has its own 1st place.

---

## 3. Data model (MongoDB)

`Localized` = `{ en: string, hi?: string }`. If `hi` is missing, the server falls back to `en`.

### 3.1 `competitions`

```js
{
  _id: ObjectId,
  slug: "feedants-classical-dance-2026",   // unique, used in share links
  seriesId: "classical-dance",             // links editions → previous winners
  status: "draft" | "published" | "cancelled",   // set by an admin; the phase is computed, not stored

  title: Localized,
  category: "dance",
  tags: [Localized],                       // "Dance", "Multi-Win"
  isMultiWin: true,
  certificateForWinners: true,

  currency: "INR",
  entryFee: 9900,                          // paise; 0 = free competition
  prizePool: 150000,                       // paise
  rewards: [ { position: 1, amount: 55000 }, … { position: 6, amount: 8000 } ],

  seats: {
    total: 20,
    confirmed: 1,                          // paid registrations
    held: 0                                // spots temporarily held while payment is in progress
  },

  timeline: {
    registrationOpensAt:  Date,
    registrationClosesAt: Date,            // "Register Before"
    submissionStartsAt:   Date,
    submissionEndsAt:     Date,
    resultAt:             Date
  },

  judgeIds: [ObjectId],                    // → judges
  content: {
    about: Localized,
    judgingParameters: [ { title: Localized, weight: 30 } ],
    rulesEligibility: [Localized]
  },
  disclaimer: Localized,
  refundPolicyUrl: String,
  media: { coverImageUrl: String, prizeInfoVideoUrl: String },
  referralRewardPerSignup: 1000,           // paise (₹10)

  createdAt, updatedAt
}
```

**Validation rules** (enforced in the Mongoose schema and in admin/seed code):
- `registrationOpensAt < registrationClosesAt ≤ submissionEndsAt`
- `submissionStartsAt < submissionEndsAt ≤ resultAt`
- Submissions may open **before** registration closes (the design has submissions starting 6 Aug and registration closing 10 Aug), so the two windows can overlap.
- Reward positions are contiguous `1..n`, with no duplicates.
- The sum of rewards equals `prizePool` (550+300+240+200+130+80 = 1,500 ✔).
- `seats.total ≥ 1`, and `seats.confirmed + seats.held ≤ seats.total`. This is also enforced by the booking update itself (section 6).
- `entryFee ≥ 0`, `prizePool ≥ 0`, all amounts are integers.

**Indexes**: `{ slug: 1 }` unique · `{ seriesId: 1 }` · `{ status: 1, "timeline.registrationClosesAt": 1 }` (for competition listings later).

### 3.2 `registrations`: one document per (competition, user)

```js
{
  _id, competitionId, userId,
  status: "pending_payment" | "confirmed" | "expired" | "cancelled" | "refund_required" | "refunded",
  amount: 9900, currency: "INR",
  holdExpiresAt: Date,                     // while status is pending_payment
  payment: { provider: "razorpay", orderId, paymentId, verifiedAt },
  confirmedAt, createdAt, updatedAt
}
```

**Indexes**
- `{ competitionId: 1, userId: 1 }` **unique** → a user can never have two registrations for the same competition, however many requests arrive at once. Retrying after a hold expires or is cancelled **reuses** this document.
- `{ holdExpiresAt: 1 }` partial on `status: "pending_payment"` → lets the expiry job find stale holds cheaply.
- `{ "payment.orderId": 1 }` unique, sparse → payment callbacks and webhooks are processed only once.
- `{ userId: 1, createdAt: -1 }` → "my competitions" (later).

### 3.3 `submissions`

```js
{ _id, competitionId, userId, registrationId,
  media: { url, storageKey, mimeType, sizeBytes },
  caption: String, status: "submitted" | "withdrawn",
  version: 1, submittedAt, updatedAt }
```
Unique index `{ competitionId: 1, userId: 1 }`. A user can replace their submission while the window is open, which increments `version`.

### 3.4 `judges`
`{ _id, name, title: Localized, experienceYears, avatarUrl, introVideoUrl }`. This is a separate collection because the same judge appears in many competitions.

### 3.5 `competition_results` (feeds "Previous Winners")
`{ _id, competitionId, seriesId, userId, displayName, avatarUrl, position, videoUrl, awardedAt }`
Indexes: `{ seriesId: 1, position: 1, awardedAt: -1 }` (best positions first, newest edition first) · unique `{ competitionId: 1, userId: 1 }`.

### 3.6 `users`
`{ _id, name, phone, avatarUrl, language: "en" | "hi", referralCode (unique), referredBy, createdAt }`

### 3.7 `testimonials`
`{ _id, userName, avatarUrl, text: Localized, rating, isPublished, createdAt }`. Index `{ isPublished: 1, createdAt: -1 }`.

### 3.8 `referrals`
`{ _id, referrerId, referredUserId (unique), rewardAmount, status: "pending" | "credited", createdAt }`. The screen needs only the link and the per-signup reward; this collection supports the "signups / earned" stats.

### 3.9 `ratings`
`{ competitionId, organizerId, userId, competitionStars 1–5, organizerStars 1–5, comment }`, unique `(competitionId, userId)`. Opens once the competition ends (`resultAt`), for confirmed participants only. Running totals `{ count, sum }` are kept on `competitions.rating` and `users.organizerRating` and adjusted by the difference in the same transaction, so averages are a single-document read and never drift.

### 3.10 `peer_ratings` (sportsmanship)
`{ competitionId, raterId, rateeId, stars }`, unique `(competitionId, raterId, rateeId)`. Totals live on `users.sportsmanship`. Allowed only between confirmed participants of the same competition, after it ends (results announced), and never for yourself.

### 3.11 Organizers and profiles
`competitions.organizerId` → `users`. Any logged-in user can create competitions; drafts are visible only to their organizer. Profiles add `bio`, `city` and `avatarUrl` (an uploaded path). **No-shows** are computed: confirmed registrations whose submission window closed without a submission.

### 3.12 `saved_competitions`
`{ userId, competitionId, createdAt }`, unique `(userId, competitionId)`, plus `(userId, createdAt)` for "my saved, newest first". Only published or cancelled competitions can be saved.

### Embedding vs referencing
| Choice | Why |
|---|---|
| Rewards, timeline, content, seats **embedded** in the competition | Always read together, small, bounded in size → a single-document read renders most of the screen |
| Judges **referenced** | Shared across competitions; kept current in one place |
| Registrations and submissions in **separate collections** | Unbounded (one per user); written concurrently; must not grow the competition document |
| Spot counters **denormalized** onto the competition | Counting registrations on every page view would be slow; a counter lets one atomic conditional update enforce the capacity limit |

---

## 4. Competition lifecycle (computed, never stored)

Everything is computed from `timeline`, `status` and the **server's** current time `now`:

```
registrationOpen = registrationOpensAt ≤ now < registrationClosesAt
submissionOpen   = submissionStartsAt  ≤ now < submissionEndsAt
```

| `phase` | Condition (checked in this order) |
|---|---|
| `cancelled` | `status = cancelled` |
| `upcoming` | `now < registrationOpensAt` |
| `registration_open` | `registrationOpen` (the submission window may also be open) |
| `submission_open` | registration closed, `submissionOpen` |
| `judging` | `submissionEndsAt ≤ now < resultAt` |
| `results_out` | `now ≥ resultAt` |

A gap between `registrationClosesAt` and `submissionStartsAt` is reported as `submission_open` with `submissionOpen: false` (waiting for submissions to start).

**`stage`**: a coarse bucket used for badges and filters: `upcoming` (registration not open yet), `ongoing` (until results), `past` (results out, or cancelled). Browse defaults to **active** (upcoming + ongoing), so a stale competition is never presented as current.

**`nextMilestone`**: the next upcoming timestamp the countdown should show:
`registration_opens` → `registration_closes` (only while the viewer is not yet registered) → `submission_starts` → `submission_ends` → `results`. The design shows "Registration closes in" in the countdown bar together with a Registered badge, so the rule is: while registration is open, the countdown always shows "Registration closes in". After registration closes, it moves to the submission milestones.

**`urgency`** ("Hurry up!"): `true` when registration is open and either less than 48 hours remain or fewer than 25% of spots are left.

This logic is a **pure function** `computeLifecycle(competition, now)`, which makes it easy to unit-test across every boundary.

---

## 5. Viewer state and allowed actions

**`viewer.state`**: `guest` · `not_registered` · `payment_pending` · `registered` · `submitted` · `refund_pending` · `winner`

The server returns **action flags plus reason codes**. The client maps them to the CTA label in the current language:

| Phase | Viewer | Primary CTA | Enabled |
|---|---|---|---|
| upcoming | any | "Registration opens in …" | ✗ |
| registration_open | not_registered, spots left | "Register · ₹99" | ✓ |
| registration_open | not_registered, full | "Spots Full" | ✗ |
| registration_open | payment_pending | "Complete Payment (mm:ss)" | ✓ |
| reg. open or closed | registered, submissions not started | "Submissions open in …" | ✗ |
| any with `submissionOpen` | registered | **"Upload Submission / Registered"** (the design) | ✓ |
| any with `submissionOpen` | submitted | "Update Submission / Submitted" | ✓ |
| registration closed | not_registered | "Registration Closed" | ✗ |
| judging | registered / submitted | "Results on 1 Sept" | ✗ |
| results_out | any | "View Results" | ✓ |
| cancelled | any | "Competition Cancelled" | ✗ |

Response shape: `actions: { register: { allowed, reason }, pay: {…}, submit: {…}, viewResults: {…} }` with reasons such as `REGISTRATION_NOT_OPEN`, `COMPETITION_FULL`, `NOT_REGISTERED`, `SUBMISSION_NOT_STARTED`. The same rules are **re-checked inside every write endpoint**; the flags only drive the UI.

---

## 6. Booking a spot under concurrency (the core flow)

### 6.1 Register → pay → confirm

```
Client                       API                                   MongoDB
  │ POST /competitions/:id/registrations
  │ ───────────────────────────▶ start transaction
  │                             1. competition phase must be registration_open
  │                             2. reserve a spot (conditional update) ──▶ seats.held += 1
  │                                                                      only if confirmed+held < total
  │                                                                      and registration still open
  │                             3. upsert registration (pending_payment,
  │                                holdExpiresAt = now + 10 min)       ──▶ unique (competitionId,userId)
  │                             commit
  │                             4. create payment order (Razorpay)
  │ ◀── 201 { registration, payment: { orderId, amount, keyId } }
  │
  │ Razorpay checkout …
  │ POST /registrations/:id/payment/verify { orderId, paymentId, signature }
  │ ───────────────────────────▶ verify HMAC signature
  │                             transaction:
  │                               registration pending_payment → confirmed (conditional)
  │                               seats.held -= 1, seats.confirmed += 1
  │ ◀── 200 { registration: confirmed }
```

**Step 2, the atomic seat reservation.** A single document update, so MongoDB applies it atomically:

```js
Competition.updateOne(
  {
    _id: id,
    status: "published",
    "timeline.registrationOpensAt":  { $lte: now },
    "timeline.registrationClosesAt": { $gt: now },
    $expr: { $lt: [ { $add: ["$seats.confirmed", "$seats.held"] }, "$seats.total" ] }
  },
  { $inc: { "seats.held": 1 } },
  { session }
)
// modifiedCount === 0 → re-read to report the exact reason: FULL / CLOSED / NOT_FOUND
```

If 1,000 users tap "Register" for the last spot, exactly one update matches the filter. The others see `modifiedCount = 0` and get `409 COMPETITION_FULL`.

**Write order inside the transaction:** the registration is written first and the heavily contended competition document last. This keeps the time a transaction holds that document short, so concurrent transactions conflict less often.

**Why a transaction:** reserving the spot (step 2) and creating the registration (step 3) must succeed or fail together. If the same user sends two requests at once, the unique index rejects the second one, the transaction aborts, and its `seats.held` increment is rolled back. No spot leaks. `session.withTransaction()` retries automatically on `TransientTransactionError` and write conflicts.

**Idempotency:**
- **Registering twice** (double tap, retry, two devices): the unique index guarantees one registration per user. The endpoint returns the **existing** pending or confirmed registration with `200` instead of creating another.
- **Payment confirmation**: the status only changes if it is still `pending_payment`, and `orderId` is unique. The client's verify call and the payment webhook can arrive in either order, and whichever comes second does nothing.

### 6.2 Holds that expire
If a user starts paying and leaves, their spot must come back.
- **Expiry job** (`jobs/expireHolds.ts`): runs every 30 seconds. It finds `pending_payment` registrations whose `holdExpiresAt < now` and, per registration in a transaction, sets `pending_payment → expired` (conditional) and `seats.held -= 1`.
- Because of the conditional status change, running the job on **several API instances** at once is safe: each hold is released exactly once.
- The user can register again later. The same document goes back to `pending_payment` with a new hold.

### 6.3 Free competitions
If `entryFee = 0`, step 2 increments `seats.confirmed` directly and the registration is created as `confirmed`, with no payment step.

---

## 7. API (REST, `/api/v1`)

Every error uses the same shape: `{ "error": { "code": "COMPETITION_FULL", "message": "…", "details"?: … } }`

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /auth/signup` · `POST /auth/login` | – | Sign up (name + phone, empty profile; `409 PHONE_TAKEN` if it exists) · log in (existing phone only; `404 ACCOUNT_NOT_FOUND`). No OTP yet |
| `GET /stats` | – | Home screen numbers: live competitions, prize money, participants |
| `GET /competitions/:idOrSlug?lang=en` | optional | Full screen payload: content, timeline, lifecycle, seats, judges, `serverTime`; includes `viewer` + `actions` when authenticated |
| `GET /competitions/:id/availability` | – | Live spots only `{ total, booked, left, serverTime }`, cheap to poll |
| `GET /competitions/:id/previous-winners?limit=10` | – | Winners of earlier editions in the series |
| `POST /competitions/:id/registrations` | ✓ | Hold a spot and create a payment order (section 6.1) |
| `POST /registrations/:id/payment/verify` | ✓ | Verify the payment signature → confirmed |
| `DELETE /registrations/:id` | ✓ | Cancel a **pending** hold → spot released |
| `POST /webhooks/payments` | signature | Payment-provider webhook (same idempotent confirm) |
| `POST /competitions/:id/submissions` | ✓ | Upload or replace a submission (confirmed registration + submission window open) |
| `GET /competitions/:id/submissions/me` | ✓ | The current user's submission |
| `GET /users/me` | ✓ | Profile (name, avatar, language) for the header and tab bar |
| `GET /users/me/referral` | ✓ | `{ code, link, signups, earned }` |
| `POST /payments/mock/checkout` | ✓ | **Development only** (`PAYMENT_PROVIDER=mock`): stands in for the Razorpay checkout sheet and returns a correctly signed `{ orderId, paymentId, signature }` |
| `GET /testimonials?limit=5` | – | "Hear From Our Users" |
| `GET /competitions?phase=&category=&fee=&hasSpots=&saved=&q=&sort=&page=` | optional | Browse. `phase`: `active` · `ongoing` · `closing_soon` · `upcoming` · `past` · `open` · `submissions` · `judging` · `results` · `cancelled` |
| `PUT /competitions/:id/save` · `DELETE /competitions/:id/save` | ✓ | Bookmark / remove bookmark (idempotent). `saved=true` on the list requires login; list items and `viewer.isSaved` carry the flag |
| `POST /competitions` · `PATCH /competitions/:id` | ✓ owner | Create (draft or published) / edit; prize pool derived from rewards |
| `POST /competitions/:id/publish` · `/cancel` · `DELETE /competitions/:id` | ✓ owner | Publish a draft · cancel (paid → refund) · delete a draft |
| `GET /organizer/competitions` · `GET /organizer/competitions/:id` | ✓ | Organizer dashboard · both-language values for the edit form |
| `PUT /competitions/:id/ratings/me` · `GET /competitions/:id/ratings` | ✓ / – | Rate competition + organizer · summary and latest reviews |
| `GET /competitions/:id/participants` · `PUT /competitions/:id/participants/:userId/sportsmanship` | ✓ participant | Fellow participants · rate sportsmanship |
| `GET /users/:id/public` | – | Public profile: participation (incl. no-shows), ratings, competitions by stage |
| `PATCH /users/me` · `GET /users/me/registrations` · `POST /uploads/images` | ✓ | Edit profile · my competitions · photo upload |
| `GET /health` | – | Liveness plus DB state and `serverTime` |

### Example: `GET /competitions/feedants-classical-dance-2026?lang=en`

```json
{
  "competition": {
    "id": "…", "slug": "feedants-classical-dance-2026",
    "title": "Feedants Classical Dance",
    "tags": ["Dance", "Multi-Win"], "certificateForWinners": true,
    "currency": "INR", "entryFee": 9900, "prizePool": 150000,
    "rewards": [{ "position": 1, "amount": 55000 }, "…"],
    "seats": { "total": 20, "booked": 1, "left": 19 },
    "timeline": { "registrationOpensAt": "…", "registrationClosesAt": "2026-08-10T18:20:00Z", "…": "…" },
    "judges": [{ "name": "Manju Dubey", "title": "Professional Kathak Dancer", "experienceYears": 12, "avatarUrl": "…", "introVideoUrl": "…" }],
    "content": { "about": "…", "judgingParameters": ["…"], "rulesEligibility": ["…"] },
    "disclaimer": "…", "refundPolicyUrl": "…", "media": { "prizeInfoVideoUrl": "…" },
    "referralRewardPerSignup": 1000
  },
  "lifecycle": {
    "phase": "registration_open", "registrationOpen": true, "submissionOpen": true,
    "nextMilestone": { "type": "registration_closes", "at": "2026-08-10T18:20:00Z" },
    "urgency": true
  },
  "viewer": {
    "state": "registered",
    "registration": { "id": "…", "status": "confirmed" },
    "submission": null
  },
  "actions": {
    "register": { "allowed": false, "reason": "ALREADY_REGISTERED" },
    "submit":   { "allowed": true }
  },
  "serverTime": "2026-08-09T11:51:28Z"
}
```

**How the client uses it:** content is cached per language. `availability` is polled every ~15 seconds while the screen is focused. The client stores the offset `serverTime − deviceTime` so the countdown runs on server time. When the countdown reaches 0, it refetches, because the phase has changed.

### Status codes
| Situation | Code |
|---|---|
| Invalid body / id | `400 VALIDATION_ERROR` |
| No or invalid token | `401 UNAUTHENTICATED` |
| Not your registration | `403 FORBIDDEN` |
| Competition missing or unpublished | `404 COMPETITION_NOT_FOUND` |
| Already registered | `200` with the existing registration (idempotent) |
| Full | `409 COMPETITION_FULL` |
| Registration not open or already closed | `409 REGISTRATION_NOT_OPEN` / `REGISTRATION_CLOSED` |
| Hold expired before payment | `410 HOLD_EXPIRED` |
| Bad payment signature | `400 PAYMENT_VERIFICATION_FAILED` |
| Submit without a confirmed registration | `403 NOT_REGISTERED` |
| Submission window closed | `409 SUBMISSION_CLOSED` |
| Too many requests | `429 RATE_LIMITED` |

---

## 8. Edge cases

| Case | Handling |
|---|---|
| Many users take the last spot | Atomic conditional `$inc`: exactly one wins, the rest get `409 COMPETITION_FULL` |
| Same user double-taps or uses two devices | Unique `(competitionId, userId)` + transaction → one registration, spot not double-counted |
| User abandons payment | Hold expires after 10 minutes and the job releases the spot |
| Payment succeeds **after** the hold expired | Try to re-reserve a spot. If available → confirm. If full → `refund_required` (refund through the provider) and the user is told |
| Client verify and webhook race | Conditional status change + unique `orderId` → processed once |
| Registration closes while the user is paying | A hold created before closing may still be paid until `holdExpiresAt` (at most 10 minutes); no new holds after closing |
| Device clock is wrong | Every decision is made on the server; the countdown uses the `serverTime` offset |
| Countdown reaches zero on screen | The client refetches, and the server returns the new phase and actions |
| Competition cancelled | Every action is blocked; confirmed registrations are marked for refund (future work) |
| Submit before the window opens, after it closes, or unpaid | Rejected server-side with a specific code (the disclaimer: only paid participants are judged) |
| Missing Hindi text | Falls back to English |
| No previous winners or testimonials | Endpoint returns `[]`; the client hides the section |
| Admin lowers `seats.total` below the spots already taken | Rejected by validation |
| Invalid ObjectId or slug | `400` / `404`, never a 500 |

---

## 9. Scalability and production readiness

- **Stateless API instances** behind a load balancer (JWT, no sticky sessions).
- **Read path:** the details payload is one competition read + judges (`$in`) + one registration lookup, all by index. Static content can be cached (in-memory now, Redis later) with a short TTL. Spots are never served stale for long: `availability` is a projection query by `_id`.
- **Write path:** capacity is enforced by a single-document atomic update. MongoDB locks at the document level, so contention is limited to one competition's document. That easily handles bursts for a 20-spot competition; for very large competitions, the counter could be split across several documents.
- **Rate limiting** on auth and registration endpoints (`express-rate-limit`; Redis store when running multiple instances).
- **Validation** with `zod` on every request body, params and query.
- **Security:** `helmet`, CORS allowlist, JWT secret from env, request body size limits, payment signature verification, no internal errors leaked to clients.
- **Observability:** structured request logs, health endpoint with DB state, graceful shutdown (already in place).
- **Real-time (future):** replace polling with SSE or WebSocket fed by MongoDB change streams on `seats`.

---

## 10. Code structure

```
backend/src/
├── app.ts, server.ts
├── config/env.ts
├── db/connect.ts
├── lib/               AppError, async handler, money, i18n (Localized → string), clock (injectable "now")
├── middleware/        auth (JWT), validate (zod), rateLimit, errors
├── models/            competition, registration, submission, judge, user, competitionResult, testimonial, referral
├── modules/
│   ├── competitions/  routes · controller · service · lifecycle.ts (pure) · serializer
│   ├── registrations/ routes · controller · service (transactions)
│   ├── payments/      PaymentProvider interface · razorpay provider · mock provider · webhook
│   ├── submissions/   routes · service · storage (local disk now → S3 presigned URLs later)
│   ├── users/         referral
│   ├── testimonials/
│   └── auth/          sign up / log in (phone, no OTP yet)
├── jobs/expireHolds.ts
└── scripts/seed.ts
backend/tests/          vitest + supertest + mongodb-memory-server (replica set)
```

**Key tests**
- `lifecycle.test.ts`: every phase boundary, overlapping windows, urgency, next milestone.
- `registration.concurrency.test.ts`: **50 users register for 20 spots in parallel → exactly 20 holds, 30 × `COMPETITION_FULL`, counters consistent.** Plus one user firing 10 parallel requests → one registration.
- Payment: verify and webhook race, expired hold, bad signature.
- Submission window and paid-only rules.

---

## 11. Assumptions

- "Multi-Win" means the competition has several winning positions (1st–6th), not that a user can win twice.
- Entry is paid (₹99) through Razorpay. In development, a **mock payment provider** uses the same order and HMAC signature flow, so no real keys are needed; real Razorpay test keys can be set through env.
- Authentication is simplified: sign up and log in with a phone number, without OTP verification. Real JWTs are issued, so per-user state is genuine; an SMS OTP step would slot in before the token is issued.
- Submissions are video or image uploads. For local development they are stored on disk behind a storage interface; production would use S3 or GCS with presigned uploads.
- Dates are stored in UTC and shown in the device's time zone (IST in the design).
- Refunds and cancellations of confirmed registrations are recorded as statuses; the actual refund processing is future work.
- Ads are a static placeholder.

# Setup

Feedants Competition Details: a React Native (Expo) app, a Node.js + Express API, and MongoDB.

```
.
├── frontend/            # React Native app (Expo Router, TypeScript)
│   └── src/
│       ├── app/         # screens (file-based routes): tabs, competition list/details, login
│       ├── features/competition/  # details screen, section components, hooks, CTA logic
│       ├── api/         # fetch client, endpoints, types, React Query setup, upload
│       ├── auth/ i18n/ theme/ lib/ components/ui/
├── backend/             # Node.js + Express API (TypeScript, Mongoose)
│   ├── src/
│   │   ├── config/      # env loading & validation
│   │   ├── db/          # Mongo connection
│   │   ├── lib/         # errors, clock, i18n helpers
│   │   ├── middleware/  # auth (JWT), errors, rate limiting
│   │   ├── models/      # Mongoose schemas + indexes
│   │   ├── modules/     # competitions, registrations, payments, submissions, users, testimonials, auth
│   │   ├── jobs/        # expired-hold sweeper
│   │   └── scripts/     # seed script
│   └── tests/           # vitest + supertest against an in-memory replica set
├── docs/BACKEND_DESIGN.md   # data model, lifecycle, API, concurrency design
└── docker-compose.yml   # local MongoDB (single-node replica set)
```

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22+ | `node -v` |
| npm | 10+ | ships with Node |
| MongoDB | 7+ | via Docker, Homebrew, or Atlas (see step 1) |
| Expo Go app | latest | on your phone, **or** Xcode (iOS Simulator) / Android Studio (emulator) |

## 1. Start MongoDB

The backend needs MongoDB running as a **replica set**. Multi-document transactions (used to book spots safely when many users register at once) don't work on a standalone server. Choose one option:

### Option A: Docker (recommended)

```bash
docker compose up -d
```

This starts `mongo:8` on `localhost:27017` and initialises replica set `rs0` automatically. Data is kept in the `mongo-data` volume.
Stop it with `docker compose down`; add `-v` to wipe the data.

### Option B: Homebrew (macOS, no Docker)

```bash
brew tap mongodb/brew
brew trust mongodb/brew          # newer Homebrew refuses formulae from third-party taps until trusted
brew install mongodb-community
mkdir -p ~/data/feedants-db
mongod --replSet rs0 --dbpath ~/data/feedants-db --port 27017   # keep this terminal open
# in a second terminal, one time only:
mongosh --eval "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'localhost:27017' }] })"
```

### Option C: MongoDB Atlas (cloud)

Create a free cluster, add your IP to the access list, and use its `mongodb+srv://…/feedants` connection string as `MONGODB_URI` in step 2. Atlas clusters are already replica sets.

## 2. Backend

```bash
cd backend
cp .env.example .env      # works as-is for local development
npm install
npm run dev               # http://localhost:4000, auto-reloads on changes
```

**Demo data loads automatically.** The first time the API starts against an **empty** database, it loads the default competitions and demo users by itself. It never touches a database that already has competitions. To turn this off, set `SEED_DEMO_DATA=false`. To reset to fresh demo data at any time, run `npm run seed`.

Check it:

```bash
curl http://localhost:4000/api/v1/health
# {"status":"ok","db":"connected","time":"..."}
curl http://localhost:4000/api/v1/competitions/feedants-classical-dance-2026
```

### Demo data

Every date is computed **from the moment the data is loaded**, so on any day you get a realistic mix of past (stale), ongoing and upcoming competitions:

| Stage | Competition (slug) | State |
|---|---|---|
| Ongoing | `feedants-classical-dance-2026` | **The design screen**: registration open (closes in ~1d 6h), submissions open, 1 / 20 booked |
| Ongoing | `feedants-folk-dance-2026` | Registration open but **full** (20 / 20) |
| Ongoing | `street-photography-walk` | Registration closed, submissions still open (free entry) |
| Upcoming | `feedants-semi-classical-2026` | Registration opens in 3 days |
| Upcoming | `hindi-poetry-slam` | Registration opens in 10 days |
| Past | `feedants-classical-dance-spring` | Ended a month ago. The demo user took part, so **they can rate it** and rate fellow participants. Its winners are the "Previous Winners" on the design screen |
| Past | `monsoon-singing-showdown` | Ended ~2.5 months ago, with ratings |
| Past | `standup-comedy-open-mic` | **Cancelled** |

| Demo account (log in with phone) | Who |
|---|---|
| `9999999999` | **Participant** (Demo User): has a sportsmanship rating and a past competition to rate |
| `8888888888` | **Organizer** (Feedants Team): owns all the competitions above; use the **+** tab to create or edit |

New users **sign up** with a name and phone number and start with an empty profile: placeholder photo, all stats at zero. There is no OTP in this build (`POST /api/v1/auth/signup`, `POST /api/v1/auth/login`).

**Payments:** with `PAYMENT_PROVIDER=mock`, no Razorpay account is needed. `POST /api/v1/payments/mock/checkout` stands in for the Razorpay checkout sheet and returns a correctly signed payment.

### Backend environment variables (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Port the API listens on |
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `MONGODB_URI` | – (**required**) | MongoDB connection string; must be a replica set (`?replicaSet=rs0` locally) |
| `JWT_SECRET` | – (**required**) | Secret for signing login tokens. Generate one with `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `CORS_ORIGIN` | `*` | Comma-separated allowed origins |
| `PUBLIC_BASE_URL` | `http://localhost:4000` | Public URL of the API, used in links to uploaded files |
| `APP_URL` | `https://feedants.com` | Base of referral links (`<APP_URL>/r/<code>`) |
| `REGISTRATION_HOLD_MINUTES` | `10` | How long a spot is held while the user pays |
| `HOLD_SWEEP_INTERVAL_MS` | `30000` | How often abandoned holds are released |
| `PAYMENT_PROVIDER` | `mock` | `mock` (no keys needed) or `razorpay` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | – | Required only when `PAYMENT_PROVIDER=razorpay` |
| `SEED_DEMO_DATA` | `true` | Load the demo data on first start against an empty database |
| `UPLOAD_DIR` | `uploads` | Where submission files are stored (local disk) |
| `MAX_UPLOAD_MB` | `100` | Maximum submission file size |

### Backend scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run with hot reload (tsx) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm run seed` | Reset the database with demo data |
| `npm test` | Run the test suite. No MongoDB needed; it starts its own in-memory replica set (the first run downloads a MongoDB binary) |
| `npm run typecheck` | Type-check source and tests |

## 3. Frontend (React Native / Expo)

```bash
cd frontend
cp .env.example .env      # nothing to edit for local development
npm install
npx expo start
```

Expo prints a QR code and a menu. Choose where to open the app:

| Option | Opens the app in | Needs |
|---|---|---|
| **Scan the QR code** | **Your phone, via Expo Go** (the real mobile app) | The Expo Go app; phone on the **same Wi-Fi** as the computer |
| `w` | Web browser at **http://localhost:8081** | Nothing extra |
| `i` | iOS Simulator | Xcode (full install from the App Store) |
| `a` | Android emulator | Android Studio with an emulator set up |

> If port 8081 is taken (for example by another Expo project), Expo asks to use the next free port (8082, 8083, …). Use the URL shown in the terminal.

### Open on your phone (Expo Go)

1. Install **Expo Go** from the App Store (iPhone) or Play Store (Android).
2. Connect the phone to the **same Wi-Fi network** as your computer.
3. Run `npx expo start` in `frontend/`.
4. Scan the QR code:
   - **iPhone:** use the Camera app, then tap the banner that opens Expo Go.
   - **Android:** open Expo Go and tap **Scan QR code**.
5. The app loads on the phone. Save a file and it reloads automatically. Shake the phone to open the dev menu.

The app finds the backend automatically: it uses the IP of the computer running Expo (for example `http://192.168.1.5:4000`), so you don't need to edit anything.

If the phone can't connect (different networks, office or guest Wi-Fi that blocks devices from reaching each other), run `npx expo start --tunnel` instead. The app then loads through a tunnel, but the backend still has to be reachable, so also set `EXPO_PUBLIC_API_URL` (see below).

## 4. Check everything works

With MongoDB, the backend and Expo all running:

| What | Where | Expected |
|---|---|---|
| **App (phone)** | Scan the QR code with Expo Go | Home lists open competitions; tap **Feedants Classical Dance** |
| **App (web preview)** | **http://localhost:8081** | Same app in the browser (development convenience only; the app targets mobile) |
| API health | http://localhost:4000/api/v1/health | `{"status":"ok","db":"connected",...}` |
| MongoDB | `mongodb://localhost:27017/feedants?replicaSet=rs0` | `mongosh` connects; `rs.status()` shows `PRIMARY` |

The **Profile** tab shows which backend URL the app is using and whether the API and database are reachable, which helps with debugging.

### Try the full flow

1. Open **Competitions → Feedants Classical Dance**. As a guest the button reads **Register Now · ₹ 99 / Log in to register**.
2. Tap it and log in with the prefilled demo phone `9999999999`.
3. Tap **Register Now**. The spot is held for 10 minutes (spots left drops by one) and the checkout sheet opens.
4. Tap **Pay ₹ 99** (mock checkout, no real money). The badge changes to **Registered** and the button to **Upload Submission**.
5. Tap **Upload Submission** and pick a video. The button shows upload progress and then changes to **Update Submission / Submitted**.
6. Toggle **हिंदी** in the header: the labels and competition content switch to Hindi.
7. Open **Feedants Folk Dance** (full) and **Feedants Semi-Classical Dance** (upcoming) to see the other states.
8. **Browse:** the Competitions tab opens on **Active** (upcoming + ongoing), so old competitions never look current. Switch to **Past** or **All**, search, or use the filter button (category, free/paid, spots left, sort).
9. **Rate:** open **Past → Feedants Classical Dance: Spring Edition**, tap **Rate this competition** (stars for the competition and the organizer), then **Rate fellow participants** (sportsmanship).
10. **Profiles:** tap **Organized by** on any competition to open the organizer's public profile (rating, competitions by Upcoming / Ongoing / Past). Your **Profile** tab shows registered / submitted / no-shows / won, your sportsmanship rating, **Edit profile** (photo, name, city, bio) and **My competitions**.
11. **Organize:** log out, log in as `8888888888`, open the **+** tab. Edit, publish, cancel, or tap **New competition** and go through the 6 steps (basics, schedule, spots & prizes, judge, details, review).

Run `npm run seed` in `backend/` to reset everything to the starting state.

### Frontend scripts

| Command | What it does |
|---|---|
| `npx expo start` | Start the dev server (QR code for Expo Go) |
| `npm test` | Unit tests (button-state logic, formatting) |
| `npm run lint` | ESLint (Expo config) |
| `npm run typecheck` | TypeScript check |

### Frontend environment variables (`frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | No | Overrides the backend URL. If unset: web uses `http://localhost:4000`; phones and emulators use `http://<computer running Expo>:4000`. Set it only for a deployed backend or an unusual network setup. |

After changing `.env`, restart Expo with `npx expo start -c` to clear the cache.

## Troubleshooting

- **`Refusing to load formula mongodb/brew/mongodb-community from untrusted tap`:** run `brew trust mongodb/brew`, then `brew install mongodb-community` again. Use `brew trust --formula mongodb/brew/mongodb-community` instead to trust only that one formula.
- **`MongoServerSelectionError` / backend exits on start:** MongoDB isn't running, or `MONGODB_URI` is wrong. Check with `mongosh "$MONGODB_URI"`.
- **`mongod` keeps logging `ReadConcernMajorityNotAvailableYet` / `Collection [local.oplog.rs] not found`:** these are harmless. The replica set just hasn't been initialised yet. Run the one-time `rs.initiate(...)` from step 1 and they stop. Check with `mongosh --eval "rs.status().members[0].stateStr"`, which should print `PRIMARY`.
- **`Transaction numbers are only allowed on a replica set member`:** Mongo is running standalone. Start it with `--replSet rs0` and run `rs.initiate(...)` (step 1).
- **The app shows "Backend unreachable":** check the API URL printed on the screen. On a phone, make sure it's on the same Wi-Fi as the computer and that `http://<that-ip>:4000/api/v1/health` opens in the phone's browser. If it doesn't, the network or the macOS firewall (System Settings → Network → Firewall) is blocking it.
- **Expo Go says the project is incompatible / needs a newer SDK:** update Expo Go from the app store. This project uses Expo SDK 57.
- **Opening the Expo URL in a browser shows JSON (a manifest) instead of the app:** press `w` in the Expo terminal, or restart with `npx expo start --web`. The plain Expo URL serves the native manifest; `w` opens the web build.
- **Port 4000 is already in use:** change `PORT` in `backend/.env` and update `EXPO_PUBLIC_API_URL` to match.

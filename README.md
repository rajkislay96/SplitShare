# SplitShare

A complete Splitwise-style expense-splitting app: create groups, add shared expenses
(split equally, by exact amounts, or by percentage), see who owes who, and settle up.

It's built as a **Progressive Web App (PWA)** with a separate API backend — this means
one codebase works on iPhone and Android (installable from the browser, full-screen,
its own icon), with no app store review, and no developer fee, while still being
"a real app" for your friends to use.

```
splitshare/
├── backend/     Node.js + Express API (auth, groups, expenses, balances)
└── frontend/    React PWA (the app your friends will use)
```

---

## 1. How it works

- **Auth**: email + password, JWT tokens.
- **Groups**: create a group, invite friends by email (they need a SplitShare account).
- **Expenses**: three split types —
  - **Equal** — split evenly among selected people
  - **Exact amounts** — you specify exactly what each person owes
  - **Percentage** — you specify what % each person owes
- **Balances**: for every group, the app calculates who owes who, and suggests the
  *minimum number of payments* needed to settle everyone up (the same debt-simplification
  trick Splitwise uses).
- **Settle up**: record a payment between two people to clear a debt.

All money is stored in **cents** as integers in the database, to avoid floating-point
rounding bugs — the classic mistake in DIY expense splitters.

---

## 2. Running it locally

You'll need [Node.js](https://nodejs.org) 18+ and a Postgres database (local or free cloud one — see Step 3).

### Backend

```bash
cd backend
npm install
cp .env.example .env     # then edit .env with your DATABASE_URL and a JWT_SECRET
psql "<your DATABASE_URL>" -f schema.sql   # creates the tables
npm start                # runs on http://localhost:4000
```

Generate a strong `JWT_SECRET` with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env     # set VITE_API_URL to your backend URL (http://localhost:4000 for local)
npm run dev               # runs on http://localhost:5173
```

Open `http://localhost:5173` in your browser — sign up, create a group, add an expense.

---

## 3. Deploying it for real (so friends can use it on their phones)

You need three free-tier accounts. Total cost: **$0/month** to start.

### Step A — Database (Neon, free Postgres)

1. Go to [neon.tech](https://neon.tech) → sign up → "Create a project."
2. Copy the connection string it gives you (looks like `postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require`).
3. Run the schema against it once, from your machine:
   ```bash
   psql "<your neon connection string>" -f backend/schema.sql
   ```

(Supabase is a fine alternative to Neon if you prefer it — same idea.)

### Step B — Backend (Render, free web service)

1. Push this whole project to a GitHub repo.
2. Go to [render.com](https://render.com) → "New +" → "Web Service" → connect your repo.
3. Set **Root Directory** to `backend`.
4. Build command: `npm install`   Start command: `npm start`
5. Add environment variables in the Render dashboard:
   - `DATABASE_URL` = your Neon connection string
   - `JWT_SECRET` = the random string you generated earlier
6. Deploy. Render gives you a URL like `https://splitshare-api.onrender.com`.

(Railway or Fly.io work the same way if you prefer them.)

> Free-tier note: Render's free web services sleep after inactivity and take ~30s to
> wake up on the next request. Fine for friends-and-family use; upgrade to a paid
> instance ($7/mo) later if that delay bothers you.

### Step C — Frontend (Vercel, free static hosting)

1. Go to [vercel.com](https://vercel.com) → "Add New Project" → import the same repo.
2. Set **Root Directory** to `frontend`.
3. Add environment variable: `VITE_API_URL` = your Render backend URL from Step B.
4. Deploy. Vercel gives you a URL like `https://splitshare.vercel.app`.

Share that link with friends. On iPhone: open in Safari → Share → "Add to Home Screen."
On Android: open in Chrome → it'll prompt "Install app" automatically (or use the
menu → "Install app"). Either way it now behaves like a native app with its own icon.

---

## 4. Optional: getting it into the actual Google Play Store

The PWA above already works like an app on Android without the Play Store. If you
specifically want a Play Store listing too, you don't need to rewrite anything —
you wrap the deployed PWA as an Android app:

1. Go to [pwabuilder.com](https://www.pwabuilder.com) and enter your deployed frontend
   URL (from Step C above).
2. It scores your PWA and generates a signed Android App Bundle (`.aab`) for you —
   this wraps your existing site in a "Trusted Web Activity," a thin native shell.
3. Create a [Google Play Developer account](https://play.google.com/console) —
   **one-time $25 fee**, tied to your Google account.
4. In Play Console: "Create app" → fill in the store listing (screenshots, description,
   privacy policy URL — required even for simple apps) → upload the `.aab` from step 2
   → submit for review.
5. Google's review typically takes a few hours to a few days for a new app.

This last part has to happen under your own Google account, since it involves your
identity, payment, and agreeing to Google's developer terms — nothing I can do on your
behalf. But everything up to that point (the actual app) is done.

---

## 5. Project structure reference

```
backend/
  schema.sql              Database tables
  src/
    index.js              Express app entry point
    db.js                 Postgres connection pool
    middleware/auth.js    JWT verification
    routes/
      auth.js              signup / login / me
      groups.js            create/list/view groups, add members, balances
      expenses.js          create/list/delete expenses (equal/exact/percentage split math)
      settlements.js       record and list payments between members
    utils/balances.js      Balance calculation + debt-simplification algorithm

frontend/
  src/
    api.js                 Fetch wrapper for the backend
    context/AuthContext.jsx
    pages/
      Login.jsx, Signup.jsx
      Dashboard.jsx         list of groups
      GroupDetail.jsx       expense ledger + balances + settle up
    components/
      CreateGroupModal.jsx
      AddExpenseModal.jsx   the three split-type UIs
      SettleUpModal.jsx
      Avatar.jsx
    format.js               money/date formatting helpers
  vite.config.js             PWA plugin config (manifest, service worker)
  public/icons/              app icons
```

## 6. Things you may want to add later

- Password reset (currently there's no "forgot password" flow)
- Push notifications when someone adds an expense (needs a bit more setup on iOS)
- Receipt photo uploads
- Multiple currencies
- Expense categories / recurring expenses

The codebase is small and readable enough that a developer (or Claude) can add any
of these without much trouble.

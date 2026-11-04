# SMARTDERIVBOT

A demo-first Deriv Synthetic Indices dashboard with a Next.js web client and an always-on Node.js worker.

## Implemented in this release

- Next.js dashboard routes: `/`, `/d-circle`, `/bot-runner`, and `/auto-strategy`.
- Worker-owned Deriv WebSocket connection and tick subscription.
- Rolling last-1,000-tick digit frequency stream (digits 0–9).
- Deriv API token authorization held in worker memory only.
- Manual one-tick Digit Over / Digit Under proposal and buy flow.
- Contract settlement notifications and session P/L counters.
- Demo-account-only trading by default.
- Worker access-key protection for HTTP API and Socket.IO.
- Configurable maximum stake, session loss lockout, and trade-count limit.
- Dockerfile and Railway deployment configuration for the persistent worker.
- GitHub Actions typecheck/build workflow.

## Safety and scope

This is a **demo deployment candidate**, not a verified production trading system and not financial advice. No strategy can guarantee profit. Keep live trading disabled.

The Over 3 / Under 6 page currently monitors simple digit trigger conditions only; it does not run an automated trading strategy. The DBot page does not execute imported XML/JSON. User accounts, multi-user isolation, durable database storage, worker failover/recovery of open contracts, full market catalogue validation, and automated strategy execution are not included. Do not expose a shared worker to untrusted users.

The worker's risk limits are in-memory session controls, not a persistent daily risk ledger. A restart resets them. Test all contract parameters and settlement handling on a Deriv demo account before any further release.

## Requirements

- Node.js 22+
- npm 10+
- Deriv account and a demo API token with read and trade permissions
- Deriv application ID

## Local setup (Windows PowerShell)

1. Clone the repository and open PowerShell in its root folder.
2. Install dependencies:

   ```powershell
   npm install
   ```

3. Copy the worker environment template:

   ```powershell
   Copy-Item apps/worker/.env.example apps/worker/.env
   ```

4. Edit `apps/worker/.env` and set:
   - `DERIV_APP_ID`: your Deriv application ID.
   - `WEB_ORIGIN=http://localhost:3000`.
   - `API_ACCESS_KEY`: a long random secret (at least 32 characters).
   - Keep `ALLOW_REAL_TRADING=false`.
   - Keep conservative `MAX_STAKE`, `MAX_DAILY_LOSS`, and `MAX_SESSION_TRADES`.

5. Start the worker in the first terminal:

   ```powershell
   npm run dev:worker
   ```

6. In a second terminal, start the dashboard:

   ```powershell
   npm run dev:web
   ```

7. Open http://localhost:3000, visit D-Circle, enter the worker access key and authorize with a demo token.

## Deployment

### 1. Deploy the worker to Railway

Create a Railway project from this GitHub repository. Configure the service to build with `apps/worker/Dockerfile` (or use the included `railway.toml`). Add these variables in Railway:

- `PORT` (Railway supplies this automatically; the app uses it)
- `DERIV_APP_ID`
- `WEB_ORIGIN` = the exact HTTPS Vercel dashboard origin, e.g. `https://your-app.vercel.app`
- `API_ACCESS_KEY` = a unique long random secret; do not commit it
- `ALLOW_REAL_TRADING=false`
- `MAX_STAKE=5`
- `MAX_DAILY_LOSS=20`
- `MAX_SESSION_TRADES=50`

Generate a public HTTPS domain for the worker. Confirm `https://YOUR-WORKER-DOMAIN/health` returns JSON with `ok: true`. The health endpoint is intentionally public and does not expose tokens or balances.

### 2. Deploy the dashboard to Vercel

Import the same repository into Vercel. Keep the project root at the repository root and use the included `vercel.json`. Set this environment variable:

- `NEXT_PUBLIC_WORKER_URL=https://YOUR-WORKER-DOMAIN`

Deploy. Open the Vercel URL, visit D-Circle, enter the same `API_ACCESS_KEY` configured on Railway, then authorize using a Deriv demo API token. Never put the Deriv token or worker access key in a committed file or in a `NEXT_PUBLIC_*` environment variable.

### 3. Verify the demo release

- Confirm the dashboard can reach the worker and receive live tick updates.
- Confirm all 10 digit frequencies update and the sample count caps at 1,000.
- Confirm a demo authorization shows the demo-account status.
- Place only the minimum affordable demo contract and verify its settlement event.
- Test invalid token, invalid market, stake above the cap, and loss-lockout behavior.
- Restart the worker and verify it reconnects; note that current in-memory session counters and tick history reset after restart.

## Environment variables

| Variable | Service | Purpose |
|---|---|---|
| `DERIV_APP_ID` | Worker | Deriv WebSocket app ID |
| `WEB_ORIGIN` | Worker | Allowed dashboard origin(s), comma-separated |
| `API_ACCESS_KEY` | Worker | Protects worker API and Socket.IO |
| `ALLOW_REAL_TRADING` | Worker | Must remain `false` |
| `MAX_STAKE` | Worker | Maximum per-contract stake |
| `MAX_DAILY_LOSS` | Worker | Session loss lockout threshold (not durable daily accounting) |
| `MAX_SESSION_TRADES` | Worker | Session contract-count cap |
| `NEXT_PUBLIC_WORKER_URL` | Web | Public HTTPS worker base URL |

## Repository scripts

```bash
npm run dev:web
npm run dev:worker
npm run typecheck
npm run build
```

Do not use live funds with this release. Automated Over 3 / Under 6 trading, DBot compilation, persistent risk accounting, multi-user authentication, and end-to-end verification remain future work.

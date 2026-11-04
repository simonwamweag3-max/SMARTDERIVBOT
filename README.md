# SMARTDERIVBOT

A Deriv Synthetic Indices quantitative trading dashboard and persistent execution worker.

## Architecture
- `apps/web`: Next.js App Router dashboard (`/d-circle`, `/bot-runner`, `/auto-strategy`).
- `apps/worker`: persistent Node.js service that owns the Deriv WebSocket, tick buffer, strategy state and order execution.
- Dashboard hosting: Vercel. The worker must run on an always-on Node.js host; Vercel serverless functions are not suitable for persistent trading loops.

## Local setup
Requires Node.js 20+ and npm 10+.

```bash
npm install
cp apps/worker/.env.example apps/worker/.env
npm run dev:worker
# in another terminal
npm run dev:web
```

Open http://localhost:3000 and authorize with a Deriv **demo** token. Configure `DERIV_APP_ID` and `WEB_ORIGIN` in the worker environment.

## Safety
This is an experimental starter, not a production-certified trading system or evidence of a profitable strategy. Demo-test and review all contract parameters before live use. Never commit API tokens or `.env` files. Imported DBot files are inspection-only; arbitrary XML/JSON execution is not enabled. Real trading is disabled by default and requires an explicit worker-side configuration change.

See the README sections and `.env.example` files for deployment and configuration details.

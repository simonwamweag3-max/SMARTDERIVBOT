# SMARTDERIVBOT

Deriv Synthetic Indices dashboard and worker scaffold.

## Current contents
- Next.js App Router pages: /d-circle, /bot-runner, /auto-strategy.
- Dark trading-terminal UI and market catalogue preview.
- Node.js worker service scaffold with Deriv WebSocket connection, tick-frequency events and health endpoint.
- Environment templates and Vercel build configuration.

## Important implementation status
This commit is an **early development scaffold**, not a complete trading product. The dashboard route controls are partly visual placeholders; manual proposal/buy execution, authenticated session recovery, full Deriv market catalogue, durable worker state, trade settlement monitoring, and the Over 3 / Under 6 automated state machines still require implementation and end-to-end tests. DBot XML/JSON files are not executed. Do not use this scaffold for live-money trading.

## Local setup
Requires Node.js 20+ and npm 10+.

    npm install
    copy apps/worker/.env.example to apps/worker/.env
    set DERIV_APP_ID and WEB_ORIGIN in apps/worker/.env
    npm run dev:worker
    npm run dev:web

Open http://localhost:3000. Use a Deriv demo account only while developing. The worker listens on port 4001.

## Deployment
Deploy apps/web to Vercel (or configure the monorepo root build command). Deploy apps/worker to an always-on Node.js host with TLS; do not run persistent trading loops inside Vercel serverless functions. Configure DERIV_APP_ID, WEB_ORIGIN, and ALLOW_REAL_TRADING=false on the worker host.

Never commit account tokens or .env files. This software is experimental and does not imply a profitable trading strategy. Validate contract parameters and test on demo before considering any real account.

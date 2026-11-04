import "dotenv/config";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import http from "http";
import { timingSafeEqual } from "crypto";

type Pending = { resolve: (value: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout };
const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.WEB_ORIGIN || "http://localhost:3000").split(",").map(v => v.trim());
const io = new Server(server, { cors: { origin: allowedOrigins } });
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "32kb" }));
app.disable("x-powered-by");
const accessKey = process.env.API_ACCESS_KEY || "";
if (process.env.NODE_ENV === "production" && accessKey.length < 32) {
  throw new Error("API_ACCESS_KEY must be set to a unique secret of at least 32 characters in production");
}
function keyMatches(value: string) { const a = Buffer.from(value); const b = Buffer.from(accessKey); return a.length === b.length && timingSafeEqual(a, b); }
app.use("/api", (req, res, next) => { if (!accessKey || keyMatches(String(req.header("x-api-key") || ""))) return next(); res.status(401).json({ error: "Invalid or missing worker access key" }); });
io.use((socket, next) => { if (!accessKey || keyMatches(String(socket.handshake.auth?.apiKey || ""))) return next(); next(new Error("Invalid worker access key")); });

let ws: WebSocket | undefined;
let socketReady: Promise<void> | undefined;
let authorized = false;
let isVirtual = false;
let currency = "";
let balance: number | null = null;
let market = "R_100";
let tickSubscription: string | undefined;
let ticks: number[] = [];
let reqId = 0;
let reconnectTimer: NodeJS.Timeout | undefined;
const pending = new Map<number, Pending>();
const allowedMarkets = new Set(["R_10","R_25","R_50","R_75","R_100","1HZ10V","1HZ25V","1HZ50V","1HZ75V","1HZ100V","JD10","JD25","JD50","JD75","JD100","RDBEAR","RDBULL"]);
const MAX_STAKE = Number(process.env.MAX_STAKE || 5);
const MAX_DAILY_LOSS = Number(process.env.MAX_DAILY_LOSS || 20);
let sessionPnl = 0;
let sessionTrades = 0;

function emitStatus() { io.emit("worker-status", { connected: ws?.readyState === WebSocket.OPEN, authorized, isVirtual }); }
function connect(): Promise<void> {
  if (ws?.readyState === WebSocket.OPEN) return Promise.resolve();
  if (socketReady) return socketReady;
  socketReady = new Promise((resolve, reject) => {
    const appId = process.env.DERIV_APP_ID;
    if (!appId) { socketReady = undefined; reject(new Error("DERIV_APP_ID is not configured")); return; }
    const s = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=" + encodeURIComponent(appId));
    ws = s;
    const timeout = setTimeout(() => { socketReady = undefined; reject(new Error("Deriv connection timed out")); s.close(); }, 12000);
    s.onopen = () => { clearTimeout(timeout); emitStatus(); resolve(); };
    s.onerror = () => { clearTimeout(timeout); socketReady = undefined; reject(new Error("Unable to connect to Deriv WebSocket")); };
    s.onmessage = event => {
      let data: any;
      try { data = JSON.parse(String(event.data)); } catch { return; }
      if (data.req_id && pending.has(data.req_id)) {
        const item = pending.get(data.req_id)!; pending.delete(data.req_id); clearTimeout(item.timer);
        data.error ? item.reject(new Error(data.error.message || "Deriv request failed")) : item.resolve(data);
      }
      if (data.msg_type === "authorize") {
        authorized = true; isVirtual = Boolean(data.authorize?.is_virtual); balance = Number(data.authorize?.balance); currency = String(data.authorize?.currency || "");
        io.emit("balance", { balance, currency, isVirtual }); emitStatus();
      }
      if (data.msg_type === "balance" && data.balance) {
        balance = Number(data.balance.balance); currency = String(data.balance.currency || currency);
        io.emit("balance", { balance, currency, isVirtual });
      }
      if (data.msg_type === "tick" && data.tick) {
        const quote = String(data.tick.quote);
        const digit = Number(quote.replace(".", "").slice(-1));
        if (Number.isInteger(digit) && digit >= 0 && digit <= 9) {
          ticks.push(digit); if (ticks.length > 1000) ticks.shift();
          const counts = Array(10).fill(0); ticks.forEach(n => counts[n]++);
          io.emit("stats", { count: ticks.length, currentDigit: digit, frequencies: counts.map(n => ticks.length ? n / ticks.length * 100 : 0), market });
          io.emit("tick", { quote, epoch: data.tick.epoch, digit, market });
        }
      }
      if (data.msg_type === "proposal_open_contract" && data.proposal_open_contract?.is_sold) {
        const p = data.proposal_open_contract; sessionTrades++;
        const profit = Number(p.profit || 0); sessionPnl += profit;
        io.emit("trade-settled", { contractId: p.contract_id, profit, status: p.status, sessionPnl, sessionTrades });
      }
    };
    s.onclose = () => {
      clearTimeout(timeout); ws = undefined; socketReady = undefined; authorized = false; tickSubscription = undefined;
      emitStatus();
      for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error("Deriv connection closed")); }
      pending.clear();
      if (!reconnectTimer) reconnectTimer = setTimeout(() => { reconnectTimer = undefined; connect().catch(() => undefined); }, 2500);
    };
  });
  return socketReady;
}
async function send(payload: Record<string, unknown>): Promise<any> {
  await connect();
  if (!ws || ws.readyState !== WebSocket.OPEN) throw new Error("Deriv socket is not connected");
  const id = ++reqId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error("Deriv request timed out")); }, 12000);
    pending.set(id, { resolve, reject, timer });
    ws!.send(JSON.stringify({ ...payload, req_id: id }));
  });
}
async function subscribeTicks() {
  if (tickSubscription) { try { await send({ forget: tickSubscription }); } catch {} tickSubscription = undefined; }
  const result = await send({ ticks: market, subscribe: 1 });
  tickSubscription = result.subscription?.id;
}
function requireDemo() {
  if (!authorized) throw new Error("Authorize a Deriv account first");
  if (!isVirtual && process.env.ALLOW_REAL_TRADING !== "true") throw new Error("Live accounts are blocked. Use a Deriv demo account.");
}
function validStake(value: unknown): number {
  const stake = Number(value);
  if (!Number.isFinite(stake) || stake < 0.35 || stake > MAX_STAKE) throw new Error(`Stake must be between 0.35 and ${MAX_STAKE} ${currency || "account currency"}`);
  if (sessionPnl <= -MAX_DAILY_LOSS) throw new Error("Session loss limit reached. Trading is locked.");
  return Math.round(stake * 100) / 100;
}

app.get("/health", (_req, res) => res.json({ ok: true, connected: ws?.readyState === WebSocket.OPEN, authorized, isVirtual, market, tickCount: ticks.length, sessionPnl, sessionTrades }));
app.get("/api/state", (_req, res) => res.json({ connected: ws?.readyState === WebSocket.OPEN, authorized, isVirtual, market, balance, currency, tickCount: ticks.length, sessionPnl, sessionTrades, maxStake: MAX_STAKE, maxDailyLoss: MAX_DAILY_LOSS }));
app.post("/api/authorize", async (req, res) => {
  try {
    const supplied = String(req.body?.token || "").trim();
    if (supplied.length < 10 || supplied.length > 4096) throw new Error("Enter a valid Deriv API token");
    const result = await send({ authorize: token });
    authorized = true; isVirtual = Boolean(result.authorize?.is_virtual);
    balance = Number(result.authorize?.balance); currency = String(result.authorize?.currency || "");
    if (!isVirtual && process.env.ALLOW_REAL_TRADING !== "true") { authorized = false; throw new Error("Live account authorization is disabled. Please use a demo token."); }
    await subscribeTicks();
    res.json({ ok: true, balance, currency, isVirtual, market });
  } catch (error: any) { authorized = false; res.status(400).json({ error: error.message || "Authorization failed" }); }
});
app.post("/api/market", async (req, res) => {
  try {
    requireDemo();
    const symbol = String(req.body?.symbol || "");
    if (!allowedMarkets.has(symbol)) throw new Error("Unsupported market symbol");
    market = symbol; ticks = []; await subscribeTicks();
    res.json({ ok: true, market });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});
app.post("/api/trade", async (req, res) => {
  try {
    requireDemo();
    const stake = validStake(req.body?.stake);
    const kind = String(req.body?.kind || "");
    if (kind !== "DIGITOVER" && kind !== "DIGITUNDER") throw new Error("Only digit Over/Under contracts are supported");
    const barrier = Number(req.body?.barrier);
    if (!Number.isInteger(barrier) || barrier < 0 || barrier > 9) throw new Error("Barrier must be a digit from 0 to 9");
    if (sessionTrades >= Number(process.env.MAX_SESSION_TRADES || 50)) throw new Error("Session trade limit reached");
    const proposal = await send({ proposal: 1, amount: stake, basis: "stake", contract_type: kind, currency, duration: 1, duration_unit: "t", symbol: market, barrier: String(barrier) });
    const proposalId = proposal.proposal?.id;
    if (!proposalId) throw new Error("Deriv did not return a valid proposal");
    const bought = await send({ buy: proposalId, price: stake });
    const contractId = bought.buy?.contract_id;
    if (!contractId) throw new Error("Deriv did not confirm the contract purchase");
    await send({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 });
    res.json({ ok: true, contractId, buyPrice: bought.buy?.buy_price, payout: proposal.proposal?.payout, longcode: proposal.proposal?.longcode, kind, barrier, stake });
  } catch (error: any) { res.status(400).json({ error: error.message || "Trade failed" }); }
});
app.post("/api/disconnect", (_req, res) => {
  authorized = false; isVirtual = false; balance = null; currency = ""; ticks = [];
  try { ws?.close(); } catch {}
  res.json({ ok: true });
});
io.on("connection", socket => socket.emit("snapshot", { balance, currency, market, tickCount: ticks.length, authorized, isVirtual, sessionPnl, sessionTrades }));
server.listen(Number(process.env.PORT || 4001), () => { console.log("SMARTDERIVBOT worker listening"); connect().catch(() => console.error("Deriv connection unavailable; will retry on demand")); });

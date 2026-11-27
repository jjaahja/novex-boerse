// NOVEX Börse – Cloudflare Worker + Durable Object
// Ein einziges Durable Object („Exchange“) hält den gemeinsamen Markt, alle Konten, Sitzungen und die Zentralbank.
//
// Sparsam für den Cloudflare-Free-Plan:
// - WebSockets im Hibernation-Modus: offene Tabs halten das Objekt nicht wach, Pings beantwortet Cloudflare selbst.
// - Live-Takt nur zu Börsenzeiten und nur, wenn jemand online ist. Nachts/am Wochenende schläft das Objekt bis zur Eröffnung.
// - Gespeichert wird nur, was sich geändert hat; Kerzen in wenigen großen Zeilen statt einer pro Wertpapier.
// - Ein Nutzungszähler (Anfragen, geschriebene Zeilen) drosselt Takt und Speicherhäufigkeit, bevor ein Tageslimit erreicht wird.
import { DurableObject } from 'cloudflare:workers';
import * as E from '../public/market.js';
import { BUILD } from '../public/version.js';

const TICK_MS = 5000;               // Live-Takt bei offener Börse
const HOT_SAVE_MS = 60000;          // Marktzustand sichern (zusätzlich sofort nach jedem Trade)
const CANDLE_SAVE_MS = 15 * 60000;  // Kerzenhistorie sichern
const LAZY_SAVE_MS = 15 * 60000;    // Vermögensverlauf der Konten sichern
const IDLE_SAVE_MS = 60000;         // Ohne Verbindungen: Restliches nach 1 Minute sichern, dann schlafen
const MAX_TABS = 3;                 // gleichzeitige Verbindungen je Spieler
const CHUNK = 10;                   // Wertpapiere je Kerzen-Zeile
const SESSION_DAYS = 30;
const DAY = 86400000;
// Tageskontingent des Free-Plans (Durable Objects, setzt um 00:00 UTC zurück) – Annahme, siehe README
export const BUDGET = { req: 100000, wr: 100000 };

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) return env.EXCHANGE.get(env.EXCHANGE.idFromName('novex')).fetch(req);
    return env.ASSETS.fetch(req);
  }
};

/* ---------- Hilfen ---------- */
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const num = (v, d) => { const n = Number(v); return isFinite(n) && n >= 0 ? n : d; };
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function sha256(s) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(s))); }
async function pbkdf2(pw, saltHex) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256));
}
function eqStr(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
async function safeEq(a, b) { return eqStr(await sha256(a), await sha256(b)); }
const BERLIN = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
function berlinNow() {
  const now = Date.now(), p = {};
  for (const x of BERLIN.formatToParts(new Date(now))) p[x.type] = x.value;
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) + now % 1000;
}
const round9 = (k, v) => typeof v === 'number' && !Number.isInteger(v) ? +v.toPrecision(9) : v;
const round7 = (k, v) => typeof v === 'number' && !Number.isInteger(v) ? +v.toPrecision(7) : v;
const round8 = (k, v) => typeof v === 'number' && !Number.isInteger(v) ? +v.toPrecision(8) : v;
const utcDay = () => Math.floor(Date.now() / DAY);
const tag = uid => 'u' + uid;

export class Exchange extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env; this.sql = ctx.storage.sql;
    this.accts = new Map(); this.dirty = new Set(); this.lazy = new Set(); this.inbox = new Map(); this.fails = new Map();
    this.bank = null; this.bankDirty = false; this.hotDirty = false; this.candlesDirty = false; this.touched = false; this.legacy = false;
    this.lastHot = Date.now(); this.lastCandles = Date.now(); this.lastLazy = Date.now(); this.lastBoard = 0; this.savedClose = 0; this.resync = false; this.wasOpen = null;
    this.usage = { day: utcDay(), req: 0, wr: 0 };
    try { ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong')); } catch { }
    ctx.blockConcurrencyWhile(async () => this.boot());
  }
  cfg() {
    const e = this.env;
    return { start: num(e.START_CAPITAL, 10000), reserve: num(e.BANK_RESERVE, 1000000), bonus: num(e.DAILY_BONUS, 250), relief: num(e.RELIEF_AMOUNT, 2000), maxUsers: num(e.MAX_USERS, 30), leagueShare: Math.min(0.2, num(e.LEAGUE_SHARE, 0.01)) };
  }

  /* ---------- Nutzung & Drosselung ---------- */
  bump(kind, n = 1) { const d = utcDay(); if (this.usage.day !== d) this.usage = { day: d, req: 0, wr: 0 }; this.usage[kind] += n; }
  pressure() { this.bump('req', 0); return Math.max(this.usage.req / BUDGET.req, this.usage.wr / BUDGET.wr); }
  tickMs() { const p = this.pressure(); return p < 0.5 ? TICK_MS : p < 0.7 ? 15000 : p < 0.85 ? 60000 : 300000; }
  saveFactor() { const p = this.pressure(); return p < 0.5 ? 1 : p < 0.7 ? 3 : 10; }
  usageInfo() { return { day: new Date(this.usage.day * DAY).toISOString().slice(0, 10), req: this.usage.req, wr: this.usage.wr, budget: BUDGET, tickMs: this.tickMs(), online: this.ctx.getWebSockets().length }; }

  /* ---------- Laden ---------- */
  boot() {
    const s = this.sql;
    s.exec(`CREATE TABLE IF NOT EXISTS blob (k TEXT PRIMARY KEY, v TEXT NOT NULL)`);
    s.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE, hash TEXT NOT NULL, salt TEXT NOT NULL, created INTEGER NOT NULL)`);
    s.exec(`CREATE TABLE IF NOT EXISTS sessions (tok TEXT PRIMARY KEY, uid INTEGER NOT NULL, exp INTEGER NOT NULL)`);
    s.exec(`CREATE TABLE IF NOT EXISTS accounts (uid INTEGER PRIMARY KEY, v TEXT NOT NULL)`);
    const get = k => { const r = s.exec('SELECT v FROM blob WHERE k = ?', k).toArray(); return r.length ? r[0].v : null; };
    let m = null; const raw = get('market');
    if (raw) { try { m = JSON.parse(raw); } catch { m = null; } if (m && m.v !== E.VERSION) m = null; }
    if (m) {
      if (m._usage && m._usage.day === utcDay()) this.usage = m._usage;
      delete m._usage;
      for (const id in m.inst) { const x = m.inst[id]; x.c1 = []; x.cH = []; x.cD = []; x.ts = []; } // auch von der Börse genommene Werte
      for (const r of s.exec("SELECT v FROM blob WHERE k LIKE 'cc:%'").toArray()) { try { const o = JSON.parse(r.v); for (const id in o) if (m.inst[id]) Object.assign(m.inst[id], o[id]); } catch { } }
      for (const r of s.exec("SELECT k, v FROM blob WHERE k LIKE 'c:%'").toArray()) { // ältere Speicherform: eine Zeile je Wertpapier
        this.legacy = true; const id = r.k.slice(2); if (m.inst[id] && !m.inst[id].c1.length) { try { Object.assign(m.inst[id], JSON.parse(r.v)); } catch { } }
      }
      E.setMarket(m);
      if (this.legacy) this.candlesDirty = true;
    } else { E.createWorld(berlinNow()); this.hotDirty = true; this.candlesDirty = true; }
    this.savedClose = E.M.lastClose;
    const cfg = this.cfg(), b = get('bank');
    if (b) this.bank = JSON.parse(b);
    else { this.bank = { initial: cfg.reserve, reserve: cfg.reserve, escrow: 0, minted: 0, paid: 0, fees: 0, lux: Object.fromEntries(E.LUX.map(i => [i.id, i.supply])), league: [] }; this.bankDirty = true; }
    for (const it of E.LUX) if (this.bank.lux[it.id] === undefined) { this.bank.lux[it.id] = it.supply; this.bankDirty = true; }
    for (const r of s.exec('SELECT uid, v FROM accounts').toArray()) { try { this.accts.set(r.uid, E.normalizeAccount(JSON.parse(r.v))); } catch { } }
    E.setEnv({
      accounts: () => this.accts.values(),
      note: (A, msg, tone) => this.note(A, msg, tone),
      dirty: A => this.dirty.add(A.uid),
      fee: amt => { if (amt > 0) { this.bank.reserve += amt; this.bank.fees += amt; this.bankDirty = true; } },
      event: (A, type, data) => this.onEvent(A, type, data),
      week: w => this.settleLeague(w),
      pay: (A, amt, cat, label) => this.credit(A, amt, label, cat, false), // Zinsen aus der Reserve (Rendite, keine Einzahlung)
      collect: amt => { if (amt > 0) { this.bank.reserve += amt; this.bank.fees += amt; this.bankDirty = true; } }
    });
    this.advance();
    this.wasOpen = E.M.isOpen;
    this.flush(true);
  }

  /* ---------- Speichern (nur Geändertes) ---------- */
  put(k, v) { this.sql.exec('INSERT INTO blob (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, v); this.bump('wr'); }
  saveHot() {
    const M = E.M, inst = {};
    for (const id in M.inst) { const { c1, cH, cD, ts, ...rest } = M.inst[id]; inst[id] = rest; }
    this.put('market', JSON.stringify(Object.assign({}, M, { inst, _usage: this.usage }), round9));
    this.lastHot = Date.now(); this.hotDirty = false; this.touched = false;
  }
  saveCandles() {
    const ids = E.M.ids;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const o = {}; for (const id of ids.slice(i, i + CHUNK)) { const x = E.M.inst[id]; o[id] = { c1: x.c1, cH: x.cH, cD: x.cD, ts: x.ts }; }
      this.put('cc:' + (i / CHUNK), JSON.stringify(o, round8));
    }
    if (this.legacy) { const n = this.sql.exec("SELECT COUNT(*) AS n FROM blob WHERE k LIKE 'c:%'").one().n; this.sql.exec("DELETE FROM blob WHERE k LIKE 'c:%'"); this.bump('wr', n); this.legacy = false; }
    this.lastCandles = Date.now(); this.candlesDirty = false; this.savedClose = E.M.lastClose;
  }
  saveAcct(A) { this.sql.exec('INSERT INTO accounts (uid, v) VALUES (?, ?) ON CONFLICT(uid) DO UPDATE SET v = excluded.v', A.uid, JSON.stringify(A, round9)); this.bump('wr'); this.lazy.delete(A.uid); }
  saveBank() { this.put('bank', JSON.stringify(this.bank)); this.bankDirty = false; }
  // force: alles Ungespeicherte jetzt schreiben (vor dem Einschlafen)
  flush(force) {
    for (const uid of this.dirty) {
      const A = this.accts.get(uid); if (!A) continue;
      this.saveAcct(A);
      const notes = this.inbox.get(uid) || []; this.inbox.delete(uid);
      this.sendTo(uid, { type: 'acct', acct: A, notes, ins: E.insightsFor(A) });
    }
    this.dirty.clear();
    if (this.bankDirty) this.saveBank();
    const now = Date.now(), f = this.saveFactor();
    if (this.hotDirty && (force || this.touched || now - this.lastHot >= HOT_SAVE_MS * f)) this.saveHot();
    if (this.candlesDirty && (force || this.savedClose !== E.M.lastClose || now - this.lastCandles >= CANDLE_SAVE_MS * f)) this.saveCandles();
    if (this.lazy.size && (force || now - this.lastLazy >= LAZY_SAVE_MS * f)) { for (const uid of [...this.lazy]) { const A = this.accts.get(uid); if (A) this.saveAcct(A); } this.lazy.clear(); this.lastLazy = now; }
  }
  unsaved() { return this.hotDirty || this.candlesDirty || this.bankDirty || this.lazy.size > 0 || this.dirty.size > 0; }

  /* ---------- Markt fortschreiben & verteilen ---------- */
  advance() { const steps = E.advanceTo(berlinNow()); if (steps) { this.hotDirty = true; this.candlesDirty = true; if (steps > 3) this.resync = true; } }
  send(ws, s) { try { ws.send(s); } catch { } }
  sendTo(uid, msg) { const l = this.ctx.getWebSockets(tag(uid)); if (!l.length) return; const s = JSON.stringify(msg, round9); for (const ws of l) this.send(ws, s); }
  broadcast(msg) { const l = this.ctx.getWebSockets(); if (!l.length) return; const s = JSON.stringify(msg, msg.type === 'tick' ? round7 : round9); for (const ws of l) this.send(ws, s); }
  // Live-Takt im Kompaktformat: je Wertpapier nur Kurs, Tagesumsatz und laufende Minutenkerze.
  // Selten Geändertes (Eröffnung, Hoch/Tief, Begründung, Quartalszahlen, Termine …) nur, wenn es sich geändert hat.
  // seq: fortlaufende Nummer – verpasst der Browser einen Takt, lädt er den Stand neu.
  tickMsg() {
    const M = E.M, d = {}, xs = {}, c = this.tc || (this.tc = { k: {}, s: {}, ts: {}, comp: {}, g: {} }), seq = (this.seq || 0) + 1, full = seq % 6 === 0;
    const ix = M.inst.WELTIX, kb = ix && ix.c1.length ? ix.c1[ix.c1.length - 1][0] : 0; // gemeinsame Minute aller Kerzen
    for (const id of M.ids) {
      const x = M.inst[id], k = x.c1[x.c1.length - 1], ex = {};
      d[id] = k && k[0] === kb ? [x.price, Math.round(x.dv), Math.round(x.dt), k[1], k[2], k[3], Math.round(k[5])] : [x.price, Math.round(x.dv), Math.round(x.dt)];
      if (k && k[0] !== kb) ex.k = k;
      if (k && c.k[id] !== undefined && c.k[id] !== k[0] && x.c1.length > 1) ex.k0 = x.c1[x.c1.length - 2]; // gerade abgeschlossene Minute
      if (k) c.k[id] = k[0];
      const slow = [x.do, x.pc, x.hi, x.lo, Math.round(x.liq * 100), x.why ? x.why.t : 0, x.eps, x.cD.length ? x.cD[x.cD.length - 1][0] : 0].join('|');
      if (c.s[id] !== slow) { c.s[id] = slow; Object.assign(ex, { do: x.do, pc: x.pc, hi: x.hi, lo: x.lo, lq: x.liq, why: x.why, eps: x.eps, cd: x.cD[x.cD.length - 1] }); }
      // Umsätze: nur die seit dem letzten Takt neuen (meist einer)
      const lastT = c.ts[id] || 0, nt = []; for (const t of x.ts) { if (t[0] <= lastT || nt.length >= 4) break; nt.push(t); } if (x.ts.length) c.ts[id] = x.ts[0][0];
      if (nt.length) ex.tn = nt;
      if (x.cls === 'bond') { Object.assign(ex, { acc: x.acc, ytm: x.ytm, dirty: x.dirty }); if (full) Object.assign(ex, { mdur: x.mdur, tri: x.tri, spr: x.spr, idio: x.idio, matured: x.matured, ci: x.ci }); }
      else if (x.cls === 'etf') { Object.assign(ex, { nav: x.nav, prem: x.prem }); if (full) ex.ff = x.ff; }
      else if (x.cls === 'fund') { ex.nav = x.nav; if (full) ex.ff = x.ff; }
      if (x.comp && (x.cls === 'etf' || x.cls === 'fund')) { const cs = x.comp.map(q => q.id + q.c.toPrecision(6)).join(); if (c.comp[id] !== cs) { c.comp[id] = cs; ex.comp = x.comp; } }
      if (x.fin && (this.sentFv || (this.sentFv = {}))[id] !== x.fin.fv) { ex.fin = x.fin; this.sentFv[id] = x.fin.fv; }
      for (const q in ex) { xs[id] = ex; break; }
    }
    const news = M.news.filter(n => n.n > (this.newsN || 0)); if (M.news.length) this.newsN = Math.max(this.newsN || 0, M.news[0].n);
    const msg = { type: 'tick', b: BUILD, seq: this.seq = seq, kb, t: M.t, isOpen: M.isOpen, lv: M.lv, r: M.r, slope: M.slope, U: M.U, week: M.week, lastClose: M.lastClose, eqMark: M.eqMark, d, x: xs, news, resync: this.resync, tickMs: this.tickMs() };
    const g = { bank: this.publicBank(), lz: M.lz, infl: M.infl, reg: M.reg, rp: M.rp, cb: M.cb, cpi: M.cpi, events: M.events, mac: this.macMsg(), fr: M.fr, pol: M.pol, ma: M.ma, idsV: M.idsV };
    for (const key in g) { const j = JSON.stringify(g[key]); if (c.g[key] !== j || key === 'mac' && g.mac && g.mac.h) { c.g[key] = j; msg[key] = g[key]; } }
    this.resync = false;
    return msg;
  }
  // Makrodaten: Verlauf nur einmal je Handelstag mitschicken (spart Datenvolumen)
  macMsg() { const m = E.M.mac; if (!m) return undefined; const { h, ...rest } = m; if (this.sentMacDay !== m.day) { this.sentMacDay = m.day; rest.h = h; } return rest; }
  marketForClient() {
    const M = E.M, inst = {};
    for (const id in M.inst) { const x = M.inst[id]; inst[id] = Object.assign({}, x, { c1: x.c1.slice(-120), cH: [], cD: x.cD.slice(-30), ts: x.ts.slice(0, 8) }); } // lange Verläufe lädt die Detailansicht bei Bedarf (/api/hist)
    return Object.assign({}, M, { inst, sec: undefined, seq: this.seq || 0 }); // Geheimnisse (Überraschungen, Gerüchte, nächste Phase) bleiben auf dem Server
  }
  broadcastBoard() { this.lastBoard = Date.now(); this.broadcast({ type: 'board', board: this.board(), bank: this.publicBank() }); }
  // Nächsten Wecker setzen: Live-Takt nur bei offener Börse mit Zuschauern; sonst zur Eröffnung oder gar nicht.
  async schedule() {
    const now = Date.now(), online = this.ctx.getWebSockets().length > 0;
    let at = Infinity;
    if (online) at = E.M.isOpen ? now + this.tickMs() : now + Math.max(60000, E.nextOpenFrom(E.M.t) - berlinNow() + 1000);
    if (this.unsaved()) at = Math.min(at, now + IDLE_SAVE_MS);
    if (!isFinite(at)) return;
    const cur = await this.ctx.storage.getAlarm();
    if (cur == null || cur <= now || cur > at + 1000) { await this.ctx.storage.setAlarm(at); this.bump('wr'); } // abgelaufene Wecker gelten als nicht gesetzt
  }
  async alarm() {
    this.bump('req');
    this.advance();
    const online = this.ctx.getWebSockets().length > 0, open = E.M.isOpen;
    if (online && (open || this.wasOpen)) { this.broadcast(this.tickMsg()); if (Date.now() - this.lastBoard > 30000) this.broadcastBoard(); }
    this.wasOpen = open;
    this.flush(!online || !open); // niemand online oder Börse zu → alles sichern, danach darf das Objekt schlafen
    await this.schedule();
  }
  async webSocketMessage(ws, msg) { this.bump('req'); if (msg === 'ping') this.send(ws, 'pong'); }
  async webSocketClose(ws, code) { this.bump('req'); try { ws.close(code === 1005 || code === 1006 || !code ? 1000 : code, 'Verbindung beendet'); } catch { } await this.schedule(); }
  async webSocketError(ws) { try { ws.close(1011, 'Fehler'); } catch { } }

  /* ---------- Zentralbank & Ökonomie ---------- */
  scarcity() { return Math.max(0, Math.min(1, this.bank.reserve / this.bank.initial)); }
  bonusAmount(streak) { return E.r2(Math.min(this.bank.reserve, this.cfg().bonus * this.scarcity() * (1 + 0.15 * (Math.min(streak, 7) - 1)))); }
  publicBank() {
    const b = this.bank, cfg = this.cfg();
    let cash = 0; for (const A of this.accts.values()) cash += A.cash;
    return { reserve: b.reserve, initial: b.initial, escrow: b.escrow, minted: b.minted, paid: b.paid, fees: b.fees, lux: b.lux, league: b.league.slice(0, 6), scarcity: this.scarcity(), bonusBase: this.bonusAmount(1), prizePool: E.r2(b.reserve * cfg.leagueShare), leagueShare: cfg.leagueShare, players: this.accts.size, maxUsers: cfg.maxUsers, start: cfg.start, relief: cfg.relief, cash };
  }
  note(A, msg, tone) { const l = this.inbox.get(A.uid) || []; l.push({ msg, tone: tone || '' }); if (l.length > 12) l.splice(0, l.length - 12); this.inbox.set(A.uid, l); this.dirty.add(A.uid); }
  // Auszahlung aus der Reserve. flow = true: Prämie (Einzahlung, zählt nicht als Rendite); false: Zinsen (Rendite)
  credit(A, amt, label, cat = 'prize', flow = true) {
    amt = E.r2(Math.min(amt, this.bank.reserve)); if (!(amt > 0)) return 0;
    this.bank.reserve -= amt; this.bank.paid += amt; this.bankDirty = true;
    A.cash += amt; E.book(A, cat, amt, label);
    if (flow) { A.week.flow += amt; E.extFlow(A, amt); }
    A.hist.unshift({ t: E.M.t, id: '', nm: label, side: cat === 'int' ? 'Zinsen' : 'Gutschrift', q: 1, px: amt, amt, fee: 0, pnl: null }); if (A.hist.length > 300) A.hist.length = 300;
    this.note(A, `${label}: +${E.fmtE(amt)}`, cat === 'int' ? 'div' : 'up'); this.dirty.add(A.uid);
    return amt;
  }
  award(A, id) {
    if (A.ach[id]) return; const def = E.ACH.find(a => a.id === id); if (!def) return;
    A.ach[id] = E.M.t; this.dirty.add(A.uid);
    if (!this.credit(A, def.reward, `Erfolg „${def.name}“`)) this.note(A, `Erfolg „${def.name}“ freigeschaltet – die Zentralbank ist leer, daher ohne Prämie.`, '');
  }
  onEvent(A, type, data) {
    if (type === 'trade' || type === 'deriv' || type === 'fund') { A.stats.trades++; A.week.trades++; }
    if (type === 'trade') { this.award(A, 'first'); if (data && data.limit) { A.stats.limitFills++; if (A.stats.limitFills >= 10) this.award(A, 'limit'); } }
    if (type === 'trade' || type === 'fund') { const cls = new Set(Object.keys(A.pos).map(id => E.M.inst[id] && E.M.inst[id].cls)); if (['stock', 'etf', 'fund', 'bond'].every(c => cls.has(c))) this.award(A, 'divers'); }
    if (type === 'deriv' && data && data.cls === 'fx') this.award(A, 'fx');
    if ((type === 'deriv' && data && data.cls === 'cmd') || (type === 'trade' && data && data.cmd)) this.award(A, 'cmd');
    if (type === 'derivClose' && data && data.cost > 0 && data.pnl / data.cost >= 0.5) this.award(A, 'lever');
    if (type === 'coupon') this.award(A, 'coupon');
    if (type === 'fund') this.award(A, 'fund');
    if (type === 'tier') { const t = E.TIERS[data.tier]; if (t) { this.note(A, `Aufgestiegen: ${t.name}! Neu freigeschaltet: ${t.perks.join(', ')}`, 'tier'); const r = E.TIER_REWARD[data.tier] || 0; if (r) this.credit(A, r, `Aufstieg zum ${t.name}`); } }
    if (type === 'ath') this.note(A, 'Neues Allzeithoch deines Portfolios', 'ath');
    if (['crisis', 'tenbagger', 'owner', 'passive100', 'drip', 'takeover', 'ipo'].includes(type)) this.award(A, type);
    if (type === 'plan' && (A.stats.plans || 0) >= 5) this.award(A, 'plan');
    if (type === 'fx') this.award(A, 'fx');
    if (type === 'equity') { // nur Verlaufspunkt: später gesammelt speichern; Faktor-Zertifikate ändern ihren Wert laufend → Konto mitschicken
      if (A.derivs.some(p => p.kind === 'fac')) this.dirty.add(A.uid); else this.lazy.add(A.uid);
      if (E.totals(A).total >= 1e6) this.award(A, 'million');
    }
  }
  settleLeague(weekKey) {
    const rows = [...this.accts.values()].map(A => { const T = E.totals(A).total; return { A, perf: A.week.start > 0 ? (T - A.week.flow) / A.week.start - 1 : 0, ok: A.week.trades >= 3 }; });
    const ranked = rows.filter(r => r.ok && r.perf > 0).sort((a, b) => b.perf - a.perf).slice(0, 3);
    const pool = E.r2(this.bank.reserve * this.cfg().leagueShare), share = [0.5, 0.3, 0.2];
    const results = ranked.map((r, i) => { const prize = this.credit(r.A, pool * share[i], `Wochenliga Platz ${i + 1}`); if (i === 0) this.award(r.A, 'league'); return { name: r.A.name, perf: r.perf, prize }; });
    if (rows.length) { this.bank.league.unshift({ week: weekKey, pool, results }); if (this.bank.league.length > 20) this.bank.league.length = 20; this.bankDirty = true; }
    for (const A of this.accts.values()) { A.week = { k: E.M.week, start: E.r2(E.totals(A).total), flow: 0, trades: 0 }; this.dirty.add(A.uid); }
  }
  board() {
    return [...this.accts.values()].map(A => {
      const T = E.totals(A).total;
      return { name: A.name, total: T, perf: A.week.start > 0 ? (T - A.week.flow) / A.week.start - 1 : 0, trades: A.week.trades, lic: A.lic, lux: A.lux, ach: Object.keys(A.ach).length };
    }).sort((a, b) => b.total - a.total);
  }
  economy(A, b) {
    const M = E.M, bank = this.bank, cfg = this.cfg();
    if (b.type === 'bonus') {
      const today = E.dayStart(M.t);
      if (A.bonus.day === today) return 'Den Tagesbonus hast du heute schon abgeholt. Ab Mitternacht gibt es den nächsten.';
      const streak = A.bonus.day === today - DAY ? A.bonus.streak + 1 : 1, amt = this.bonusAmount(streak);
      if (!(amt >= 0.01)) return 'Die Zentralbank ist leer. Erst wenn Gebühren zurückfließen, gibt es wieder Boni.';
      A.bonus = { day: today, streak }; this.credit(A, amt, `Tagesbonus (Tag ${streak} in Folge)`);
      if (streak >= 7) this.award(A, 'streak');
      return null;
    }
    if (b.type === 'relief') {
      const T = E.totals(A).total;
      if (T >= 1000) return 'Insolvenzhilfe gibt es nur bei einem Gesamtvermögen unter 1.000 €.';
      if (A.derivs.length) return 'Schließe zuerst alle Hebelpositionen.';
      if (M.t - (A.reliefT || 0) < 7 * DAY) return 'Insolvenzhilfe gibt es höchstens einmal pro Woche.';
      if (!this.credit(A, cfg.relief, 'Insolvenzhilfe')) return 'Die Zentralbank ist leer.';
      A.reliefT = M.t; return null;
    }
    if (b.type === 'license') {
      const lv = Number(b.level), L = E.LIC[lv];
      if (!L || lv <= (A.lic || 0)) return 'Diese Lizenz hast du schon.';
      if (E.availCash(A) < L.price) return `Die ${L.name} kostet ${E.fmtE(L.price)}. Verfügbar: ${E.fmtE(E.availCash(A))}.`;
      A.cash -= L.price; A.week.flow -= L.price; A.lic = lv; E.book(A, 'spend', -L.price, L.name); E.extFlow(A, -L.price);
      bank.reserve += L.price; bank.fees += L.price; this.bankDirty = true;
      A.hist.unshift({ t: M.t, id: '', nm: L.name, side: 'Lizenz', q: 1, px: L.price, amt: L.price, fee: 0, pnl: null });
      this.note(A, `${L.name} erworben`, 'up'); this.dirty.add(A.uid); return null;
    }
    if (b.type === 'luxbuy' || b.type === 'luxsell') {
      const it = E.LUX.find(i => i.id === b.id); if (!it) return 'Unbekannter Gegenstand.';
      const back = E.r2(it.price * E.LUX_BUYBACK);
      if (b.type === 'luxbuy') {
        if (!(bank.lux[it.id] > 0)) return `${it.name} ist ausverkauft. Warte, bis jemand eins zurückgibt.`;
        if (E.availCash(A) < it.price) return `${it.name} kostet ${E.fmtE(it.price, 0)}. Verfügbar: ${E.fmtE(E.availCash(A))}.`;
        A.cash -= it.price; A.lux[it.id] = (A.lux[it.id] || 0) + 1; A.week.flow -= it.price - back; E.book(A, 'spend', -(it.price - back), it.name); E.extFlow(A, -(it.price - back));
        bank.lux[it.id]--; bank.escrow += back; bank.reserve += it.price - back; bank.fees += it.price - back;
        A.hist.unshift({ t: M.t, id: '', nm: it.name, side: 'Luxuskauf', q: 1, px: it.price, amt: it.price, fee: 0, pnl: null });
        this.note(A, `${it.name} gehört jetzt dir`, 'up');
      } else {
        if (!(A.lux[it.id] > 0)) return 'Den Gegenstand besitzt du nicht.';
        A.lux[it.id]--; if (!A.lux[it.id]) delete A.lux[it.id]; A.cash += back;
        bank.lux[it.id]++; bank.escrow -= back;
        A.hist.unshift({ t: M.t, id: '', nm: it.name, side: 'Luxusverkauf', q: 1, px: back, amt: back, fee: 0, pnl: null });
        this.note(A, `${it.name} an die Bank zurückverkauft: +${E.fmtE(back)}`, '');
      }
      if (A.hist.length > 300) A.hist.length = 300;
      this.bankDirty = true; this.dirty.add(A.uid); return null;
    }
    return 'Unbekannte Aktion.';
  }

  /* ---------- Sitzungen ---------- */
  async auth(req) {
    const m = (req.headers.get('Cookie') || '').match(/(?:^|;\s*)sid=([A-Za-z0-9_-]{30,})/); if (!m) return null;
    const r = this.sql.exec('SELECT uid, exp FROM sessions WHERE tok = ?', await sha256(m[1])).toArray();
    if (!r.length || r[0].exp < Date.now()) return null;
    return this.accts.get(r[0].uid) || null;
  }
  async newSession(uid) {
    const tok = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const del = this.sql.exec('DELETE FROM sessions WHERE exp < ?', Date.now()).rowsWritten || 0;
    this.sql.exec('INSERT INTO sessions (tok, uid, exp) VALUES (?, ?, ?)', await sha256(tok), uid, Date.now() + SESSION_DAYS * DAY);
    this.bump('wr', 1 + del);
    return `sid=${tok}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
  }
  isAdmin(A) { const a = this.env.ADMIN_USER; return !!(a && A && A.name.toLowerCase() === String(a).toLowerCase()); }

  /* ---------- HTTP ---------- */
  async fetch(req) {
    this.bump('req');
    let res;
    try { this.advance(); res = await this.handle(req); }
    catch (err) { console.error(err && err.stack || err); res = json({ error: 'Interner Fehler. Bitte noch einmal versuchen.' }, 500); }
    try { this.flush(false); await this.schedule(); } catch (err) { console.error(err && err.stack || err); }
    return res;
  }
  async handle(req) {
    const url = new URL(req.url), path = url.pathname, origin = req.headers.get('Origin');
    if (path === '/api/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket erwartet', { status: 426 });
      if (origin && origin !== url.origin) return new Response('Ungültige Herkunft', { status: 403 });
      const A = await this.auth(req); if (!A) return new Response('Nicht angemeldet', { status: 401 });
      const mine = this.ctx.getWebSockets(tag(A.uid));
      for (let i = 0; i <= mine.length - MAX_TABS; i++) { try { mine[i].close(4002, 'Zu viele offene Tabs'); } catch { } }
      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server, [tag(A.uid)]);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (req.method === 'GET') {
      if (path === '/api/session') { const A = await this.auth(req); return json({ user: A ? { name: A.name, admin: this.isAdmin(A) } : null, registration: !!String(this.env.INVITE_CODE || '').trim() }); }
      const A = await this.auth(req); if (!A) return json({ error: 'Bitte anmelden.' }, 401);
      if (path === '/api/state') return new Response(JSON.stringify({ b: BUILD, me: { name: A.name, uid: A.uid, admin: this.isAdmin(A) }, M: this.marketForClient(), acct: A, ins: E.insightsFor(A), bank: this.publicBank(), board: this.board(), tickMs: this.tickMs() }, round8), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
      if (path === '/api/board') return json({ board: this.board(), bank: this.publicBank() });
      if (path === '/api/hist') { const x = E.M.inst[String(url.searchParams.get('id') || '')]; if (!x) return json({ error: 'Nicht gefunden.' }, 404); return new Response(JSON.stringify({ id: x.id, c1: x.c1, cH: x.cH || [], cD: x.cD.slice(-260) }, round8), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } }); } // lange Kursverläufe nur bei Bedarf
      return json({ error: 'Nicht gefunden.' }, 404);
    }
    if (req.method !== 'POST') return json({ error: 'Methode nicht erlaubt.' }, 405);
    if (origin && origin !== url.origin) return json({ error: 'Ungültige Herkunft.' }, 403);
    if (!(req.headers.get('content-type') || '').includes('application/json')) return json({ error: 'JSON erwartet.' }, 415);
    let b; try { b = await req.json(); } catch { return json({ error: 'Ungültige Anfrage.' }, 400); }
    if (!b || typeof b !== 'object') return json({ error: 'Ungültige Anfrage.' }, 400);

    if (path === '/api/register') {
      const norm = v => String(v || '').trim().toLowerCase(); // Leerzeichen und Groß-/Kleinschreibung egal
      const code = norm(this.env.INVITE_CODE);
      if (!code) return json({ error: 'Registrierung gesperrt: Der Betreiber hat keinen Einladungscode (INVITE_CODE) gesetzt.' }, 403);
      const { name, pw, invite } = b;
      if (typeof name !== 'string' || !/^[A-Za-z0-9_-]{3,20}$/.test(name)) return json({ error: 'Name: 3–20 Zeichen, nur Buchstaben, Ziffern, _ und -.' }, 400);
      if (typeof pw !== 'string' || pw.length < 8 || pw.length > 200) return json({ error: 'Passwort: mindestens 8 Zeichen.' }, 400);
      if (typeof invite !== 'string' || !(await safeEq(norm(invite), code))) return json({ error: 'Der Einladungscode stimmt nicht.' }, 403);
      const cfg = this.cfg();
      if (this.accts.size >= cfg.maxUsers) return json({ error: `Die Börse ist voll (${cfg.maxUsers} Spieler).` }, 403);
      if (this.sql.exec('SELECT id FROM users WHERE name = ?', name).toArray().length) return json({ error: 'Dieser Name ist schon vergeben.' }, 409);
      const salt = hex(crypto.getRandomValues(new Uint8Array(16))), hash = await pbkdf2(pw, salt);
      let uid;
      try { uid = this.sql.exec('INSERT INTO users (name, hash, salt, created) VALUES (?, ?, ?, ?) RETURNING id', name, hash, salt, Date.now()).one().id; this.bump('wr', 2); }
      catch { return json({ error: 'Dieser Name ist schon vergeben.' }, 409); }
      const A = E.newAccount(uid, name, cfg.start); A.week.k = E.M.week; E.book(A, 'start', cfg.start, 'Startkapital');
      this.accts.set(uid, A); this.bank.minted += cfg.start; this.bankDirty = true; this.dirty.add(uid);
      this.note(A, `Willkommen bei NOVEX! Dein Startkapital: ${E.fmtE(cfg.start)}`, 'up');
      return json({ ok: true }, 200, { 'Set-Cookie': await this.newSession(uid) });
    }
    if (path === '/api/login') {
      const name = typeof b.name === 'string' ? b.name.slice(0, 40) : '', pw = typeof b.pw === 'string' ? b.pw.slice(0, 200) : '';
      const key = name.toLowerCase(), f = this.fails.get(key);
      if (f && f.n >= 8 && Date.now() - f.t < 10 * 60000) return json({ error: 'Zu viele Fehlversuche. Bitte in 10 Minuten erneut versuchen.' }, 429);
      const row = this.sql.exec('SELECT id, hash, salt FROM users WHERE name = ?', name).toArray()[0];
      const h = await pbkdf2(pw, row ? row.salt : '00'.repeat(16));
      if (!row || !eqStr(h, row.hash) || !this.accts.has(row.id)) {
        const g = f && Date.now() - f.t < 10 * 60000 ? f : { n: 0, t: Date.now() }; g.n++; this.fails.set(key, g);
        return json({ error: 'Name oder Passwort ist falsch.' }, 401);
      }
      this.fails.delete(key);
      return json({ ok: true }, 200, { 'Set-Cookie': await this.newSession(row.id) });
    }
    if (path === '/api/logout') {
      const m = (req.headers.get('Cookie') || '').match(/(?:^|;\s*)sid=([A-Za-z0-9_-]{30,})/);
      if (m) { this.sql.exec('DELETE FROM sessions WHERE tok = ?', await sha256(m[1])); this.bump('wr'); }
      return json({ ok: true }, 200, { 'Set-Cookie': 'sid=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' });
    }
    const A = await this.auth(req); if (!A) return json({ error: 'Bitte anmelden.' }, 401);
    if (path === '/api/action') {
      const t = b.type, n = v => (v === null || v === undefined || v === '') ? NaN : Number(v); let err;
      if (t === 'order') err = E.placeOrder(A, { iid: String(b.iid), side: b.side, type: b.otype, qty: n(b.qty), limit: n(b.limit), stop: n(b.stop), val: b.val });
      else if (t === 'fund') err = E.placeFundOrder(A, String(b.iid), b.side, n(b.val));
      else if (t === 'cancel') err = E.cancelOrder(A, n(b.id));
      else if (t === 'deriv') err = E.openDeriv(A, { kind: b.kind, und: String(b.und), dir: n(b.dir), lev: n(b.lev), cp: b.cp, exp: n(b.exp), K: n(b.K), cfdLev: n(b.cfdLev), fac: n(b.fac), budget: n(b.budget), margin: n(b.margin), sl: n(b.sl), tp: n(b.tp) });
      else if (t === 'close') err = E.M.isOpen ? E.closeDeriv(A, n(b.pid), n(b.frac)) : 'Hebelprodukte sind nur zu Börsenzeiten handelbar (Mo–Fr 08:00–22:00).';
      else if (t === 'drip') err = E.setDrip(A, !!b.on);
      else if (t === 'credit') err = E.setCredit(A, !!b.on);
      else if (t === 'plan') err = E.addPlan(A, { iid: String(b.iid), amt: n(b.amt), freq: b.freq, day: n(b.day) });
      else if (t === 'unplan') err = E.delPlan(A, n(b.id));
      else if (t === 'deposit') err = E.openDeposit(A, n(b.months), n(b.amt));
      else if (t === 'exchange') err = E.exchange(A, String(b.from), String(b.to), n(b.amt));
      else if (t === 'loan') err = E.drawLoan(A, n(b.amt));
      else if (t === 'repay') err = E.repayLoan(A, n(b.id), n(b.amt));
      else if (t === 'breakdep') err = E.breakDeposit(A, n(b.id));
      else if (t === 'bid') err = E.placeBid(A, { id: String(b.id), prem: n(b.prem), lbo: n(b.lbo) || 0 });
      else if (t === 'vote') err = E.vote(A, String(b.id), String(b.v));
      else if (t === 'strat') err = E.setStrategy(A, String(b.co), String(b.k));
      else if (t === 'ipo') err = E.ipo(A, String(b.co), n(b.frac));
      else if (t === 'auto') err = E.setAuto(A, { id: n(b.id) || 0, tg: String(b.tg), ref: String(b.ref), k: String(b.k), f: n(b.f), oco: !!b.oco, trig: n(b.trig), tm: String(b.tm), dist: n(b.dist) });
      else if (t === 'autodel') err = E.delAuto(A, n(b.id));
      else err = this.economy(A, b);
      E.cleanAuto(A); // Auto-Orders verkaufter Positionen sofort entfernen
      const trade = ['order', 'cancel', 'deriv', 'close', 'exchange', 'bid', 'ipo', 'vote'].includes(t), online = this.ctx.getWebSockets().length > 0;
      if (trade && !err) { this.hotDirty = true; this.candlesDirty = true; this.touched = true; } // Kursimpakt sofort sichern
      const notes = this.inbox.get(A.uid) || []; this.inbox.delete(A.uid);
      if (this.dirty.has(A.uid) || !err) { this.saveAcct(A); this.dirty.delete(A.uid); }
      if (online && trade && !err) this.broadcast(this.tickMsg());
      if (online && !trade && !err) this.broadcastBoard();
      return json({ ok: !err, error: err || undefined, acct: A, notes, ins: E.insightsFor(A), bank: this.publicBank() }, err ? 400 : 200);
    }
    if (path === '/api/admin') {
      if (!this.isAdmin(A)) return json({ error: 'Nur für den Administrator.' }, 403);
      if (b.type === 'users') return json({ users: this.sql.exec('SELECT id, name, created FROM users ORDER BY id').toArray(), usage: this.usageInfo() });
      if (b.type === 'delete') {
        const row = this.sql.exec('SELECT id, name FROM users WHERE name = ?', String(b.name || '')).toArray()[0];
        if (!row) return json({ error: 'Spieler nicht gefunden.' }, 404);
        if (row.id === A.uid) return json({ error: 'Du kannst dich nicht selbst löschen.' }, 400);
        const V = this.accts.get(row.id);
        if (V) for (const [id, c] of Object.entries(V.lux || {})) { const it = E.LUX.find(i => i.id === id); if (it) { this.bank.lux[id] += c; this.bank.escrow -= c * it.price * E.LUX_BUYBACK; this.bank.reserve += c * it.price * E.LUX_BUYBACK; } }
        this.accts.delete(row.id); this.dirty.delete(row.id); this.lazy.delete(row.id); this.bankDirty = true;
        this.sql.exec('DELETE FROM users WHERE id = ?', row.id); this.sql.exec('DELETE FROM sessions WHERE uid = ?', row.id); this.sql.exec('DELETE FROM accounts WHERE uid = ?', row.id); this.bump('wr', 3);
        for (const ws of this.ctx.getWebSockets(tag(row.id))) { try { ws.close(4001, 'Konto gelöscht'); } catch { } }
        return json({ ok: true });
      }
      return json({ error: 'Unbekannte Admin-Aktion.' }, 400);
    }
    return json({ error: 'Nicht gefunden.' }, 404);
  }
}

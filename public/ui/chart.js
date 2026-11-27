// Ruhige Charts im Neobroker-Stil: Linie mit Fläche, optional Kerzen, Vergleich mit Index, Balken für Quartalszahlen
import { E } from './store.js';
const { fmt, fDate, fTime, clamp } = E;

export const hover = { id: null, x: 0 };
const css = () => { const s = getComputedStyle(document.documentElement), g = n => s.getPropertyValue(n).trim(); return { up: g('--up'), dn: g('--dn'), fg: g('--fg'), fg2: g('--fg2'), mute: g('--mute'), line: g('--line'), line2: g('--line2'), bg: g('--bg'), f: g('--f') }; };
function prep(cv) {
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return null;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); return { g, W, H };
}
function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 3.5 ? 2.5 : f < 7.5 ? 5 : 10) * p; }

// bars: [t, o, h, l, c, v]; o: { candle, cmp: [[t, v]], digits, daily, ref, pct, fmtV,
//   lines: [{ v, label, tone: 'up'|'dn'|'fg' }] – waagerechte Linien (Einstand, Stop-Loss, Take-Profit), marks: [{ t, px, buy }] – Käufe/Verkäufe }
export function drawChart(cv, bars, o = {}) {
  if (!cv) return; const P = prep(cv); if (!P) return; const { g, W, H } = P, C = css();
  g.font = `12px ${C.f}`;
  if (!bars.length) { g.fillStyle = C.mute; g.fillText('Noch keine Kursdaten', 4, 20); return; }
  const padR = 58, padT = 10, padB = 22, pw = W - padR, ph = H - padT - padB, n = bars.length;
  // Vergleichsmodus: beide Reihen in % ab Start
  const base = bars[0][4], cmp = o.cmp && o.cmp.length > 1 ? o.cmp : null, cbase = cmp ? cmp[0][1] : 1;
  const yv = b => cmp || o.pct ? b[4] / base - 1 : b[4];
  let hi = -Infinity, lo = Infinity;
  for (const b of bars) { const h = o.candle && !cmp ? b[2] : yv(b), l = o.candle && !cmp ? b[3] : yv(b); if (h > hi) hi = h; if (l < lo) lo = l; }
  if (cmp) for (const c of cmp) { const v = c[1] / cbase - 1; if (v > hi) hi = v; if (v < lo) lo = v; }
  // Linien einbeziehen, wenn sie nicht allzu weit weg liegen (sonst Pfeil am Rand)
  const lines = !cmp && !o.pct && o.lines ? o.lines.filter(l => isFinite(l.v) && l.v > 0) : [];
  { const span = Math.max(hi - lo, Math.abs(hi) * 0.01); for (const l of lines) if (l.v >= lo - span * 1.5 && l.v <= hi + span * 1.5) { hi = Math.max(hi, l.v); lo = Math.min(lo, l.v); } }
  if (hi - lo < Math.abs(hi) * 1e-6 + 1e-9) { hi += Math.abs(hi) * 0.001 + 1e-6; lo -= Math.abs(lo) * 0.001 + 1e-6; }
  const pad = (hi - lo) * 0.08; hi += pad; lo -= pad;
  const sp = pw / Math.max(n - 1, 1), X = i => n === 1 ? pw / 2 : i * sp, Y = v => padT + (hi - v) / (hi - lo) * ph;
  // dezente Hilfslinien
  const st = niceStep((hi - lo) / 3), dd = cmp || o.pct ? 1 : Math.max(0, Math.min(5, -Math.floor(Math.log10(st)) + 1));
  g.strokeStyle = C.line; g.lineWidth = 1; g.fillStyle = C.mute; g.textBaseline = 'middle';
  for (let v = Math.ceil(lo / st) * st; v <= hi; v += st) { const y = Math.round(Y(v)) + 0.5; g.beginPath(); g.moveTo(0, y); g.lineTo(pw, y); g.stroke(); g.fillText(cmp || o.pct ? (v > 0 ? '+' : '') + fmt(v * 100, dd) + ' %' : fmt(v, dd), pw + 8, y); }
  const last = bars[n - 1][4], ref = o.ref !== undefined ? o.ref : bars[0][1] || base, col = last >= ref ? C.up : C.dn;
  if (o.candle && !cmp) {
    const bw = Math.max(1, Math.min(9, sp * 0.65));
    for (let i = 0; i < n; i++) { const b = bars[i], c = b[4] >= b[1] ? C.up : C.dn, x = X(i); g.strokeStyle = c; g.fillStyle = c; g.beginPath(); g.moveTo(Math.round(x) + 0.5, Y(b[2])); g.lineTo(Math.round(x) + 0.5, Y(b[3])); g.stroke(); const y1 = Y(Math.max(b[1], b[4])), y2 = Y(Math.min(b[1], b[4])); g.fillRect(x - bw / 2, y1, bw, Math.max(1, y2 - y1)); }
  } else {
    if (cmp) { // Index als zweite Linie
      g.beginPath(); cmp.forEach((c, i) => { const x = X(Math.round(i / Math.max(cmp.length - 1, 1) * (n - 1))), y = Y(c[1] / cbase - 1); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.strokeStyle = C.mute; g.lineWidth = 1.5; g.setLineDash([4, 4]); g.stroke(); g.setLineDash([]);
    }
    g.beginPath(); for (let i = 0; i < n; i++) { const x = X(i), y = Y(yv(bars[i])); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.strokeStyle = cmp ? C.fg : col; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();
    if (!cmp) { g.lineTo(X(n - 1), padT + ph); g.lineTo(X(0), padT + ph); g.closePath(); const gr = g.createLinearGradient(0, padT, 0, padT + ph); gr.addColorStop(0, col + '26'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.fill(); }
  }
  // Trigger- und Einstandslinien mit Beschriftung im rechten Rand
  const used = [];
  for (const l of lines.slice().sort((a, b) => b.v - a.v)) {
    const out = l.v > hi ? 1 : l.v < lo ? -1 : 0, y = Math.round(out > 0 ? padT + 1 : out < 0 ? padT + ph - 1 : Y(l.v)) + 0.5;
    let ly = y; while (used.some(u => Math.abs(u - ly) < 19)) ly += out < 0 ? -19 : 19; used.push(ly); // Beschriftungen nicht übereinander, col = l.tone === 'up' ? C.up : l.tone === 'dn' ? C.dn : C.fg2;
    g.strokeStyle = col; g.lineWidth = 1; g.setLineDash(out ? [2, 4] : [5, 4]); g.beginPath(); g.moveTo(0, y); g.lineTo(pw, y); g.stroke(); g.setLineDash([]);
    const txt = (out > 0 ? '↑ ' : out < 0 ? '↓ ' : '') + l.label; g.font = `600 11px ${C.f}`; const tw = g.measureText(txt).width + 10, bx = Math.max(0, pw - tw - 4);
    g.fillStyle = C.bg; g.fillRect(bx, ly - 9, tw, 18); g.strokeStyle = col; g.strokeRect(bx + 0.5, ly - 8.5, tw - 1, 17); g.fillStyle = col; g.textBaseline = 'middle'; g.fillText(txt, bx + 5, ly + 0.5); g.font = `12px ${C.f}`;
  }
  // Käufe (gefülltes Dreieck) und Verkäufe (Umriss) auf der Zeitachse
  if (o.marks && !cmp && n > 1) for (const mk of o.marks) {
    if (mk.t < bars[0][0] || mk.t > bars[n - 1][0] + (bars[n - 1][0] - bars[n - 2][0])) continue;
    let i = 0; while (i < n - 1 && bars[i + 1][0] <= mk.t) i++;
    const x = X(i), y = Y(o.pct ? mk.px / base - 1 : mk.px), d = mk.buy ? 1 : -1;
    g.beginPath(); g.moveTo(x, y + d * 4); g.lineTo(x - 5, y + d * 12); g.lineTo(x + 5, y + d * 12); g.closePath();
    g.fillStyle = mk.buy ? C.fg : C.bg; g.strokeStyle = C.fg; g.lineWidth = 1.5; g.fill(); g.stroke();
  }
  // Achse: Anfang und Ende
  g.fillStyle = C.mute; g.textBaseline = 'alphabetic';
  const tl = t => o.daily ? fDate(t).slice(0, 6) + fDate(t).slice(8) : o.hourly ? fDate(t).slice(0, 6) + ' ' + fTime(t) : fTime(t);
  g.textAlign = 'left'; g.fillText(tl(bars[0][0]), 0, H - 5); g.textAlign = 'right'; g.fillText(tl(bars[n - 1][0]), pw, H - 5); g.textAlign = 'left';
  // Fadenkreuz
  if (hover.id === cv.id && hover.x >= 0 && hover.x <= pw) {
    const i = clamp(Math.round(hover.x / Math.max(sp, 1e-9)), 0, n - 1), b = bars[i], x = X(i), y = Y(o.candle && !cmp ? b[4] : yv(b));
    g.strokeStyle = C.line2; g.beginPath(); g.moveTo(Math.round(x) + 0.5, padT); g.lineTo(Math.round(x) + 0.5, padT + ph); g.stroke();
    g.fillStyle = C.bg; g.strokeStyle = cmp ? C.fg : col; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); g.stroke();
    const vtxt = cmp ? `Du ${(b[4] / base - 1 >= 0 ? '+' : '')}${fmt((b[4] / base - 1) * 100, 2)} %` + (cmp[Math.round(i / (n - 1 || 1) * (cmp.length - 1))] ? ` · WELTIX ${(() => { const v = cmp[Math.round(i / (n - 1 || 1) * (cmp.length - 1))][1] / cbase - 1; return (v >= 0 ? '+' : '') + fmt(v * 100, 2); })()} %` : '') : (o.fmtV ? o.fmtV(b[4]) : fmt(b[4], o.digits === undefined ? 2 : o.digits)) + `  ${(b[4] / base - 1 >= 0 ? '+' : '')}${fmt((b[4] / base - 1) * 100, 2)} %`;
    const ttxt = o.daily ? fDate(b[0], true) : fDate(b[0]).slice(0, 6) + ' ' + fTime(b[0]);
    g.font = `600 13px ${C.f}`; const w1 = g.measureText(vtxt).width; g.font = `12px ${C.f}`; const w2 = g.measureText(ttxt).width, bw = Math.max(w1, w2) + 20;
    const bx = clamp(x - bw / 2, 0, pw - bw); g.fillStyle = C.bg; g.strokeStyle = C.line2; g.lineWidth = 1; g.beginPath(); g.roundRect ? g.roundRect(bx, 0, bw, 38, 8) : g.rect(bx, 0, bw, 38); g.fill(); g.stroke();
    g.fillStyle = C.fg; g.font = `600 13px ${C.f}`; g.fillText(vtxt, bx + 10, 16); g.fillStyle = C.mute; g.font = `12px ${C.f}`; g.fillText(ttxt, bx + 10, 31);
  }
}

// Quartalszahlen: Erwartung (Umriss) gegen Ist-Wert (gefüllt, grün = übertroffen, rot = verfehlt)
export function drawBars(cv, groups, o = {}) {
  if (!cv) return; const P = prep(cv); if (!P) return; const { g, W, H } = P, C = css();
  g.font = `12px ${C.f}`;
  if (!groups.length) { g.fillStyle = C.mute; g.fillText('Noch keine Quartalszahlen', 4, 20); return; }
  const padT = 20, padB = 22, ph = H - padT - padB;
  let hi = 0, lo = 0; for (const q of groups) { hi = Math.max(hi, q.a, q.b); lo = Math.min(lo, q.a, q.b); }
  if (hi === lo) hi = lo + 1;
  const Y = v => padT + (hi - v) / (hi - lo) * ph, gw = W / groups.length, bw = Math.min(18, gw * 0.28);
  g.strokeStyle = C.line; g.beginPath(); g.moveTo(0, Math.round(Y(0)) + 0.5); g.lineTo(W, Math.round(Y(0)) + 0.5); g.stroke();
  groups.forEach((q, i) => {
    const cx = gw * i + gw / 2, y0 = Y(0);
    g.strokeStyle = C.line2; g.lineWidth = 1.5; const ya = Y(q.a); g.strokeRect(cx - bw - 2, Math.min(ya, y0), bw, Math.max(1, Math.abs(y0 - ya)));
    const yb = Y(q.b); g.fillStyle = q.good === null ? C.fg2 : q.good ? C.up : C.dn; g.fillRect(cx + 2, Math.min(yb, y0), bw, Math.max(1, Math.abs(y0 - yb)));
    g.fillStyle = C.mute; g.textAlign = 'center'; g.fillText(q.label, cx, H - 5);
    if (o.fmt) { g.fillStyle = C.fg2; g.fillText(o.fmt(q.b), cx + 2 + bw / 2, Math.min(yb, y0) - 5); }
    g.textAlign = 'left';
  });
}

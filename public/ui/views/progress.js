// Fortschritt: Vermögensstufen, Tagesbonus, Erfolge, Wochenliga, Rangliste, Lizenzen, Luxusgüter, Zentralbank, Einstellungen
import { S, E, esc, sc, pctS, act, actions, post, $ } from '../store.js';
import { info } from '../glossary.js';
import { openReview } from './order.js';
const { fmt, fmtE, fDate, dayStart, DAY, totals, TIERS, TIER_REWARD, ACH, LIC, LUX, LUX_BUYBACK, availCash } = E;

export function render() {
  return `<div class="grid2"><div class="stack" style="gap:0">
    <section class="sec" style="border-top:0;padding-top:0"><h1 class="h1" style="margin-bottom:18px">Fortschritt</h1><div id="p-tier"></div></section>
    <section class="sec"><h2>Erfolge</h2><div id="p-ach"></div></section>
    <section class="sec"><h2>Rangliste</h2><div id="p-board"></div></section>
    <section class="sec"><h2>Handelslizenzen ${info('lever')}</h2><div class="items" id="p-lic"></div></section>
    <section class="sec"><h2>Luxusgüter · limitierte Auflage</h2><p class="note" style="margin:-6px 0 6px">Jedes Stück gibt es nur so oft wie angegeben. Die Bank kauft es jederzeit für 80 % zurück – erst dann kann es jemand anderes kaufen.</p><div class="items" id="p-lux"></div></section>
  </div><aside class="stack" style="gap:0">
    <section class="sec" style="border-top:0;padding-top:0"><h2>Tagesbonus</h2><div id="p-bonus"></div></section>
    <section class="sec"><h2>Wochenliga</h2><div id="p-league"></div></section>
    <section class="sec"><h2>Zentralbank ${info('zentral')}</h2><div id="p-bank"></div></section>
    <section class="sec"><h2>Darstellung</h2><div class="seg"><button data-a="theme" data-v="auto">System</button><button data-a="theme" data-v="light">Hell</button><button data-a="theme" data-v="dark">Dunkel</button></div></section>
    ${S.ME.admin ? `<section class="sec"><h2>Verwaltung</h2><div id="p-admin"><button class="btn sm ghost" data-a="adm">Spieler und Nutzung laden</button></div></section>` : ''}
  </aside></div>`;
}
export function update() {
  const A = S.A, T = totals(A).total, b = S.BANK, t = A.tier || 0, nx = TIERS[t + 1];
  $('#p-tier').innerHTML = `<div class="hero"><span class="label">Deine Stufe ${info('tier')}</span><span class="big" style="font-size:32px">${esc(TIERS[t].name)}</span>
    ${nx ? `<span class="fg2">Noch ${fmtE(nx.min - T, 0)} bis ${esc(nx.name)}</span><div class="meter" style="margin-top:6px"><i style="width:${Math.min(100, Math.max(2, (T - TIERS[t].min) / (nx.min - TIERS[t].min) * 100)).toFixed(1)}%"></i></div>` : '<span class="fg2">Höchste Stufe erreicht.</span>'}</div>
    <div class="tiers">${TIERS.map((x, i) => `<div class="tierrow ${i <= (A.tierMax || 0) ? 'got' : ''}"><span class="n">${i + 1}</span><span><b>${esc(x.name)}</b> <span class="fg2 small">ab ${fmtE(x.min, 0)}</span><ul>${x.perks.map(p => `<li>${esc(p)}</li>`).join('')}</ul></span><span class="small fg2">${TIER_REWARD[i] ? '+' + fmtE(TIER_REWARD[i], 0) : ''}</span></div>`).join('')}</div>`;
  const got = ACH.filter(a => A.ach[a.id]).length;
  $('#p-ach').innerHTML = `<p class="note" style="margin:-6px 0 6px">${got} von ${ACH.length} erreicht. Jede Prämie zahlt die Zentralbank einmal aus.</p>` + ACH.map(a => `<div class="ach ${A.ach[a.id] ? 'done' : ''}"><span class="c">${A.ach[a.id] ? '✓' : ''}</span><b style="font-weight:500">${esc(a.name)}</b><span class="rw">+${fmtE(a.reward, 0)}</span><small>${esc(a.desc)}</small></div>`).join('');
  $('#p-board').innerHTML = `<div class="tbl"><table><thead><tr><th>#</th><th style="text-align:left">Spieler</th><th>Vermögen</th><th>Woche</th><th>Stufe</th></tr></thead><tbody>${S.BOARD.map((p, i) => `<tr class="${p.name === S.ME.name ? 'mine' : ''}"><td>${i + 1}</td><td style="text-align:left">${esc(p.name)}${LUX.filter(it => p.lux && p.lux[it.id]).map(it => ` <span class="tag">${esc(it.name)}</span>`).join('')}</td><td>${fmtE(p.total, 0)}</td><td class="${sc(p.perf)}">${pctS(p.perf)}</td><td>${esc(TIERS[E.tierOf(p.total)].name)}</td></tr>`).join('')}</tbody></table></div>`;
  $('#p-lic').innerHTML = LIC.map((L, i) => `<div class="item"><div class="hd"><b>${esc(L.name)}</b>${i === (A.lic || 0) ? '<span class="tag">aktiv</span>' : ''}</div><p>${esc(L.desc)}</p><div class="hd"><span>${L.price ? fmtE(L.price, 0) : 'gratis'}</span>${i > (A.lic || 0) ? `<button class="btn sm" data-a="lic" data-v="${i}" ${availCash(A, undefined, true) < L.price ? 'disabled' : ''}>Freischalten</button>` : ''}</div></div>`).join('');
  $('#p-lux').innerHTML = LUX.map(it => { const own = A.lux[it.id] || 0, left = b.lux[it.id]; return `<div class="item"><div class="hd"><b>${esc(it.name)}</b>${own ? `<span class="tag">${own}× deins</span>` : ''}</div><p>${esc(it.desc)}</p><div class="hd"><span>${fmtE(it.price, 0)} <span class="fg2 small">· ${left} von ${it.supply} frei</span></span><span class="btns" style="flex-wrap:nowrap">${own ? `<button class="btn sm ghost" data-a="luxsell" data-v="${it.id}">Für ${fmtE(it.price * LUX_BUYBACK, 0)} zurückgeben</button>` : ''}<button class="btn sm" data-a="luxbuy" data-v="${it.id}" ${left > 0 && availCash(A, undefined, true) >= it.price ? '' : 'disabled'}>Kaufen</button></span></div></div>`; }).join('');
  const today = dayStart(S.berlin()), claimed = A.bonus.day === today, streak = claimed ? A.bonus.streak : (A.bonus.day === today - DAY ? A.bonus.streak + 1 : 1), amt = Math.min(b.reserve, b.bonusBase * (1 + 0.15 * (Math.min(streak, 7) - 1)));
  $('#p-bonus').innerHTML = `<div class="setting" style="border:0;padding:0 0 10px"><div class="t"><b>${claimed ? 'Heute schon abgeholt' : `+${fmtE(amt)} warten auf dich`}</b><small>Serie: ${claimed ? A.bonus.streak : streak - 1} ${claimed ? '' : '→ ' + streak} Tage. Ab Tag 7 gibt es das 1,9-Fache.</small></div><button class="btn sm" data-a="bonus" ${claimed ? 'disabled' : ''}>${claimed ? 'Morgen wieder' : 'Abholen'}</button></div><div class="alloc">${[1, 2, 3, 4, 5, 6, 7].map(i => `<i style="flex:1;background:${i <= Math.min(7, claimed ? A.bonus.streak : streak - 1) ? 'var(--fg)' : 'var(--bg2)'}"></i>`).join('')}</div>`;
  const me = S.BOARD.find(p => p.name === S.ME.name), L = b.league || [];
  $('#p-league').innerHTML = `<div class="lines"><div><span>Preisgeld diese Woche</span><b>${fmtE(b.prizePool, 0)}</b></div><div><span>Deine Rendite seit Montag</span><b class="${me ? sc(me.perf) : ''}">${me ? pctS(me.perf) : '–'}</b></div><div><span>Deine Trades (mind. 3)</span><b>${me ? me.trades : 0}</b></div></div><p class="note" style="margin-top:8px">Abrechnung montags 0:00 Uhr: 50 / 30 / 20 % an die drei besten positiven Wochenrenditen. Boni und Prämien zählen nicht mit.</p>` + (L.length ? `<div class="lines" style="margin-top:10px">${L.slice(0, 3).map(w => `<div><span>Woche ab ${fDate(w.week).slice(0, 6)}</span><b>${w.results.length ? esc(w.results[0].name) + ' ' + pctS(w.results[0].perf, 1) : 'kein Gewinner'}</b></div>`).join('')}</div>` : '');
  $('#p-bank').innerHTML = `<div class="lines"><div><span>Reserve</span><b>${fmtE(b.reserve, 0)}</b></div><div><span>Füllstand (bestimmt alle Prämien)</span><b>${fmt(b.scarcity * 100, 1)} %</b></div><div><span>Ausgeschüttet</span><b>${fmtE(b.paid, 0)}</b></div><div><span>Zurückgeflossen</span><b>${fmtE(b.fees, 0)}</b></div><div><span>Spieler</span><b>${b.players} von ${b.maxUsers}</b></div></div><div class="meter" style="margin-top:6px"><i style="width:${(b.scarcity * 100).toFixed(1)}%"></i></div>`;
  if (S.adm && $('#p-admin')) admin();
}
function admin() {
  const u = S.adm.usage, bar = (v, m) => `<div class="meter" style="margin:4px 0 10px"><i style="width:${Math.min(100, v / m * 100).toFixed(1)}%;${v / m > 0.7 ? 'background:var(--dn)' : ''}"></i></div>`;
  $('#p-admin').innerHTML = (u ? `<div class="lines"><div><span>Cloudflare-Anfragen heute</span><b>${fmt(u.req, 0)} / ${fmt(u.budget.req, 0)}</b></div>${bar(u.req, u.budget.req)}<div><span>Geschriebene Zeilen heute</span><b>${fmt(u.wr, 0)} / ${fmt(u.budget.wr, 0)}</b></div>${bar(u.wr, u.budget.wr)}<div><span>Live-Takt</span><b>alle ${fmt(u.tickMs / 1000, 0)} s</b></div></div>` : '') +
    `<div class="tbl"><table><tbody>${S.adm.users.map(x => `<tr><td>${esc(x.name)}</td><td>${x.name === S.ME.name ? '' : `<button class="btn sm ghost" data-a="admdel" data-v="${esc(x.name)}">${S.admConfirm === x.name ? 'Wirklich löschen?' : 'Löschen'}</button>`}</td></tr>`).join('')}</tbody></table></div>`;
}
actions.bonus = async el => { el.disabled = true; await act({ type: 'bonus' }); };
actions.lic = el => { const L = LIC[+el.dataset.v]; openReview({ title: L.name, lines: [['Schaltet frei', L.desc], ['Preis', fmtE(L.price, 0)]], warn: 'Der Preis fließt in die Reserve der Zentralbank. Die Lizenz gilt dauerhaft.', confirm: 'Freischalten', run: () => act({ type: 'license', level: +el.dataset.v }, true) }); };
actions.luxbuy = el => { const it = LUX.find(i => i.id === el.dataset.v); openReview({ title: it.name, lines: [['Preis', fmtE(it.price, 0)], ['Rückkaufwert', fmtE(it.price * LUX_BUYBACK, 0)]], warn: 'Luxusgüter zählen mit 80 % zu deinem Vermögen und stehen in der Rangliste neben deinem Namen.', confirm: 'Kaufen', run: () => act({ type: 'luxbuy', id: it.id }, true) }); };
actions.luxsell = async el => { el.disabled = true; await act({ type: 'luxsell', id: el.dataset.v }); };
actions.theme = el => { const v = el.dataset.v; if (v === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v); try { localStorage.setItem('novex-theme', v); } catch { } S.redraw(); };
actions.adm = async () => { const r = await post('/api/admin', { type: 'users' }); S.adm = { users: r.data.users || [], usage: r.data.usage }; update(); };
actions.admdel = async el => { const n = el.dataset.v; if (S.admConfirm !== n) { S.admConfirm = n; update(); return; } S.admConfirm = null; const r = await post('/api/admin', { type: 'delete', name: n }); S.toast(r.data.ok ? `${n} gelöscht` : (r.data.error || 'Fehler'), r.data.ok ? '' : 'dn'); await actions.adm(); };

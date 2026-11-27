// Markt: Klassen-Segmente, Suche, Sortierung
import { S, E, esc, sc, pctS, actions, inputs, changes, $ } from '../store.js';
import { info } from '../glossary.js';
import { row, isEtc } from '../parts.js';
import * as Derivs from './derivs.js';
const { fmt, fmtBig, fmtPx, chg, REGIMES, SECTORS, rateOf, bidAsk } = E;

export const SEGS = [['stock', 'Aktien'], ['etf', 'ETFs & ETCs'], ['fund', 'Fonds'], ['bond', 'Anleihen'], ['cmd', 'Rohstoffe'], ['fx', 'Devisen'], ['lever', 'Hebel']];
const INTRO = {
  stock: '32 Unternehmen aus allen Branchen, 24 davon im Leitindex WELTIX. Kaufen kannst du auch Bruchstücke – schon ab wenigen Euro.',
  etf: 'Ein ETF kauft für dich einen ganzen Korb an Wertpapieren. ETCs bilden einen Rohstoff wie Gold ab. Günstig, breit gestreut, jederzeit handelbar.',
  fund: 'Aktiv gemanagte Fonds mit Ausgabeaufschlag. Abgerechnet wird einmal täglich um 17:30 Uhr zum Inventarwert.',
  bond: 'Anleihen zahlen feste Zinsen (Kupon) und am Ende 100 % zurück. Der Kurs schwankt mit den Marktzinsen.',
  cmd: 'Rohstoffe in US-Dollar. Ohne Hebel über ETCs, mit Hebel über Turbos, Faktor-Zertifikate, Optionsscheine oder CFDs.',
  fx: 'Wechselkurse schwanken mit Zinsen und Nachrichten. Tauschen kannst du im Konto, auf Kursbewegungen setzen unter „Hebel“.',
  lever: ''
};
export function render() {
  const U = S.UI, seg = U.mkt;
  return `<div class="stack" style="gap:20px">
    <div class="figs" id="m-head"></div>
    <div class="seg" role="tablist" aria-label="Anlageklasse">${SEGS.map(s => `<button role="tab" aria-selected="${seg === s[0]}" class="${seg === s[0] ? 'on' : ''}" data-a="mseg" data-v="${s[0]}">${s[1]}</button>`).join('')}</div>
    ${seg === 'lever' ? Derivs.render() : `<p class="lead" style="margin:0">${INTRO[seg]}</p>
    <div class="row2" style="max-width:560px"><label class="field"><span>Suchen</span><input class="inp" id="m-q" value="${esc(U.q)}" placeholder="Name oder Kürzel" autocomplete="off"></label>
    <label class="field"><span>Sortieren</span><select class="inp" id="m-sort">${[['cap', 'Größte zuerst'], ['up', 'Gewinner heute'], ['dn', 'Verlierer heute'], ['name', 'Name']].map(o => `<option value="${o[0]}" ${U.sort === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label></div>
    <div class="rows" id="m-list"></div>`}
  </div>`;
}
const size = x => x.cls === 'stock' ? x.shares * x.price : x.cls === 'bond' ? x.adv : x.adv || x.price;
export function update() {
  const M = E.M, U = S.UI, ix = M.inst.WELTIX;
  $('#m-head').innerHTML = `<div><span class="label">WELTIX 24</span><b>${fmt(ix.price, 2)}</b><span class="small ${sc(chg(ix))}">${pctS(chg(ix))}</span></div>
    <div><span class="label">Marktphase ${info('phase')}</span><b>${esc(REGIMES[M.reg.k].name)}</b><span class="small fg2">${M.isOpen ? 'Börse offen' : 'Börse geschlossen'}</span></div>
    <div><span class="label">Leitzins ${info('leitzins')}</span><b>${fmt(M.lz * 100, 2)} %</b><span class="small fg2">nächster Entscheid ${E.fDate(M.cb.next).slice(0, 6)}</span></div>
    <div><span class="label">Inflation ${info('inflation')}</span><b>${fmt(M.infl, 1)} %</b><span class="small fg2">erwartet ${fmt(M.cpi.exp, 1)} %</span></div>`;
  if (U.mkt === 'lever') { Derivs.update(); return; }
  const q = U.q.trim().toLowerCase();
  let list = E.byCls(U.mkt).filter(x => !q || x.name.toLowerCase().includes(q) || x.id.toLowerCase().includes(q));
  list.sort(U.sort === 'up' ? (a, b) => chg(b) - chg(a) : U.sort === 'dn' ? (a, b) => chg(a) - chg(b) : U.sort === 'name' ? (a, b) => a.name.localeCompare(b.name, 'de') : (a, b) => size(b) - size(a));
  $('#m-list').innerHTML = list.length ? list.map(x => {
    if (x.cls === 'bond') return row(x, { right: x.matured ? '<b>getilgt</b>' : `<b>${fmt(x.price, 2)} %</b><small class="fg2">Rendite ${fmt(x.ytm * 100, 2)} %</small>` });
    if (x.cls === 'fx') return row(x, { right: `<b>${fmt(x.price, x.dec)}</b><small class="${sc(chg(x))}">${pctS(chg(x))}</small>`, sub: `Zins ${x.base} ${fmt(rateOf(x.base) * 100, 2)} % · ${x.quote} ${fmt(rateOf(x.quote) * 100, 2)} %` });
    if (x.cls === 'fund') return row(x, { sub: `${x.type} · Ausgabeaufschlag ${fmt(x.aa * 100, 2)} %` });
    if (x.cls === 'etf') return row(x, { sub: `${isEtc(x) ? 'ETC' : 'ETF'} · Kosten ${fmt(x.ter * 100, 2)} % p. a.` });
    if (x.cls === 'stock') return row(x, { sub: `${x.id} · ${SECTORS[x.sector]} · ${fmtBig(x.shares * x.price)} €` });
    return row(x);
  }).join('') : '<p class="empty">Nichts gefunden.</p>';
}
actions.mseg = el => { S.UI.mkt = el.dataset.v; S.rebuild(); };
inputs['m-q'] = el => { S.UI.q = el.value; update(); };
changes['m-sort'] = el => { S.UI.sort = el.value; update(); };

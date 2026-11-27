// Nachrichten mit Filtern und Terminkalender
import { S, E, esc, actions, $ } from '../store.js';
import { info } from '../glossary.js';
import { newsItem, holdingIds, upcoming } from '../parts.js';
const { fDate, fTime, dayStart, DAY, SECTORS, weekStart } = E;
const CATS = [['all', 'Alle'], ['mine', 'Mein Portfolio'], ['earn', 'Quartalszahlen'], ['politics', 'Politik & Zölle'], ['macro', 'Makro & Zentralbank'], ['ma', 'M&A & Übernahmen']];

export function render() {
  const U = S.UI;
  return `<div class="grid2"><div class="stack" style="gap:16px">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap"><h1 class="h1">${U.newsView === 'cal' ? 'Termine' : 'Nachrichten'}</h1>
    <div class="seg"><button data-a="nview" data-v="feed" class="${U.newsView === 'feed' ? 'on' : ''}">Nachrichten</button><button data-a="nview" data-v="cal" class="${U.newsView === 'cal' ? 'on' : ''}">Kalender</button></div></div>
    ${U.newsView === 'feed' ? `<div class="chips" role="tablist">${CATS.map(c => `<button class="chip ${U.newsCat === c[0] ? 'on' : ''}" data-a="ncat" data-v="${c[0]}">${c[1]}</button>`).join('')}</div><div id="n-list"></div>`
      : `<p class="lead" style="margin:0">Was in den nächsten Wochen ansteht. Bereite dein Depot vor: Vor Quartalszahlen und Zinsentscheiden schwanken die Kurse stärker.</p><div id="n-cal"></div>`}
  </div><aside class="stack"><section class="sec"><h2>So liest du die Nachrichten</h2>
    <div class="lines"><div><span>Kursreaktion</span><b><span class="eff up">+2,1 %</span></b></div><div><span>Gerücht ${info('rumor')}</span><b><span class="rumor">unbestätigt</span></b></div><div><span>Politik ${info('polprob')}</span><b><span class="rumor">60 % Wahrscheinlichkeit</span></b></div><div><span>Kürzel antippen</span><b>öffnet den Wert</b></div></div>
    <p class="note" style="margin-top:10px">Fakten bewegen den Kurs sofort. Bei Gerüchten und Gesetzentwürfen ist nur ein Teil eingepreist – je wahrscheinlicher, desto mehr. Kommt es anders, dreht der Kurs.</p></section></aside></div>`;
}
export function update() {
  const U = S.UI;
  if (U.newsView === 'feed') {
    const mine = holdingIds(S.A);
    const own = U.newsCat === 'all' || U.newsCat === 'mine' ? (S.A.feed || []) : [];
    const list = own.concat(E.M.news.filter(n => U.newsCat === 'all' ? true : U.newsCat === 'mine' ? (n.ids || [n.id]).some(id => mine.has(id)) : n.cat === U.newsCat)).sort((a, b) => b.t - a.t).slice(0, 80);
    $('#n-list').innerHTML = list.length ? list.map(newsItem).join('') : `<p class="empty">${U.newsCat === 'mine' ? 'Zu deinen Werten gibt es gerade keine Meldungen.' : 'Keine Meldungen in dieser Kategorie.'}</p>`;
  } else {
    const ev = upcoming(35), byDay = new Map();
    for (const e of ev) { const d = dayStart(e.t); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(e); }
    // Tech-Earnings-Wochen markieren (mind. 3 Tech-/Halbleiter-Berichte in einer Woche)
    const weeks = {}; for (const e of ev) if (e.kind === 'Zahlen' && (e.sector === 'tech' || e.sector === 'semi')) { const w = weekStart(e.t); weeks[w] = (weeks[w] || 0) + 1; }
    $('#n-cal').innerHTML = byDay.size ? [...byDay.entries()].map(([d, items]) => {
      const tw = weeks[weekStart(d)] >= 3 && new Date(d).getUTCDay() === 1 ? `<div class="cal-item"><span class="k">Woche</span><b>Tech-Earnings-Woche</b><span class="fg2 small">${weeks[weekStart(d)]} Tech-Konzerne berichten – erhöhte Schwankung erwartet</span></div>` : '';
      return `<div class="cal-day"><div class="d">${fDate(d, true).slice(0, 9)}<small>${d === dayStart(E.M.t) ? 'heute' : ''}</small></div><div>${tw}${items.map(e => `<div class="cal-item"><span class="k">${e.kind === 'Zahlen' ? 'vorbörslich' : e.kind === 'Quartal' ? 'Quartal' : fTime(e.t)}</span><span style="flex:1;min-width:0">${e.id ? `<button class="link" data-go="i-${e.id}">${esc(e.txt)}</button>` : `<b style="font-weight:500">${esc(e.txt)}</b>`}${e.sub ? `<br><span class="small fg2">${esc(e.sub)}</span>` : ''}</span>${e.mine && e.id ? '<span class="tag">im Depot</span>' : ''}</div>`).join('')}</div></div>`;
    }).join('') : '<p class="empty">Keine Termine in den nächsten Wochen.</p>';
  }
}
actions.nview = el => { S.UI.newsView = el.dataset.v; S.rebuild(); };
actions.ncat = el => { S.UI.newsCat = el.dataset.v; el.parentElement.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', b === el)); update(); };

// NOVEX Börse – Hintergrund-Meldungen, damit der News-Feed lebt:
// Unternehmensnachrichten (Produkte, Aufträge, Personalien, Analysten, Insider), Marktberichte zu festen Uhrzeiten
// mit den echten Tagesgewinnern und -verlierern, Stimmungs- und Umschichtungsmeldungen.
// Kurswirkung bewusst klein und im Mittel neutral, damit die Kalibrierung des Marktes erhalten bleibt.
import { M, hook, byCls, addNews, setWhy, gauss, pick, clamp, pct, fmt, fmtBig, chg, dayStart, minuteOfDay, MIN, recomputeDerived } from './engine.js';
import { SECTORS } from './data.js';

const BANKS = ['Goldmann Sax', 'JP Morgen', 'Berenbank', 'Morgan Stanlee', 'UBX', 'Deutsche Bunk', 'Jefferis & Co.', 'Barcleys', 'Comerzbank', 'BNB Parisbas'];
const CITIES = ['Dresden', 'Leipzig', 'Austin', 'Rotterdam', 'Lyon', 'Krakau', 'Barcelona', 'Singapur', 'Toronto', 'Mailand', 'Stuttgart', 'Dublin'];
// Je Branche: positive, negative und neutrale Vorlagen. {n} Name, {c} Stadt, {k} Betrag, {q} Prozentzahl
const T = {
  _: {
    pos: ['{n} gewinnt Großauftrag über {k}', '{n} meldet Rekordbestellungen im laufenden Quartal', '{n} schließt strategische Partnerschaft mit einem Weltkonzern', '{n} kündigt Aktienrückkauf über {k} an', '{n} senkt Kosten schneller als geplant', '{n} hebt die Dividende überraschend an', 'Neue Studie: Kunden von {n} so zufrieden wie nie'],
    neg: ['{n}: Lieferengpässe bremsen die Produktion', '{n} verliert wichtigen Großkunden', 'Streik legt Standort von {n} in {c} lahm', '{n} muss Rückstellungen für Rechtsstreit erhöhen', 'Finanzvorstand von {n} verlässt das Unternehmen', '{n} verschiebt Investorentag – Anleger rätseln', 'IT-Panne bei {n}: Systeme stundenlang gestört'],
    neu: ['{n} eröffnet neuen Standort in {c}', '{n} beruft neues Vorstandsmitglied', '{n} lädt zum Kapitalmarkttag im nächsten Monat', '{n} stellt Nachhaltigkeitsbericht vor', '{n} benennt Geschäftsbereich um', '{n} verlängert Vertrag des Vorstandschefs']
  },
  tech: { pos: ['{n} stellt neue KI-Funktionen vor – Nutzerzahlen steigen', '{n} gewinnt Cloud-Auftrag einer Großbank über {k}'], neg: ['Datenschutzbehörde prüft neue App-Funktion von {n}', 'Ausfall bei {n}: Millionen Nutzer stundenlang offline'], neu: ['{n} stellt neues Produkt auf Entwicklerkonferenz vor'] },
  semi: { pos: ['{n}: Nachfrage nach KI-Chips übertrifft das Angebot', '{n} baut neues Werk in {c} – Subventionen zugesagt'], neg: ['{n}: Ausbeute in neuer Fertigung enttäuscht', 'Lagerbestände bei Chip-Kunden von {n} steigen'], neu: ['{n} zeigt nächste Chip-Generation auf Fachmesse'] },
  auto: { pos: ['{n}: Neues E-Auto-Modell mit langen Wartelisten', '{n} steigert Auslieferungen um {q} %'], neg: ['{n} ruft {k} Fahrzeuge zurück', '{n} kürzt Produktion wegen schwacher Nachfrage'], neu: ['{n} präsentiert Studie auf Automesse in {c}'] },
  fin: { pos: ['{n} profitiert von hohen Handelsumsätzen', '{n}: Kreditausfälle niedriger als befürchtet'], neg: ['Aufsicht verlangt von {n} mehr Eigenkapital', '{n} muss Abschreibungen auf Gewerbeimmobilien vornehmen'], neu: ['{n} startet neue Banking-App'] },
  cons: { pos: ['{n}: Umsatz im Weihnachtsgeschäft über Plan', 'Neue Kollektion von {n} ausverkauft'], neg: ['{n} senkt Preise, um Kunden zu halten', 'Hohe Rabatte belasten Marge von {n}'], neu: ['{n} eröffnet Flagship-Store in {c}'] },
  energy: { pos: ['{n} entdeckt großes neues Gasfeld', '{n} erhält Genehmigung für Offshore-Windpark'], neg: ['Leck in Pipeline: {n} stoppt Förderung vorübergehend', '{n} muss Projekt wegen Kostensteigerung abschreiben'], neu: ['{n} baut Ladenetz für E-Autos in {c} aus'] },
  health: { pos: ['Studie: Medikament von {n} wirkt besser als erwartet', 'Zulassung für neues Präparat von {n}'], neg: ['{n}: Studie mit Hoffnungsträger abgebrochen', 'Patentschutz für Bestseller von {n} läuft bald aus'], neu: ['{n} kooperiert mit Uniklinik in {c}'] },
  ind: { pos: ['{n} erhält Rekordauftrag über {k}', 'Auftragsbestand von {n} erreicht neues Hoch'], neg: ['{n}: Verzögerung bei Großprojekt kostet {k}', 'Zulieferprobleme bremsen {n}'], neu: ['{n} weiht neue Fabrik in {c} ein'] },
  tel: { pos: ['{n} gewinnt mehr Vertragskunden als erwartet', '{n} verkauft Funktürme für {k}'], neg: ['Netzausfall bei {n}: Kunden verärgert', 'Preiskampf im Mobilfunk trifft {n}'], neu: ['{n} baut Glasfaser in {c} aus'] },
  chem: { pos: ['{n} kann Preiserhöhungen durchsetzen', '{n}: Nachfrage aus Asien zieht an'], neg: ['Hohe Gaspreise belasten Werke von {n}', '{n} legt Anlage in {c} vorübergehend still'], neu: ['{n} forscht an recycelbaren Kunststoffen'] },
  util: { pos: ['{n} erhält höhere Netzentgelte genehmigt', '{n} schließt langfristigen Stromliefervertrag über {k}'], neg: ['Windflaute drückt Stromerzeugung von {n}', 'Regulierer kürzt erlaubte Rendite von {n}'], neu: ['{n} baut Batteriespeicher in {c}'] },
  realty: { pos: ['{n}: Mieteinnahmen steigen stärker als erwartet', '{n} verkauft Wohnungspaket über Buchwert'], neg: ['{n} muss Immobilienwerte abschreiben', 'Leerstand bei {n} steigt'], neu: ['{n} startet Neubauprojekt in {c}'] }
};
const fill = (s, x) => s.replace('{n}', x.name).replace('{c}', pick(CITIES)).replace('{k}', fmtBig(x.shares * x.price * (0.002 + Math.random() * 0.02)) + ' €').replace('{q}', fmt(5 + Math.random() * 20, 0));
const listed = () => byCls('stock').filter(x => !x.delisted);
const move = (x, j, why) => { x.f *= Math.exp(j); x.price = x.f * Math.exp(x.tr); if (why && Math.abs(j) >= 0.004) setWhy(x, `${pct(j, 1)} – ${why}`, j); };

hook('init', () => { if (!M.flav) M.flav = { done: {} }; });

/* ---------- Unternehmensmeldungen und Analysten ---------- */
function companyFlavor() {
  const st = listed(); if (!st.length) return;
  const x = pick(st), S = T[x.sector] || {}, r = Math.random(), sv = Math.sqrt(x.vol / 0.3);
  if (r < 0.22) { // Analysten: Kursziel rauf oder runter
    const up = Math.random() < 0.5, bank = pick(BANKS), a = x.price * (0.95 + Math.random() * 0.3), b = a * (up ? 1.08 + Math.random() * 0.2 : 0.75 + Math.random() * 0.15), j = (up ? 1 : -1) * (0.004 + Math.random() * 0.01) * sv;
    move(x, j, `${bank} ${up ? 'hebt' : 'senkt'} das Kursziel`);
    addNews(`${bank} ${up ? 'hebt' : 'senkt'} das Kursziel für ${x.name} auf ${fmt(b, 0)} €`, up ? 1 : -1, [x.id], { cat: 'company', eff: j, sub: up ? `Die Analysten trauen ${x.name} mehr zu und raten zum Kauf.` : `Die Analysten sind skeptischer geworden und raten zur Vorsicht.` });
    return;
  }
  if (r < 0.30) { // Insider
    const buy = Math.random() < 0.6, j = (buy ? 1 : -1) * (0.002 + Math.random() * 0.006) * sv;
    move(x, j, buy ? 'Insiderkauf' : 'Insiderverkauf');
    addNews(`${buy ? 'Insiderkauf' : 'Insiderverkauf'}: ${buy ? 'Vorstand' : 'Aufsichtsrat'} von ${x.name} ${buy ? 'kauft' : 'verkauft'} Aktien für ${fmtBig(x.shares * x.price * (0.00001 + Math.random() * 0.00005))} €`, buy ? 1 : -1, [x.id], { cat: 'company', eff: j, sub: buy ? 'Käufe des Managements gelten als Vertrauensbeweis – eine Garantie sind sie nicht.' : 'Verkäufe von Insidern können viele Gründe haben, Anleger werden trotzdem hellhörig.' });
    return;
  }
  const kind = r < 0.58 ? 'pos' : r < 0.86 ? 'neg' : 'neu';
  const pool = (S[kind] || []).concat(T._[kind]), txt = fill(pick(pool), x);
  const j = kind === 'neu' ? 0 : (kind === 'pos' ? 1 : -1) * (0.004 + Math.abs(gauss()) * 0.008) * sv;
  if (j) move(x, j, txt);
  addNews(txt, kind === 'pos' ? 1 : kind === 'neg' ? -1 : 0, [x.id], { cat: 'company', eff: j || null, sub: kind === 'neu' ? 'Für den Kurs vorerst ohne große Bedeutung.' : kind === 'pos' ? 'Gute Nachricht – Käufer greifen zu.' : 'Schlechte Nachricht – Anleger trennen sich von Aktien.' });
}

/* ---------- Stimmung: Umschichtungen zwischen Branchen ---------- */
function rotationFlavor() {
  const secs = Object.keys(SECTORS), a = pick(secs); let b = pick(secs); if (b === a) b = secs[(secs.indexOf(a) + 3) % secs.length];
  const j = 0.004 + Math.random() * 0.006;
  for (const x of listed()) { if (x.sector === a) move(x, j * Math.sqrt(x.vol / 0.3), `Anleger schichten in ${SECTORS[a]} um`); else if (x.sector === b) move(x, -j * Math.sqrt(x.vol / 0.3), `Anleger meiden ${SECTORS[b]}`); }
  recomputeDerived();
  const ids = listed().filter(x => x.sector === a).slice(0, 2).concat(listed().filter(x => x.sector === b).slice(0, 2)).map(x => x.id);
  addNews(`Umschichtung am Markt: ${SECTORS[a]} gefragt, ${SECTORS[b]} unter Druck`, 0, ids, { cat: 'macro', eff: null, sub: `Große Fonds verkaufen ${SECTORS[b]}-Werte und kaufen ${SECTORS[a]}. Kein konkreter Anlass – Stimmung und Positionierung vor den nächsten Terminen.` });
}

/* ---------- Marktberichte mit echten Zahlen ---------- */
function report(slot) {
  const ix = M.inst.WELTIX; if (!ix) return;
  const st = listed().filter(x => x.pc > 0).sort((a, b) => chg(b) - chg(a)), c = chg(ix);
  const top = st.slice(0, 3), flop = st.slice(-3).reverse();
  const sec = {}; for (const x of st) { (sec[x.sector] || (sec[x.sector] = [])).push(chg(x)); }
  const avg = Object.entries(sec).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]).sort((a, b) => b[1] - a[1]);
  const fx = M.inst.EURUSD, gold = M.inst.GOLD, oil = M.inst.BRNT;
  const mood = c > 0.012 ? 'Kräftige Gewinne' : c > 0.003 ? 'Leichte Gewinne' : c < -0.012 ? 'Deutliche Verluste' : c < -0.003 ? 'Leichte Verluste' : 'Wenig Bewegung';
  const head = { open: `Börsenstart: WELTIX ${pct(c, 1)} – ${mood.toLowerCase()} zum Auftakt`, noon: `Mittagsbericht: ${mood} – WELTIX ${pct(c, 1)}`, eu: `Europa-Schluss: WELTIX ${pct(c, 1)}, ${avg[0] ? SECTORS[avg[0][0]] : ''} vorn`, close: `Schlussglocke: WELTIX beendet den Tag ${pct(c, 1)}` }[slot];
  const lst = a => a.map(x => `${x.name} ${pct(chg(x), 1)}`).join(', ');
  const sub = `Gewinner: ${lst(top)}. Verlierer: ${lst(flop)}. Stärkste Branche: ${avg[0] ? SECTORS[avg[0][0]] + ' ' + pct(avg[0][1], 1) : '–'}, schwächste: ${avg.length ? SECTORS[avg[avg.length - 1][0]] + ' ' + pct(avg[avg.length - 1][1], 1) : '–'}.`
    + (fx ? ` Euro ${fmt(fx.price, 4)} $` : '') + (gold ? `, Gold ${pct(chg(gold), 1)}` : '') + (oil ? `, Öl ${pct(chg(oil), 1)}.` : '.');
  addNews(head, c > 0.003 ? 1 : c < -0.003 ? -1 : 0, ['WELTIX'].concat(top.slice(0, 1).map(x => x.id), flop.slice(0, 1).map(x => x.id)), { cat: 'market', eff: null, sub });
}
const SLOTS = [['open', 9 * 60], ['noon', 12 * 60 + 30], ['eu', 17 * 60 + 35]];

/* ---------- Ablauf ---------- */
hook('step', dtMs => {
  if (!M.flav) M.flav = { done: {} };
  const dm = dtMs / MIN, day = dayStart(M.t), mod = minuteOfDay(M.t);
  if (dm < 30) { // beim schnellen Nachholen langer Pausen keine Flut erzeugen
    if (Math.random() < dm / 40) companyFlavor();      // etwa alle 40 Handelsminuten eine Unternehmensmeldung
    if (Math.random() < dm / (60 * 7)) rotationFlavor(); // etwa zweimal pro Handelstag
  }
  for (const [k, at] of SLOTS) { const key = day + k; if (mod >= at && mod < at + 45 && !M.flav.done[key]) { M.flav.done[key] = 1; report(k); } }
  for (const k in M.flav.done) if (+k.slice(0, 13) < day - 3 * 86400000) delete M.flav.done[k];
});
hook('close', () => { const key = dayStart(M.t) + 'close'; if (M.flav && !M.flav.done[key]) { M.flav.done[key] = 1; report('close'); } });

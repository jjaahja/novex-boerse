// Erklär-System: jede Kennzahl in Alltagssprache, plus „Was bedeutet das für meinen Trade?“
import { esc } from './store.js';

export const G = {
  avgcost: { t: 'Einstand Ø', d: 'Was du im Schnitt pro Stück bezahlt hast, inklusive Gebühren. Liegt der Kurs darüber, bist du im Plus.' },
  networth: { t: 'Gesamtvermögen', d: 'Alles, was dir gehört: Guthaben, Wertpapiere zum aktuellen Kurs, Festgeld, Fremdwährungen und Luxusgüter zum Rückkaufwert. Ein Wertpapierkredit wird abgezogen.', so: 'Das ist die Zahl für die Rangliste und deine Vermögensstufe.' },
  cash: { t: 'Verrechnungskonto', d: 'Dein Bargeld bei der Börse. Von hier bezahlst du Käufe, hierhin fließen Verkäufe, Dividenden und Zinsen.', so: 'Nicht investiertes Geld bekommt Zinsen in Höhe des Leitzinses (bis 100.000 €).' },
  invested: { t: 'Investiert', d: 'Der aktuelle Wert aller Wertpapiere und Hebelprodukte in deinem Depot.', so: 'Dieser Teil schwankt mit dem Markt – nach oben wie nach unten.' },
  twr: { t: 'Rendite (zeitgewichtet)', d: 'Wie gut deine Anlagen gelaufen sind – ohne den Effekt von Prämien, Boni und Ausgaben. So rechnen auch Fonds ihre Wertentwicklung.', so: 'Damit kannst du dich fair mit dem Markt (WELTIX) und deinen Freunden vergleichen.' },
  today: { t: 'Heute', d: 'Veränderung seit dem Schlusskurs des letzten Handelstags.', so: 'Ein einzelner Tag sagt wenig. Wichtig ist die Richtung über Wochen und Monate.' },
  mcap: { t: 'Marktkapitalisierung', d: 'Was das ganze Unternehmen an der Börse wert ist: Aktienkurs mal Anzahl aller Aktien.', so: 'Große Unternehmen schwanken meist weniger und sind leichter zu handeln. Je kleiner, desto stärker bewegt deine Order den Kurs.' },
  kgv: { t: 'KGV (Kurs-Gewinn-Verhältnis)', d: 'Wie viele Jahresgewinne du für das Unternehmen bezahlst. KGV 20 heißt: Bei gleichbleibendem Gewinn hat es 20 Jahre gedauert, bis der Kaufpreis „verdient“ ist.', so: 'Hohes KGV = der Markt erwartet viel Wachstum. Enttäuschen die Zahlen, fällt so eine Aktie besonders tief.' },
  eps: { t: 'Gewinn je Aktie (EPS)', d: 'Der Gewinn des Unternehmens geteilt durch die Anzahl der Aktien. Wird jedes Quartal veröffentlicht.', so: 'Liegt der Gewinn über der Erwartung der Analysten („Beat“), steigt der Kurs meist – darunter („Miss“) fällt er.' },
  divy: { t: 'Dividendenrendite', d: 'Wie viel Prozent des Aktienkurses das Unternehmen pro Jahr als Gewinnbeteiligung auszahlt. Hier vierteljährlich, zusammen mit den Quartalszahlen.', so: 'Am Zahltag sinkt der Kurs um die Dividende – du verlierst also nichts. Mit Wiederanlage arbeitet der Zinseszins für dich.' },
  beta: { t: 'Beta', d: 'Wie stark die Aktie mit dem Gesamtmarkt mitschwingt. Beta 1 = wie der Markt, 2 = doppelt so stark, 0,5 = halb so stark.', so: 'In Crashs fallen Aktien mit hohem Beta besonders tief – im Aufschwung steigen sie stärker.' },
  vola: { t: 'Volatilität', d: 'Wie stark der Kurs typischerweise in einem Jahr schwankt. 30 % heißt: Ausschläge von ±30 % sind normal.', so: 'Hohe Volatilität bedeutet große Chancen und große Risiken. Bei Hebelprodukten verstärkt sich beides.' },
  hilo: { t: '52-Wochen-Hoch und -Tief', d: 'Der höchste und niedrigste Kurs der letzten zwölf Monate.', so: 'Zeigt dir, wo die Aktie gerade in ihrer Spanne steht – kurz vor dem Hoch oder nahe dem Tief.' },
  spread: { t: 'Spread', d: 'Der Unterschied zwischen dem Kaufkurs (Brief) und dem Verkaufskurs (Geld).', so: 'Den Spread zahlst du bei jedem Kauf und Verkauf versteckt mit. Bei wenig gehandelten Werten ist er größer.' },
  impact: { t: 'Marktwirkung', d: 'Große Orders verschieben den Kurs: Du kaufst dich durchs Orderbuch nach oben. Ein Teil der Bewegung bleibt, ein Teil klingt wieder ab.', so: 'Bei kleinen Beträgen kaum spürbar. Wer Millionen in eine kleine Aktie steckt, zahlt deutlich mehr als den angezeigten Kurs.' },
  fee: { t: 'Ordergebühr', d: 'Pro Börsenorder 0,05 % des Kurswerts, mindestens 1 €. Ab höheren Vermögensstufen wird es günstiger. Sparpläne und Dividenden-Wiederanlage sind kostenlos.', so: 'Viele kleine Orders sind teurer als wenige große – oder ein Sparplan.' },
  limit: { t: 'Ordertypen', d: 'Market: sofort zum besten verfügbaren Kurs. Limit: nur zu deinem Wunschkurs oder besser. Stop: wird erst aktiv, wenn ein Kurs erreicht ist (z. B. zum Absichern).', so: 'Für den Einstieg reicht „Market“. Limit-Orders schützen dich vor schlechten Kursen bei wenig gehandelten Werten.' },
  leitzins: { t: 'Leitzins', d: 'Der Zins, den die Zentralbank vorgibt. Sie entscheidet alle sechs Wochen, ob er steigt, fällt oder gleich bleibt.', so: 'Steigende Zinsen belasten Aktien und Anleihenkurse, bringen aber mehr Zinsen auf dein Guthaben und Festgeld. Banken profitieren meist.' },
  inflation: { t: 'Inflation', d: 'Wie stark die Preise im Jahr steigen. Wird jeden Monat veröffentlicht.', so: 'Höher als erwartet → die Zentralbank erhöht eher die Zinsen → Aktien geben oft nach. Rohstoffe und Energie profitieren.' },
  phase: { t: 'Marktphase', d: 'Die Wirtschaft läuft in Zyklen: Bullenmarkt, Seitwärtsphase, Inflationsschub, Zinswende, Rezession, Erholung. Jede Phase hat ihre Gewinner und Verlierer.', so: 'In der Rezession fallen die Kurse – genau dann ist Nachkaufen am günstigsten. Im Boom läuft fast alles.' },
  guidance: { t: 'Ausblick (Guidance)', d: 'Die Prognose des Managements für das restliche Geschäftsjahr.', so: 'Ein angehobener Ausblick zählt oft mehr als die Zahlen selbst – ein gesenkter kann trotz guter Zahlen zu Kursverlusten führen.' },
  consensus: { t: 'Analystenerwartung', d: 'Der Durchschnitt dessen, was Analysten für das Quartal erwarten. Daran wird das Ergebnis gemessen.', so: 'Der Kurs reagiert nicht auf „gut“ oder „schlecht“, sondern auf „besser oder schlechter als erwartet“.' },
  rev: { t: 'Umsatz', d: 'Alles, was das Unternehmen im Quartal eingenommen hat – vor Abzug der Kosten.', so: 'Wachsender Umsatz zeigt, dass das Geschäft läuft. Gewinn ohne Umsatzwachstum hält meist nicht lange.' },
  margin: { t: 'Operative Marge', d: 'Wie viel vom Umsatz nach den laufenden Kosten als Gewinn übrig bleibt.', so: 'Steigende Margen sind ein starkes Signal – das Unternehmen verdient an jedem Euro mehr.' },
  ter: { t: 'Laufende Kosten (TER)', d: 'Was der ETF oder Fonds pro Jahr für die Verwaltung abzieht. Wird täglich vom Kurs abgezogen.', so: 'Über viele Jahre machen 1 % mehr Kosten einen großen Unterschied. ETFs sind meist viel günstiger als aktive Fonds.' },
  nav: { t: 'Inventarwert (NAV)', d: 'Der Wert aller Wertpapiere im ETF oder Fonds, geteilt durch die Anteile.', so: 'Der Börsenkurs eines ETFs liegt fast immer sehr nah am NAV – Market Maker sorgen dafür.' },
  aa: { t: 'Ausgabeaufschlag', d: 'Einmalige Gebühr beim Kauf von aktiven Fonds, hier 3–5 %. Abgerechnet wird einmal täglich um 17:30 Uhr.', so: 'Den Aufschlag musst du erst wieder verdienen. Fonds lohnen sich eher für langes Halten.' },
  ytm: { t: 'Rendite (Anleihe)', d: 'Was du pro Jahr verdienst, wenn du die Anleihe heute kaufst und bis zur Rückzahlung hältst – Zinsen plus Kursgewinn oder -verlust.', so: 'Steigen die Marktzinsen, fällt der Kurs bestehender Anleihen. Bis zur Fälligkeit gehalten, bekommst du trotzdem 100 % zurück.' },
  duration: { t: 'Duration', d: 'Wie empfindlich der Anleihekurs auf Zinsänderungen reagiert. Duration 7: Steigen die Zinsen um 1 Prozentpunkt, fällt der Kurs um etwa 7 %.', so: 'Erwartest du sinkende Zinsen, gewinnen lange Anleihen am meisten.' },
  coupon: { t: 'Kupon', d: 'Der feste Zins, den die Anleihe einmal im Jahr auf den Nennwert zahlt.', so: 'Der Kupon landet direkt auf deinem Verrechnungskonto – planbares Einkommen.' },
  accrued: { t: 'Stückzinsen', d: 'Die Zinsen seit der letzten Kuponzahlung. Du zahlst sie beim Kauf an den Verkäufer und bekommst sie mit dem nächsten Kupon zurück.', so: 'Kein Verlust – nur eine faire Aufteilung der Zinsen zwischen Käufer und Verkäufer.' },
  rating: { t: 'Rating', d: 'Die Bonitätsnote des Schuldners: AAA ist sehr sicher, alles ab BB gilt als spekulativ („Hochzins“).', so: 'Schlechtere Ratings bringen höhere Zinsen – aber auch mehr Risiko, wenn es dem Unternehmen schlecht geht.' },
  lever: { t: 'Hebel', d: 'Ein Hebel von 10 bedeutet: Bewegt sich der Basiswert um 1 %, bewegt sich dein Produkt um etwa 10 %.', so: 'Gewinne und Verluste werden vervielfacht. Schon kleine Gegenbewegungen können zum Totalverlust führen.' },
  ko: { t: 'Turbo (Knock-out)', d: 'Hebelprodukt mit Schwelle: Erreicht der Basiswert die Knock-out-Schwelle, verfällt das Zertifikat sofort wertlos.', so: 'Je näher die Schwelle am Kurs liegt, desto höher der Hebel – und desto schneller ist alles weg.' },
  fac: { t: 'Faktor-Zertifikat', d: 'Hält den Hebel jeden Tag konstant. Ohne Knock-out-Schwelle, aber pfadabhängig.', so: 'Ideal für klare Trends. In Seitwärtsphasen verliert es an Wert, auch wenn der Basiswert am Ende gleich steht.' },
  opt: { t: 'Optionsschein', d: 'Das Recht, zum Basispreis zu kaufen (Call) oder zu verkaufen (Put). Verliert mit der Zeit an Wert, wenn sich nichts tut.', so: 'Maximaler Verlust ist dein Einsatz. Gewinnt vor allem bei schnellen, großen Bewegungen.' },
  cfd: { t: 'CFD', d: 'Eine Wette auf die Kursbewegung mit Sicherheitsleistung (Margin). Fällt dein Kapital auf 50 % der Margin, wird die Position automatisch geschlossen.', so: 'Hohe Hebel möglich, laufende Finanzierungskosten über Nacht. Mehr als die Margin kannst du nicht verlieren.' },
  festgeld: { t: 'Festgeld', d: 'Du legst Geld für eine feste Zeit an und bekommst einen festen Zins – etwas mehr als auf dem Verrechnungskonto.', so: 'Sicherer Hafen in Krisen. Während der Laufzeit kommst du nicht an das Geld.' },
  sparplan: { t: 'Sparplan', d: 'Regelmäßig automatisch einen festen Betrag investieren – ohne Ordergebühr, auch in Bruchstücken.', so: 'Du kaufst bei hohen Kursen wenig und bei tiefen Kursen viel. Langfristig ist das einer der stärksten Vermögensbauer.' },
  drip: { t: 'Dividenden wieder anlegen', d: 'Ausgeschüttete Dividenden werden automatisch und gebührenfrei in dieselbe Aktie investiert.', so: 'Der Zinseszins-Effekt: Deine Dividenden bringen selbst wieder Dividenden.' },
  credit: { t: 'Wertpapierkredit', d: 'Du leihst dir Geld gegen dein Depot als Sicherheit. Wie viel, hängt vom Beleihungswert ab (Aktien 50 %, ETFs 60 %, Anleihen 80 %) und von deiner Stufe.', so: 'Fällt dein Depot, schrumpft der Rahmen. Wird er überschritten, verkauft die Börse automatisch Wertpapiere. Kreditzinsen: Leitzins + 3 %.' },
  fxacc: { t: 'Fremdwährungskonten', d: 'Guthaben in US-Dollar, Franken oder Pfund. Getauscht wird zum Devisenkurs mit kleinem Spread.', so: 'Steigt die Fremdwährung gegenüber dem Euro, machst du einen Währungsgewinn. USD- und GBP-Guthaben bekommen derzeit höhere Zinsen.' },
  owner: { t: 'Großaktionär', d: 'Ab 1 % aller Aktien bekommst du Einblicke vom Unternehmen, ab 5 % Stimmrecht und eine Sonderdividende, ab 25 % einen Aufsichtsratssitz.', so: 'Bei großen Firmen kaum erreichbar – bei kleinen wie Quantix oder Solaris ein echtes Ziel.' },
  tier: { t: 'Vermögensstufe', d: 'Je größer dein Vermögen, desto mehr schaltest du frei: Kredit, längeres Festgeld, Analysewerkzeuge, günstigere Gebühren.', so: 'Der Aufstieg bringt jeweils eine einmalige Prämie aus der Zentralbank.' },
  divers: { t: 'Streuung', d: 'Wie viele „gleich große“ Positionen dein Depot effektiv hat. 10 Aktien, von denen eine 90 % ausmacht, sind effektiv nur gut eine Position.', so: 'Je breiter gestreut, desto weniger kann dich eine einzelne Pleite treffen.' },
  rumor: { t: 'Gerücht', d: 'Unbestätigte Meldung. Der Kurs reagiert schon, aber ob etwas dran ist, zeigt sich erst Tage später.', so: 'Wer auf Gerüchte setzt, kann viel gewinnen – oder den Aufschlag wieder verlieren, wenn das Gerücht platzt.' },
  bench: { t: 'Vergleich mit dem WELTIX', d: 'Zeigt, ob du besser oder schlechter als der Gesamtmarkt abschneidest. Beide Linien starten bei 0 %.', so: 'Den Index zu schlagen ist schwer. Ein ETF auf den WELTIX liefert dir die Marktrendite fast ohne Aufwand.' },
  zentral: { t: 'Zentralbank-Reserve', d: 'Alle Prämien, Boni und Zinsen kommen aus einer festen Reserve. Gebühren und Käufe von Lizenzen und Luxus füllen sie wieder auf.', so: 'Je leerer die Reserve, desto kleiner werden Boni und Prämien. Spielgeld ist also wirklich knapp.' }
};

export const info = k => G[k] ? `<button type="button" class="i" data-term="${k}" aria-label="Erklärung: ${esc(G[k].t)}" aria-expanded="false">i</button>` : '';

let open = null;
export function hidePop() { if (!open) return; open.pop.remove(); open.btn.setAttribute('aria-expanded', 'false'); open = null; }
export function togglePop(btn) {
  if (open && open.btn === btn) { hidePop(); return; }
  hidePop();
  const g = G[btn.dataset.term]; if (!g) return;
  const pop = document.createElement('div'); pop.className = 'pop'; pop.setAttribute('role', 'dialog');
  pop.innerHTML = `<h4>${esc(g.t)}</h4><p>${esc(g.d)}</p>${g.so ? `<p class="so">${esc(g.so)}</p>` : ''}`;
  document.body.appendChild(pop);
  const r = btn.getBoundingClientRect(), w = pop.offsetWidth, vw = document.documentElement.clientWidth;
  let left = r.left + window.scrollX - 12; left = Math.max(16 + window.scrollX, Math.min(left, window.scrollX + vw - w - 16));
  let top = r.bottom + window.scrollY + 8; if (r.bottom + pop.offsetHeight + 16 > window.innerHeight && r.top > pop.offsetHeight + 16) top = r.top + window.scrollY - pop.offsetHeight - 8;
  pop.style.left = left + 'px'; pop.style.top = top + 'px';
  btn.setAttribute('aria-expanded', 'true'); open = { btn, pop };
}

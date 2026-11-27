// NOVEX Börse – gemeinsame Engine für Browser (Vorschau) und Cloudflare Worker (verbindliche Ausführung).
// Alle Unternehmen, Staaten, Fonds und Emittenten sind frei erfunden.

export const VERSION = 2;
export const MIN = 60000, DAY = 86400000, YR = 365 * DAY;
export const OPEN_MIN = 8 * 60, CLOSE_MIN = 22 * 60, FUND_CUT = 17 * 60 + 30; // Handelszeit 08:00–22:00, Fonds-Annahmeschluss 17:30
export const SESSION = CLOSE_MIN - OPEN_MIN;
const DT = 1 / (252 * SESSION);                  // Jahre je Handelsminute
export const PERM = 0.45, TRANS = 0.15, AMAX = 1.6, IMPACT_Y = 1.0;
export const FEE_RATE = 0.0005, FEE_MIN = 1, KO_SPR = 0.0002;
const C1MAX = 900, CDMAX = 400;
const TD_BASE = Math.pow(0.5, 1 / 45);          // transiente Marktwirkung: Halbwertszeit 45 Min.
const ID_BASE = Math.pow(0.5, 1 / (3 * SESSION)); // Anleihen: 3 Handelstage
const RATES = { USD: 0.040, GBP: 0.040, JPY: 0.005, CHF: 0.0025, AUD: 0.036 };
// Kalibrierung: Diffusion + Volatilitäts-Regime + Übernacht-Lücken + Nachrichtensprünge ergeben zusammen die angegebene Jahresvola
const SIG_M = 0.14, SIG_S = 0.09, SIG_C = 0.10, VS = 0.76, VSH = VS * Math.sqrt(1.25), VSC = 0.68; // VSC: Rohstoffe haben zusätzlich Makro-Preissprünge

export let M = null;
// Beim Laden: abgeleitete Parameter neu berechnen und neu hinzugekommene Produkte in den laufenden Markt einfügen
export function setMarket(m) { M = m; const added = buildMissing(); normalize(); if (added.length && M.ids.includes('WELTIX') && !added.includes('WELTIX')) extendWorld(added); return added; }
function normalize() {
  for (const id of M.ids) {
    const x = M.inst[id]; if (x.cls !== 'stock' && x.cls !== 'cmd') continue;
    const sg = x.cls === 'cmd' ? SIG_C : SIG_S;
    x.idv = Math.sqrt(Math.max(x.cls === 'cmd' ? 0.0025 : 0.01, x.vol * x.vol - Math.pow(x.beta * SIG_M, 2) - sg * sg));
    const vs = x.cls === 'cmd' ? VSC : VS; x.var = vs * vs * (Math.pow(x.beta * SIG_M, 2) + sg * sg + x.idv * x.idv);
  }
}
const ENV = { accounts: () => [], note() { }, dirty() { }, fee() { }, event() { } };
export function setEnv(e) { Object.assign(ENV, e); }

/* ---------- Hilfen ---------- */
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function gauss() { let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function heavy() { const g = gauss(); return (Math.random() < 0.04 ? g * 2.5 : g) / 1.1; }
const pick = a => a[Math.floor(Math.random() * a.length)];
export const dayStart = t => Math.floor(t / DAY) * DAY;
export const minuteOfDay = t => { const d = new Date(t); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
export const weekStart = t => { const d = dayStart(t); return d - ((new Date(d).getUTCDay() + 6) % 7) * DAY; };
function easter(y) { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451); const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return Date.UTC(y, mo - 1, da); }
export function isHoliday(t) {
  const d = new Date(t), m = d.getUTCMonth() + 1, x = d.getUTCDate(), ds = dayStart(t), e = easter(d.getUTCFullYear());
  return (m === 12 && (x === 24 || x === 25 || x === 26 || x === 31)) || (m === 1 && x === 1) || (m === 5 && x === 1) || ds === e - 2 * DAY || ds === e + DAY;
}
export function isTradingDay(t) { const wd = new Date(t).getUTCDay(); return wd !== 0 && wd !== 6 && !isHoliday(t); }
export function nextOpenFrom(t) { let d = dayStart(t); if (isTradingDay(d) && t < d + OPEN_MIN * MIN) return d + OPEN_MIN * MIN; d += DAY; while (!isTradingDay(d)) d += DAY; return d + OPEN_MIN * MIN; }

const NF = {};
export function fmt(n, d = 2) { if (n === null || n === undefined || !isFinite(n)) return '–'; if (!NF[d]) NF[d] = new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }); return NF[d].format(n); }
export const fmtE = (n, d = 2) => fmt(n, d) + ' €';
export function fmtBig(n) { const a = Math.abs(n); if (!isFinite(n)) return '–'; if (a >= 1e12) return fmt(n / 1e12, 2) + ' Bio.'; if (a >= 1e9) return fmt(n / 1e9, 2) + ' Mrd.'; if (a >= 1e6) return fmt(n / 1e6, 2) + ' Mio.'; if (a >= 1e4) return fmt(n / 1e3, 1) + ' Tsd.'; return fmt(n, a < 10 && n % 1 ? 2 : 0); }
export const pct = (n, d = 2) => isFinite(n) ? (n > 0 ? '+' : '') + fmt(n * 100, d) + ' %' : '–';
const p2 = n => String(n).padStart(2, '0');
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export function fDate(t, wd) { const d = new Date(t); return (wd ? WD[d.getUTCDay()] + ' ' : '') + p2(d.getUTCDate()) + '.' + p2(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear(); }
export function fTime(t) { const d = new Date(t); return p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()); }
export function dig(x) { if (x.cls === 'fx') return x.dec; if (x.cls === 'bond') return 3; if (x.cls === 'cmd' && x.price < 10) return 3; if (x.price < 2) return 4; return 2; }
export function fmtPx(x, p) { return fmt(p, dig(x)) + (x.cls === 'bond' ? ' %' : x.cls === 'cmd' ? ' $' : x.cls === 'fx' || x.cls === 'index' ? '' : ' €'); }
export function fmtQty(x, q) { if (x.cls === 'bond') return fmt(q, 0) + ' € nom.'; if (x.cls === 'fund') return fmt(q, 3) + ' Ant.'; return fmt(q, 0) + ' Stk.'; }
export function fmtD(p) { return fmt(p, p < 1 ? 4 : p < 10 ? 3 : 2) + ' €'; }
export const r2 = n => Math.round(n * 100) / 100;

/* ---------- Black-Scholes ---------- */
function ncdf(x) { const t = 1 / (1 + 0.2316419 * Math.abs(x)); const d = 0.3989422804014327 * Math.exp(-x * x / 2); const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))); return x > 0 ? 1 - p : p; }
function bs(cp, S, K, T, r, q, v) {
  if (T <= 0 || v <= 0) return Math.max(0, cp === 'C' ? S - K : K - S);
  const sq = v * Math.sqrt(T), d1 = (Math.log(S / K) + (r - q + 0.5 * v * v) * T) / sq, d2 = d1 - sq;
  return cp === 'C' ? S * Math.exp(-q * T) * ncdf(d1) - K * Math.exp(-r * T) * ncdf(d2) : K * Math.exp(-r * T) * ncdf(-d2) - S * Math.exp(-q * T) * ncdf(-d1);
}
function bsDelta(cp, S, K, T, r, q, v) {
  if (T <= 0 || v <= 0) return cp === 'C' ? (S > K ? 1 : 0) : (S < K ? -1 : 0);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * v * v) * T) / (v * Math.sqrt(T));
  return cp === 'C' ? Math.exp(-q * T) * ncdf(d1) : Math.exp(-q * T) * (ncdf(d1) - 1);
}

/* ---------- Stammdaten ---------- */
export const SECTORS = { tech: 'Software & Internet', semi: 'Halbleiter', auto: 'Automobil', fin: 'Finanzen', cons: 'Konsum', energy: 'Energie', health: 'Gesundheit', ind: 'Industrie', tel: 'Telekom', chem: 'Chemie' };
export const CSECT = { prec: 'Edelmetalle', ener: 'Energie', metal: 'Industriemetalle', agri: 'Agrar' };
const STOCKS = [
  ['MVDA', 'Mvidia Corp.', 'semi', 168.40, 24.4, 1.6, 0.50, 0.0070, 46, 0.0003, 'Weltmarktführer für KI-Beschleuniger und Grafikprozessoren.'],
  ['PEAR', 'Pear Inc.', 'tech', 212.80, 15.0, 1.1, 0.26, 0.0030, 33, 0.0045, 'Smartphones, Tablets und ein geschlossenes App-Ökosystem.'],
  ['MHRD', 'Macrohard Corp.', 'tech', 405.10, 7.4, 1.0, 0.24, 0.0030, 35, 0.0075, 'Betriebssysteme, Büro-Software und Cloud-Infrastruktur.'],
  ['ABET', 'Alphabeat Inc.', 'tech', 252.30, 12.1, 1.1, 0.30, 0.0030, 24, 0.0035, 'Suchmaschine, Werbenetzwerk und Videoplattform.'],
  ['AMZS', 'Amazonas Retail', 'cons', 198.60, 10.6, 1.2, 0.32, 0.0040, 38, 0, 'Online-Versandhandel und Cloud-Dienste.'],
  ['TSLR', 'Tesler Motors', 'auto', 365.20, 3.2, 2.0, 0.60, 0.0200, 120, 0, 'Elektroautos, Batteriespeicher und Robotaxi-Pläne.'],
  ['MTVR', 'Metaversum Platforms', 'tech', 590.50, 2.5, 1.3, 0.38, 0.0050, 27, 0.0034, 'Soziale Netzwerke, Messenger und VR-Brillen.'],
  ['SAPF', 'Sapfire Software', 'tech', 205.40, 1.23, 0.9, 0.28, 0.0030, 42, 0.0110, 'Unternehmenssoftware für Buchhaltung und Logistik.'],
  ['SIMZ', 'Siemenz AG', 'ind', 218.30, 0.79, 1.0, 0.25, 0.0030, 19, 0.0240, 'Automatisierung, Zugtechnik und Medizintechnik.'],
  ['ALNX', 'Allianx SE', 'fin', 345.60, 0.385, 0.8, 0.20, 0.0025, 13, 0.0460, 'Versicherungen und Vermögensverwaltung.'],
  ['DBNK', 'Deutsche Bunk AG', 'fin', 26.42, 1.95, 1.4, 0.35, 0.0060, 10, 0.0260, 'Universalbank mit großem Investmentbanking.'],
  ['VWGN', 'Volkswagon AG', 'auto', 92.18, 0.50, 1.2, 0.30, 0.0050, 4.5, 0.0680, 'Massenhersteller von Pkw und Nutzfahrzeugen.'],
  ['BMVW', 'BMV Motorenwerke', 'auto', 78.04, 0.64, 1.1, 0.28, 0.0040, 6, 0.0560, 'Premium-Autos und Motorräder.'],
  ['ADBS', 'Adibas AG', 'cons', 182.50, 0.178, 1.0, 0.30, 0.0060, 32, 0.0110, 'Sportartikel, Schuhe und Bekleidung.'],
  ['NSTL', 'Nestlo SA', 'cons', 81.20, 2.6, 0.5, 0.17, 0.0020, 17, 0.0380, 'Nahrungsmittel, Kaffee und Tiernahrung.'],
  ['KOKA', 'Koka-Kolo Co.', 'cons', 63.10, 4.3, 0.6, 0.16, 0.0020, 24, 0.0300, 'Erfrischungsgetränke in über 200 Ländern.'],
  ['EXXF', 'Exxoff Energy', 'energy', 104.30, 4.3, 0.8, 0.25, 0.0030, 13, 0.0350, 'Öl- und Gasförderung, Raffinerien.'],
  ['SHLL', 'Shall plc', 'energy', 31.55, 6.1, 0.8, 0.24, 0.0030, 11, 0.0400, 'Integrierter Energiekonzern mit Flüssiggasgeschäft.'],
  ['PFZR', 'Pfizzer Inc.', 'health', 24.80, 5.7, 0.6, 0.22, 0.0040, 9, 0.0650, 'Impfstoffe und verschreibungspflichtige Medikamente.'],
  ['NVNO', 'Novanordo A/S', 'health', 54.10, 4.4, 0.9, 0.38, 0.0060, 18, 0.0250, 'Diabetes- und Abnehmmedikamente.'],
  ['ABZZ', 'Airbuzz SE', 'ind', 196.20, 0.79, 1.1, 0.28, 0.0030, 28, 0.0100, 'Verkehrsflugzeuge, Hubschrauber und Raumfahrt.'],
  ['TTEL', 'Telekom Teutonia', 'tel', 30.20, 4.98, 0.5, 0.18, 0.0020, 14, 0.0300, 'Mobilfunk, Festnetz und Glasfaser.'],
  ['QNTX', 'Quantix Computing', 'tech', 14.20, 0.30, 2.4, 0.95, 0.0500, -1, 0, 'Quantencomputer-Start-up, noch ohne Gewinn.'],
  ['SOLR', 'Solaris Energie', 'energy', 7.82, 0.50, 1.6, 0.70, 0.0200, 31, 0, 'Solarparks und Heimspeicher, hoch verschuldet.'],
  // ab hier: nicht im WELTIX 24 enthalten
  ['NTFX', 'Netflux Inc.', 'tech', 612.40, 0.43, 1.2, 0.36, 0.0050, 41, 0, 'Streamingdienst mit eigenen Serien und Filmen.'],
  ['JPMG', 'JP Morgen Chase', 'fin', 218.70, 2.85, 1.1, 0.24, 0.0030, 13, 0.0220, 'Größte Bank des Landes: Privatkunden, Investmentbanking, Vermögensverwaltung.'],
  ['VIZZ', 'Vizza Payments', 'fin', 286.30, 1.95, 0.9, 0.20, 0.0025, 30, 0.0075, 'Kreditkarten-Netzwerk und digitale Zahlungen.'],
  ['HRMZ', 'Hermez SCA', 'cons', 2210.00, 0.105, 0.9, 0.27, 0.0020, 52, 0.0080, 'Luxusmode, Lederwaren und Seidentücher mit langen Wartelisten.'],
  ['RHST', 'Rheinstahl Defence', 'ind', 548.00, 0.0435, 0.7, 0.42, 0.0120, 38, 0.0090, 'Panzer, Munition und Flugabwehr – profitiert von steigenden Verteidigungsetats.'],
  ['LUFZ', 'Lufthanza AG', 'ind', 6.84, 1.2, 1.4, 0.38, 0.0080, 6, 0.0440, 'Fluggesellschaft mit Drehkreuzen in Frankfurt und München.'],
  ['BSFA', 'Basfa SE', 'chem', 44.30, 0.89, 1.1, 0.26, 0.0040, 21, 0.0770, 'Chemiekonzern: Kunststoffe, Agrarchemie und Batteriematerialien.'],
  ['CBZE', 'Coinbaze Global', 'fin', 245.60, 0.25, 2.2, 0.80, 0.0300, 45, 0, 'Kryptobörse – schwankt mit dem Bitcoin-Kurs.']
];
const CORE = new Set(STOCKS.slice(0, 24).map(d => d[0])); // Bestandteile des WELTIX 24
const BONDS = [
  ['TEUT29', 'Teutonien 2,10 % 2029', 'Bundesrepublik Teutonien', 2.10, [2029, 4, 15], 'AAA', 0, 1500, null],
  ['TEUT34', 'Teutonien 2,60 % 2034', 'Bundesrepublik Teutonien', 2.60, [2034, 2, 15], 'AAA', 0, 1200, null],
  ['TEUT54', 'Teutonien 3,25 % 2054', 'Bundesrepublik Teutonien', 3.25, [2054, 8, 15], 'AAA', 8, 400, null],
  ['HISP31', 'Hispalia 3,15 % 2031', 'Königreich Hispalia', 3.15, [2031, 10, 31], 'A', 55, 600, null],
  ['LOMB33', 'Lombardia 3,85 % 2033', 'Republik Lombardia', 3.85, [2033, 9, 1], 'BBB', 110, 800, null],
  ['MVDA30', 'Mvidia 3,40 % 2030', 'Mvidia Corp.', 3.40, [2030, 6, 1], 'AA-', 45, 120, 'MVDA'],
  ['TSLR32', 'Tesler 5,75 % 2032', 'Tesler Motors', 5.75, [2032, 3, 15], 'BB+', 250, 90, 'TSLR'],
  ['DBNK28', 'Deutsche Bunk 4,50 % 2028', 'Deutsche Bunk AG', 4.50, [2028, 1, 19], 'BBB', 130, 150, 'DBNK'],
  ['VWGN31', 'Volkswagon 3,875 % 2031', 'Volkswagon AG', 3.875, [2031, 11, 30], 'BBB+', 105, 110, 'VWGN'],
  ['SOLR29', 'Solaris Energie 8,25 % 2029', 'Solaris Energie', 8.25, [2029, 7, 1], 'B', 560, 15, 'SOLR'],
  ['TEUT27', 'Teutonien 2,00 % 2027', 'Bundesrepublik Teutonien', 2.00, [2027, 6, 15], 'AAA', 0, 2000, null],
  ['TEUT31', 'Teutonien 0 % 2031 (Nullkupon)', 'Bundesrepublik Teutonien', 0, [2031, 8, 15], 'AAA', 0, 700, null],
  ['JPMG29', 'JP Morgen 4,20 % 2029', 'JP Morgen Chase', 4.20, [2029, 9, 24], 'A+', 70, 200, 'JPMG'],
  ['HRMZ35', 'Hermez 3,10 % 2035', 'Hermez SCA', 3.10, [2035, 5, 7], 'A', 60, 60, 'HRMZ'],
  ['CBZE30', 'Coinbaze 9,50 % 2030', 'Coinbaze Global', 9.50, [2030, 10, 1], 'B-', 650, 20, 'CBZE']
];
// Rohstoffe (Notierung in US-Dollar): id, Name, Einheit, Kurs, Vola p.a., Beta, Gruppe, Tagesumsatz (Mrd €), halber Spread, Beschreibung
const CMDS = [
  ['GOLD', 'Gold', 'Feinunze', 2650, 0.15, -0.05, 'prec', 150, 0.00005, 'Das klassische Krisenmetall. Gefragt, wenn Anleger Sicherheit suchen.'],
  ['SILV', 'Silber', 'Feinunze', 31.20, 0.28, 0.2, 'prec', 20, 0.0002, 'Edel- und Industriemetall, schwankt stärker als Gold.'],
  ['BRNT', 'Rohöl Brent', 'Barrel', 73.40, 0.32, 0.5, 'ener', 100, 0.0002, 'Referenzsorte für Rohöl aus der Nordsee.'],
  ['NGAS', 'Erdgas', 'MMBtu', 3.20, 0.60, 0.3, 'ener', 20, 0.0006, 'US-Erdgas (Henry Hub). Wetter und Speicherstände bewegen den Preis stark.'],
  ['COPR', 'Kupfer', 'Pfund', 4.15, 0.22, 0.7, 'metal', 30, 0.0003, 'Konjunkturmetall für Kabel, Motoren und Stromnetze.'],
  ['WHEA', 'Weizen', 'Scheffel', 5.50, 0.28, 0.1, 'agri', 3, 0.0008, 'Wichtigstes Brotgetreide; Ernten und Wetter treiben den Preis.']
];
const CMDNEWS = {
  GOLD: [['Zentralbanken kaufen Gold in Rekordmenge', 'Goldpreis steigt nach schwachen US-Daten'], ['Starker Dollar belastet den Goldpreis', 'Anleger ziehen Geld aus Gold-ETCs ab']],
  SILV: [['Solarindustrie treibt Silbernachfrage', 'Silber folgt Gold nach oben'], ['Silberminen fahren Produktion hoch', 'Gewinnmitnahmen bei Silber']],
  BRNT: [['OPEC+ kündigt Förderkürzung an', 'Angriff auf Tanker im Golf treibt Ölpreis'], ['US-Lagerbestände steigen überraschend stark', 'OPEC+ uneinig – mehr Öl kommt auf den Markt']],
  NGAS: [['Kältewelle treibt Gasnachfrage', 'Ausfall eines LNG-Terminals verknappt Angebot'], ['Milder Winter: Gasspeicher randvoll', 'Neue Förderprojekte drücken Gaspreis']],
  COPR: [['Streik in der größten Kupfermine der Welt', 'Netzausbau lässt Kupfernachfrage steigen'], ['Bauwirtschaft schwächelt – Kupfer unter Druck', 'Kupferlager in London füllen sich']],
  WHEA: [['Dürre bedroht die Weizenernte', 'Exportstopp eines großen Anbaulands'], ['Rekordernte drückt Weizenpreise', 'Regen entspannt die Lage auf den Feldern']]
};
const FXP = [
  ['EURUSD', 'EUR', 'USD', 500, 0.6, 0.065], ['GBPUSD', 'GBP', 'USD', 200, 0.9, 0.075], ['USDJPY', 'USD', 'JPY', 300, 0.8, 0.095],
  ['EURCHF', 'EUR', 'CHF', 60, 1.2, 0.055], ['AUDUSD', 'AUD', 'USD', 90, 0.8, 0.095], ['EURGBP', 'EUR', 'GBP', 70, 0.9, 0.055], ['EURJPY', 'EUR', 'JPY', 70, 1.2, 0.10]
];
const ETFS = [
  { id: 'WLTX', name: 'iShores WELTIX 24 UCITS ETF', px: 92.40, ter: 0.0007, sprd: 0.0004, adv: 3e8, comp: 'ALLCAP', desc: 'Bildet den Leitindex WELTIX 24 physisch und vollständig nach.' },
  { id: 'TECX', name: 'Vanguardian Global Tech ETF', px: 48.15, ter: 0.0015, sprd: 0.0005, adv: 1.2e8, comp: 'TECHCAP', desc: 'Alle Software-, Internet- und Halbleiterwerte, nach Marktkapitalisierung gewichtet.' },
  { id: 'DIVX', name: 'Xtrakt Europa Dividenden ETF', px: 31.70, ter: 0.0030, sprd: 0.0008, adv: 3e7, comp: { ALNX: 1, SIMZ: 1, TTEL: 1, NSTL: 1, BMVW: 1, VWGN: 1, DBNK: 1, SHLL: 1, ABZZ: 1, SAPF: 1 }, desc: 'Zehn europäische Dividendenwerte, gleichgewichtet.' },
  { id: 'EGOV', name: 'iShores Euro Staatsanleihen ETF', px: 118.30, ter: 0.0009, sprd: 0.00015, adv: 8e7, comp: { TEUT29: 1, TEUT34: 1, TEUT54: 1, HISP31: 1, LOMB33: 1 }, desc: 'Staatsanleihen der Eurozone über alle Laufzeiten.' },
  { id: 'ECRP', name: 'Xtrakt Euro Corporate Bond ETF', px: 54.20, ter: 0.0020, sprd: 0.0003, adv: 2.5e7, comp: { MVDA30: 1, TSLR32: 1, DBNK28: 1, VWGN31: 1, SOLR29: 1 }, desc: 'Unternehmensanleihen von Investment Grade bis High Yield.' },
  { id: 'GLDX', name: 'Xtrakt Physical Gold ETC', px: 24.80, ter: 0.0025, sprd: 0.0003, adv: 1.5e8, comp: { GOLD: 1 }, desc: 'Mit physischem Gold hinterlegt. Notiert in Euro und folgt dem Goldpreis in US-Dollar (nicht währungsgesichert).' },
  { id: 'SLVX', name: 'Xtrakt Physical Silver ETC', px: 28.40, ter: 0.0045, sprd: 0.0006, adv: 3e7, comp: { SILV: 1 }, desc: 'Mit physischem Silber hinterlegt, nicht währungsgesichert.' },
  { id: 'OILX', name: 'WisdomFree Brent Crude Oil ETC', px: 18.60, ter: 0.0049, sprd: 0.0008, adv: 4e7, comp: { BRNT: 1 }, desc: 'Bildet den Ölpreis der Sorte Brent ab, nicht währungsgesichert.' },
  { id: 'CMDX', name: 'iShores Diversified Commodity ETF', px: 36.20, ter: 0.0019, sprd: 0.0006, adv: 3e7, comp: { GOLD: .3, BRNT: .25, COPR: .2, SILV: .1, NGAS: .1, WHEA: .05 }, desc: 'Breiter Rohstoffkorb aus Edelmetallen, Energie, Industriemetallen und Agrar.' },
  { id: 'FINX', name: 'Vanguardian Global Financials ETF', px: 42.90, ter: 0.0018, sprd: 0.0005, adv: 4e7, comp: { JPMG: .3, VIZZ: .25, ALNX: .2, DBNK: .15, CBZE: .1 }, desc: 'Banken, Versicherer und Zahlungsdienstleister.' },
  { id: 'DEFX', name: 'Xtrakt Europe Defence ETF', px: 27.10, ter: 0.0035, sprd: 0.0008, adv: 2e7, comp: { RHST: .4, ABZZ: .35, SIMZ: .25 }, desc: 'Europäische Rüstungs- und Luftfahrtwerte.' }
];
const FUNDS = [
  { id: 'DWZT', name: 'DWZ Top Dividende', px: 142.85, aa: 0.05, ter: 0.0145, av: 0.02, type: 'Aktienfonds', comp: { ALNX: .12, NSTL: .12, KOKA: .12, TTEL: .12, EXXF: .10, SHLL: .10, PFZR: .10, SIMZ: .11, MHRD: .11 }, desc: 'Aktiv gemanagter Dividendenfonds mit Fokus auf defensive Substanzwerte.' },
  { id: 'UNIG', name: 'Unidepot Global', px: 386.20, aa: 0.05, ter: 0.0150, av: 0.02, type: 'Aktienfonds', comp: { PEAR: .12, MHRD: .12, ABET: .10, AMZS: .10, MVDA: .10, NSTL: .06, ALNX: .06, SIMZ: .06, NVNO: .06, EXXF: .06, KOKA: .05, SAPF: .05, ABZZ: .06 }, desc: 'Breit gestreuter globaler Aktienfonds.' },
  { id: 'FTIN', name: 'Fidelitas Tech Innovation', px: 27.64, aa: 0.0525, ter: 0.0180, av: 0.03, type: 'Aktienfonds', comp: { MVDA: .25, MTVR: .15, ABET: .15, TSLR: .15, QNTX: .10, SAPF: .10, PEAR: .10 }, desc: 'Konzentrierter Technologiefonds mit hoher Schwankung.' },
  { id: 'HREN', name: 'Hansa Rentenfonds Euro', px: 51.12, aa: 0.03, ter: 0.0090, av: 0.004, type: 'Rentenfonds', comp: { TEUT29: .2, TEUT34: .2, HISP31: .15, LOMB33: .15, DBNK28: .1, VWGN31: .1, MVDA30: .1 }, desc: 'Euro-Anleihen guter Bonität, Staats- und Unternehmensanleihen.' },
  { id: 'MBAL', name: 'Mischfonds Balance 60/40', px: 63.48, aa: 0.04, ter: 0.0135, av: 0.01, type: 'Mischfonds', comp: { PEAR: .1, MHRD: .1, NSTL: .1, ALNX: .1, SIMZ: .1, EXXF: .1, TEUT34: .15, TEUT54: .1, HISP31: .15 }, desc: 'Ausgewogener Mischfonds: 60 % Aktien, 40 % Anleihen.' },
  { id: 'RHGF', name: 'Lazarus Rohstoff & Gold', px: 88.40, aa: 0.05, ter: 0.0175, av: 0.03, type: 'Rohstofffonds', comp: { GOLD: .35, SILV: .1, BRNT: .15, COPR: .1, EXXF: .15, SHLL: .15 }, desc: 'Aktiv gemanagter Rohstofffonds mit Goldschwerpunkt und Energieaktien.' },
  { id: 'GVAL', name: 'Kapital Global Value', px: 156.90, aa: 0.05, ter: 0.0160, av: 0.02, type: 'Aktienfonds', comp: { JPMG: .15, ALNX: .12, NSTL: .12, KOKA: .1, PFZR: .1, BSFA: .1, VWGN: .1, TTEL: .11, HRMZ: .1 }, desc: 'Weltweite Substanzwerte mit niedriger Bewertung.' }
];
const POSN = ['{n} übertrifft die Gewinnerwartungen deutlich', '{n} hebt die Jahresprognose an', 'Analysten stufen {n} auf „Kaufen“ hoch', '{n} meldet Rekordumsatz im Quartal', '{n} kündigt milliardenschweren Aktienrückkauf an', '{n} gewinnt Großauftrag', 'Übernahmegerüchte um {n}', '{n}: Neues Produkt übertrifft Vorbestellungen'];
const NEGN = ['{n} verfehlt die Umsatzerwartungen', '{n} senkt die Prognose', 'Kartellbehörde ermittelt gegen {n}', '{n}: Finanzvorstand tritt überraschend zurück', 'Rückrufaktion belastet {n}', 'Analysten stufen {n} auf „Verkaufen“ ab', '{n} warnt vor schwächerer Nachfrage', 'Hackerangriff legt Systeme von {n} lahm'];

/* ---------- Spielökonomie (Definitionen, gemeinsam für Server und Browser) ---------- */
export const LIC = [
  { name: 'Basis', price: 0, ko: 10, fac: 3, cfd: 5, opt: false, desc: 'Aktien, ETFs, ETCs, Fonds, Anleihen. Turbos bis Hebel 10, Faktor bis 3, CFDs und Devisen bis 1:5.' },
  { name: 'Derivate-Lizenz', price: 2500, ko: 50, fac: 10, cfd: 30, opt: true, desc: 'Turbos bis Hebel 50, Faktor bis 10, Optionsscheine, CFDs und Devisen bis 1:30.' },
  { name: 'Profi-Lizenz', price: 25000, ko: 500, fac: 20, cfd: 200, opt: true, desc: 'Turbos bis Hebel 500, Faktor bis 20, CFDs und Devisen bis 1:200.' }
];
export const LUX = [
  { id: 'uhr', name: 'Rolexx Daytona', price: 15000, supply: 12, desc: 'Die Uhr, auf die jeder beim Händeschütteln schaut.' },
  { id: 'glocke', name: 'Goldene Börsenglocke', price: 40000, supply: 8, desc: 'Einmal läuten, und alle wissen: Du hast es geschafft.' },
  { id: 'auto', name: 'Ferrino 812 Superfast', price: 250000, supply: 5, desc: 'V12, 800 PS, nur fünf Stück für die ganze Börse.' },
  { id: 'penthouse', name: 'Penthouse an der Kaiserstraße', price: 1500000, supply: 3, desc: 'Dachterrasse mit Blick auf die Börse.' },
  { id: 'yacht', name: 'Yacht „Bullenmarkt“', price: 8000000, supply: 1, desc: 'Es gibt genau eine. Wer sie hat, hat sie.' },
  { id: 'insel', name: 'Privatinsel Taleria', price: 25000000, supply: 1, desc: 'Das Endgame. Steuerfrei und unerreichbar.' }
];
export const LUX_BUYBACK = 0.8;
export const ACH = [
  { id: 'first', name: 'Erster Trade', desc: 'Führe deine erste Börsenorder aus.', reward: 500 },
  { id: 'divers', name: 'Breit gestreut', desc: 'Halte gleichzeitig Aktie, ETF, Fonds und Anleihe.', reward: 2000 },
  { id: 'coupon', name: 'Kuponjäger', desc: 'Erhalte deine erste Kuponzahlung.', reward: 1000 },
  { id: 'fund', name: 'Sparfuchs', desc: 'Lass eine Fondsorder abrechnen.', reward: 500 },
  { id: 'fx', name: 'Devisenhändler', desc: 'Eröffne eine Devisenposition.', reward: 500 },
  { id: 'cmd', name: 'Rohstoffhändler', desc: 'Handle ein Rohstoff-ETC oder ein Hebelprodukt auf einen Rohstoff.', reward: 500 },
  { id: 'lever', name: 'Hebelkünstler', desc: 'Schließe ein Hebelprodukt mit mindestens +50 % Gewinn.', reward: 2500 },
  { id: 'limit', name: 'Geduldig', desc: 'Lass 10 Limit-Orders ausführen.', reward: 1000 },
  { id: 'streak', name: 'Treue', desc: 'Hole den Tagesbonus 7 Tage in Folge ab.', reward: 1500 },
  { id: 'league', name: 'Wochensieger', desc: 'Gewinne die Wochenliga.', reward: 5000 },
  { id: 'million', name: 'Millionär', desc: 'Erreiche 1 Mio. € Gesamtvermögen.', reward: 10000 }
];

/* ---------- Basisfunktionen ---------- */
export const I = id => M.inst[id];
export const all = () => M.ids.map(I);
export const byCls = c => M.ids.map(I).filter(x => x.cls === c);
export const isBook = x => x.cls === 'stock' || x.cls === 'bond' || x.cls === 'fx' || x.cls === 'cmd';
export const q2e = u => u.cls === 'fx' ? M.U[u.quote] / M.U.EUR : u.cls === 'cmd' ? M.U.USD / M.U.EUR : 1;
export const rateOf = c => c === 'EUR' ? M.r : RATES[c];
const bpx = m => m.cls === 'bond' ? m.tri : m.cls === 'cmd' ? m.price * q2e(m) : m.price;
export const chg = x => x.pc ? x.price / x.pc - 1 : 0;
export const isTradable = x => (x.cls === 'stock' || x.cls === 'etf' || x.cls === 'bond') && !x.matured;

/* ---------- Anleihen ---------- */
function curve(T) { return M.r + M.slope * (1 - Math.exp(-T / 4)) + 0.0035 * (1 - Math.exp(-T / 20)); }
function bondCalc(x, y, t) {
  const cds = x.cds; let i = 0; while (i < cds.length && cds[i] <= t) i++;
  if (i >= cds.length) return { clean: 100, dirty: 100, acc: 0, mdur: 0 };
  const prev = cds[i - 1], next = cds[i], acc = x.cpn * (t - prev) / (next - prev);
  let dirty = 0, dw = 0;
  for (let j = i; j < cds.length; j++) { const tau = (cds[j] - t) / YR, cf = x.cpn + (j === cds.length - 1 ? 100 : 0), df = Math.pow(1 + y, -tau); dirty += cf * df; dw += tau * cf * df; }
  return { clean: dirty - acc, dirty, acc, mdur: dw / dirty / (1 + y) };
}
function reprice(x) {
  if (x.matured) { x.price = 100; x.dirty = 100; x.acc = 0; x.mdur = 0; return; }
  x.ytm = curve((x.mat - M.t) / YR) + x.spr + x.idio;
  const r = bondCalc(x, x.ytm, M.t); x.price = r.clean; x.dirty = r.dirty; x.acc = r.acc; x.mdur = r.mdur;
}
function solveYield(x, clean) {
  let y = x.ytm;
  for (let k = 0; k < 40; k++) { const r = bondCalc(x, y, M.t), f = r.clean - clean; if (Math.abs(f) < 1e-10) break; const d = -r.mdur * r.dirty; if (!d) break; y = clamp(y - f / d, -0.05, 2); }
  return y;
}

/* ---------- Orderbuch-Modell (Square-Root Market Impact) ---------- */
export function bookP(x) {
  if (x.cls === 'stock') return { s: x.spr, k: x.vol / Math.sqrt(252) * IMPACT_Y, D: Math.max(1e5, x.advPct * x.shares * x.price * x.liq) };
  if (x.cls === 'bond') return { s: x.sprd, k: Math.max(0.0004, x.mdur * 0.0006) * IMPACT_Y, D: x.adv * x.liq };
  if (x.cls === 'cmd') return { s: x.sprd, k: x.vol / Math.sqrt(252) * IMPACT_Y, D: x.adv * x.liq };
  return { s: x.sprd, k: x.sigD * IMPACT_Y, D: x.adv * x.liq };
}
export function members(x) {
  let tot = 0; const arr = x.comp.map(c => { const m = I(c.id), v = c.c * bpx(m); tot += v; return { m, v }; });
  return arr.map(a => ({ m: a.m, w: tot > 0 ? a.v / tot : 0 }));
}
function favg(c) { if (Math.abs(c) < 1e-7) return 1 + 2 * c / 3; return 2 * (Math.exp(c) * (c - 1) + 1) / (c * c); }
export function marginal(x, dir, Q) {
  if (x.matured) return 1;
  if (isBook(x)) { const p = bookP(x); return Math.exp(dir * (p.s + Math.min(AMAX, p.k * Math.sqrt(Math.max(0, Q) / p.D)))); }
  let s = 0; for (const { m, w } of members(x)) s += w * marginal(m, dir, Q * w); return Math.exp(dir * (x.sprd || 0)) * s;
}
export function avgRatio(x, dir, Q) {
  if (x.matured) return 1;
  if (isBook(x)) { const p = bookP(x), a = p.k * Math.sqrt(Math.max(0, Q) / p.D); return Math.exp(dir * p.s) * favg(dir * a); }
  let s = 0; for (const { m, w } of members(x)) s += w * avgRatio(m, dir, Q * w); return Math.exp(dir * (x.sprd || 0)) * s;
}
export function permRatio(x, dir, Q) {
  if (x.matured) return 1;
  if (isBook(x)) { const p = bookP(x); return Math.exp(dir * (PERM + TRANS) * Math.min(AMAX, p.k * Math.sqrt(Q / p.D))); }
  let s = 0; for (const { m, w } of members(x)) s += w * permRatio(m, dir, Q * w); return s;
}
export function maxQ(x) {
  if (x.matured) return 0;
  if (isBook(x)) { const p = bookP(x); return p.D * Math.pow(AMAX / p.k, 2); }
  let mq = Infinity; for (const { m, w } of members(x)) if (w > 1e-9 && !m.matured) mq = Math.min(mq, maxQ(m) / w);
  return isFinite(mq) ? mq : 0;
}
export function qAtLimit(x, dir, L) {
  const mid = x.price, ok = q => dir > 0 ? mid * marginal(x, 1, q) <= L * (1 + 1e-12) : mid * marginal(x, -1, q) >= L * (1 - 1e-12);
  if (!ok(0)) return 0; const hq = maxQ(x); if (ok(hq)) return hq;
  let lo = 0, hi = hq; for (let k = 0; k < 70; k++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; } return lo;
}
export function bidAsk(x) { return [x.price * marginal(x, -1, 0), x.price * marginal(x, 1, 0)]; }
export function unitVal(x) { return x.cls === 'bond' ? x.price / 100 : x.price; }
export function settleVal(x, px) { return x.cls === 'bond' ? (px + x.acc) / 100 : px; }
function pushTS(x, px, q, dir, me) { x.ts.unshift([M.t, px, q, dir, me ? 1 : 0]); if (x.ts.length > 28) x.ts.length = 28; }

function applyTrade(x, dir, Q, user) {
  if (!(Q > 0) || x.matured) return;
  const before = x.price, vw = before * avgRatio(x, dir, Q);
  if (isBook(x)) {
    const p = bookP(x), a = Math.min(AMAX, p.k * Math.sqrt(Q / p.D)), extreme = before * Math.exp(dir * (p.s + a));
    if (x.cls === 'stock' || x.cls === 'cmd') { x.f *= Math.exp(dir * PERM * a); x.tr += dir * TRANS * a; x.price = x.f * Math.exp(x.tr); }
    else if (x.cls === 'fx') {
      const lg = dir * (PERM + TRANS) * a;
      if (x.base === 'USD') M.U[x.quote] *= Math.exp(-lg); else if (x.quote === 'USD') M.U[x.base] *= Math.exp(lg); else { M.U[x.base] *= Math.exp(lg / 2); M.U[x.quote] *= Math.exp(-lg / 2); }
      for (const f of byCls('fx')) f.price = M.U[f.base] / M.U[f.quote];
    } else { const y = solveYield(x, x.price * Math.exp(dir * (PERM + TRANS) * a)); x.idio += y - x.ytm; reprice(x); }
    x.liq = Math.max(0.25, x.liq / (1 + 0.6 * Q / p.D));
    const units = x.cls === 'fx' || x.cls === 'cmd' ? Q / (before * q2e(x)) : Q / unitVal({ cls: x.cls, price: before });
    x.dv += units; x.dt += Q;
    const k = x.c1[x.c1.length - 1]; if (k) { k[5] += units; k[2] = Math.max(k[2], extreme, x.price); k[3] = Math.min(k[3], extreme, x.price); }
    x.hi = Math.max(x.hi, extreme); x.lo = Math.min(x.lo, extreme);
    if (user) pushTS(x, vw, units, dir, true);
  } else {
    for (const { m, w } of members(x)) applyTrade(m, dir, Q * w, false);
    x.dv += Q / before; x.dt += Q; const k = x.c1[x.c1.length - 1]; if (k) k[5] += Q / before;
    if (user) pushTS(x, vw, Q / before, dir, true);
  }
  refreshAll();
}
function recomputeDerived() {
  for (const x of all()) {
    if (x.cls === 'index') { let s = 0; for (const c of x.comp) s += c.c * I(c.id).price; x.price = s / x.divisor; }
    else if (x.cls === 'etf') { let s = 0; for (const c of x.comp) s += c.c * bpx(I(c.id)); x.nav = s * x.ff; x.price = x.nav * (1 + x.prem); }
    else if (x.cls === 'fund') { let s = 0; for (const c of x.comp) s += c.c * bpx(I(c.id)); x.nav = s * x.ff; x.price = x.nav; }
  }
}
function refreshAll() {
  recomputeDerived();
  for (const x of all()) { const k = x.c1[x.c1.length - 1]; if (k) { k[2] = Math.max(k[2], x.price); k[3] = Math.min(k[3], x.price); k[4] = x.price; } x.lc = x.price; x.hi = Math.max(x.hi, x.price); x.lo = Math.min(x.lo, x.price); }
}

/* ---------- Welt erzeugen ---------- */
function isin(id, i) { return 'NX' + (id + '000000').slice(0, 6).toUpperCase() + String(1000 + i).slice(1) + ((i * 7) % 10); }
function blankStats(x) { x.c1 = []; x.cD = []; x.ts = []; x.do = x.price; x.pc = x.price; x.hi = x.price; x.lo = x.price; x.dv = 0; x.dt = 0; x.lc = x.price; }
function addInst(x) { M.inst[x.id] = x; M.ids.push(x.id); blankStats(x); return x; }
function compOf(spec) {
  let w = {};
  const core = byCls('stock').filter(s => CORE.has(s.id));
  if (spec === 'ALLCAP') core.forEach(s => w[s.id] = s.shares * s.price);
  else if (spec === 'TECHCAP') core.filter(s => s.sector === 'tech' || s.sector === 'semi').forEach(s => w[s.id] = s.shares * s.price);
  else w = Object.assign({}, spec);
  const tot = Object.values(w).reduce((a, b) => a + b, 0); return Object.keys(w).map(id => ({ id, w: w[id] / tot }));
}
// Legt alle definierten, aber noch fehlenden Produkte an (neue Welt oder Erweiterung eines gespeicherten Markts)
function buildMissing() {
  const added = [], has = id => !!M.inst[id], put = x => { addInst(x); added.push(x.id); return x; };
  STOCKS.forEach((d, i) => {
    const [sym, name, sector, px, sh, beta, vol, advPct, pe, dy, desc] = d; if (has(sym)) return;
    const shares = sh * 1e9, adv = advPct * shares * px;
    put({ id: sym, cls: 'stock', name, sector, shares, beta, vol, advPct, dy, desc, isin: isin(sym, i), f: px, tr: 0, liq: 1, price: px, eps: pe > 0 ? px / pe : -0.9, spr: clamp(0.00035 * Math.sqrt(1e9 / adv), 0.00004, 0.004), volA: vol, core: CORE.has(sym) });
  });
  if (!has('WELTIX')) {
    const core = byCls('stock').filter(s => CORE.has(s.id)), mcap = core.reduce((s, x) => s + x.shares * x.price, 0);
    put({ id: 'WELTIX', cls: 'index', name: 'WELTIX 24', comp: core.map(s => ({ id: s.id, c: s.shares })), divisor: mcap / 18452.37, price: 18452.37, volA: 0.17, isin: 'NX0WELTIX240', desc: 'Leitindex der NOVEX-Börse: 24 große Aktien des Handelsplatzes, gewichtet nach Marktkapitalisierung.' });
  }
  BONDS.forEach((d, i) => {
    const [id, name, issuer, cpn, md, rating, bp, advM, linked] = d; if (has(id)) return;
    const mat = Date.UTC(md[0], md[1] - 1, md[2], 17, 30), cds = []; for (let y = md[0]; y >= 2016; y--) cds.unshift(Date.UTC(y, md[1] - 1, md[2], 17, 30));
    const x = put({ id, cls: 'bond', name, issuer, cpn, mat, rating, sprBase: bp / 1e4, spr: bp / 1e4, z: 0, idio: 0, adv: advM * 1e6, linked, liq: 1, cds, tri: 100, matured: false, sprd: bp >= 300 ? 0.0025 : linked ? 0.0008 : 0.00015, isin: isin(id, 40 + i), price: 100, volA: 0.06 });
    reprice(x); blankStats(x); x.ci = x.cds.findIndex(c => c > M.t); x.volA = Math.max(0.01, x.mdur * 0.0095);
  });
  FXP.forEach((d, i) => {
    const [id, base, quote, advB, pips, vola] = d; if (has(id)) return;
    const price = M.U[base] / M.U[quote], pip = quote === 'JPY' ? 0.01 : 0.0001;
    put({ id, cls: 'fx', name: base + '/' + quote, base, quote, adv: advB * 1e9, pips, pip, dec: quote === 'JPY' ? 3 : 5, sigD: vola / Math.sqrt(252), sprd: pips * pip / 2 / price, liq: 1, price, volA: vola, isin: isin(id, 60 + i) });
  });
  CMDS.forEach((d, i) => {
    const [id, name, unit, px, vol, beta, sector, advB, hs, desc] = d; if (has(id)) return;
    put({ id, cls: 'cmd', name, unit, sector, beta, vol, adv: advB * 1e9, sprd: hs, desc, isin: isin(id, 70 + i), f: px, tr: 0, liq: 1, price: px, volA: vol });
  });
  ETFS.forEach((d, i) => { if (has(d.id)) return; put({ id: d.id, cls: 'etf', name: d.name, ter: d.ter, sprd: d.sprd, adv: d.adv, comp: compOf(d.comp).map(c => ({ id: c.id, c: c.w * d.px / bpx(I(c.id)) })), ff: 1, prem: 0, price: d.px, nav: d.px, desc: d.desc, isin: isin(d.id, 80 + i), volA: 0.16 }); });
  FUNDS.forEach((d, i) => { if (has(d.id)) return; put({ id: d.id, cls: 'fund', name: d.name, aa: d.aa, ter: d.ter, av: d.av, type: d.type, comp: compOf(d.comp).map(c => ({ id: c.id, c: c.w * d.px / bpx(I(c.id)) })), ff: 1, price: d.px, nav: d.px, desc: d.desc, isin: isin(d.id, 110 + i), volA: d.type === 'Rentenfonds' ? 0.05 : 0.15, sprd: 0 }); });
  return added;
}
// now: Berliner Ortszeit in ms (als UTC kodiert)
export function createWorld(now) {
  let t0 = dayStart(now) - DAY; while (!isTradingDay(t0)) t0 -= DAY; // letzter Handelstag vor heute
  const histEnd = (() => { let d = t0 - DAY; while (!isTradingDay(d)) d -= DAY; return d; })();
  M = { v: VERSION, t: t0 + OPEN_MIN * MIN, isOpen: true, lastClose: histEnd, lastCut: 0, eqMark: 0, nseq: 1, week: weekStart(t0), lv: 0, r: 0.0205, slope: 0.0085, U: { USD: 1, EUR: 1.0850, GBP: 1.2710, JPY: 1 / 152.4, CHF: 1.1360, AUD: 0.6540 }, inst: {}, ids: [], news: [] };
  const ids = buildMissing(); normalize(); recomputeDerived();
  genHistory(260, histEnd, ids);
  return M;
}
// Neue Produkte in einen laufenden Markt einfügen: Kurshistorie auf denselben Handelstagen wie der Bestand
function extendWorld(ids) {
  recomputeDerived();
  genHistory(260, null, ids);
  for (const id of ids) { const x = I(id); x.do = x.price; x.hi = x.price; x.lo = x.price; x.lc = x.price; }
  const nm = ids.map(id => I(id)).filter(x => x.cls !== 'bond').slice(0, 6).map(x => x.name).join(', ');
  addNews(`Neu an der NOVEX: ${ids.length} Produkte, darunter ${nm}`, 1);
}
function genHistory(N, lastDay, ids) {
  const want = new Set(ids), ref = M.inst.WELTIX, fresh = want.has('WELTIX');
  const dates = [];
  if (fresh) { let d = lastDay; while (dates.length < N) { if (isTradingDay(d)) dates.unshift(d); d -= DAY; } }
  else ref.cD.slice(-N).forEach(k => dates.push(k[0]));
  N = dates.length;
  if (N < 2) { for (const id of ids) I(id).pc = I(id).price; return; }
  const sd = 1 / Math.sqrt(252), pick2 = c => byCls(c).filter(x => want.has(x.id));
  const stocks = pick2('stock'), cmds = pick2('cmd'), bonds = pick2('bond');
  const lr = {}; [...stocks, ...cmds].forEach(s => lr[s.id] = [0]);
  const cur = { EUR: [0], GBP: [0], JPY: [0], CHF: [0], AUD: [0] }, rr = [0], ss = [0]; let lv = 0;
  const jump = x => Math.random() < 1 / 20 ? (Math.random() < 0.5 ? 1 : -1) * (0.01 + Math.abs(gauss()) * 0.025) * x.vol / 0.3 : 0;
  for (let i = 1; i < N; i++) {
    lv = clamp(lv * 0.5 + 0.24 * gauss(), -0.7, 1.6); const vm = Math.exp(lv), rm = 0.07 / 252 + SIG_M * VSH * sd * vm * heavy();
    const sec = {}; for (const k in SECTORS) sec[k] = SIG_S * VSH * sd * vm * gauss();
    const csec = {}; for (const k in CSECT) csec[k] = SIG_C * VSC * Math.sqrt(1.25) * sd * vm * gauss();
    for (const s of stocks) lr[s.id].push(lr[s.id][i - 1] + s.beta * rm + sec[s.sector] + s.idv * VSH * sd * vm * heavy() - 0.5 * s.var * 1.25 * vm * vm / 252 + jump(s));
    for (const s of cmds) lr[s.id].push(lr[s.id][i - 1] + s.beta * rm + csec[s.sector] + s.idv * VSC * Math.sqrt(1.25) * sd * vm * heavy() - 0.5 * s.var * 1.25 * vm * vm / 252 + jump(s));
    const e = 0.05 * sd * gauss();
    cur.EUR.push(cur.EUR[i - 1] + e + 0.04 * sd * gauss()); cur.GBP.push(cur.GBP[i - 1] + e + 0.05 * sd * gauss()); cur.CHF.push(cur.CHF[i - 1] + e + 0.04 * sd * gauss());
    cur.JPY.push(cur.JPY[i - 1] + 0.09 * sd * gauss() - 0.3 * rm); cur.AUD.push(cur.AUD[i - 1] + 0.08 * sd * gauss() + 0.4 * rm);
    rr.push(rr[i - 1] - 0.15 * rr[i - 1] / 252 + 0.009 * sd * gauss()); ss.push(ss[i - 1] - 0.3 * ss[i - 1] / 252 + 0.005 * sd * gauss());
  }
  const closes = {};
  for (const s of [...stocks, ...cmds]) { const a = lr[s.id], end = a[N - 1]; closes[s.id] = a.map(v => s.price * Math.exp(v - end)); }
  if (fresh) {
    const U = {}; for (const c in cur) { const a = cur[c], end = a[N - 1]; U[c] = a.map(v => M.U[c] * Math.exp(v - end)); }
    for (const f of byCls('fx')) closes[f.id] = dates.map((_, i) => (f.base === 'USD' ? 1 : U[f.base][i]) / (f.quote === 'USD' ? 1 : U[f.quote][i]));
  }
  const r0 = M.r, s0 = M.slope;
  for (const b of bonds) {
    const cl = [], dirt = [], paid = [];
    for (let i = 0; i < N; i++) {
      const t = dates[i] + 17.5 * 60 * MIN; M.r = r0 + rr[i] - rr[N - 1]; M.slope = s0 + ss[i] - ss[N - 1];
      const c = bondCalc(b, curve((b.mat - t) / YR) + b.spr, t); cl.push(c.clean); dirt.push(c.dirty);
      const pt = i ? dates[i - 1] + 17.5 * 60 * MIN : t - DAY; paid.push(b.cds.some(cd => cd > pt && cd <= t) ? b.cpn : 0);
    }
    M.r = r0; M.slope = s0;
    const tri = new Array(N); tri[N - 1] = 100; for (let i = N - 1; i > 0; i--) tri[i - 1] = tri[i] * dirt[i - 1] / (dirt[i] + paid[i]);
    b._tri = tri; const scl = b.price / cl[N - 1]; closes[b.id] = cl.map(v => v * scl);
  }
  // Schlusskurse bereits bestehender Produkte (für neue Körbe aus alten Bestandteilen)
  const old = {}, closeOf = id => closes[id] || old[id] || (old[id] = (() => { const x = I(id), mp = new Map(x.cD.map(k => [k[0], k[4]])); let last = x.price; return dates.map(t => (last = mp.has(t) ? mp.get(t) : last)); })());
  const usd = closeOf('EURUSD').map(v => 1 / v); // EUR je USD
  const hp = (id, i) => { const x = I(id); if (x.cls === 'bond') return x._tri ? x._tri[i] : x.tri * closeOf(id)[i] / x.price; if (x.cls === 'cmd') return closeOf(id)[i] * usd[i]; return closeOf(id)[i]; };
  for (const x of all()) {
    if (!want.has(x.id)) continue;
    if (x.cls === 'index') closes[x.id] = dates.map((_, i) => x.comp.reduce((s, c) => s + c.c * closeOf(c.id)[i], 0) / x.divisor);
    if (x.cls === 'etf' || x.cls === 'fund') closes[x.id] = dates.map((_, i) => x.comp.reduce((s, c) => s + c.c * hp(c.id, i), 0));
  }
  for (const x of all()) {
    if (!want.has(x.id)) continue;
    const c = closes[x.id], dv = x.volA * sd;
    const advU = x.cls === 'stock' ? x.advPct * x.shares : x.cls === 'bond' ? x.adv / (x.price / 100) : x.cls === 'cmd' ? x.adv / (x.price * q2e(x)) : (x.cls === 'fx' || x.cls === 'etf') ? x.adv / x.price : 0;
    x.cD = dates.map((t, i) => { const cl = c[i], o = i ? c[i - 1] * Math.exp(dv * 0.25 * gauss()) : cl; return [t, o, Math.max(o, cl) * Math.exp(Math.abs(gauss()) * dv * 0.5), Math.min(o, cl) * Math.exp(-Math.abs(gauss()) * dv * 0.5), cl, advU * Math.exp(0.35 * gauss())]; });
    x.pc = c[N - 1];
  }
  for (const b of bonds) delete b._tri;
}

/* ---------- Nachrichten ---------- */
function addNews(txt, tone, id) { M.news.unshift({ n: M.nseq++, t: M.t, txt, tone, id: id || null }); if (M.news.length > 150) M.news.length = 150; }
function cmdNews(x) { const pos = Math.random() < 0.5, mag = (0.01 + Math.abs(gauss()) * 0.025) * (x.vol / 0.3); const t = CMDNEWS[x.id]; addNews(t ? pick(t[pos ? 0 : 1]) : `${x.name}: ${pos ? 'Preissprung' : 'Preisrutsch'}`, pos ? 1 : -1, x.id); return pos ? mag : -mag; }
const bumpCmd = (id, f) => { const x = M.inst[id]; if (x) x.f *= f; };
function companyNews(x) { const pos = Math.random() < 0.5, mag = (0.01 + Math.abs(gauss()) * 0.025) * (x.vol / 0.3); addNews(pick(pos ? POSN : NEGN).replace('{n}', x.name), pos ? 1 : -1, x.id); return pos ? mag : -mag; }
function macroNews(sec) {
  return pick([
    () => { M.r -= 0.0025; addNews('Zentralbank der Eurozone senkt den Leitzins um 25 Basispunkte', 1); return 0.007; },
    () => { M.r += 0.0025; addNews('Überraschung: Zentralbank erhöht den Leitzins um 25 Basispunkte', -1); return -0.008; },
    () => { M.r += 0.0008; M.slope += 0.0005; addNews('Inflation in der Eurozone höher als erwartet', -1); return -0.005; },
    () => { M.r -= 0.0008; addNews('Inflationsrate sinkt stärker als erwartet', 1); return 0.005; },
    () => { for (const c of ['EUR', 'GBP', 'CHF', 'JPY', 'AUD']) M.U[c] *= 0.997; addNews('Starke US-Arbeitsmarktdaten – Dollar gefragt', 0); return 0.002; },
    () => { M.lv += 0.45; M.U.CHF *= 1.006; M.U.JPY *= 1.008; bumpCmd('GOLD', 1.02); bumpCmd('BRNT', 1.03); addNews('Geopolitische Spannungen: Anleger flüchten in sichere Häfen', -1); return -0.011; },
    () => { addNews('Einkaufsmanagerindizes deuten auf Abschwung hin', -1); return -0.005; },
    () => { M.lv -= 0.2; addNews('Einigung im Handelsstreit: Zölle fallen weg', 1); return 0.012; },
    () => { addNews('Konjunkturdaten überraschen positiv', 1); return 0.006; },
    () => { sec.energy += 0.03; bumpCmd('BRNT', 1.06); bumpCmd('NGAS', 1.03); addNews('Ölpreis springt nach Förderkürzung um 6 %', 0); return -0.003; }
  ])();
}

/* ---------- Zeitfortschritt ---------- */
// Bringt den Markt auf Berliner Ortszeit `target`. Live in Sekundenschritten, Nachholen in Minuten- bzw. 15-Minuten-Schritten.
export function advanceTo(target) {
  let guard = 0, steps = 0;
  while (M.t < target && guard++ < 400000) {
    if (weekStart(M.t) !== M.week) { const w = M.week; M.week = weekStart(M.t); ENV.week && ENV.week(w); }
    if (!M.isOpen) {
      const no = nextOpenFrom(M.t);
      if (no > target) { M.t = target; break; }
      M.t = no; if (weekStart(M.t) !== M.week) { const w = M.week; M.week = weekStart(M.t); ENV.week && ENV.week(w); }
      openDay(); continue;
    }
    const d0 = dayStart(M.t), closeT = d0 + CLOSE_MIN * MIN, cut = d0 + FUND_CUT * MIN;
    if (M.t >= closeT) { closeDay(); continue; }
    const rem = target - M.t;
    // Nachholen nach Pausen in gröberen Schritten (spart CPU); live in Sekundenschritten
    let dt = rem > 2 * DAY ? 15 * MIN - (M.t % (15 * MIN)) : rem > 3 * 3600000 ? 5 * MIN - (M.t % (5 * MIN)) : rem > MIN ? MIN - (M.t % MIN) : rem;
    dt = Math.min(dt, closeT - M.t, rem);
    if (M.t < cut && M.t + dt > cut) dt = cut - M.t;
    if (dt <= 0) dt = Math.min(MIN, rem);
    step(dt); steps++;
    if (M.t >= cut && M.lastCut !== d0) { M.lastCut = d0; processFundOrders(); }
  }
  if (weekStart(M.t) !== M.week) { const w = M.week; M.week = weekStart(M.t); ENV.week && ENV.week(w); }
  return steps;
}
function step(dtMs) {
  const dm = dtMs / MIN, dy = dm * DT, sq = Math.sqrt(dy), sdm = Math.sqrt(dm);
  M.lv = clamp(M.lv * Math.pow(0.996, dm) + 0.025 * Math.min(sdm, 4) * gauss(), -0.7, 1.6);
  const vm = Math.exp(M.lv), sec = {}; for (const k in SECTORS) sec[k] = SIG_S * VS * vm * sq * gauss();
  let rm = 0.07 * dy + SIG_M * VS * vm * sq * heavy();
  if (Math.random() < dm / (SESSION * 5)) rm += macroNews(sec);
  const sret = {}, mod = minuteOfDay(M.t) - OPEN_MIN;
  const ushape = 0.55 + 0.9 * (Math.exp(-mod / 35) + Math.exp(-(SESSION - mod) / 35));
  const td = Math.pow(TD_BASE, dm), lq = 1 - Math.pow(0.96, dm);
  for (const x of byCls('stock')) {
    let r = x.beta * rm + sec[x.sector] + x.idv * VS * vm * sq * heavy() - 0.5 * x.var * vm * vm * dy;
    if (Math.random() < dm / (SESSION * 20)) r += companyNews(x);
    sret[x.id] = r; x.f *= Math.exp(r); x.tr *= td; x.liq += (1 - x.liq) * lq; x.price = x.f * Math.exp(x.tr);
  }
  const csec = {}; for (const k in CSECT) csec[k] = SIG_C * VSC * vm * sq * gauss();
  for (const x of byCls('cmd')) {
    let r = x.beta * rm + csec[x.sector] + x.idv * VSC * vm * sq * heavy() - 0.5 * x.var * vm * vm * dy;
    if (Math.random() < dm / (SESSION * 20)) r += cmdNews(x);
    x.f *= Math.exp(r); x.tr *= td; x.liq += (1 - x.liq) * lq; x.price = x.f * Math.exp(x.tr);
  }
  const e = 0.05 * vm * sq * gauss();
  M.U.EUR *= Math.exp(e + 0.04 * vm * sq * gauss()); M.U.GBP *= Math.exp(e + 0.05 * vm * sq * gauss()); M.U.CHF *= Math.exp(e + 0.04 * vm * sq * gauss());
  M.U.JPY *= Math.exp(0.09 * vm * sq * gauss() - 0.3 * rm); M.U.AUD *= Math.exp(0.08 * vm * sq * gauss() + 0.4 * rm);
  for (const f of byCls('fx')) { f.price = M.U[f.base] / M.U[f.quote]; f.liq += (1 - f.liq) * lq; }
  M.r = clamp(M.r + 0.15 * (0.022 - M.r) * dy + 0.009 * vm * sq * gauss(), -0.01, 0.12);
  M.slope = clamp(M.slope + 0.3 * (0.009 - M.slope) * dy + 0.005 * sq * gauss(), -0.03, 0.05);
  const idd = Math.pow(ID_BASE, dm);
  for (const b of byCls('bond')) {
    if (b.matured) continue;
    b.z = clamp(b.z - 0.5 * b.z * dy + 0.25 * sq * gauss() - 1.5 * (b.linked ? sret[b.linked] : 0), -1.5, 2.5);
    b.spr = b.sprBase * Math.exp(b.z); b.idio *= idd; b.liq += (1 - b.liq) * lq;
    const od = b.dirty; reprice(b); b.tri *= b.dirty / od;
  }
  for (const x of byCls('etf')) { x.ff *= Math.exp(-x.ter * dy); x.prem = clamp(x.prem * Math.pow(0.85, dm) + 0.00012 * Math.min(sdm, 3) * gauss(), -0.004, 0.004); }
  for (const x of byCls('fund')) x.ff *= Math.exp(-x.ter * dy + x.av * vm * sq * gauss());
  recomputeDerived();
  const bucket = Math.floor(M.t / MIN) * MIN;
  for (const x of all()) {
    const o = x.lc, c = x.price, w = x.volA * sq * 0.6;
    const h = Math.max(o, c) * (1 + Math.abs(gauss()) * w), l = Math.min(o, c) * (1 - Math.abs(gauss()) * w);
    let v = 0;
    if (x.cls === 'stock') v = x.advPct * x.shares; else if (x.cls === 'bond' && !x.matured) v = x.adv / (x.price / 100); else if (x.cls === 'fx' || x.cls === 'cmd') v = x.adv / (x.price * q2e(x)); else if (x.cls === 'etf') v = x.adv / x.price;
    v *= dm / SESSION * ushape * vm * Math.exp(0.5 * gauss() - 0.125);
    if (x.cls === 'bond') v = Math.round(v / 1000) * 1000; else if (x.cls !== 'fx') v = Math.round(v);
    const k = x.c1[x.c1.length - 1];
    if (k && k[0] === bucket) { k[2] = Math.max(k[2], h); k[3] = Math.min(k[3], l); k[4] = c; k[5] += v; }
    else { x.c1.push([bucket, o, h, l, c, v]); if (x.c1.length > C1MAX) x.c1.splice(0, x.c1.length - C1MAX); }
    x.lc = c; x.hi = Math.max(x.hi, h); x.lo = Math.min(x.lo, l); x.dv += v; x.dt += v * (x.cls === 'fx' || x.cls === 'cmd' ? x.price * q2e(x) : unitVal(x));
    if (v > 0 && x.cls !== 'index' && x.cls !== 'fund') { const dir = Math.random() < 0.5 ? 1 : -1; pushTS(x, c * marginal(x, dir, 0), Math.max(1, Math.round(v * (0.02 + Math.random() * 0.1))), dir, false); }
  }
  bondEvents();
  M.t += dtMs;
  updateFactors(); processOrders(); checkDerivs();
  const mark = Math.floor(M.t / (15 * MIN));
  if (mark !== M.eqMark) { M.eqMark = mark; for (const A of ENV.accounts()) { A.eq.push([M.t, r2(totals(A).total)]); if (A.eq.length > 2500) A.eq.splice(0, A.eq.length - 2500); ENV.event(A, 'equity'); } }
}
function bondEvents() {
  for (const b of byCls('bond')) {
    if (b.matured) continue;
    while (b.ci < b.cds.length && M.t >= b.cds[b.ci]) {
      const last = b.ci === b.cds.length - 1;
      b.tri *= (b.dirty + b.cpn) / b.dirty;
      for (const A of ENV.accounts()) {
        const p = A.pos[b.id]; if (!p || p.qty <= 0 || !(b.cpn > 0)) continue;
        const c = r2(p.qty * b.cpn / 100); A.cash += c; A.realized += c;
        logHist(A, { t: M.t, id: b.id, nm: b.name, side: 'Kupon', q: p.qty, px: b.cpn, amt: c, fee: 0, pnl: c });
        ENV.note(A, `Kuponzahlung ${b.name}: ${fmtE(c)}`, 'up'); ENV.event(A, 'coupon'); ENV.dirty(A);
      }
      b.ci++;
      if (last) {
        b.matured = true; b.tri *= 100 / b.dirty; reprice(b);
        for (const A of ENV.accounts()) {
          const p = A.pos[b.id];
          if (p && p.qty > 0) { const amt = p.qty, pnl = amt - p.cost; A.cash += amt; A.realized += pnl; logHist(A, { t: M.t, id: b.id, nm: b.name, side: 'Tilgung', q: p.qty, px: 100, amt, fee: 0, pnl }); delete A.pos[b.id]; ENV.note(A, `${b.name} getilgt – ${fmtE(amt)} zurückgezahlt`, 'up'); ENV.dirty(A); }
          for (const o of A.orders) if (o.iid === b.id && isOpen(o)) { o.status = 'gestrichen'; o.note = 'Anleihe getilgt'; ENV.dirty(A); }
        }
        addNews(`${b.name} wurde zu 100 % getilgt`, 0, b.id);
      }
    }
  }
}
function closeDay() {
  const today = dayStart(M.t);
  for (const x of all()) { x.cD.push([today, x.do, Math.max(x.hi, x.price), Math.min(x.lo, x.price), x.price, x.dv]); if (x.cD.length > CDMAX) x.cD.splice(0, x.cD.length - CDMAX); }
  for (const A of ENV.accounts()) for (const o of A.orders) if (isOpen(o) && o.val === 'day' && o.type !== 'fund') { o.status = 'verfallen'; o.note = 'Tagesgültigkeit abgelaufen'; ENV.dirty(A); }
  M.isOpen = false; M.lastClose = today;
}
function openDay() {
  const days = Math.max(1, Math.round((dayStart(M.t) - M.lastClose) / DAY));
  const on = Math.sqrt(0.25 * days / 252), vm = Math.exp(M.lv), rm = SIG_M * VS * vm * on * heavy();
  for (const x of byCls('stock')) { let r = x.beta * rm + Math.sqrt(Math.pow(SIG_S, 2) + x.idv * x.idv) * VS * vm * on * heavy() - 0.5 * x.var * vm * vm * on * on; if (Math.random() < 0.03 * Math.min(days, 5)) r += companyNews(x); x.f *= Math.exp(r); x.tr = 0; x.liq = 1; x.price = x.f; }
  for (const x of byCls('cmd')) { let r = x.beta * rm + Math.sqrt(SIG_C * SIG_C + x.idv * x.idv) * VSC * vm * on * heavy() - 0.5 * x.var * vm * vm * on * on; if (Math.random() < 0.03 * Math.min(days, 5)) r += cmdNews(x); x.f *= Math.exp(r); x.tr = 0; x.liq = 1; x.price = x.f; }
  const e = 0.05 * on * gauss();
  M.U.EUR *= Math.exp(e + 0.04 * on * gauss()); M.U.GBP *= Math.exp(e + 0.05 * on * gauss()); M.U.CHF *= Math.exp(e + 0.04 * on * gauss());
  M.U.JPY *= Math.exp(0.09 * on * gauss()); M.U.AUD *= Math.exp(0.08 * on * gauss() + 0.4 * rm);
  for (const f of byCls('fx')) { f.price = M.U[f.base] / M.U[f.quote]; f.liq = 1; }
  M.r = clamp(M.r + 0.009 * on * gauss(), -0.01, 0.12);
  for (const b of byCls('bond')) if (!b.matured) { const od = b.dirty; reprice(b); b.tri *= b.dirty / od; b.liq = 1; }
  recomputeDerived();
  overnightDerivs(days);
  for (const x of all()) { x.pc = x.cD.length ? x.cD[x.cD.length - 1][4] : x.price; x.do = x.price; x.hi = x.price; x.lo = x.price; x.dv = 0; x.dt = 0; x.lc = x.price; }
  M.isOpen = true;
  bondEvents();
  updateFactors(); checkDerivs();
}

/* ---------- Konto ---------- */
export const fee = amt => Math.max(FEE_MIN, amt * FEE_RATE);
export const isOpen = o => o.status === 'offen' || o.status === 'teilausgeführt';
export function newAccount(uid, name, cash) {
  return { uid, name, cash, start: cash, pos: {}, derivs: [], orders: [], hist: [], realized: 0, seq: 1, eq: [], lic: 0, lux: {}, ach: {}, bonus: { day: 0, streak: 0 }, stats: { trades: 0, limitFills: 0 }, week: { k: 0, start: cash, flow: 0, trades: 0 }, reliefT: 0, created: M ? M.t : 0 };
}
function logHist(A, h) { A.hist.unshift(h); if (A.hist.length > 300) A.hist.length = 300; }
export function reservedCash(A, exceptId) {
  let r = 0;
  for (const o of A.orders) {
    if (!isOpen(o) || o.id === exceptId || o.side !== 'buy' || o.type === 'fund') continue;
    const x = I(o.iid), rem = o.qty - o.filled, px = o.type === 'limit' || o.type === 'stoplimit' ? o.limit : o.stop * 1.05;
    const amt = rem * settleVal(x, px); r += amt + fee(amt);
  }
  return r;
}
export function reservedUnits(A, iid, exceptId) { let r = 0; for (const o of A.orders) if (isOpen(o) && o.id !== exceptId && o.side === 'sell' && o.iid === iid) r += o.type === 'fund' ? o.qty : o.qty - o.filled; return r; }
export const availCash = (A, exceptId) => A.cash - reservedCash(A, exceptId);
export function posValue(id, p) { const x = I(id); return x.cls === 'bond' ? p.qty * (x.price + x.acc) / 100 : p.qty * x.price; }
export function luxValue(A) { let v = 0; for (const it of LUX) v += (A.lux[it.id] || 0) * it.price * LUX_BUYBACK; return v; }
export function totals(A) {
  let sec = 0, der = 0, pend = 0;
  for (const id in A.pos) sec += posValue(id, A.pos[id]);
  for (const p of A.derivs) der += derivValue(p);
  for (const o of A.orders) if (o.type === 'fund' && isOpen(o) && o.side === 'buy') pend += o.amount;
  const lux = luxValue(A);
  return { sec, der, pend, lux, total: A.cash + sec + der + pend + lux };
}
export function roundQty(x, q) { if (!(q > 0)) return 0; if (x.cls === 'bond') return Math.floor(q / 1000 + 1e-6) * 1000; return Math.floor(q + 1e-6); }
export function estimateExchange(x, side, qty, limitPx) {
  const dir = side === 'buy' ? 1 : -1, uv = unitVal(x), qReq = roundQty(x, qty);
  let Q = qReq * uv, capped = false, limited = false;
  const qm = maxQ(x); if (Q > qm) { Q = qm; capped = true; }
  if (limitPx > 0) { const ql = qAtLimit(x, dir, limitPx); if (ql < Q) { Q = ql; limited = true; } }
  const q = capped || limited ? Math.min(qReq, roundQty(x, Q / uv)) : qReq;
  if (q <= 0) return { q: 0, capped, limited };
  const Qr = q * uv, ratio = avgRatio(x, dir, Qr), px = x.price * ratio, amount = q * settleVal(x, px), f = fee(amount);
  return { q, px, amount, fee: f, total: dir > 0 ? amount + f : amount - f, impact: ratio - 1, after: x.price * permRatio(x, dir, Qr), worst: x.price * marginal(x, dir, Qr), capped, limited, Q: Qr };
}
export function maxBuyQty(x, budget, limitPx) {
  const lot = x.cls === 'bond' ? 1000 : 1, fits = q => { const e = estimateExchange(x, 'buy', q, limitPx); return e.q === 0 || e.total <= budget; };
  let hi = roundQty(x, maxQ(x) / unitVal(x)); if (limitPx > 0) hi = Math.min(hi, roundQty(x, qAtLimit(x, 1, limitPx) / unitVal(x)));
  hi = Math.min(hi, roundQty(x, budget / settleVal(x, x.price * marginal(x, 1, 0)) + lot));
  if (hi <= 0) return 0; if (fits(hi)) return hi;
  let lo = 0; for (let k = 0; k < 64 && hi - lo > lot; k++) { const m = roundQty(x, (lo + hi) / 2); if (m <= lo) break; if (fits(m)) lo = m; else hi = m; }
  return lo;
}
function fillOrder(A, o) {
  const x = I(o.iid); if (!x || x.matured) { o.status = 'gestrichen'; o.note = 'nicht handelbar'; ENV.dirty(A); return 0; }
  const rem = o.qty - o.filled; if (rem <= 0) return 0;
  const lim = o.type === 'limit' ? o.limit : 0;
  let e = estimateExchange(x, o.side, rem, lim); if (e.q <= 0) return 0;
  if (o.side === 'buy') {
    const av = availCash(A, o.id);
    if (e.total > av) { const q = maxBuyQty(x, av, lim); if (q <= 0) { o.status = 'gestrichen'; o.note = 'mangels Deckung gestrichen'; ENV.note(A, `Order ${x.name} mangels Deckung gestrichen`, 'dn'); ENV.dirty(A); return 0; } e = estimateExchange(x, 'buy', q, lim); }
  } else {
    const p = A.pos[o.iid], have = p ? p.qty - reservedUnits(A, o.iid, o.id) : 0;
    if (have < e.q) { if (have <= 0) { o.status = 'gestrichen'; o.note = 'kein Bestand'; ENV.dirty(A); return 0; } e = estimateExchange(x, 'sell', roundQty(x, have), lim); if (e.q <= 0) return 0; }
  }
  const dir = o.side === 'buy' ? 1 : -1, pre = x.price;
  applyTrade(x, dir, e.Q, true);
  let pnl = 0;
  if (dir > 0) { A.cash -= e.total; const p = A.pos[o.iid] || (A.pos[o.iid] = { qty: 0, cost: 0 }); p.qty += e.q; p.cost += e.total; }
  else { const p = A.pos[o.iid], c = p.cost * e.q / p.qty; pnl = e.total - c; A.cash += e.total; p.qty -= e.q; p.cost -= c; A.realized += pnl; if (p.qty <= 1e-9) delete A.pos[o.iid]; }
  ENV.fee(e.fee);
  o.avg = (o.avg * o.filled + e.px * e.q) / (o.filled + e.q); o.filled += e.q; o.status = o.filled >= o.qty ? 'ausgeführt' : 'teilausgeführt';
  logHist(A, { t: M.t, id: x.id, nm: x.name, side: dir > 0 ? 'Kauf' : 'Verkauf', q: e.q, px: e.px, amt: e.amount, fee: e.fee, pnl: dir < 0 ? pnl : null });
  const mv = x.price / pre - 1;
  if (Math.abs(mv) >= 0.03) addNews(`Großorder bewegt ${x.name}: ${pct(mv, 1)} nach ${dir > 0 ? 'Kauf' : 'Verkauf'} über ${fmtBig(e.amount)} €`, dir, x.id);
  ENV.note(A, `${dir > 0 ? 'Kauf' : 'Verkauf'} ausgeführt: ${fmtQty(x, e.q)} ${x.name} zu ${fmtPx(x, e.px)}${o.status === 'teilausgeführt' ? ' (Teilausführung)' : ''}`, dir > 0 ? 'up' : 'dn');
  ENV.event(A, 'trade', { cls: x.cls, limit: o.otype === 'limit', cmd: x.cls === 'etf' && x.comp.every(c => I(c.id).cls === 'cmd') }); ENV.dirty(A);
  return e.q;
}
const okNum = (v, max = 1e15) => typeof v === 'number' && isFinite(v) && v > 0 && v <= max;
export function placeOrder(A, s) {
  const x = M.inst[s.iid];
  if (!x || !isTradable(x)) return 'Dieses Wertpapier ist nicht börslich handelbar.';
  if (s.side !== 'buy' && s.side !== 'sell') return 'Ungültige Orderrichtung.';
  if (!['market', 'limit', 'stop', 'stoplimit'].includes(s.type)) return 'Ungültiger Ordertyp.';
  if (!okNum(s.qty)) return 'Bitte eine gültige Menge eingeben.';
  const qty = roundQty(x, s.qty);
  if (!(qty > 0)) return x.cls === 'bond' ? 'Mindeststückelung: 1.000 € nominal.' : 'Bitte mindestens 1 Stück eingeben.';
  const needL = s.type === 'limit' || s.type === 'stoplimit', needS = s.type === 'stop' || s.type === 'stoplimit';
  if (needL && !okNum(s.limit, 1e9)) return 'Bitte ein gültiges Limit eingeben.';
  if (needS && !okNum(s.stop, 1e9)) return 'Bitte einen gültigen Stoppkurs eingeben.';
  if (s.type === 'market' && !M.isOpen) return 'Die Börse ist geschlossen. Market-Orders gehen nur von 08:00 bis 22:00 Uhr; Limit- und Stop-Orders kannst du jetzt schon aufgeben.';
  if (needS) { if (s.side === 'buy' && s.stop <= x.price) return 'Stop-Buy muss über dem aktuellen Kurs liegen.'; if (s.side === 'sell' && s.stop >= x.price) return 'Stop-Loss muss unter dem aktuellen Kurs liegen.'; }
  if (A.orders.filter(isOpen).length >= 50) return 'Maximal 50 offene Orders.';
  if (s.side === 'sell') { const p = A.pos[x.id], have = p ? p.qty - reservedUnits(A, x.id) : 0; if (qty > have + 1e-9) return `Nicht genug Bestand (verfügbar: ${fmtQty(x, Math.max(0, have))})`; }
  else {
    let need;
    if (s.type === 'market') { const e = estimateExchange(x, 'buy', qty, 0); need = e.q ? e.total : 0; }
    else { const px = s.type === 'stop' ? s.stop * 1.05 : s.limit, amt = qty * settleVal(x, px); need = amt + fee(amt); }
    if (need > availCash(A) + 1e-6) return `Nicht genug Guthaben: benötigt ca. ${fmtE(need)}, verfügbar ${fmtE(availCash(A))}.`;
  }
  const o = { id: A.seq++, iid: x.id, side: s.side, type: s.type, otype: s.type, qty, filled: 0, avg: 0, limit: needL ? s.limit : 0, stop: needS ? s.stop : 0, val: s.type === 'market' ? 'day' : (s.val === 'gtc' ? 'gtc' : 'day'), status: 'offen', t: M.t, note: '' };
  A.orders.unshift(o); if (A.orders.length > 200) A.orders.length = 200;
  if (o.type === 'market') {
    fillOrder(A, o);
    if (isOpen(o)) { o.status = o.filled > 0 ? 'ausgeführt' : 'gestrichen'; o.note = 'Restmenge gestrichen (Markttiefe bzw. Guthaben reichte nicht)'; if (o.filled > 0) o.qty = o.filled; ENV.note(A, 'Restmenge gestrichen – Orderbuch bzw. Guthaben reichte nicht', 'dn'); }
  } else if (o.type === 'limit') { if (M.isOpen) fillOrder(A, o); if (isOpen(o)) ENV.note(A, `Limit-Order ${x.name} liegt im Orderbuch`, ''); }
  else ENV.note(A, `Stop-Order ${x.name} angelegt (Auslösung bei ${fmtPx(x, o.stop)})`, '');
  ENV.dirty(A); return null;
}
function processOrders() {
  for (const A of ENV.accounts()) for (const o of A.orders) {
    if (!isOpen(o) || o.type === 'fund') continue;
    const x = I(o.iid);
    if (o.type === 'stop' || o.type === 'stoplimit') {
      if (!(o.side === 'buy' ? x.price >= o.stop : x.price <= o.stop)) continue;
      o.type = o.type === 'stop' ? 'market' : 'limit'; o.note = 'Stopp ausgelöst ' + fTime(M.t); ENV.note(A, `Stopp ausgelöst: ${x.name} bei ${fmtPx(x, x.price)}`, ''); ENV.dirty(A);
    }
    if (o.type === 'market') { fillOrder(A, o); if (isOpen(o)) { o.status = o.filled > 0 ? 'ausgeführt' : 'gestrichen'; if (o.filled > 0) o.qty = o.filled; o.note += ' · Rest mangels Liquidität gestrichen'; ENV.dirty(A); } }
    else if (o.type === 'limit' && (o.side === 'buy' ? x.price * marginal(x, 1, 0) <= o.limit : x.price * marginal(x, -1, 0) >= o.limit)) fillOrder(A, o);
  }
}
export function cancelOrder(A, id) {
  const o = A.orders.find(o => o.id === id); if (!o || !isOpen(o)) return 'Order ist nicht mehr offen.';
  if (o.type === 'fund' && o.side === 'buy') A.cash += o.amount;
  o.status = 'gestrichen'; o.note = 'vom Kunden gelöscht'; ENV.dirty(A); return null;
}
export function placeFundOrder(A, iid, side, val) {
  const x = M.inst[iid]; if (!x || x.cls !== 'fund') return 'Unbekannter Fonds.';
  if (A.orders.filter(isOpen).length >= 50) return 'Maximal 50 offene Orders.';
  if (side === 'buy') {
    if (!okNum(val) || val < 10) return 'Mindestanlage: 10 €.';
    if (val > availCash(A) + 1e-6) return `Nicht genug Guthaben (verfügbar ${fmtE(availCash(A))}).`;
    A.cash -= val;
    A.orders.unshift({ id: A.seq++, iid, side, type: 'fund', otype: 'fund', amount: val, qty: 0, filled: 0, avg: 0, val: 'nav', status: 'offen', t: M.t, note: 'Abrechnung zum NAV um 17:30' });
  } else if (side === 'sell') {
    const p = A.pos[iid], have = p ? p.qty - reservedUnits(A, iid) : 0;
    if (!okNum(val)) return 'Bitte Anteile eingeben.';
    if (val > have + 1e-9) return `Nicht genug Anteile (verfügbar ${fmt(Math.max(0, have), 3)}).`;
    A.orders.unshift({ id: A.seq++, iid, side, type: 'fund', otype: 'fund', amount: 0, qty: val, filled: 0, avg: 0, val: 'nav', status: 'offen', t: M.t, note: 'Abrechnung zum NAV um 17:30' });
  } else return 'Ungültige Orderrichtung.';
  ENV.note(A, `Fondsorder ${x.name} angenommen – Abrechnung zum NAV um 17:30`, ''); ENV.dirty(A); return null;
}
function processFundOrders() {
  for (const A of ENV.accounts()) for (const o of A.orders) {
    if (o.type !== 'fund' || !isOpen(o)) continue;
    const x = I(o.iid);
    if (o.side === 'buy') {
      const net = o.amount / (1 + x.aa), ratio = avgRatio(x, 1, net), px = x.nav * ratio, units = net / px;
      applyTrade(x, 1, net, false); ENV.fee(o.amount - net);
      const p = A.pos[x.id] || (A.pos[x.id] = { qty: 0, cost: 0 }); p.qty += units; p.cost += o.amount;
      o.filled = units; o.qty = units; o.avg = px; o.status = 'ausgeführt'; o.note = `NAV ${fmt(x.nav, 2)} · Swing ${pct(ratio - 1, 3)} · Aufschlag ${fmtE(o.amount - net)}`;
      logHist(A, { t: M.t, id: x.id, nm: x.name, side: 'Kauf', q: units, px, amt: o.amount, fee: o.amount - net, pnl: null });
      ENV.note(A, `Fondskauf abgerechnet: ${fmt(units, 3)} Anteile ${x.name}`, 'up');
    } else {
      const p = A.pos[x.id]; if (!p || p.qty < o.qty - 1e-9) { o.status = 'gestrichen'; o.note = 'kein Bestand'; ENV.dirty(A); continue; }
      const gross = o.qty * x.nav, ratio = avgRatio(x, -1, gross), px = x.nav * ratio, amt = o.qty * px;
      applyTrade(x, -1, gross, false);
      const c = p.cost * o.qty / p.qty, pnl = amt - c; A.cash += amt; A.realized += pnl; p.qty -= o.qty; p.cost -= c; if (p.qty <= 1e-9) delete A.pos[x.id];
      o.filled = o.qty; o.avg = px; o.status = 'ausgeführt'; o.note = `Rücknahme zu ${fmt(px, 2)}`;
      logHist(A, { t: M.t, id: x.id, nm: x.name, side: 'Verkauf', q: o.qty, px, amt, fee: 0, pnl });
      ENV.note(A, `Fondsverkauf abgerechnet: ${fmtE(amt)}`, 'dn');
    }
    ENV.event(A, 'fund'); ENV.dirty(A);
  }
}

/* ---------- Derivate (Emittent sichert am Basiswert ab → Marktwirkung) ---------- */
export const undList = () => [I('WELTIX'), ...byCls('stock'), ...byCls('fx'), ...byCls('cmd')];
const isUnd = u => !!u && (u.cls === 'index' || u.cls === 'stock' || u.cls === 'fx' || u.cls === 'cmd');
const undVol = u => u.cls === 'stock' || u.cls === 'cmd' ? u.vol : u.cls === 'index' ? 0.17 : u.volA;
export const undCarry = u => u.cls === 'fx' ? rateOf(u.quote) - rateOf(u.base) : u.cls === 'cmd' ? rateOf('USD') : M.r;
const undQ = u => u.cls === 'fx' ? rateOf(u.base) : u.cls === 'stock' ? u.dy : u.cls === 'cmd' ? 0 : 0.018;
const undR = u => u.cls === 'fx' ? rateOf(u.quote) : u.cls === 'cmd' ? rateOf('USD') : M.r;
export const ratioFor = u => Math.pow(10, Math.floor(Math.log10(1000 / (u.price * q2e(u)))));
const sig = (v, n = 5) => +v.toPrecision(n);
export const cfdRate = (u, dir) => u.cls === 'fx' ? (dir > 0 ? rateOf(u.quote) - rateOf(u.base) : rateOf(u.base) - rateOf(u.quote)) + 0.005 : (dir > 0 ? undCarry(u) + 0.03 : 0.03 - undCarry(u));
/* Faktor-Zertifikate: konstanter Hebel, laufend angepasst (pfadabhängig), Ausgabe zu 10 € je Stück */
export const FACTORS = [2, 3, 4, 5, 8, 10, 15, 20];
export const FAC_PX = 10, FAC_SPR = 0.002;
export const facRate = (u, dir, F) => { const c = undCarry(u); return dir > 0 ? (F - 1) * (c + 0.005) + 0.01 : -(F + 1) * c + F * 0.005 + 0.01; }; // Kosten p. a. (negativ = Zinsertrag)
export function facMark(p, S) { return Math.max(0, p.val * Math.max(0.02, 1 + p.F * p.dir * (S / p.ref - 1))); } // Wert je Stück bei Kurs S
function updateFactors() {
  for (const A of ENV.accounts()) for (const p of A.derivs) {
    if (p.kind !== 'fac') continue; const S = I(p.und).price;
    if (S !== p.ref) { p.val = facMark(p, S); p.ref = S; }
  }
}
function koIntr(p, S) { return Math.max(0, p.dir * (S - p.K)) * p.r * q2e(I(p.und)); }
export function koQuote(p, n, side) {
  const u = I(p.und), S = u.price, Q = n * p.r * S * q2e(u), hd = side * p.dir, Se = S * (n > 0 ? avgRatio(u, hd, Q) : marginal(u, hd, 0));
  return { px: Math.max(0, koIntr(p, Se) + side * KO_SPR * S * p.r * q2e(u)), Se, Q, hd };
}
export function optIV(u, K) { const m = Math.log(K / u.price); return clamp(undVol(u) * Math.sqrt(Math.exp(M.lv)) * (1 + 0.35 * Math.abs(m) + (m < 0 ? 0.5 * -m : 0)), 0.04, 3); }
export const optT = p => Math.max(0, (p.exp - M.t) / YR);
function optUnit(p, S) { const u = I(p.und); return bs(p.cp, S, p.K, optT(p), undR(u), undQ(u), optIV(u, p.K)) * p.r * q2e(u); }
export function optDelta(p) { const u = I(p.und); return bsDelta(p.cp, u.price, p.K, optT(p), undR(u), undQ(u), optIV(u, p.K)); }
export function optQuote(p, n, side, hedgeUnits) {
  const u = I(p.und), S = u.price, hu = hedgeUnits !== undefined ? hedgeUnits : Math.abs(optDelta(p)) * n * p.r;
  const hd = side * (p.cp === 'C' ? 1 : -1), Q = hu * S * q2e(u), Se = S * (Q > 0 ? avgRatio(u, hd, Q) : marginal(u, hd, 0)), v = optUnit(p, Se);
  return { px: side > 0 ? v * 1.01 + 0.0001 : Math.max(0, v * 0.99 - 0.0001), Se, Q, hd, hu };
}
export function cfdEquity(p, S) { const u = I(p.und); return p.margin + p.dir * p.units * ((S === undefined ? u.price : S) - p.entry) * q2e(u) - p.fin; }
export function derivValue(p) {
  const u = I(p.und);
  if (p.kind === 'ko') return p.n * Math.max(0, koIntr(p, u.price) - KO_SPR * u.price * p.r * q2e(u));
  if (p.kind === 'opt') return p.n * Math.max(0, optUnit(p, u.price) * 0.99 - 0.0001);
  if (p.kind === 'fac') return p.n * facMark(p, u.price) * (1 - FAC_SPR);
  return Math.max(0, cfdEquity(p));
}
export function derivLev(p) {
  const u = I(p.und), S = u.price;
  if (p.kind === 'ko') { const d = p.dir * (S - p.K); return d > 0 ? S / d : Infinity; }
  if (p.kind === 'opt') { const v = optUnit(p, S); return v > 0 ? Math.abs(optDelta(p)) * S * p.r * q2e(u) / v : 0; }
  if (p.kind === 'fac') return p.F;
  const eq = cfdEquity(p); return eq > 0 ? p.units * S * q2e(u) / eq : Infinity;
}
export function derivName(p) {
  const u = I(p.und);
  if (p.kind === 'ko') return `Turbo ${p.dir > 0 ? 'Long' : 'Short'} ${u.name} · KO ${fmtPx(u, p.K)}`;
  if (p.kind === 'opt') return `${p.cp === 'C' ? 'Call' : 'Put'} ${u.name} ${fmtPx(u, p.K)} · ${fDate(p.exp)}`;
  if (p.kind === 'fac') return `Faktor ${p.F}× ${p.dir > 0 ? 'Long' : 'Short'} ${u.name}`;
  return `CFD ${p.dir > 0 ? 'Long' : 'Short'} ${u.name} ×${p.lev}`;
}
function maxN(quote, budget, cap) {
  const p1 = quote(1).px; if (!(p1 > 0)) return 0;
  let hi = Math.min(budget / p1, cap); if (hi < 1) return 0;
  const cost = n => n * quote(n).px; if (cost(Math.floor(hi)) <= budget) return Math.floor(hi);
  let lo = 0; for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (cost(m) <= budget) lo = m; else hi = m; } return Math.floor(lo);
}
export const EXPIRIES = [{ l: '1 Woche', d: 7 }, { l: '1 Monat', d: 30 }, { l: '3 Monate', d: 91 }, { l: '6 Monate', d: 182 }, { l: '1 Jahr', d: 365 }];
function koSpec(uid, dir, lev) { const u = I(uid); return { kind: 'ko', und: uid, dir, K: sig(u.price * (1 - dir / lev)), r: ratioFor(u) }; }
function optSpec(uid, cp, K, expIdx) { const u = I(uid), e = EXPIRIES[expIdx]; let exp = dayStart(M.t) + e.d * DAY; while (!isTradingDay(exp)) exp += DAY; return { kind: 'opt', und: uid, cp, K, exp: exp + FUND_CUT * MIN, r: ratioFor(u) }; }
export function strikeList(u) {
  const S = u.price, pw = Math.pow(10, Math.floor(Math.log10(S))), stp = pw / 100 * (S / pw >= 5 ? 5 : 1), out = [];
  for (const m of [0.8, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15, 1.2]) { const k = sig(Math.round(S * m / stp) * stp, 6); if (!out.includes(k)) out.push(k); }
  return out;
}
export function estDeriv(d) {
  const u = I(d.und), S = u.price, fx = q2e(u);
  if (d.kind === 'ko') {
    const p = koSpec(d.und, d.dir, d.lev), cap = maxQ(u) / (p.r * S * fx), n = maxN(n => koQuote(p, n, 1), d.budget, cap), q = koQuote(p, Math.max(1, n), 1);
    return { p, n, px: q.px, cost: n * q.px, exposure: n * p.r * S * fx, lev: S / Math.abs(S - p.K), move: n ? permRatio(u, d.dir, n * p.r * S * fx) - 1 : 0, capped: n >= Math.floor(cap) };
  }
  if (d.kind === 'opt') {
    const p = optSpec(d.und, d.cp, d.K, d.exp), dl = Math.abs(optDelta(p)) || 1e-9, cap = maxQ(u) / (dl * p.r * S * fx);
    const n = maxN(n => optQuote(p, n, 1), d.budget, cap), q = optQuote(p, Math.max(1, n), 1), v = optUnit(p, S);
    return { p, n, px: q.px, cost: n * q.px, delta: optDelta(p), iv: optIV(u, p.K), omega: v > 0 ? dl * S * p.r * fx / v : 0, be: p.cp === 'C' ? p.K + q.px / (p.r * fx) : p.K - q.px / (p.r * fx), move: n ? permRatio(u, q.hd, n * dl * p.r * S * fx) - 1 : 0 };
  }
  if (d.kind === 'fac') {
    const unit = FAC_PX * (1 + FAC_SPR), cap = Math.floor(maxQ(u) / (d.fac * FAC_PX)), n = Math.max(0, Math.min(cap, Math.floor(d.budget / unit + 1e-9)));
    const Q = d.fac * Math.max(1, n) * FAC_PX, Se = S * avgRatio(u, d.dir, Q);
    return { n, px: unit, cost: n * unit, exposure: d.fac * n * FAC_PX, Se, rate: facRate(u, d.dir, d.fac), move: n ? permRatio(u, d.dir, Q) - 1 : 0, capped: n >= cap };
  }
  const Q = d.margin * d.cfdLev, units = Q / (S * fx), Se = S * avgRatio(u, d.dir, Q);
  return { Q, units, Se, liq: Se - d.dir * 0.5 * d.margin / (units * fx), move: permRatio(u, d.dir, Q) - 1, tooBig: Q > maxQ(u) };
}
export function openDeriv(A, d) {
  const u = M.inst[d.und];
  if (!isUnd(u)) return 'Ungültiger Basiswert.';
  if (!M.isOpen) return 'Hebelprodukte sind nur zu Börsenzeiten handelbar (Mo–Fr 08:00–22:00).';
  if (A.derivs.length >= 50) return 'Maximal 50 offene Hebelpositionen.';
  const L = LIC[A.lic || 0], av = availCash(A);
  if (d.kind === 'ko' || d.kind === 'opt') {
    if (!okNum(d.budget)) return 'Bitte einen Anlagebetrag eingeben.';
    if (d.budget > av + 1e-6) return `Nicht genug Guthaben (verfügbar ${fmtE(av)}).`;
    if (d.kind === 'ko') { if (d.dir !== 1 && d.dir !== -1) return 'Ungültige Richtung.'; if (!okNum(d.lev, 500) || d.lev < 2) return 'Ungültiger Hebel.'; if (d.lev > L.ko) return `Hebel ${d.lev} braucht eine höhere Lizenz (deine: ${L.name}, max. ${L.ko}).`; }
    else {
      if (!L.opt) return 'Optionsscheine brauchen die Derivate-Lizenz (Bank → Lizenzen).';
      if (d.cp !== 'C' && d.cp !== 'P') return 'Call oder Put wählen.';
      if (!EXPIRIES[d.exp]) return 'Ungültige Laufzeit.';
      if (!okNum(d.K) || !strikeList(u).some(k => Math.abs(k / d.K - 1) < 0.2)) return 'Bitte einen gültigen Basispreis wählen.';
    }
    const e = estDeriv(d); if (e.n < 1) return 'Betrag reicht nicht für ein Zertifikat.';
    const q = d.kind === 'ko' ? koQuote(e.p, e.n, 1) : optQuote(e.p, e.n, 1), cost = e.n * q.px;
    if (cost > av + 1e-6) return 'Nicht genug Guthaben.';
    applyTrade(u, q.hd, q.Q, true); A.cash -= cost;
    const pos = Object.assign({ pid: A.seq++, n: e.n, cost, t: M.t, entryPx: q.px }, e.p, d.kind === 'opt' ? { hu: q.hu } : {});
    A.derivs.push(pos);
    logHist(A, { t: M.t, id: u.id, nm: derivName(pos), side: 'Kauf', q: e.n, px: q.px, amt: cost, fee: 0, pnl: null });
    ENV.note(A, `Gekauft: ${fmt(e.n, 0)} × ${derivName(pos)} zu ${fmtD(q.px)}`, 'up');
  } else if (d.kind === 'fac') {
    if (d.dir !== 1 && d.dir !== -1) return 'Ungültige Richtung.';
    if (!FACTORS.includes(d.fac)) return 'Ungültiger Faktor.';
    if (d.fac > (L.fac || 3)) return `Faktor ${d.fac} braucht eine höhere Lizenz (deine: ${L.name}, max. ${L.fac || 3}).`;
    if (!okNum(d.budget)) return 'Bitte einen Anlagebetrag eingeben.';
    if (d.budget > av + 1e-6) return `Nicht genug Guthaben (verfügbar ${fmtE(av)}).`;
    const e = estDeriv(d); if (e.n < 1) return `Ein Faktor-Zertifikat kostet ${fmtE(FAC_PX * (1 + FAC_SPR))}.`;
    if (e.cost > av + 1e-6) return 'Nicht genug Guthaben.';
    const Q = d.fac * e.n * FAC_PX, Se = u.price * avgRatio(u, d.dir, Q);
    applyTrade(u, d.dir, Q, true); A.cash -= e.cost;
    const pos = { pid: A.seq++, kind: 'fac', und: u.id, dir: d.dir, F: d.fac, n: e.n, val: FAC_PX, ref: Se, cost: e.cost, t: M.t, entryPx: e.px };
    A.derivs.push(pos);
    logHist(A, { t: M.t, id: u.id, nm: derivName(pos), side: 'Kauf', q: e.n, px: e.px, amt: e.cost, fee: 0, pnl: null });
    ENV.note(A, `Gekauft: ${fmt(e.n, 0)} × ${derivName(pos)} zu ${fmtD(e.px)}`, 'up');
  } else if (d.kind === 'cfd') {
    if (d.dir !== 1 && d.dir !== -1) return 'Ungültige Richtung.';
    if (!okNum(d.margin)) return 'Bitte eine Margin eingeben.';
    if (!okNum(d.cfdLev, 200) || d.cfdLev < 1) return 'Ungültiger Hebel.';
    if (d.cfdLev > L.cfd) return `Hebel 1:${d.cfdLev} braucht eine höhere Lizenz (deine: ${L.name}, max. 1:${L.cfd}).`;
    if (d.margin > av + 1e-6) return `Nicht genug Guthaben (verfügbar ${fmtE(av)}).`;
    const sl = okNum(d.sl) ? d.sl : 0, tp = okNum(d.tp) ? d.tp : 0;
    if (sl && (d.dir > 0 ? sl >= u.price : sl <= u.price)) return d.dir > 0 ? 'Stop-Loss muss unter dem Kurs liegen.' : 'Stop-Loss muss über dem Kurs liegen.';
    if (tp && (d.dir > 0 ? tp <= u.price : tp >= u.price)) return d.dir > 0 ? 'Take-Profit muss über dem Kurs liegen.' : 'Take-Profit muss unter dem Kurs liegen.';
    const Q = d.margin * d.cfdLev; if (Q > maxQ(u)) return 'Position übersteigt die gesamte Markttiefe des Basiswerts.';
    const S = u.price, units = Q / (S * q2e(u)), Se = S * avgRatio(u, d.dir, Q);
    applyTrade(u, d.dir, Q, true); A.cash -= d.margin;
    const pos = { pid: A.seq++, kind: 'cfd', und: u.id, dir: d.dir, units, entry: Se, margin: d.margin, lev: d.cfdLev, sl, tp, fin: 0, t: M.t, cost: d.margin };
    A.derivs.push(pos);
    logHist(A, { t: M.t, id: u.id, nm: derivName(pos), side: d.dir > 0 ? 'Long' : 'Short', q: units, px: Se, amt: d.margin, fee: 0, pnl: null });
    ENV.note(A, `${derivName(pos)} eröffnet zu ${fmtPx(u, Se)}`, d.dir > 0 ? 'up' : 'dn');
  } else return 'Unbekannter Produkttyp.';
  ENV.event(A, 'deriv', { cls: u.cls }); ENV.dirty(A); return null;
}
export function closeDeriv(A, pid, frac, reason) {
  const p = A.derivs.find(p => p.pid === pid); if (!p) return 'Position nicht gefunden.';
  const u = I(p.und); frac = clamp(+frac || 0, 0, 1); if (!(frac > 0)) return 'Ungültiger Anteil.';
  let payout = 0, costPart = p.cost * frac, px = 0, q = 0;
  if (p.kind === 'fac') {
    let n = Math.round(p.n * frac); if (n < 1) n = Math.min(1, p.n); frac = n / p.n; costPart = p.cost * frac;
    p.val = facMark(p, u.price); p.ref = u.price;
    const Q = p.F * n * p.val, Se = u.price * avgRatio(u, -p.dir, Q);
    applyTrade(u, -p.dir, Q, true);
    px = facMark(p, Se) * (1 - FAC_SPR); payout = n * px; q = n; p.n -= n;
  } else if (p.kind === 'ko' || p.kind === 'opt') {
    let n = Math.round(p.n * frac); if (n < 1) n = Math.min(1, p.n); frac = n / p.n; costPart = p.cost * frac;
    const qq = p.kind === 'ko' ? koQuote(p, n, -1) : optQuote(p, n, -1, p.hu * frac);
    applyTrade(u, qq.hd, qq.Q, true); payout = n * qq.px; px = qq.px; q = n; p.n -= n; if (p.kind === 'opt') p.hu -= p.hu * frac;
  } else {
    const units = p.units * frac, Q = units * u.price * q2e(u), Se = u.price * avgRatio(u, -p.dir, Q);
    applyTrade(u, -p.dir, Q, true);
    payout = Math.max(0, p.margin * frac + p.dir * units * (Se - p.entry) * q2e(u) - p.fin * frac); px = Se; q = units;
    p.units -= units; p.margin -= p.margin * frac; p.fin -= p.fin * frac;
  }
  p.cost -= costPart; A.cash += payout;
  const pnl = payout - costPart; A.realized += pnl;
  logHist(A, { t: M.t, id: u.id, nm: derivName(p), side: reason || (p.kind === 'cfd' ? 'Schließung' : 'Verkauf'), q, px, amt: payout, fee: 0, pnl });
  if (frac >= 0.999 || (p.kind !== 'cfd' && p.n <= 0) || (p.kind === 'cfd' && p.units <= 1e-12)) A.derivs.splice(A.derivs.indexOf(p), 1);
  else if (p.kind === 'fac') p.ref = u.price; // Restbestand ab jetzt vom Kurs nach dem Verkauf
  ENV.note(A, `${reason || (p.kind === 'cfd' ? 'Schließung' : 'Verkauf')}: ${derivName(p)} · Erlös ${fmtE(payout)} (${pnl >= 0 ? '+' : ''}${fmtE(pnl)})`, pnl >= 0 ? 'up' : 'dn');
  ENV.event(A, 'derivClose', { pnl, cost: costPart }); ENV.dirty(A); return null;
}
function checkDerivs() {
  for (const A of ENV.accounts()) {
    let guard = 0;
    for (let i = 0; i < A.derivs.length && guard++ < 2000;) {
      const p = A.derivs[i], u = I(p.und), S = u.price;
      if (p.kind === 'ko' && p.dir * (S - p.K) <= 0) {
        A.derivs.splice(i, 1); applyTrade(u, -p.dir, p.n * p.r * S * q2e(u), false);
        A.realized -= p.cost; logHist(A, { t: M.t, id: u.id, nm: derivName(p), side: 'Knock-out', q: p.n, px: 0, amt: 0, fee: 0, pnl: -p.cost });
        ENV.note(A, `Knock-out! ${derivName(p)} ist wertlos verfallen (−${fmtE(p.cost)})`, 'dn'); ENV.dirty(A); i = 0; continue;
      }
      if (p.kind === 'fac' && facMark(p, S) < 0.005) {
        A.derivs.splice(i, 1); A.realized -= p.cost;
        logHist(A, { t: M.t, id: u.id, nm: derivName(p), side: 'Totalverlust', q: p.n, px: 0, amt: 0, fee: 0, pnl: -p.cost });
        ENV.note(A, `${derivName(p)} ist praktisch wertlos geworden (−${fmtE(p.cost)})`, 'dn'); ENV.dirty(A); i = 0; continue;
      }
      if (p.kind === 'opt' && M.t >= p.exp) {
        A.derivs.splice(i, 1);
        const pay = p.n * Math.max(0, p.cp === 'C' ? S - p.K : p.K - S) * p.r * q2e(u);
        applyTrade(u, -(p.cp === 'C' ? 1 : -1), p.hu * S * q2e(u), false);
        A.cash += pay; const pnl = pay - p.cost; A.realized += pnl;
        logHist(A, { t: M.t, id: u.id, nm: derivName(p), side: 'Fälligkeit', q: p.n, px: p.n ? pay / p.n : 0, amt: pay, fee: 0, pnl });
        ENV.note(A, `Fälligkeit ${derivName(p)}: Auszahlung ${fmtE(pay)}`, pay > 0 ? 'up' : 'dn'); ENV.event(A, 'derivClose', { pnl, cost: p.cost }); ENV.dirty(A); i = 0; continue;
      }
      if (p.kind === 'cfd') {
        const eq = cfdEquity(p);
        if (eq <= 0.5 * p.margin) { closeDeriv(A, p.pid, 1, 'Margin Call – Zwangsschließung'); i = 0; continue; }
        if (p.sl > 0 && (p.dir > 0 ? S <= p.sl : S >= p.sl)) { closeDeriv(A, p.pid, 1, 'Stop-Loss'); i = 0; continue; }
        if (p.tp > 0 && (p.dir > 0 ? S >= p.tp : S <= p.tp)) { closeDeriv(A, p.pid, 1, 'Take-Profit'); i = 0; continue; }
      }
      i++;
    }
  }
}
function overnightDerivs(days) {
  for (const A of ENV.accounts()) for (const p of A.derivs) {
    const u = I(p.und), c = undCarry(u);
    if (p.kind === 'ko') { p.K = p.dir > 0 ? p.K * (1 + (c + 0.03) * days / 360) : p.K * (1 + (c - 0.03) * days / 360); ENV.dirty(A); }
    if (p.kind === 'cfd') { p.fin += p.units * u.price * q2e(u) * cfdRate(u, p.dir) * days / 360; ENV.dirty(A); }
    if (p.kind === 'fac') { p.val *= Math.exp(-facRate(u, p.dir, p.F) * days / 360); ENV.dirty(A); }
  }
}

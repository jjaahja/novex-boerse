// NOVEX Börse – Stammdaten und Spielregeln (gemeinsam für Browser und Server). Alles frei erfunden.

/* ---------- Stammdaten ---------- */
export const SECTORS = { tech: 'Software & Internet', semi: 'Halbleiter', auto: 'Automobil', fin: 'Finanzen', cons: 'Konsum', energy: 'Energie', health: 'Gesundheit', ind: 'Industrie', tel: 'Telekom', chem: 'Chemie' };
export const CSECT = { prec: 'Edelmetalle', ener: 'Energie', metal: 'Industriemetalle', agri: 'Agrar' };
export const STOCKS = [
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
export const CORE = new Set(STOCKS.slice(0, 24).map(d => d[0])); // Bestandteile des WELTIX 24
export const BONDS = [
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
export const CMDS = [
  ['GOLD', 'Gold', 'Feinunze', 2650, 0.15, -0.05, 'prec', 150, 0.00005, 'Das klassische Krisenmetall. Gefragt, wenn Anleger Sicherheit suchen.'],
  ['SILV', 'Silber', 'Feinunze', 31.20, 0.28, 0.2, 'prec', 20, 0.0002, 'Edel- und Industriemetall, schwankt stärker als Gold.'],
  ['BRNT', 'Rohöl Brent', 'Barrel', 73.40, 0.32, 0.5, 'ener', 100, 0.0002, 'Referenzsorte für Rohöl aus der Nordsee.'],
  ['NGAS', 'Erdgas', 'MMBtu', 3.20, 0.60, 0.3, 'ener', 20, 0.0006, 'US-Erdgas (Henry Hub). Wetter und Speicherstände bewegen den Preis stark.'],
  ['COPR', 'Kupfer', 'Pfund', 4.15, 0.22, 0.7, 'metal', 30, 0.0003, 'Konjunkturmetall für Kabel, Motoren und Stromnetze.'],
  ['WHEA', 'Weizen', 'Scheffel', 5.50, 0.28, 0.1, 'agri', 3, 0.0008, 'Wichtigstes Brotgetreide; Ernten und Wetter treiben den Preis.']
];
export const CMDNEWS = {
  GOLD: [['Zentralbanken kaufen Gold in Rekordmenge', 'Goldpreis steigt nach schwachen US-Daten'], ['Starker Dollar belastet den Goldpreis', 'Anleger ziehen Geld aus Gold-ETCs ab']],
  SILV: [['Solarindustrie treibt Silbernachfrage', 'Silber folgt Gold nach oben'], ['Silberminen fahren Produktion hoch', 'Gewinnmitnahmen bei Silber']],
  BRNT: [['OPEC+ kündigt Förderkürzung an', 'Angriff auf Tanker im Golf treibt Ölpreis'], ['US-Lagerbestände steigen überraschend stark', 'OPEC+ uneinig – mehr Öl kommt auf den Markt']],
  NGAS: [['Kältewelle treibt Gasnachfrage', 'Ausfall eines LNG-Terminals verknappt Angebot'], ['Milder Winter: Gasspeicher randvoll', 'Neue Förderprojekte drücken Gaspreis']],
  COPR: [['Streik in der größten Kupfermine der Welt', 'Netzausbau lässt Kupfernachfrage steigen'], ['Bauwirtschaft schwächelt – Kupfer unter Druck', 'Kupferlager in London füllen sich']],
  WHEA: [['Dürre bedroht die Weizenernte', 'Exportstopp eines großen Anbaulands'], ['Rekordernte drückt Weizenpreise', 'Regen entspannt die Lage auf den Feldern']]
};
export const FXP = [
  ['EURUSD', 'EUR', 'USD', 500, 0.6, 0.065], ['GBPUSD', 'GBP', 'USD', 200, 0.9, 0.075], ['USDJPY', 'USD', 'JPY', 300, 0.8, 0.095],
  ['EURCHF', 'EUR', 'CHF', 60, 1.2, 0.055], ['AUDUSD', 'AUD', 'USD', 90, 0.8, 0.095], ['EURGBP', 'EUR', 'GBP', 70, 0.9, 0.055], ['EURJPY', 'EUR', 'JPY', 70, 1.2, 0.10]
];
export const ETFS = [
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
export const FUNDS = [
  { id: 'DWZT', name: 'DWZ Top Dividende', px: 142.85, aa: 0.05, ter: 0.0145, av: 0.02, type: 'Aktienfonds', comp: { ALNX: .12, NSTL: .12, KOKA: .12, TTEL: .12, EXXF: .10, SHLL: .10, PFZR: .10, SIMZ: .11, MHRD: .11 }, desc: 'Aktiv gemanagter Dividendenfonds mit Fokus auf defensive Substanzwerte.' },
  { id: 'UNIG', name: 'Unidepot Global', px: 386.20, aa: 0.05, ter: 0.0150, av: 0.02, type: 'Aktienfonds', comp: { PEAR: .12, MHRD: .12, ABET: .10, AMZS: .10, MVDA: .10, NSTL: .06, ALNX: .06, SIMZ: .06, NVNO: .06, EXXF: .06, KOKA: .05, SAPF: .05, ABZZ: .06 }, desc: 'Breit gestreuter globaler Aktienfonds.' },
  { id: 'FTIN', name: 'Fidelitas Tech Innovation', px: 27.64, aa: 0.0525, ter: 0.0180, av: 0.03, type: 'Aktienfonds', comp: { MVDA: .25, MTVR: .15, ABET: .15, TSLR: .15, QNTX: .10, SAPF: .10, PEAR: .10 }, desc: 'Konzentrierter Technologiefonds mit hoher Schwankung.' },
  { id: 'HREN', name: 'Hansa Rentenfonds Euro', px: 51.12, aa: 0.03, ter: 0.0090, av: 0.004, type: 'Rentenfonds', comp: { TEUT29: .2, TEUT34: .2, HISP31: .15, LOMB33: .15, DBNK28: .1, VWGN31: .1, MVDA30: .1 }, desc: 'Euro-Anleihen guter Bonität, Staats- und Unternehmensanleihen.' },
  { id: 'MBAL', name: 'Mischfonds Balance 60/40', px: 63.48, aa: 0.04, ter: 0.0135, av: 0.01, type: 'Mischfonds', comp: { PEAR: .1, MHRD: .1, NSTL: .1, ALNX: .1, SIMZ: .1, EXXF: .1, TEUT34: .15, TEUT54: .1, HISP31: .15 }, desc: 'Ausgewogener Mischfonds: 60 % Aktien, 40 % Anleihen.' },
  { id: 'RHGF', name: 'Lazarus Rohstoff & Gold', px: 88.40, aa: 0.05, ter: 0.0175, av: 0.03, type: 'Rohstofffonds', comp: { GOLD: .35, SILV: .1, BRNT: .15, COPR: .1, EXXF: .15, SHLL: .15 }, desc: 'Aktiv gemanagter Rohstofffonds mit Goldschwerpunkt und Energieaktien.' },
  { id: 'GVAL', name: 'Kapital Global Value', px: 156.90, aa: 0.05, ter: 0.0160, av: 0.02, type: 'Aktienfonds', comp: { JPMG: .15, ALNX: .12, NSTL: .12, KOKA: .1, PFZR: .1, BSFA: .1, VWGN: .1, TTEL: .11, HRMZ: .1 }, desc: 'Weltweite Substanzwerte mit niedriger Bewertung.' }
];
export const POSN = ['{n} übertrifft die Gewinnerwartungen deutlich', '{n} hebt die Jahresprognose an', 'Analysten stufen {n} auf „Kaufen“ hoch', '{n} meldet Rekordumsatz im Quartal', '{n} kündigt milliardenschweren Aktienrückkauf an', '{n} gewinnt Großauftrag', 'Übernahmegerüchte um {n}', '{n}: Neues Produkt übertrifft Vorbestellungen'];
export const NEGN = ['{n} verfehlt die Umsatzerwartungen', '{n} senkt die Prognose', 'Kartellbehörde ermittelt gegen {n}', '{n}: Finanzvorstand tritt überraschend zurück', 'Rückrufaktion belastet {n}', 'Analysten stufen {n} auf „Verkaufen“ ab', '{n} warnt vor schwächerer Nachfrage', 'Hackerangriff legt Systeme von {n} lahm'];

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
  { id: 'fx', name: 'Devisenhändler', desc: 'Eröffne eine Devisenposition oder tausche Währung.', reward: 500 },
  { id: 'cmd', name: 'Rohstoffhändler', desc: 'Handle ein Rohstoff-ETC oder ein Hebelprodukt auf einen Rohstoff.', reward: 500 },
  { id: 'lever', name: 'Hebelkünstler', desc: 'Schließe ein Hebelprodukt mit mindestens +50 % Gewinn.', reward: 2500 },
  { id: 'limit', name: 'Geduldig', desc: 'Lass 10 Limit-Orders ausführen.', reward: 1000 },
  { id: 'streak', name: 'Treue', desc: 'Hole den Tagesbonus 7 Tage in Folge ab.', reward: 1500 },
  { id: 'drip', name: 'Zinseszins-Maschine', desc: 'Lass eine Dividende automatisch wieder anlegen.', reward: 500 },
  { id: 'plan', name: 'Dranbleiben', desc: 'Lass Sparpläne insgesamt 5-mal ausführen.', reward: 1000 },
  { id: 'passive100', name: 'Passives Einkommen', desc: 'Kassiere insgesamt 100 € Dividenden, Zinsen und Kupons.', reward: 1000 },
  { id: 'league', name: 'Wochensieger', desc: 'Gewinne die Wochenliga.', reward: 5000 },
  { id: 'crisis', name: 'Krisen-Gewinner', desc: 'Beende eine komplette Rezession mit Portfolio im Plus.', reward: 5000 },
  { id: 'tenbagger', name: '10-Bagger', desc: 'Halte eine Position, die das Zehnfache ihres Einstands wert ist (ab 100 € Einsatz).', reward: 10000 },
  { id: 'owner', name: 'Großaktionär', desc: 'Besitze 1 % eines Unternehmens.', reward: 5000 },
  { id: 'million', name: 'Millionär', desc: 'Erreiche 1 Mio. € Gesamtvermögen.', reward: 10000 }
];

/* ---------- Fundamentaldaten & Geschichten ----------
   g: Umsatzwachstum p. a., psr: Kurs-Umsatz-Verhältnis, fy: Geschäftsjahres-Versatz in Monaten (verteilt die Berichtstermine übers Jahr) */
export const FUNDA = {
  MVDA: { g: 0.45, psr: 22, fy: 0 }, PEAR: { g: 0.05, psr: 8, fy: 1 }, MHRD: { g: 0.14, psr: 12, fy: 2 }, ABET: { g: 0.11, psr: 6.5, fy: 0 },
  AMZS: { g: 0.11, psr: 3.2, fy: 1 }, TSLR: { g: 0.02, psr: 10, fy: 2 }, MTVR: { g: 0.18, psr: 9, fy: 0 }, SAPF: { g: 0.09, psr: 7, fy: 1 },
  SIMZ: { g: 0.04, psr: 2.0, fy: 2 }, ALNX: { g: 0.05, psr: 1.2, fy: 0 }, DBNK: { g: 0.03, psr: 1.6, fy: 1 }, VWGN: { g: 0.01, psr: 0.15, fy: 2 },
  BMVW: { g: 0.0, psr: 0.35, fy: 0 }, ADBS: { g: 0.10, psr: 1.4, fy: 1 }, NSTL: { g: 0.02, psr: 2.3, fy: 2 }, KOKA: { g: 0.03, psr: 5.8, fy: 0 },
  EXXF: { g: -0.02, psr: 1.3, fy: 1 }, SHLL: { g: -0.01, psr: 0.7, fy: 2 }, PFZR: { g: -0.03, psr: 2.4, fy: 0 }, NVNO: { g: 0.25, psr: 5.5, fy: 1 },
  ABZZ: { g: 0.07, psr: 2.0, fy: 2 }, TTEL: { g: 0.02, psr: 1.3, fy: 0 }, QNTX: { g: 0.60, psr: 40, fy: 1 }, SOLR: { g: 0.15, psr: 1.5, fy: 2 },
  NTFX: { g: 0.15, psr: 8.5, fy: 0 }, JPMG: { g: 0.06, psr: 3.6, fy: 1 }, VIZZ: { g: 0.10, psr: 15, fy: 2 }, HRMZ: { g: 0.14, psr: 13, fy: 0 },
  RHST: { g: 0.30, psr: 2.6, fy: 1 }, LUFZ: { g: 0.04, psr: 0.2, fy: 2 }, BSFA: { g: -0.01, psr: 0.6, fy: 0 }, CBZE: { g: 0.35, psr: 8, fy: 1 }
};
export const STORY = {
  MVDA: 'Gegründet von einer Gamerin, die Grafikkarten zu besseren Taschenrechnern umbaute. Heute laufen fast alle KI-Rechenzentren auf Mvidia-Chips – die Lieferzeiten betragen Monate.',
  PEAR: 'Das wertvollste Konsummarkenimperium der Welt. Wächst kaum noch, verdient aber an jedem App-Kauf mit und kauft eigene Aktien in Rekordhöhe zurück.',
  MHRD: 'Vom Büro-Software-Monopol zur Cloud-Supermacht. Jeder zweite Konzern mietet Rechenleistung bei Macrohard.',
  ABET: 'Die Suchmaschine verdient Milliarden mit Werbung. Die große Frage: Ersetzen KI-Chats bald die klassische Suche?',
  AMZS: 'Liefert alles an jede Haustür. Den eigentlichen Gewinn bringt aber die Cloud-Sparte, nicht der Versandhandel.',
  TSLR: 'Mehr Glaubensfrage als Autobauer: Die Bewertung setzt auf Robotaxis, die es noch nicht gibt. Entsprechend wild schwankt der Kurs.',
  MTVR: 'Drei Milliarden Menschen nutzen täglich die Apps. Der Konzern steckt jedes Jahr Milliarden in VR-Brillen, die noch keiner braucht.',
  SAPF: 'Die Buchhaltungssoftware, ohne die kaum ein Großkonzern abschließen kann. Langweilig, profitabel, schwer zu ersetzen.',
  SIMZ: 'Industrie-Urgestein mit Zügen, Fabrikautomatisierung und Medizintechnik. Profitiert von jedem Infrastrukturprogramm.',
  ALNX: 'Versichert halb Europa. Hohe Zinsen freuen den Konzern: Er legt die Beiträge gewinnbringender an.',
  DBNK: 'Nach Jahren der Skandale endlich wieder profitabel. Das Investmentbanking macht die Aktie aber zur Achterbahn.',
  VWGN: 'Größter Autobauer Europas, aber spät dran bei Elektroautos. Billig bewertet, hohe Dividende, viel Skepsis.',
  BMVW: 'Premium-Autos mit treuen Kunden. Hängt stark am Geschäft in Asien.',
  ADBS: 'Sportschuhe und Trikots für die halbe Welt. Nach einem schwachen Jahr läuft das Comeback mit Retro-Sneakern.',
  NSTL: 'Kaffee, Babynahrung, Tierfutter – Dinge, die man auch in der Krise kauft. Der Inbegriff einer defensiven Aktie.',
  KOKA: 'Verkauft seit 130 Jahren Brause mit geheimem Rezept. Erhöht die Dividende seit Jahrzehnten Jahr für Jahr.',
  EXXF: 'Ölmulti mit eigener Förderung und Raffinerien. Verdient prächtig, wenn der Ölpreis steigt – und leidet, wenn er fällt.',
  SHLL: 'Setzt stärker als die Konkurrenz auf Flüssiggas. Zahlt hohe Dividenden, steht aber unter Klimadruck.',
  PFZR: 'Pharmariese nach dem Impfstoff-Boom. Mehrere Patente laufen bald aus – die Pipeline muss liefern.',
  NVNO: 'Die Abnehmspritze ist ein Welterfolg, das Werk kommt kaum hinterher. Jede Studie bewegt den Kurs.',
  ABZZ: 'Baut Verkehrsflugzeuge mit Auftragsbüchern für zehn Jahre. Das Problem sind Lieferketten, nicht die Nachfrage.',
  TTEL: 'Mobilfunk und Glasfaser, solide Dividende. Wächst langsam, aber verlässlich.',
  QNTX: 'Ein Start-up mit dem ersten kommerziellen Quantenchip. Macht Verluste, aber jede Forschungsmeldung kann den Kurs verdoppeln.',
  SOLR: 'Baut Solarparks auf Pump. Steigende Zinsen sind Gift für die Schuldenlast.',
  NTFX: 'Hat das Streaming erfunden und den Abo-Krieg gewonnen. Jetzt kommen Werbung und Live-Sport dazu.',
  JPMG: 'Größte Bank des Landes mit einem legendären Chef. Gilt als sicherer Hafen unter den Banken.',
  VIZZ: 'Verdient an fast jeder Kartenzahlung ein paar Cent. Hohe Margen, kaum Risiko, stetiges Wachstum.',
  HRMZ: 'Handtaschen mit jahrelangen Wartelisten. Die Kundschaft ist so reich, dass Konjunkturflauten kaum stören.',
  RHST: 'Vom Mittelständler zum Rüstungsriesen. Die Auftragsbücher sind voll wie nie.',
  LUFZ: 'Fluglinie mit hohen Kosten und Streiks. Billig, aber Treibstoffpreise und Konjunktur schlagen voll durch.',
  BSFA: 'Größter Chemiekonzern der Welt. Leidet unter hohen Energiepreisen in Europa.',
  CBZE: 'Größte Kryptobörse. Verdient an jedem Bitcoin-Trade – und bricht ein, wenn die Kryptowelt kriselt.'
};

/* ---------- Vermögensstufen ---------- */
export const TIERS = [
  { name: 'Kleinanleger', min: 0, credit: 0, terms: [3], hint: false, feeRate: 0.0005, perks: ['Sparpläne und Dividenden-Wiederanlage', 'Zinsen auf dein Guthaben', 'Festgeld über 3 Monate'] },
  { name: 'Aktiver Trader', min: 25000, credit: 0.5, terms: [3, 6, 12], hint: false, feeRate: 0.0005, perks: ['Wertpapierkredit bis 50 % des Beleihungswerts', 'Festgeld über 6 und 12 Monate', 'Erweiterte Risikoanalyse (Beta, Volatilität)'] },
  { name: 'Fondsmanager', min: 250000, credit: 0.8, terms: [3, 6, 12], hint: false, phase: true, feeRate: 0.0004, perks: ['Wertpapierkredit bis 80 %', 'Marktphasen-Radar mit Ausblick', 'Ordergebühr 0,04 %'] },
  { name: 'Investor', min: 2500000, credit: 1, terms: [3, 6, 12], hint: true, phase: true, feeRate: 0.0003, perks: ['Wertpapierkredit bis 100 %', 'Analystentendenz vor jeder Quartalsbilanz', 'Ordergebühr 0,03 %'] },
  { name: 'Finanz-Tycoon', min: 25000000, credit: 1, terms: [3, 6, 12], hint: true, phase: true, feeRate: 0.0002, perks: ['Alle Werkzeuge', 'Ordergebühr 0,02 %', 'Der Status, über den alle reden'] }
];
export const TIER_REWARD = [0, 1000, 5000, 20000, 50000];
// Beleihungswerte für den Wertpapierkredit
export const LOMBARD = { stock: 0.5, etf: 0.6, fund: 0.5, bond: 0.8 };
// Großaktionärs-Schwellen (Anteil an allen Aktien)
export const OWNER = [
  { min: 0.01, name: 'Großaktionär', div: 0, hint: 0.75, perk: 'Investor-Relations-Zugang: Tendenz vor jeder Quartalsbilanz' },
  { min: 0.05, name: 'Ankeraktionär', div: 0.25, hint: 0.8, perk: 'Stimmrecht auf der Hauptversammlung und 25 % Sonderdividende' },
  { min: 0.25, name: 'Aufsichtsratssitz', div: 0.5, hint: 0.92, perk: 'Sitz im Aufsichtsrat: 50 % Sonderdividende und verlässlicher Blick auf die Zahlen' }
];
export const DEPOSIT_PREMIUM = { 3: 0.002, 6: 0.004, 12: 0.006 }; // Aufschlag aufs Festgeld über dem Leitzins
export const CASH_RATE_CAP = 100000; // Guthabenzinsen bis zu diesem Betrag

/* ---------- Marktphasen ---------- */
// mu: Marktrendite p. a., vol: Schwankungsfaktor, infl: Inflationsziel, tilt: Sektor-Rückenwind p. a., dur: Dauer in Handelstagen
export const REGIMES = {
  bull: { name: 'Bullenmarkt', mu: 0.18, vol: 0.85, infl: 2.4, dur: [30, 70], next: { side: 0.5, infl: 0.35, rec: 0.15 }, tilt: { tech: 0.05, semi: 0.1, cons: 0.03, ener: 0, prec: -0.05 }, desc: 'Steigende Kurse, gute Stimmung, niedrige Schwankungen. Wachstumswerte laufen besonders gut.' },
  side: { name: 'Seitwärtsphase', mu: 0.03, vol: 0.85, infl: 2.2, dur: [20, 50], next: { bull: 0.5, infl: 0.25, hike: 0.25 }, tilt: { health: 0.04, tel: 0.04 }, desc: 'Der Markt pendelt ohne klare Richtung. Dividenden und Zinsen tragen den Großteil der Rendite.' },
  infl: { name: 'Inflationsschub', mu: -0.02, vol: 1.1, infl: 5.0, dur: [20, 45], next: { hike: 0.7, side: 0.3 }, tilt: { energy: 0.15, fin: 0.05, tech: -0.1, semi: -0.1, ener: 0.2, prec: 0.15, metal: 0.1, agri: 0.1 }, desc: 'Preise steigen schneller als erwartet. Rohstoffe und Energie profitieren, teure Wachstumsaktien leiden.' },
  hike: { name: 'Zinswende', mu: -0.06, vol: 1.2, infl: 3.0, dur: [15, 35], next: { rec: 0.55, side: 0.45 }, tilt: { fin: 0.08, tech: -0.12, energy: 0.0, ind: -0.04, prec: -0.05 }, desc: 'Die Zentralbank erhöht die Zinsen deutlich. Anleihen verlieren, Banken gewinnen, Hochbewertete fallen.' },
  rec: { name: 'Rezession', mu: -0.28, vol: 1.6, infl: 1.2, dur: [15, 40], next: { recov: 1 }, tilt: { health: 0.1, cons: 0.06, tel: 0.06, auto: -0.15, ind: -0.1, fin: -0.08, ener: -0.2, metal: -0.15, prec: 0.12 }, desc: 'Die Wirtschaft schrumpft, Kurse fallen kräftig. Wer Geld übrig hat, kauft jetzt günstig nach.' },
  recov: { name: 'Erholung', mu: 0.28, vol: 1.1, infl: 1.8, dur: [20, 45], next: { bull: 1 }, tilt: { auto: 0.15, ind: 0.1, semi: 0.1, fin: 0.08, metal: 0.1, ener: 0.08 }, desc: 'Nach dem Tief geht es schnell wieder aufwärts. Zyklische Werte erholen sich am stärksten.' }
};

/* ---------- Termine & Nachrichtenvorlagen ---------- */
export const SECTOR_EVENTS = [
  { sector: 'semi', title: 'Halbleiter-Gipfel: Exportregeln für KI-Chips werden neu verhandelt' },
  { sector: 'health', title: 'Gesundheitsbehörde entscheidet über Preisdeckel für Medikamente' },
  { sector: 'auto', title: 'Autogipfel: Regierung berät über neue E-Auto-Prämie' },
  { sector: 'fin', title: 'Bankenaufsicht veröffentlicht Ergebnisse des Stresstests' },
  { sector: 'energy', title: 'OPEC+-Treffen: Förderquoten stehen auf der Tagesordnung' },
  { sector: 'tech', title: 'EU-Kommission entscheidet über Digitalsteuer für Plattformen' },
  { sector: 'ind', title: 'Bundestag stimmt über Infrastruktur- und Verteidigungspaket ab' },
  { sector: 'cons', title: 'Einzelhandelsverband legt Weihnachtsbilanz vor' },
  { sector: 'tel', title: 'Frequenzauktion für den neuen Mobilfunkstandard' }
];
export const RUMORS = [
  { txt: '{n} prüft angeblich Übernahmeangebot eines Finanzinvestors', yes: '{n} bestätigt Übernahmeangebot mit {p} % Aufschlag', no: '{n} dementiert Übernahmegerüchte', up: [0.04, 0.12] },
  { txt: 'Insider: {n} steht kurz vor einem Großauftrag', yes: '{n} meldet Rekordauftrag', no: '{n}: Großauftrag geplatzt', up: [0.03, 0.06] },
  { txt: 'Medienbericht: {n} plant Sonderdividende', yes: '{n} kündigt Sonderdividende an', no: '{n}: Keine Sonderdividende geplant', up: [0.02, 0.04] },
  { txt: 'Gerücht: {n} droht hohe Strafe der Wettbewerbsbehörde', yes: 'Behörde verhängt Milliardenstrafe gegen {n}', no: '{n}: Wettbewerbsverfahren eingestellt', up: [-0.06, -0.03] }
];



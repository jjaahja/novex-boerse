// NOVEX Börse – Stammdaten und Spielregeln (gemeinsam für Browser und Server). Alles frei erfunden.

/* ---------- Stammdaten ---------- */
export const SECTORS = { tech: 'Software & Internet', semi: 'Halbleiter', auto: 'Automobil', fin: 'Finanzen', cons: 'Konsum', energy: 'Energie', health: 'Gesundheit', ind: 'Industrie', tel: 'Telekom', chem: 'Chemie', util: 'Versorger', realty: 'Immobilien' };
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
  ['CBZE', 'Coinbaze Global', 'fin', 245.60, 0.25, 2.2, 0.80, 0.0300, 45, 0, 'Kryptobörse – schwankt mit dem Bitcoin-Kurs.'],
  // Nebenwerte – realistische Übernahmeziele
  ['KRNH', 'Brauerei Kranich AG', 'cons', 3.80, 0.0032, 0.5, 0.30, 0.0040, 14, 0.045, 'Familienbrauerei mit drei Biermarken und eigener Mälzerei.'],
  ['RTST', 'Ruhrtal Stahl AG', 'ind', 12.40, 0.0068, 1.3, 0.45, 0.0060, 9, 0.030, 'Spezialstahl für Maschinenbau und Windkraft aus dem Ruhrgebiet.'],
  ['MDVO', 'Medivio Diagnostics', 'health', 21.50, 0.0075, 0.9, 0.48, 0.0060, 28, 0, 'Schnelltests und Labordiagnostik für Kliniken.'],
  ['NWDT', 'Nordwind Turbinen', 'energy', 9.60, 0.0350, 1.3, 0.55, 0.0080, 35, 0, 'Baut Windkraftanlagen für Nord- und Ostsee.'],
  // Erweiterung: weitere Konzerne aus aller Welt
  ["OKRL", "Orakel Systems", 'tech', 168.00, 2.8, 1.0, 0.28, 0.003, 32, 0.01, "Datenbanken und Cloud-Infrastruktur für Großkonzerne."],
  ["SLSF", "Salesfarce Inc.", 'tech', 268.00, 0.96, 1.1, 0.3, 0.004, 45, 0.006, "Kundenmanagement-Software aus der Cloud."],
  ["ADOB", "Adobo Systems", 'tech', 480.00, 0.44, 1.1, 0.3, 0.004, 38, 0, "Software für Bildbearbeitung, Design und PDF."],
  ["SPTF", "Spotifly Technology", 'tech', 420.00, 0.2, 1.3, 0.42, 0.008, 80, 0, "Musik- und Podcast-Streaming."],
  ["UBRX", "Uba Technologies", 'tech', 72.00, 2.1, 1.3, 0.4, 0.006, 30, 0, "Fahrdienste und Essenslieferung per App."],
  ["ZLND", "Zalandi SE", 'cons', 31.00, 0.26, 1.4, 0.42, 0.008, 28, 0, "Online-Modehändler für ganz Europa."],
  ["TSMK", "Taiwan Semikon", 'semi', 168.00, 5.2, 1.3, 0.38, 0.004, 24, 0.014, "Auftragsfertiger für fast alle Hochleistungs-Chips."],
  ["ASMR", "ASMR Lithography NV", 'semi', 690.00, 0.39, 1.3, 0.38, 0.005, 36, 0.009, "Einziger Hersteller von EUV-Belichtungsmaschinen."],
  ["INTL", "Intal Corp.", 'semi', 24.00, 4.3, 1.1, 0.4, 0.007, -1, 0.02, "Prozessoren für PCs und Rechenzentren, im Umbau."],
  ["AMDX", "AMB Devices", 'semi', 152.00, 1.62, 1.7, 0.5, 0.009, 110, 0, "Prozessoren und KI-Beschleuniger."],
  ["INFN", "Infinion AG", 'semi', 34.00, 1.3, 1.4, 0.38, 0.006, 24, 0.01, "Leistungshalbleiter für Autos und Energietechnik."],
  ["MBNZ", "Merzedes-Benz Group", 'auto', 62.00, 1.0, 1.1, 0.28, 0.004, 6.5, 0.085, "Premium-Autos und Transporter."],
  ["PRSH", "Porsha AG", 'auto', 64.00, 0.91, 1.1, 0.3, 0.004, 15, 0.036, "Sportwagen mit Kultstatus."],
  ["BYDX", "BYT Auto", 'auto', 32.00, 2.9, 1.2, 0.45, 0.006, 22, 0.01, "Größter Hersteller von E-Autos und Batterien."],
  ["GSAC", "Goldmann Sax", 'fin', 560.00, 0.32, 1.3, 0.28, 0.003, 16, 0.02, "Investmentbank und Vermögensverwalter."],
  ["BRKS", "Berkshore Hathaway", 'fin', 470.00, 2.16, 0.8, 0.16, 0.002, 22, 0, "Beteiligungsholding mit Versicherungen und Industrie."],
  ["MCHR", "Münchner Rück", 'fin', 470.00, 0.13, 0.7, 0.19, 0.002, 13, 0.033, "Rückversicherer für Naturkatastrophen und Großrisiken."],
  ["PAYP", "PayPall Holdings", 'fin', 68.00, 1.0, 1.3, 0.38, 0.007, 15, 0, "Online-Bezahldienst."],
  ["MCDO", "McDonalt's Corp.", 'cons', 290.00, 0.72, 0.6, 0.17, 0.002, 25, 0.023, "Größte Schnellrestaurant-Kette der Welt."],
  ["LVMX", "LVHM Moët Hennessy", 'cons', 640.00, 0.5, 1.0, 0.3, 0.004, 24, 0.02, "Luxuskonzern: Mode, Champagner, Schmuck."],
  ["WMRT", "Wallmarkt Inc.", 'cons', 92.00, 8.0, 0.5, 0.18, 0.002, 38, 0.011, "Supermärkte und Onlinehandel in den USA."],
  ["NKEE", "Nikke Inc.", 'cons', 74.00, 1.5, 1.0, 0.3, 0.005, 26, 0.02, "Sportschuhe und Sportbekleidung."],
  ["STBX", "Starbacks Corp.", 'cons', 95.00, 1.13, 0.9, 0.28, 0.004, 30, 0.025, "Kaffeehaus-Kette mit 40.000 Filialen."],
  ["TTEN", "TotalErgies SE", 'energy', 58.00, 2.3, 0.8, 0.24, 0.003, 8, 0.055, "Öl, Gas, Flüssiggas und Strom."],
  ["NEXE", "NextEra Grün", 'util', 72.00, 2.05, 0.8, 0.26, 0.004, 22, 0.028, "Größter Betreiber von Wind- und Solarparks."],
  ["EONX", "E.ON-Netz AG", 'util', 13.40, 2.6, 0.6, 0.18, 0.003, 13, 0.04, "Stromnetze und Energievertrieb."],
  ["RWEX", "RWE Kraft AG", 'util', 33.00, 0.74, 0.7, 0.26, 0.004, 9, 0.033, "Stromerzeugung aus Wind, Solar und Gas."],
  ["LLLY", "Lilly & Söhne", 'health', 820.00, 0.95, 0.7, 0.3, 0.004, 60, 0.007, "Diabetes- und Abnehmmedikamente."],
  ["JNJX", "Jonson & Jonson", 'health', 158.00, 2.4, 0.5, 0.16, 0.002, 15, 0.032, "Medikamente und Medizintechnik."],
  ["BAYR", "Beyer AG", 'health', 26.00, 0.98, 1.0, 0.4, 0.007, 6, 0.004, "Pharma, Pflanzenschutz und Saatgut."],
  ["MRCK", "Merk KGaA", 'health', 150.00, 0.13, 0.8, 0.26, 0.003, 18, 0.015, "Pharma, Laborbedarf und Spezialchemie."],
  ["CATX", "Caterpiller Inc.", 'ind', 360.00, 0.48, 1.1, 0.28, 0.003, 17, 0.016, "Bagger, Bergbau- und Baumaschinen."],
  ["BOEG", "Boing Co.", 'ind', 175.00, 0.75, 1.3, 0.38, 0.006, -1, 0, "Verkehrsflugzeuge und Rüstung."],
  ["DHLX", "DHL Logistik", 'ind', 38.00, 1.2, 1.0, 0.26, 0.004, 13, 0.05, "Paket- und Expresslogistik weltweit."],
  ["SCHN", "Schnyder Electric", 'ind', 236.00, 0.57, 1.1, 0.26, 0.003, 30, 0.016, "Elektrotechnik für Rechenzentren und Gebäude."],
  ["VZNX", "Verizan Comm.", 'tel', 40.00, 4.2, 0.4, 0.17, 0.002, 9, 0.066, "Mobilfunk und Glasfaser in den USA."],
  ["LINX", "Lindt Gas plc", 'chem', 430.00, 0.48, 0.8, 0.2, 0.002, 33, 0.013, "Industriegase für Stahl, Medizin und Chips."],
  ["VNVX", "Vonovio SE", 'realty', 28.00, 0.82, 1.0, 0.3, 0.005, 14, 0.04, "Größter Wohnungsvermieter Europas."],
  ["PLDX", "Prologix Inc.", 'realty', 112.00, 0.93, 1.0, 0.26, 0.003, 30, 0.034, "Logistikhallen und Lagerzentren."],
  ["DWNX", "Deutsche Wohnwert AG", 'realty', 22.00, 0.4, 1.0, 0.32, 0.006, 16, 0.03, "Wohnungen in Berlin und Großstädten."]
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
  { id: 'million', name: 'Millionär', desc: 'Erreiche 1 Mio. € Gesamtvermögen.', reward: 10000 },
  { id: 'takeover', name: 'Übernahme-Profi', desc: 'Übernimm ein komplettes Unternehmen und nimm es von der Börse.', reward: 50000 },
  { id: 'ipo', name: 'Börsengang', desc: 'Bring ein eigenes Unternehmen wieder an die Börse.', reward: 50000 },
  { id: 'founder', name: 'Gründer', desc: 'Gründe dein eigenes Startup.', reward: 500 },
  { id: 'pmf', name: 'Product-Market Fit', desc: 'Erreiche 80 % Product-Market Fit.', reward: 2500 },
  { id: 'arr1m', name: 'Erste Million', desc: 'Erreiche 1 Mio. € wiederkehrenden Jahresumsatz (ARR).', reward: 10000 },
  { id: 'unicorn', name: 'Einhorn', desc: 'Dein Startup wird mit mindestens 1 Mrd. € bewertet.', reward: 50000 },
  { id: 'ownipo', name: 'Glocke geläutet', desc: 'Bring dein eigenes Startup an die Börse.', reward: 50000 },
  { id: 'exit', name: 'Exit', desc: 'Verkaufe dein Startup an einen Konzern.', reward: 25000 }
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
  RHST: { g: 0.30, psr: 2.6, fy: 1 }, LUFZ: { g: 0.04, psr: 0.2, fy: 2 }, BSFA: { g: -0.01, psr: 0.6, fy: 0 }, CBZE: { g: 0.35, psr: 8, fy: 1 },
  KRNH: { g: 0.02, psr: 0.9, fy: 2 }, RTST: { g: 0.03, psr: 0.35, fy: 0 }, MDVO: { g: 0.12, psr: 2.8, fy: 1 }, NWDT: { g: 0.18, psr: 1.1, fy: 2 },
  OKRL: { g: 0.09, psr: 8, fy: 0 }, SLSF: { g: 0.1, psr: 7, fy: 1 }, ADOB: { g: 0.1, psr: 11, fy: 2 }, SPTF: { g: 0.16, psr: 4.5, fy: 0 }, UBRX: { g: 0.17, psr: 3.5, fy: 1 }, ZLND: { g: 0.06, psr: 0.75, fy: 2 }, TSMK: { g: 0.28, psr: 10, fy: 0 }, ASMR: { g: 0.12, psr: 9.5, fy: 1 }, INTL: { g: -0.04, psr: 1.9, fy: 2 }, AMDX: { g: 0.22, psr: 9, fy: 0 }, INFN: { g: 0.05, psr: 2.8, fy: 1 }, MBNZ: { g: -0.01, psr: 0.45, fy: 2 }, PRSH: { g: 0.02, psr: 1.4, fy: 0 }, BYDX: { g: 0.25, psr: 1.1, fy: 1 }, GSAC: { g: 0.06, psr: 3.8, fy: 2 }, BRKS: { g: 0.06, psr: 2.7, fy: 0 }, MCHR: { g: 0.04, psr: 0.9, fy: 1 }, PAYP: { g: 0.07, psr: 2.2, fy: 2 }, MCDO: { g: 0.05, psr: 8, fy: 0 }, LVMX: { g: 0.06, psr: 3.8, fy: 1 }, WMRT: { g: 0.05, psr: 1.0, fy: 2 }, NKEE: { g: 0.03, psr: 2.2, fy: 0 }, STBX: { g: 0.05, psr: 3.0, fy: 1 }, TTEN: { g: 0.0, psr: 0.65, fy: 2 }, NEXE: { g: 0.08, psr: 5.5, fy: 0 }, EONX: { g: 0.03, psr: 0.38, fy: 1 }, RWEX: { g: 0.05, psr: 1.0, fy: 2 }, LLLY: { g: 0.3, psr: 18, fy: 1 }, JNJX: { g: 0.04, psr: 4.3, fy: 2 }, BAYR: { g: -0.01, psr: 0.55, fy: 0 }, MRCK: { g: 0.04, psr: 0.9, fy: 1 }, CATX: { g: 0.03, psr: 2.6, fy: 2 }, BOEG: { g: 0.08, psr: 1.6, fy: 0 }, DHLX: { g: 0.03, psr: 0.55, fy: 1 }, SCHN: { g: 0.1, psr: 3.6, fy: 2 }, VZNX: { g: 0.01, psr: 1.2, fy: 0 }, LINX: { g: 0.05, psr: 6.2, fy: 1 }, VNVX: { g: 0.03, psr: 6.5, fy: 2 }, PLDX: { g: 0.07, psr: 13, fy: 0 }, DWNX: { g: 0.02, psr: 5.5, fy: 1 }
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
  CBZE: 'Größte Kryptobörse. Verdient an jedem Bitcoin-Trade – und bricht ein, wenn die Kryptowelt kriselt.',
  KRNH: 'Seit 1874 in Familienhand, solide Dividende, kaum Wachstum. Klein genug, um sie komplett zu kaufen.',
  RTST: 'Zyklischer Stahlkocher: leidet unter Billigimporten aus Fernost und jubelt über jeden Schutzzoll.',
  MDVO: 'Wachsender Diagnostik-Spezialist mit guten Margen. Ein beliebtes Ziel für Finanzinvestoren.',
  NWDT: 'Volle Auftragsbücher dank Energiewende, aber Bauteile kommen aus Asien – Zölle treffen die Marge.',
  OKRL: "Jede Bank und jede Airline speichert ihre Daten in Orakel-Datenbanken. Der Wechsel kostet so viel, dass kaum jemand ihn wagt.",
  SLSF: "Erfand das Abo-Modell für Unternehmenssoftware. Wächst langsamer als früher und kauft dafür ständig Konkurrenten auf.",
  ADOB: "Ohne Adobo-Programme gäbe es keine Werbung und keine Magazine. Die große Sorge: KI-Bildgeneratoren machen das Handwerk billiger.",
  SPTF: "Die Musik-App mit 600 Millionen Nutzern. Nach Jahren mit Verlusten verdient sie endlich Geld – die Börse feiert jede Preiserhöhung.",
  UBRX: "Vom Geldverbrenner zur Gewinnmaschine. Robotaxis könnten das Geschäft revolutionieren – oder überflüssig machen.",
  ZLND: "Bestellt, anprobiert, zurückgeschickt: Retouren sind der größte Kostenblock. Hängt stark an der Kauflaune der Konsumenten.",
  TSMK: "Fertigt die Chips für Mvidia, Pear und Co. Technisch kaum einholbar – aber jede geopolitische Spannung in Fernost drückt auf den Kurs.",
  ASMR: "Baut Maschinen so groß wie ein Bus, ohne die kein moderner Chip entsteht. Exportverbote nach Fernost treffen den Umsatz direkt.",
  INTL: "Der einstige Chip-König kämpft mit Verlusten und baut milliardenschwere Fabriken. Subventionen und Zölle entscheiden über das Comeback.",
  AMDX: "Der ewige Zweite hinter Mvidia und Intal – mit Chips, die immer öfter besser sind. Entsprechend hoch die Erwartungen.",
  INFN: "Steckt in jedem E-Auto und jedem Windrad. Läuft die Autoindustrie schlecht, spürt Infinion das sofort.",
  MBNZ: "Der Stern auf der Haube verkauft sich vor allem in Asien und den USA – genau dort, wo Zölle drohen. Dafür gibt es eine hohe Dividende.",
  PRSH: "Hohe Margen, treue Kunden – aber das Elektro-Geschäft läuft schleppend und China kauft weniger Luxusautos.",
  BYDX: "Baut mehr Elektroautos als jeder andere und drängt nach Europa. Schutzzölle gegen Fernost sind das größte Risiko.",
  GSAC: "Verdient an Börsengängen, Übernahmen und Handel. Gute Börsenjahre sind gute Goldmann-Jahre – und umgekehrt.",
  BRKS: "Der legendäre Investor kauft seit Jahrzehnten ganze Firmen und behält sie für immer. Zahlt nie Dividende – und sitzt auf einem Berg Cash.",
  MCHR: "Versichert die Versicherer. Hohe Zinsen bringen mehr Ertrag auf die Rücklagen, schwere Stürme kosten Milliarden.",
  PAYP: "Fast jeder hat ein Konto, aber Apple Pay und Co. jagen Marktanteile. Billig bewertet, weil keiner an Wachstum glaubt.",
  MCDO: "Burger gehen immer – auch in der Krise. Gehört eigentlich zu den größten Immobilienbesitzern der Welt.",
  LVMX: "Über 70 Marken von Handtaschen bis Champagner. Hängt am Konsum reicher Chinesen und Amerikaner – Zölle treffen voll.",
  WMRT: "Der größte Händler der Welt profitiert, wenn Kunden sparen müssen. Zölle auf Importe aus Fernost verteuern sein Sortiment.",
  NKEE: "Lässt fast alles in Fernost produzieren. Jeder Zoll auf asiatische Importe frisst direkt in die Marge.",
  STBX: "Ein Latte für sieben Euro: Funktioniert, solange die Kunden sich das leisten wollen. Ein neuer Chef soll das Wachstum zurückbringen.",
  TTEN: "Verdient mit Öl und investiert in Wind und Solar. Hohe Dividende, schwankt mit dem Ölpreis.",
  NEXE: "Baut Wind- und Solarparks auf Kredit. Steigende Zinsen machen jedes Projekt teurer – fallende Zinsen beflügeln.",
  EONX: "Betreibt die Stromleitungen in halb Europa. Die Renditen sind vom Staat reguliert – sicher, aber langweilig.",
  RWEX: "Vom Kohlekonzern zum Ökostrom-Riesen. Verdient, wenn der Strompreis hoch ist.",
  LLLY: "Die Abnehmspritze hat Lilly zum wertvollsten Pharmakonzern der Welt gemacht. Jede Studie und jeder Preisdeckel bewegt den Kurs.",
  JNJX: "Erhöht seit über 60 Jahren die Dividende. Klagen wegen Babypuder belasten seit Jahren.",
  BAYR: "Eine teure Übernahme in den USA brachte Tausende Klagen. Die Dividende wurde auf fast null gekürzt – ein Sanierungsfall.",
  MRCK: "Ältestes Pharmaunternehmen der Welt, mehrheitlich in Familienbesitz. Beliefert auch die Chipindustrie.",
  CATX: "Gelbe Bagger auf jeder Baustelle der Welt. Ein Konjunkturbarometer: Läuft der Bau, läuft Caterpiller.",
  BOEG: "Qualitätsprobleme, Streiks, Milliardenverluste – aber die Auftragsbücher reichen für ein Jahrzehnt. Ein Comeback-Kandidat.",
  DHLX: "Transportiert den Welthandel. Zölle und schwacher Handel drücken die Mengen, der Onlinehandel stützt.",
  SCHN: "Liefert Kühlung und Stromverteilung für KI-Rechenzentren. Einer der großen Profiteure des Datenbooms.",
  VZNX: "Hohe Dividende, hohe Schulden, wenig Wachstum. Bewegt sich eher wie eine Anleihe – steigende Zinsen schaden.",
  LINX: "Liefert Sauerstoff und Wasserstoff per Pipeline – mit Verträgen über 15 Jahre. Kann Preissteigerungen fast immer weitergeben.",
  VNVX: "Besitzt über eine halbe Million Wohnungen, finanziert mit viel Schulden. Jede Zinserhöhung drückt auf die Bewertung.",
  PLDX: "Vermietet die Hallen, aus denen der Onlinehandel liefert. Profitiert vom Boom des Versandhandels, leidet unter hohen Zinsen.",
  DWNX: "Ein reiner Berlin-Wert: Mietendeckel-Debatten und Zinsen bestimmen den Kurs."
};

/* ---------- Wirtschaftliche Empfindlichkeiten ----------
   rate: Zinsempfindlichkeit (positiv = leidet unter steigenden Zinsen), infl: Preissetzungsmacht (positiv = profitiert von Inflation),
   cyc: Konjunkturabhängigkeit, home: Heimatmarkt (eu/us), exp: Anteil Auslandsumsatz, sc: Abhängigkeit von Importen/Lieferketten */
export const SECTOR_SENS = {
  tech: { rate: 1.4, infl: -0.3, cyc: 0.8 }, semi: { rate: 1.3, infl: -0.2, cyc: 1.3 }, auto: { rate: 0.6, infl: -0.5, cyc: 1.5 },
  fin: { rate: -0.8, infl: 0.2, cyc: 1.0 }, cons: { rate: 0.4, infl: 0.2, cyc: 0.6 }, energy: { rate: 0.2, infl: 1.2, cyc: 0.7 },
  health: { rate: 0.5, infl: 0.2, cyc: 0.2 }, ind: { rate: 0.5, infl: 0.1, cyc: 1.2 }, tel: { rate: 0.9, infl: 0.1, cyc: 0.3 }, chem: { rate: 0.4, infl: -0.4, cyc: 1.3 },
  util: { rate: 1.1, infl: 0.3, cyc: 0.3 }, realty: { rate: 1.8, infl: 0.4, cyc: 0.7 }
};
export const COMPANY_SENS = {
  MVDA: { home: 'us', exp: 0.55, sc: 0.8 }, PEAR: { home: 'us', exp: 0.5, sc: 0.9 }, MHRD: { home: 'us', exp: 0.4, sc: 0.2 }, ABET: { home: 'us', exp: 0.45, sc: 0.1 },
  AMZS: { home: 'us', exp: 0.3, sc: 0.6 }, TSLR: { home: 'us', exp: 0.4, sc: 0.4, rate: 1.6 }, MTVR: { home: 'us', exp: 0.5, sc: 0.3 }, SAPF: { home: 'eu', exp: 0.6, sc: 0.1 },
  SIMZ: { home: 'eu', exp: 0.6, sc: 0.3 }, ALNX: { home: 'eu', exp: 0.3, sc: 0 }, DBNK: { home: 'eu', exp: 0.3, sc: 0 }, VWGN: { home: 'eu', exp: 0.55, sc: 0.5 },
  BMVW: { home: 'eu', exp: 0.6, sc: 0.5 }, ADBS: { home: 'eu', exp: 0.65, sc: 0.8 }, NSTL: { home: 'eu', exp: 0.7, sc: 0.2, infl: 0.5 }, KOKA: { home: 'us', exp: 0.6, sc: 0.1, infl: 0.6 },
  EXXF: { home: 'us', exp: 0.4, sc: 0.1 }, SHLL: { home: 'eu', exp: 0.5, sc: 0.1 }, PFZR: { home: 'us', exp: 0.45, sc: 0.3 }, NVNO: { home: 'eu', exp: 0.6, sc: 0.2, infl: 0.6 },
  ABZZ: { home: 'eu', exp: 0.6, sc: 0.4 }, TTEL: { home: 'eu', exp: 0.2, sc: 0.3 }, QNTX: { home: 'us', exp: 0.3, sc: 0.5, rate: 2.5 }, SOLR: { home: 'eu', exp: 0.1, sc: 0.9, rate: 2.0 },
  NTFX: { home: 'us', exp: 0.5, sc: 0 }, JPMG: { home: 'us', exp: 0.2, sc: 0 }, VIZZ: { home: 'us', exp: 0.45, sc: 0 }, HRMZ: { home: 'eu', exp: 0.75, sc: 0.1, infl: 0.8 },
  RHST: { home: 'eu', exp: 0.3, sc: 0.2, cyc: 0.2 }, LUFZ: { home: 'eu', exp: 0.4, sc: 0.1, infl: -0.8 }, BSFA: { home: 'eu', exp: 0.55, sc: 0.3 }, CBZE: { home: 'us', exp: 0.3, sc: 0, rate: 1.8 },
  KRNH: { home: 'eu', exp: 0.1, sc: 0.1, infl: 0.3 }, RTST: { home: 'eu', exp: 0.35, sc: 0.3, steel: 1 }, MDVO: { home: 'eu', exp: 0.5, sc: 0.3 }, NWDT: { home: 'eu', exp: 0.4, sc: 0.6, rate: 1.2 },
  OKRL: { home: "us", exp: 0.45, sc: 0.1 },
  SLSF: { home: "us", exp: 0.35, sc: 0.05 },
  ADOB: { home: "us", exp: 0.45, sc: 0.05 },
  SPTF: { home: "eu", exp: 0.75, sc: 0.05 },
  UBRX: { home: "us", exp: 0.35, sc: 0.2 },
  ZLND: { home: "eu", exp: 0.6, sc: 0.7 },
  TSMK: { home: "asia", exp: 0.8, sc: 0.3 },
  ASMR: { home: "eu", exp: 0.85, sc: 0.3 },
  INTL: { home: "us", exp: 0.5, sc: 0.4 },
  AMDX: { home: "us", exp: 0.55, sc: 0.8 },
  INFN: { home: "eu", exp: 0.75, sc: 0.4 },
  MBNZ: { home: "eu", exp: 0.7, sc: 0.5 },
  PRSH: { home: "eu", exp: 0.75, sc: 0.4 },
  BYDX: { home: "asia", exp: 0.35, sc: 0.2 },
  GSAC: { home: "us", exp: 0.4, sc: 0 },
  BRKS: { home: "us", exp: 0.2, sc: 0.1 },
  MCHR: { home: "eu", exp: 0.6, sc: 0 },
  PAYP: { home: "us", exp: 0.45, sc: 0 },
  MCDO: { home: "us", exp: 0.55, sc: 0.1, infl: 0.5 },
  LVMX: { home: "eu", exp: 0.8, sc: 0.2, infl: 0.7 },
  WMRT: { home: "us", exp: 0.15, sc: 0.6 },
  NKEE: { home: "us", exp: 0.6, sc: 0.9 },
  STBX: { home: "us", exp: 0.35, sc: 0.3 },
  TTEN: { home: "eu", exp: 0.6, sc: 0.1 },
  NEXE: { home: "us", exp: 0.05, sc: 0.6 },
  EONX: { home: "eu", exp: 0.2, sc: 0.2 },
  RWEX: { home: "eu", exp: 0.35, sc: 0.4 },
  LLLY: { home: "us", exp: 0.4, sc: 0.2, infl: 0.6 },
  JNJX: { home: "us", exp: 0.45, sc: 0.2 },
  BAYR: { home: "eu", exp: 0.7, sc: 0.3 },
  MRCK: { home: "eu", exp: 0.8, sc: 0.3 },
  CATX: { home: "us", exp: 0.55, sc: 0.4 },
  BOEG: { home: "us", exp: 0.5, sc: 0.4 },
  DHLX: { home: "eu", exp: 0.7, sc: 0.2 },
  SCHN: { home: "eu", exp: 0.75, sc: 0.4 },
  VZNX: { home: "us", exp: 0.0, sc: 0.3 },
  LINX: { home: "eu", exp: 0.7, sc: 0.1, infl: 0.6 },
  VNVX: { home: "eu", exp: 0.0, sc: 0.0 },
  PLDX: { home: "us", exp: 0.3, sc: 0.0 },
  DWNX: { home: "eu", exp: 0.0, sc: 0.0 }
};
export const sensOf = x => Object.assign({ home: 'eu', exp: 0.4, sc: 0.3 }, SECTOR_SENS[x.sector] || { rate: 0.5, infl: 0, cyc: 1 }, COMPANY_SENS[x.id] || {}, x.sens || {});
export const REGION = { eu: 'Europa', us: 'USA', asia: 'Fernost' };

/* ---------- Politik: Storylines mit Vorlauf ----------
   p: Grundwahrscheinlichkeit, dass es wirklich kommt; die angezeigte Markt-Einschätzung weicht davon ab */
export const POLICIES = [
  { k: 'tariff', by: 'us', on: 'eu', sectors: ['auto', 'chem', 'ind', 'cons'], rate: [15, 30], p: 0.6, rumor: 'Wahlkampf in den USA: Kandidat droht mit {r} % Strafzöllen auf europäische Autos und Industriegüter', draft: 'US-Handelsministerium legt Zollliste vor: {r} % auf europäische Autos, Chemie und Maschinen', yes: 'USA verhängen {r} % Strafzölle auf europäische Autos und Industriegüter', no: 'USA verschieben die Strafzölle auf europäische Waren' },
  { k: 'tariff', by: 'us', on: 'asia', sectors: 'all', rate: [20, 50], p: 0.6, rumor: 'Washington erwägt {r} % Zölle auf alle Importe aus Fernost', draft: 'Gesetzentwurf: {r} % Importzoll auf Elektronik, Stahl und Konsumgüter aus Fernost', yes: 'USA verhängen {r} % Zölle auf Importe aus Fernost', no: 'Kein Zoll auf Fernost-Importe: Weißes Haus lenkt ein' },
  { k: 'tariff', by: 'eu', on: 'us', sectors: ['tech', 'semi', 'cons', 'auto'], rate: [10, 25], p: 0.5, rumor: 'Brüssel prüft Gegenzölle von {r} % auf US-Waren', draft: 'EU-Kommission veröffentlicht Gegenzoll-Liste: {r} % auf US-Technik, Autos und Konsumgüter', yes: 'EU antwortet mit {r} % Gegenzöllen auf US-Waren', no: 'EU verzichtet vorerst auf Gegenzölle' },
  { k: 'tariff', by: 'eu', on: 'asia', sectors: ['ind', 'energy', 'auto'], rate: [15, 35], p: 0.55, rumor: 'EU erwägt Schutzzölle von {r} % gegen Billigstahl, Solarmodule und E-Autos aus Fernost', draft: 'Antidumping-Verfahren: EU schlägt {r} % Zoll auf Stahl, Solarmodule und E-Autos aus Fernost vor', yes: 'EU verhängt {r} % Schutzzölle auf Stahl, Solarmodule und E-Autos aus Fernost', no: 'EU lässt Schutzzölle gegen Fernost fallen' },
  { k: 'deal', p: 0.55, rumor: 'Hinter verschlossenen Türen: Unterhändler sprechen über ein Ende des Zollstreits', draft: 'Durchbruch in Sicht: Rahmenabkommen zum Abbau der Zölle liegt vor', yes: 'Handelsabkommen unterzeichnet: Zölle werden halbiert', no: 'Zollgespräche ohne Ergebnis abgebrochen' },
  { k: 'stimulus', size: 500, sectors: ['ind', 'semi', 'tech', 'energy'], p: 0.65, rumor: 'Regierung plant angeblich 500-Mrd.-Programm für Infrastruktur und KI', draft: 'Kabinett beschließt Entwurf: 500 Mrd. € für Infrastruktur, Netze und KI-Rechenzentren', yes: 'Parlament verabschiedet 500-Mrd.-Infrastruktur- und KI-Programm', no: 'Konjunkturpaket scheitert im Parlament' },
  { k: 'taxcut', p: 0.55, rumor: 'Koalition diskutiert Senkung der Unternehmenssteuer von 30 auf 25 %', draft: 'Gesetzentwurf: Unternehmenssteuer soll auf 25 % sinken', yes: 'Steuerreform beschlossen: Unternehmenssteuer sinkt auf 25 %', no: 'Steuerreform vertagt' },
  { k: 'dereg', sectors: ['fin', 'energy'], p: 0.6, rumor: 'Regierung will Banken- und Energieregeln lockern', draft: 'Deregulierungspaket für Banken und Energie liegt vor', yes: 'Deregulierung beschlossen: weniger Kapitalvorschriften und schnellere Genehmigungen', no: 'Deregulierung scheitert am Widerstand der Aufsicht' },
  { k: 'antitrust', ids: ['ABET', 'MHRD', 'MTVR', 'AMZS', 'PEAR'], p: 0.5, rumor: 'Wettbewerbshüter nehmen {n} ins Visier', draft: 'Kartellbehörde leitet förmliches Verfahren gegen {n} ein', yes: 'Kartellstrafe: {n} muss Milliarden zahlen und Geschäftsbereiche abtrennen', no: 'Kartellverfahren gegen {n} eingestellt' },
  { k: 'exportban', ids: ['MVDA', 'QNTX'], sectors: ['semi'], p: 0.55, rumor: 'Berichte: Regierung plant Exportverbot für KI-Chips nach Fernost', draft: 'Exportkontrolle: Liste mit verbotenen Chip-Lieferungen nach Fernost veröffentlicht', yes: 'Exportverbot für Hochleistungs-Chips nach Fernost tritt in Kraft', no: 'Exportverbot für KI-Chips abgewendet' },
  { k: 'defense', ids: ['RHST', 'ABZZ', 'SIMZ'], p: 0.7, rumor: 'NATO-Gipfel: Verteidigungsausgaben sollen auf 3,5 % steigen', draft: 'Haushaltsentwurf sieht Verdopplung des Verteidigungsetats vor', yes: 'Parlament beschließt Rekord-Verteidigungsetat', no: 'Verteidigungsetat wird gekürzt' }
];

/* ---------- Vermögensstufen ---------- */
export const TIERS = [
  { name: 'Kleinanleger', min: 0, credit: 1, acq: 0, margin: 0.030, terms: [3], hint: false, feeRate: 0.0005, perks: ['Sparpläne und Dividenden-Wiederanlage', 'Zinsen auf dein Guthaben', 'Wertpapierkredit zu Leitzins + 3,0 %'] },
  { name: 'Aktiver Trader', min: 25000, credit: 1, acq: 0, margin: 0.025, terms: [3, 6, 12], hint: false, feeRate: 0.0005, perks: ['Wertpapierkredit zu Leitzins + 2,5 %', 'Festgeld über 6 und 12 Monate', 'Erweiterte Risikoanalyse (Beta, Volatilität)'] },
  { name: 'Fondsmanager', min: 250000, credit: 1, acq: 0.25, margin: 0.020, terms: [3, 6, 12], hint: false, phase: true, feeRate: 0.0004, perks: ['Unternehmenskredit bis 25 % des Vermögens', 'Wertpapierkredit zu Leitzins + 2,0 %', 'Marktphasen-Radar, Ordergebühr 0,04 %'] },
  { name: 'Investor', min: 2500000, credit: 1, acq: 0.5, margin: 0.015, terms: [3, 6, 12], hint: true, phase: true, feeRate: 0.0003, perks: ['Unternehmenskredit bis 50 % des Vermögens', 'Analystentendenz vor jeder Quartalsbilanz', 'Wertpapierkredit zu Leitzins + 1,5 %'] },
  { name: 'Finanz-Tycoon', min: 25000000, credit: 1, acq: 1, margin: 0.010, terms: [3, 6, 12], hint: true, phase: true, feeRate: 0.0002, perks: ['Unternehmenskredit bis 100 % des Vermögens', 'Wertpapierkredit zu Leitzins + 1,0 %', 'Ordergebühr 0,02 %'] }
];
export const TIER_REWARD = [0, 1000, 5000, 20000, 50000];
// Beleihungswerte für den Wertpapierkredit
export const LOMBARD = { stock: 0.5, etf: 0.6, fund: 0.5, bond: 0.8 }; // Grobwerte (für Altdaten); genaue Quoten je Wert in credit.js
// Großaktionärs-Schwellen (Anteil an allen Aktien)
export const OWNER = [
  { min: 0.01, name: 'Investor-Relations-Zugang', div: 0, hint: 0.7, perk: 'Tendenz vor jeder Quartalsbilanz' },
  { min: 0.05, name: 'Meldepflichtiger Großaktionär', div: 0, hint: 0.8, deep: true, perk: 'Tiefere Bilanz-Einblicke und Übernahmeangebot möglich' },
  { min: 0.25, name: 'Sperrminorität', div: 0, hint: 0.9, deep: true, vote: true, perk: 'Aufsichtsratssitz: Du stimmst über Dividende oder Reinvestition ab' },
  { min: 0.501, name: 'Mehrheitsaktionär', div: 0, hint: 0.95, deep: true, vote: true, perk: 'Kontrolle: Übernahme und Rückzug von der Börse möglich' }
];
export const BID_MIN_SHARE = 0.05;    // Übernahmeangebot ab 5 % Beteiligung
export const LBO_SPREAD = 0.045;      // Übernahmekredit: Leitzins + 4,5 %
export const LBO_MAX_X = 4.5;         // höchstens 4,5 × operativer Jahresgewinn (EBIT)
export const LBO_MAX_SHARE = 0.6;     // höchstens 60 % des Kaufpreises
export const PE_STRATS = {
  cost: { name: 'Kosten radikal senken', desc: 'Marge +4 Prozentpunkte über zwei Quartale, Wachstum −3 Punkte für ein Jahr, einmalig 2 % des Umsatzes für Abfindungen.' },
  rnd: { name: 'KI- und F&E-Offensive', desc: 'Marge −3 Punkte für drei Quartale. Mit etwa 70 % Wahrscheinlichkeit danach +6 Punkte Wachstum über anderthalb Jahre.' },
  price: { name: 'Preise erhöhen', desc: 'Marge +3 Punkte, Wachstum −2 Punkte. Bei schlechtem Konsumklima springen Kunden stärker ab.' },
  special: { name: 'Sonderdividende ausschütten', desc: 'Das Unternehmen nimmt Kredit bis 3,5 × EBIT auf und schüttet das Geld an dich aus – zum Beispiel, um deine eigenen Kredite zu tilgen.' }
};
export const DEPOSIT_PREMIUM = { 3: 0.002, 6: 0.004, 12: 0.006 }; // Aufschlag aufs Festgeld über dem Leitzins
export const CASH_RATE_CAP = 100000; // Guthabenzinsen bis zu diesem Betrag

/* ---------- Marktphasen ---------- */
// mu: Marktrendite p. a., vol: Schwankungsfaktor, infl: Inflationsziel, tilt: Sektor-Rückenwind p. a., dur: Dauer in Handelstagen
export const REGIMES = {
  bull: { name: 'Bullenmarkt', mu: 0.18, vol: 0.85, infl: 2.4, dur: [30, 70], next: { side: 0.5, infl: 0.35, rec: 0.15 }, tilt: { tech: 0.05, semi: 0.1, cons: 0.03, ener: 0, prec: -0.05 }, desc: 'Steigende Kurse, gute Stimmung, niedrige Schwankungen. Wachstumswerte laufen besonders gut.' },
  side: { name: 'Seitwärtsphase', mu: 0.03, vol: 0.85, infl: 2.2, dur: [20, 50], next: { bull: 0.5, infl: 0.25, hike: 0.25 }, tilt: { health: 0.04, tel: 0.04 }, desc: 'Der Markt pendelt ohne klare Richtung. Dividenden und Zinsen tragen den Großteil der Rendite.' },
  infl: { name: 'Inflationsschub', mu: -0.02, vol: 1.1, infl: 5.0, dur: [20, 45], next: { hike: 0.7, side: 0.3 }, tilt: { energy: 0.15, fin: 0.05, tech: -0.1, semi: -0.1, ener: 0.2, prec: 0.15, metal: 0.1, agri: 0.1 }, desc: 'Preise steigen schneller als erwartet. Rohstoffe und Energie profitieren, teure Wachstumsaktien leiden.' },
  hike: { name: 'Zinswende', mu: -0.06, vol: 1.2, infl: 3.0, dur: [15, 35], next: { rec: 0.55, side: 0.45 }, tilt: { fin: 0.08, tech: -0.12, energy: 0.0, ind: -0.04, prec: -0.05, realty: -0.12, util: -0.05 }, desc: 'Die Zentralbank erhöht die Zinsen deutlich. Anleihen verlieren, Banken gewinnen, Hochbewertete fallen.' },
  rec: { name: 'Rezession', mu: -0.28, vol: 1.6, infl: 1.2, dur: [15, 40], next: { recov: 1 }, tilt: { health: 0.1, cons: 0.06, tel: 0.06, util: 0.06, realty: -0.06, auto: -0.15, ind: -0.1, fin: -0.08, ener: -0.2, metal: -0.15, prec: 0.12 }, desc: 'Die Wirtschaft schrumpft, Kurse fallen kräftig. Wer Geld übrig hat, kauft jetzt günstig nach.' },
  recov: { name: 'Erholung', mu: 0.28, vol: 1.1, infl: 1.8, dur: [20, 45], next: { bull: 1 }, tilt: { auto: 0.15, ind: 0.1, semi: 0.1, fin: 0.08, metal: 0.1, ener: 0.08, realty: 0.08 }, desc: 'Nach dem Tief geht es schnell wieder aufwärts. Zyklische Werte erholen sich am stärksten.' }
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
  { sector: 'tel', title: 'Frequenzauktion für den neuen Mobilfunkstandard' },
  { sector: 'util', title: 'Netzagentur legt die erlaubten Renditen für Stromnetze fest' },
  { sector: 'realty', title: 'Bundestag stimmt über schärfere Mietpreisbremse ab' }
];
export const RUMORS = [
  { txt: '{n} prüft angeblich Übernahmeangebot eines Finanzinvestors', yes: '{n} bestätigt Übernahmeangebot mit {p} % Aufschlag', no: '{n} dementiert Übernahmegerüchte', up: [0.04, 0.12] },
  { txt: 'Insider: {n} steht kurz vor einem Großauftrag', yes: '{n} meldet Rekordauftrag', no: '{n}: Großauftrag geplatzt', up: [0.03, 0.06] },
  { txt: 'Medienbericht: {n} plant Sonderdividende', yes: '{n} kündigt Sonderdividende an', no: '{n}: Keine Sonderdividende geplant', up: [0.02, 0.04] },
  { txt: 'Gerücht: {n} droht hohe Strafe der Wettbewerbsbehörde', yes: 'Behörde verhängt Milliardenstrafe gegen {n}', no: '{n}: Wettbewerbsverfahren eingestellt', up: [-0.06, -0.03] }
];



/* ---------- Ventures: Spieler-Startups ----------
   Zeit: ein Startup-Quartal dauert je nach Phase 5–21 Handelstage, nach dem Börsengang gilt der normale Quartalstakt.
   Geldwerte pro Startup-Jahr (ARR = Jahresumsatz aus laufenden Verträgen). */
export const BIZ_MODELS = {
  saas: { name: 'B2B Enterprise SaaS', sub: 'KI & Software für Unternehmen', sector: 'tech', hyper: true, why: 'Software kostet pro zusätzlichem Kunden fast nichts (Grenzkosten nahe null). Wachstum begrenzen nur Vertrieb und Kapital.', pro: 'Treue Kunden (niedriger Churn), hohe Bruttomarge, planbare Umsätze', con: 'Langsame Verkaufszyklen am Anfang, teure Kundengewinnung', gm: 0.80, churn: 0.035, cac: 2400, arpu: 6000, conv: 0.85, net: 0.6, tam: 1.5e9, mult: 7.5, matM: 0.32, moat: 0.35, pace: 1.0, ipoArr: 60000000, sens: { rate: 1.5, cons: 0.2, tar: 0.1, reg: 0.4 } },
  b2c: { name: 'B2C Consumer-Plattform', sub: 'App, Community, Marktplatz für Endkunden', sector: 'tech', hyper: true, why: 'Jeder neue Nutzer macht die Plattform für alle anderen wertvoller (Netzwerkeffekt), Server kosten pro Nutzer nur Cent.', pro: 'Explosives Nutzerwachstum, starke Netzwerkeffekte', con: 'Hoher Marketing- und Server-Burn, Kunden springen bei schlechter Konsumlaune ab', gm: 0.60, churn: 0.16, cac: 8, arpu: 36, conv: 1.0, net: 1.0, tam: 2e9, mult: 6, matM: 0.25, moat: 0.25, pace: 0.8, ipoArr: 50000000, sens: { rate: 1.3, cons: 1.0, tar: 0.1, reg: 0.7 } },
  fintech: { name: 'Fintech / Marktplatz', sub: 'Zahlungen, Kredite, Handel – Verdienst über Transaktionen', sector: 'fin', hyper: true, why: 'Digitale Transaktionen skalieren fast ohne Zusatzkosten. Mehr Händler ziehen mehr Kunden an und umgekehrt.', pro: 'Verdient an jedem Umsatz mit (Take-Rate), profitiert von Zinsen und Boomphasen', con: 'Bei Dominanz drohen Regulierung und Kartellverfahren', gm: 0.55, churn: 0.07, cac: 40, arpu: 220, conv: 0.9, net: 0.8, tam: 1.2e9, mult: 9, matM: 0.30, moat: 0.3, pace: 1.0, ipoArr: 60000000, sens: { rate: -0.2, cons: 0.6, tar: 0.1, reg: 1.0 } },
  deeptech: { name: 'DeepTech / Hardware', sub: 'Chips, Robotik, Sensoren', sector: 'semi', hyper: false, why: 'Jedes Gerät muss gebaut werden: Fabriken, Lieferketten und Importzölle begrenzen das Tempo. Wachstum kommt stufenweise über Investitionen (CapEx).', pro: 'Starke Patente (Burggraben), hohe Margen im Reifestadium, Subventionen', con: 'Kapazität muss erst gebaut werden, Zölle verteuern Bauteile', gm: 0.38, churn: 0.025, cac: 12000, arpu: 30000, conv: 0.8, net: 0.1, tam: 2e9, mult: 7.5, matM: 0.42, moat: 0.75, cap: { unit: 60, cost: 20000, q: 1 }, subsidy: ['semi', 'ind', 'tech'], pace: 1.25, ipoArr: 40000000, sens: { rate: 0.9, cons: 0.2, tar: 1.0, reg: 0.2 } },
  cleantech: { name: 'CleanTech / Energie', sub: 'Speicher, Wasserstoff, Solar- und Windtechnik', sector: 'energy', hyper: false, why: 'Anlagen und Projekte brauchen Material, Genehmigungen und Finanzierung – Wachstum kommt Projekt für Projekt.', pro: 'Lange Lieferverträge, starke Subventionen, Preissetzungsmacht bei hohen Energiepreisen', con: 'Sehr zinsempfindlich, Zölle auf Komponenten aus Fernost', gm: 0.40, churn: 0.02, cac: 11000, arpu: 40000, conv: 0.8, net: 0.05, tam: 2e9, mult: 11, matM: 0.38, moat: 0.6, cap: { unit: 50, cost: 30000, q: 1 }, subsidy: ['energy', 'ind'], pace: 1.4, ipoArr: 40000000, sens: { rate: 1.6, cons: 0.1, tar: 0.7, reg: 0.3 } },
  biotech: { name: 'Biotech / Pharma', sub: 'Wirkstoffe, Diagnostik, Medizintechnik', sector: 'health', hyper: false, why: 'Klinische Studien und Zulassungen bestimmen das Tempo – kein Geld der Welt beschleunigt eine Studie beliebig.', pro: 'Patentschutz für viele Jahre, sehr hohe Margen nach der Zulassung', con: 'Umsatz erst nach erfolgreicher Studie, Rückschläge möglich', gm: 0.75, churn: 0.02, cac: 20000, arpu: 60000, conv: 0.7, net: 0.05, tam: 1.5e9, mult: 7.5, matM: 0.45, moat: 0.9, cap: { unit: 80, cost: 40000, q: 1 }, trial: true, subsidy: ['health'], pace: 1.6, ipoArr: 40000000, sens: { rate: 1.0, cons: 0, tar: 0.2, reg: 0.5 } }
};
// Phasen: ARR-Schwelle, Liquiditätsfaktor fürs Nettovermögen, Beleihungsquote, Dauer eines Startup-Quartals in Handelstagen
export const VENTURE_STAGES = [
  { k: 'garage', name: 'Garage & Bootstrapping', min: 0, liq: 0.60, ltv: 0, qd: 5, base: 900 },
  { k: 'traction', name: 'Traction & Disruption', min: 100000, liq: 0.75, ltv: 0, qd: 5, base: 30000 },
  { k: 'scale', name: 'Scale-Up & Hyperscaling', min: 10000000, liq: 0.85, ltv: 0.20, qd: 10, base: 600000 },
  { k: 'ipo', name: 'Börsenreif', min: 60000000, liq: 0.85, ltv: 0.20, qd: 21, base: 2500000 }
];
export const VENTURE_MIN = 2500, VENTURE_SHARES = 1e8, IPO_MIN_QUARTERS = 4;
// Führungskräfte: zwei Archetypen je Rolle; Kosten je Startup-Quartal (skaliert mit Phase) oder Anteile (ESOP)
export const EXECS = {
  cto: { name: 'CTO / Produkt', a: [{ k: 'vision', name: '10x-Visionär', desc: 'PMF wächst schneller, F&E wirkt stärker – aber teurer und chaotischer.', fx: { pmf: 1.5, quality: -0.01 }, pay: 1.3 }, { k: 'eff', name: 'Effizienz-Experte', desc: 'Hält die Produktqualität stabil, halbiert den Stress beim Hyperscaling.', fx: { quality: 0.03, stress: 0.5 }, pay: 1 }] },
  growth: { name: 'VP Growth / Vertrieb', a: [{ k: 'vision', name: 'Growth-Hacker', desc: 'Kundengewinnung 25 % günstiger, Kunden etwas weniger treu.', fx: { cac: 0.75, churn: 1.1 }, pay: 1.2 }, { k: 'eff', name: 'Key-Account-Profi', desc: 'Etwas günstiger und deutlich treuere Kunden.', fx: { cac: 0.9, churn: 0.85 }, pay: 1 }] },
  cfo: { name: 'CFO / Deal-Maker', a: [{ k: 'vision', name: 'Deal-Maker', desc: '15 % höhere Bewertungen in Finanzierungsrunden und bei Übernahmeangeboten.', fx: { val: 1.15 }, pay: 1.2 }, { k: 'eff', name: 'Kostencontroller', desc: 'Fixkosten 15 % niedriger, längere Cash Runway.', fx: { opex: 0.85 }, pay: 1 }] },
  coo: { name: 'COO / Operations', a: [{ k: 'vision', name: 'Scale-Architekt', desc: 'Neue Kapazität ist ein Quartal schneller fertig und 20 % größer.', fx: { capQ: -1, capU: 1.2 }, pay: 1.2 }, { k: 'eff', name: 'Lean-Manager', desc: 'Fixkosten 10 % niedriger, Bruttomarge +3 Punkte.', fx: { opex: 0.9, gm: 0.03 }, pay: 1 }] }
};
export const EXEC_PAY = [4000, 45000, 220000, 450000]; // Gehalt je Startup-Quartal nach Phase
export const EXEC_ESOP = 0.03;                       // alternativ: 3 % Anteile aus dem Gründeranteil
export const VC_ROUNDS = [
  { k: 'seed', name: 'Seed', arr: 40000, pmf: 0.45, dil: [0.12, 0.2] },
  { k: 'a', name: 'Series A', arr: 900000, pmf: 0.6, dil: [0.15, 0.22] },
  { k: 'b', name: 'Series B', arr: 7000000, pmf: 0.7, dil: [0.12, 0.2] },
  { k: 'c', name: 'Series C', arr: 25000000, pmf: 0.75, dil: [0.1, 0.16] }
];
export const VC_NAMES = ['Sequoja Capital', 'Andreesen Horowitzz', 'Index Venturs', 'Accell Partners', 'Lakestar Ventures', 'Earlybird Capital', 'Balderton Kapital', 'Point Nein', 'HV Kapital', 'Northzone Partners'];
// Kampagnen gegen einen Rivalen: Kosten als Anteil der Startup-Kasse (mindestens), Wirkung über 2 Quartale
export const CAMPAIGNS = {
  price: { name: 'Preisbrecher-Offensive', desc: 'Kampfpreise und Wechselprämien: 40 % mehr Neukunden, ARPU −12 % für zwei Quartale. Der Rivale verliert Kunden – und schlägt oft mit einem Preiskampf zurück.', cost: 0.15 },
  poach: { name: 'Talent-Abwerbung', desc: 'Du wirbst Schlüsselleute ab: PMF +6 Punkte, der Rivale verliert an Innovationskraft.', cost: 0.12 },
  patent: { name: 'Patent-Offensive', desc: 'Du sicherst Technologie ab und klagst: Churn −20 % für zwei Quartale, beim Rivalen kostet das Gewinn. Stärker bei DeepTech und Biotech.', cost: 0.12 },
  pr: { name: 'PR- & Narrativ-Kampagne', desc: 'Medien, Konferenzen, Influencer: Kundengewinnung 25 % günstiger für zwei Quartale, Bewertung +10 % bis zur nächsten Runde.', cost: 0.1 }
};

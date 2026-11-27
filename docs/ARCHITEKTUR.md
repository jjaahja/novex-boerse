# NOVEX – Architektur und Umsetzungsplan (Ausbau Makro, Politik, Kredit, Übernahmen)

## Bestand (Analyse)

| Bereich | Umsetzung |
|---|---|
| Tech-Stack | Vanilla-JS-ES-Module ohne Build-Schritt. Cloudflare Worker + Durable Object (SQLite-Storage, WebSocket-Hibernation). |
| Ordner | `public/` (Browser + gemeinsame Logik), `public/ui/` (Ansichten), `src/worker.js` (Server). |
| State | Ein Markt-Objekt `M` (Kurse, Nachrichten, Termine) im Durable Object. Konten `A` getrennt je Spieler. Geheimes liegt in `M.sec` und geht nie an den Browser. |
| Simulations-Loop | `advanceTo()` → `step()` (Faktormodell: Markt × Beta + Sektor + Einzelwert, Phasen-Drift). Dazu die Hooks `gap`, `open`, `close`, `step` und `mark`, über die die Module angebunden sind. |
| Module | `engine.js` (Markt, Orderbuch, Derivate, Konten), `events.js` (Marktphasen, Zentralbank, Inflation, Quartalszahlen, Dividenden, Gerüchte), `wealth.js` (Zinsen, Festgeld, Sparpläne, Devisen, Kredit, Analyse). |
| UI | `store.js` (Zustand, Aktionen), `parts.js` (Zeilen, News), `chart.js`, `glossary.js` (Info-Popover), je Ansicht eine Datei unter `views/`. |

## Neue Module

1. **`public/macro.js`** – kausale Volkswirtschaft (`M.mac`), täglich bei Börsenöffnung:
   - BIP-Wachstum ← Marktphase, Konjunkturpakete, Zölle, Realzins, Konsumklima
   - Arbeitslosigkeit ← Okun-Gesetz
   - Konsumklima ← BIP, Inflation, Arbeitslosigkeit, Börse
   - Geldmenge ← Leitzins
   - Energie ← Ölpreis
   - Inflationstrend ← Konjunktur, Geldmenge, Energie, Zölle. Daraus kommen die Erwartung und das Ergebnis der VPI-Termine.
   - Taylor-Regel ← Inflation, BIP, Arbeitslosigkeit. Sie bestimmt die Wahrscheinlichkeiten beim Zinsentscheid.
   - Je Aktie wirken Sensitivitäten (Zins, Inflation/Preissetzungsmacht, Konjunktur, Zölle) als laufende Drift und als Schock bei Terminen.
   - Devisen reagieren auf die Zinsdifferenz, Zölle und das Konsumklima (Franken als sicherer Hafen).
2. **`public/politics.js`** – Politik-Storylines mit Vorlauf: Gerücht/Entwurf (mit Wahrscheinlichkeit) → Termin im Kalender → Entscheidung. Die Arten:
   - Zölle und Gegenzölle
   - Konjunkturpaket
   - Steuerreform
   - Deregulierung
   - Kartellverfahren
   - Exportverbot
   - Verteidigungsetat
   - Handelsabkommen

   Zölle sind dauerhafter Zustand (`M.pol.tar`) und wirken auf Margen (EPS der nächsten Quartalszahlen), Inflation, BIP und Devisen.
3. **`public/credit.js`** – Lombardkredit:
   - Beleihungsquote je Wert: Staatsanleihen 85 %, breite ETFs 70 %, Blue Chips 55 %, volatile Nebenwerte 0–25 %
   - Live-Monitor
   - Margin Call mit Frist (240 Handelsminuten), danach Teil-Liquidation auf 85 % Auslastung
   - Notbremse bei 125 %
   - Unternehmenskredit ab „Fondsmanager“, mit Bonität aus Verschuldung und Cashflow
4. **`public/ma.js`** – Beteiligungen und Übernahmen:
   - Ab 5 % Bilanz-Einblicke, ab 25 % Abstimmung Dividende/Reinvestition
   - Übernahmeangebot mit Prämie, finanziert aus Cash, Lombard und LBO-Kredit. Die Annahmefrist läuft bis zur nächsten Börseneröffnung.
   - Bei Erfolg: Delisting (Index, ETFs und Fonds werden bereinigt, Mitaktionäre und Derivate werden ausgezahlt)
   - „Meine Unternehmen“ mit Quartalsrechnung, Strategien und Börsengang (IPO)

## Vermögensmodell

`Nettovermögen = Verrechnungskonto + Depot + Hebelprodukte + Fremdwährung + Festgeld + Beteiligungen (Eigenkapitalwert) + Luxus − Unternehmenskredite`

Der Lombardkredit ist ein negatives Verrechnungskonto. Alle Buchungen laufen über den Geldfluss (`book`), neu dazu kommen die Kategorien `pe` und `loan`.

## UI

- Neue Ansichten **Makro** und **Unternehmen**
- Neuer Konto-Reiter **Kredit**
- In der Detailansicht: Beteiligungsleiter und Übernahme-Ablauf
- News-Kategorien: Alle, Mein Portfolio, Quartalszahlen, Politik & Zölle, Makro & Zentralbank, M&A & Übernahmen
- Bernstein (`--warn`) nur für Kredit-Risiko und Marktstatus

## Persistenz und Migration

Alle Init-Hooks ergänzen fehlende Felder bestehender Märkte und Konten. Neue Nebenwerte kommen über `buildMissing()` dazu. Der Browser lädt nach Delisting oder IPO neu (`resync`).

## Ausbau 2: Auto-Orders, Detailansicht, mehr Unternehmen

Analyse:
- Navigation läuft über `app.js` (Hash-Routen, `S.UI.back`).
- Positionen liegen in `A.pos[id] = { qty, cost, t0, inc, rz }`.
- Die Order-Engine `executeMarket`/`placeOrder` kennt Limit- und Stop-Orders mit Reservierung.
- Der Chart (`chart.js`) zeichnet Linie oder Kerzen mit Fadenkreuz.

Umsetzung:
1. **`public/auto.js`**: Stop-Loss, Take-Profit und Trailing-Stop für Wertpapiere, Hebelprodukte (auf den Basiswert) und Fremdwährung.
   - Die Menge wird als Anteil der Position gespeichert. Manuelle Verkäufe verkleinern die Order automatisch, es bleiben keine Geister-Orders.
   - OCO-Gruppen.
   - Prüfung bei jedem Markt-Schritt. Bei einer Kurslücke wird zum Marktpreis ausgeführt, mit Hinweis.
   - Persönliche Meldungen im News-Feed.
   - Fonds und eigene Unternehmen sind ausgeschlossen, mit Begründung.
2. **Detailansicht**:
   - Eigene Position oben (Wert, Rendite, Tag, Gewichtung, Einstand gegen Kurs, Erträge).
   - Zeiträume 1T/1W/1M/1J/Max, im Chart Einstand-, SL-, TP- und Trailing-Linien sowie Kauf- und Verkaufsmarker.
   - Produktspezifische Kennzahlen (Wachstum, Zins- und Zollempfindlichkeit, LTV, Restlaufzeit, ETF-Schwerpunkte).
   - Gefilterte News, Aktionsleiste mit „Absichern“.
3. **Navigation**:
   - Detailansichten bekommen einen eigenen Verlaufseintrag.
   - Scroll-Position und Filter bleiben beim Zurückgehen erhalten.
   - Schnellaktionen in der Depotliste.
4. **40 weitere Unternehmen**, zwei neue Branchen (Versorger, Immobilien), Heimatregion Fernost.

## Effizienz (Cloudflare Free)

Gemessen mit 123 Instrumenten:

| Messgröße | Vorher | Nachher |
|---|---|---|
| Live-Takt | ca. 92 KB | ca. 16 KB |
| Startdaten | ca. 8,7 MB | ca. 1,2 MB |

So wurde das erreicht:
- Kompakter Takt: Arrays, gemeinsame Kerzenminute, nur geänderte Felder, neue Umsätze und News als Delta, 7 Stellen Genauigkeit.
- Fortlaufende Nummer `seq`: Verpasst der Browser einen Takt, lädt er den Stand neu.
- Lange Kursverläufe kommen erst bei Bedarf über `/api/hist`.

Weitere Werte:
- CPU je 5-Sekunden-Takt: unter 1 ms
- Geschriebene Zeilen: ca. 830 pro Stunde bei offener Börse (Limit: 100.000 pro Tag)
- Größte Speicherzeile: ca. 0,72 MB (Limit: 2 MB)
- Stundenkerzen für „1W“ liegen in den vorhandenen Kerzenzeilen.

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

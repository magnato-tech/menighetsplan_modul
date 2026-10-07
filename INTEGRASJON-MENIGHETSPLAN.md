# Integrasjon: CMS ⇄ Menighetsplan 2.0 (v1.1)
*Oppdatert: 2026-09-28 – Endepunktene er nå aktive og testet i Menighetsplan 2.0.*
*Appen: [magnato-tech/Menighetsplan2.0_mobil](https://github.com/magnato-tech/Menighetsplan2.0_mobil)*

---

## 1. Prinsipp

- CMS-et er en **egen modul** med egen kode, hosting og domene (`lillesandmisjonskirke.no`).
- CMS-et har **én kilde**: det offentlige REST-API-et i Menighetsplan 2.0.
- **Menighetsplan er fasit** for gudstjenester og arrangementer.
- CMS-et leser aldri Firestore direkte. Server-endepunktet i appen fungerer som en sikker brannmur som kun slipper gjennom hvitelistede offentlige felt. Personopplysninger, oppgaver, tilgjengelighet og interne meldinger forlater aldri appen.
- Hvis appen er utilgjengelig, viser CMS-et automatisk forrige vellykkede henting eller fallback-fil.

---

## 2. Server-Endepunkter

### Primært Endepunkt (Kontrakt v1):
```
GET https://ais-dev-bpwtuilescw22tmh5zztaw-138177352715.europe-west3.run.app/api/offentlig/arrangementer?fra=2026-09-01&til=2027-03-01
```

- **Query-parametre:** `fra` og `til` (valgfrie ISO-datoer).
- **Headere:**
  * `Content-Type: application/json; charset=utf-8`
  * `Cache-Control: public, max-age=300`
  * `Access-Control-Allow-Origin: *`

#### Svar (JSON v1):
```json
{
  "versjon": 1,
  "kilde": "menighetsplan",
  "generert": "2026-09-28T10:17:18.034Z",
  "tidssone": "Europe/Oslo",
  "arrangementer": [
    {
      "id": "gathering-1",
      "type": "gudstjeneste",
      "tittel": "Gudstjeneste & dåp",
      "tema": "Guds rike",
      "bibeltekst": "Mark 1,14–15",
      "beskrivelse": "",
      "start": "2026-09-06T13:00:00+02:00",
      "slutt": "2026-09-06T15:00:00+02:00",
      "heldag": false,
      "sted": "Lillesand Misjonskirke",
      "status": "planlagt",
      "tagger": ["gudstjeneste"],
      "sistEndret": "2026-09-28T10:17:18.033Z"
    }
  ]
}
```

### Utvidet Endepunkt (inkludert grupper og gjentagende eventer):
```
GET https://ais-dev-bpwtuilescw22tmh5zztaw-138177352715.europe-west3.run.app/api/public/all
```
Leverer samlet:
* `arrangementer` (enkelthendelser og gudstjenester). Hvert arrangement har `fremhevet: true` når en administrator har løftet det fram; nettsiden kan bruke det til å vise arrangementet øverst.
* `grupper` (husfellesskap og fellesskap). Grupper som er skjult i Menighetsplan er ikke med.
* `gjentagende_eventer` (faste møtetider for gruppene som er med i `grupper`)

Kontrakt v1 over er uendret.

---

## 3. Feltoversikt og Datamapping

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | string | Unik ID for arrangementet |
| `type` | `"gudstjeneste"` \| `"arrangement"` | Type samling. Gudstjenester får merkelapp |
| `tittel` | string | Navn på samlingen |
| `start` | string (ISO) | Starttidspunkt med norsk offset (`+01:00`/`+02:00`) |
| `slutt` | string (ISO) | Sluttidspunkt med norsk offset |
| `sted` | string | Lokasjon (standard: "Kirken") |
| `status` | `"planlagt"` \| `"avlyst"` | Avlyste arrangementer vises med rød avlyst-merking |
| `tagger` | string[] | Kategorier (`gudstjeneste`, `ungdom`, `fellesskap`, etc.) |
| `heldag` | boolean | Sann hvis arrangementet varer hele dagen |

---

## 4. Referanseadapter for Claude (`lib/kilder/menighetsplan.js`)

```javascript
/**
 * lib/kilder/menighetsplan.js
 * Ren Node.js uten eksterne npm-avhengigheter.
 */
const fs = require('fs');
const path = require('path');

const API_URL = process.env.MENIGHETSPLAN_API_URL || 
  'https://ais-dev-bpwtuilescw22tmh5zztaw-138177352715.europe-west3.run.app/api/offentlig/arrangementer';

const MOCK_FILE = path.join(__dirname, '..', '..', 'data', 'menighetsplan-mock.json');

async function hentArrangementer(fra, til) {
  const url = new URL(API_URL);
  if (fra) url.searchParams.set('fra', fra);
  if (til) url.searchParams.set('til', til);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    const data = await res.json();
    return data.arrangementer || [];
  } catch (err) {
    // Fallback til lokal mock ved nettverksfeil eller frakoblede enhetstester
    if (fs.existsSync(MOCK_FILE)) {
      try {
        const mockData = JSON.parse(fs.readFileSync(MOCK_FILE, 'utf-8'));
        return mockData.arrangementer || mockData;
      } catch (mockErr) {
        console.error('Kunne ikke lese mock:', mockErr.message);
      }
    }
    return [];
  }
}

module.exports = { hentArrangementer };
```

# Givertjeneste: slik settes den opp hos en menighet

*Gjelder leveranse 1 (grunnmur og tilgang). Skrevet 26. november 2026.*

Demoen trenger ingenting av dette: der er modulen alltid synlig, med eksempeldata.

**Ingen ekte gaveopplysninger før sjekklisten i kapittel 3.5 i [planen](menighetsplan-givertjeneste-mvp-v1.md) er fylt ut.**

## 1. Publiser databasereglene

Reglene følger ikke med når koden slippes.

1. Åpne menighetens prosjekt i Firebase Console, **Firestore → Rules**.
2. Lim inn hele `firestore.rules` fra den versjonen som er sluppet, og trykk **Publish**.

## 2. Slå på modulen

I appen: **Admin → Moduler → Givertjeneste**.

## 3. Legg inn gaveformål

En administrator: **Admin → Planlegging → Gaveformål**.

## 4. Gi den første tilgangen

Den første må legges inn for hånd, av den som eier prosjektet. Det er meningen: ingen i appen kan gi seg selv tilgang.

Personen må stå i registeret med en e-postadresse som kan brukes til å logge inn, og administrator må ha åpnet appen etter at personen ble lagt inn.

1. **Finn personens id.** Firebase Console → **Firestore → Data → `logins`** → dokumentet med e-postadressen. Kopier verdien i `personId`.
2. **Lag samlingen `givingAccess`** (finnes den, åpne den) og velg **Add document**.
3. **Document ID:** e-postadressen, med bare små bokstaver.
4. **Feltene**, alle ni minus det som står som utelatt:

| Felt | Type | Verdi |
|:---|:---|:---|
| `personId` | string | fra punkt 1 |
| `name` | string | personens navn |
| `overview` | boolean | `false` eller `true` |
| `budget` | boolean | `false` eller `true` |
| `individual` | boolean | `false` eller `true` |
| `manage` | boolean | `true` for den som skal gi andre tilgang |
| `version` | number | `1` |

Legg **ikke** inn `googleId`.

5. Personen logger inn i appen **med Google**, åpner **Admin → Gaveinnstillinger** og trykker **Ta i bruk tilgangen**.

Deretter gir den med «Tilganger» de andre tilgangene på samme side.

## 5. Kontroller at det er stengt

Logg inn med en konto uten giverrettigheter (gjerne en administrator) og kontroller at menyen ikke har **Gaveinnstillinger**, og at siden ellers sier at du ikke har tilgang.

## Fjerne tilgang

- **Vanlig:** den med «Tilganger» trykker **Fjern all tilgang**. Virker med en gang.
- **Haster det, og ingen med «Tilganger» er tilgjengelig:** sett de fire feltene til `false` i Firebase Console. Ikke slett dokumentet.
- Slettes personen fra registeret, eller slås modulen av, stenges tilgangen også.

## Bytter personen Google-konto

Den med «Tilganger» trykker **Tilbakestill Google-konto**. Personen tar tilgangen i bruk på nytt.

## Husk

Den som eier Firebase- og Vercel-prosjektet, kan teknisk se alle data, uansett hva som står i appen.

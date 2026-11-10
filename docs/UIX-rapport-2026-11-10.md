# UIX-rapport, 10. november 2026

Det som ble lagt merke til mens trinn 1–7 i «Én Min side for medlem og leder, og moduler» ble bygget og prøvd i demoen (som Andreas Lind, tjenestegruppeleder, og Kari Nordmann, administrator), på PC og på 375 punkters bredde. Ingenting her er endret. Punktene står etter hvor mye de betyr for den som bruker løsningen.

## Høy

**1. Gudstjenester på Min side: samme rolle står flere ganger.**
Gudstjeneste & dåp viser «Bilde — Kari Nordmann» to ganger og «Lyd» to ganger. Det er to oppgaver med samme rolle (for eksempel Kamerastyring og Prosjektor & streaming har begge rollen Bilde). For den som leser, ser det ut som en feil.
*Forslag:* bruk oppgavens tittel når to oppgaver har samme rolle, eller slå dem sammen til én linje med alle navnene.

**2. Gudstjenester: lange lister med tomme roller.**
En gudstjeneste der ingen har sagt ja ennå, gir ti linjer med «Møtevert –», «Lovsang –» og så videre. Det er mye å lese for lite informasjon, og det skyver neste gudstjeneste langt ned.
*Forslag:* vis bare rollene der noen har sagt ja, og én linje til slutt: «6 roller er ikke fylt ennå». Et trykk åpner kjøreplanen som før.

**3. «Se ledige oppgaver (63)» er for mye for en frivillig.**
Andreas ser 63 ledige oppgaver. Det er alle ledige plasser i alle gruppene hans, hele semesteret. Et så stort tall gjør det lett å la være.
*Forslag:* tell bare de neste fire ukene på knappen, som «Trenger oppfølging» i admin gjør, og la listen vise resten under.

**4. Bemanningen viser forfall som en egen rad i tillegg til de ledige plassene.**
Under Møtevert står «0/2 bekreftet», så «Ola Hansen – Forfall», og så to «Ledig plass». Det ser ut som tre plasser når det trengs to.
*Forslag:* vis den som har meldt forfall, som en liten linje under rollen («Ola Hansen meldte forfall»), ikke som en plass.

## Middels

**5. «Min Side» og «Min side» om hverandre.**
Min side, nettsidens meny og fanene skriver «Min side». Admin skriver flere steder «Min Side» og «Gå til Min Side» (Oversikt, menyen, hjelpen).
*Forslag:* «Min side» overalt.

**6. Temafargen gjelder bare deler av Min side.**
Aktiv fane og «Min side»-knappen har nå menighetens farge (trinn 6). Knapper som «Ta oppgave», «Gå til grupperommet» og filterknappene i kalenderen er fortsatt grønne. Det ser halvferdig ut med en menighet som har blå eller rød farge.
*Forslag:* bytt de grønne hovedknappene på Min side til temafargen. Behold grønt der det betyr «bekreftet».

**7. Raden med bare én knapp øverst på Min side.**
For en frivillig som ikke er administrator, står det nå bare «Min side» i raden under menighetens navn, siden Gruppeleder er borte. Raden tar plass uten å gi et valg.
*Forslag:* vis raden bare for administrator og nettredaktør (Min side / Admin). Andre har fanene nederst.

**8. «Du» står to ganger på Gudstjenester.**
En egen oppgave er både uthevet med fet skrift og merket «Du». Ett av dem holder.

**9. Filterknappene i kalenderen er trange på mobil.**
Med «Jeg leder» er det fire knapper på 375 punkter. Teksten er satt ned til 11 punkter for å få plass.
*Forslag:* en nedtrekksliste («Vis: Alle»), eller to rader på smal skjerm.

**10. «Utenfor programmet» står på nesten hver rolle i bemanningen.**
På Gudstjeneste & dåp står det på sju av ti roller. Det som står på nesten alt, sier lite.
*Forslag:* vis klokkeslettet når rollen er i programmet, og ingenting ellers.

**11. «Dagens taler» står under «Uten team».**
Taleren er den viktigste rollen, men havner nederst i en gruppe som ser ut som en rest.
*Forslag:* la roller uten team stå først, under arrangementets navn, eller gi dem overskriften «Ledere».

## Lav

**12. Moduler kan ikke vises i demoen.**
Siden Moduler er tatt ut av demoen, fordi demoens database deles av alle. Da kan ikke produkteier vise at Min side kan gjøres enklere, som er et av salgspunktene.
*Forslag:* i demoen lagres bryterne bare i den besøkendes nettleser, slik valget av menighet gjøres.

**13. Nye hjelpeartikler mangler bilder.**
«Én nettside, tre visninger», «Min side for frivillige og ledere», «Nytt i høst», «Moduler» og «Flater i løsningen» har ikke skjermbilde. Kjør `node scripts/capture-help-screenshots.mjs` og legg Min side til i skriptet.

**14. Veiledningen på Min side er lang.**
«Slik bruker du Min side» har åtte punkter, flere med to setninger, og gjelder alle fanene på en gang.
*Forslag:* et «?» per fane, med det som gjelder den fanen.

**15. Grupper av på Min side tar ikke bort «Fellesskap» på nettsiden.**
Det står i kapittel 14 som et valg som tas senere. Det kan overraske en administrator som slår av Grupper.

**16. Planleggingen ligger fortsatt under `/leder/samling/…`.**
Gruppeleder-siden er borte, men adressen til planleggingen bærer navnet. Brukeren ser det bare i adresselinjen, men det er en rest å rydde når adressene uansett endres.

**17. «Vår nettside av» kan ikke prøves på utviklermaskinen.**
`.env.local` kjører som demo mot demoens database, og der er nettsiden alltid på. Det som skjer når nettsiden er av (adressen går til Min side), er bare prøvd med tester.
*Forslag:* en egen `.env`-fil mot en tom prøvedatabase uten demo.

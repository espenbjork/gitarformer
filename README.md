# Gitarformer

Verktøy for å planlegge gitarbygging: hent inn bilder av eksisterende
modeller, rett opp vinkelen, trekk ut omrisset, og legg formene oppå
hverandre for å sammenligne dem.

Appen er én HTML-fil uten avhengigheter og uten byggesteg. All
bildebehandling skjer i nettleseren. Formene lagres i en lokal base og
synkes til D1 i skya, så de finnes på alle maskinene dine.

## Kom i gang

Åpne `index.html` i nettleseren. Det er hele installasjonen av appen.

Skal formene også havne i skya, åpne **Sky** i panelet og lim inn tokenet.
Det skjer én gang per maskin.

## Arbeidsgangen

**Fra bilde** åpner en veiviser i fire steg.

1. **Bilde.** Velg fil, slipp bildet i vinduet, eller lim inn med Cmd+V.
2. **Vinkel.** Dra de fire hjørnene slik at rammen følger gitarens eget plan.
   Firkanten rettes ut til et rektangel, så et bilde tatt på skrå blir
   sett rett forfra. Hjelperutene viser når det stemmer. Er bildet allerede
   rett, trykk **Hele bildet**.
3. **Omriss.** Tre metoder:
   - *Tryllestav*: klikk på bakgrunnen. Alt som ligner nok forsvinner, og
     resten blir omrisset. Klikk flere steder om bakgrunnen er flerfarget.
   - *Terskel*: skiller på lyshet. Passer på silhuetter og strektegninger.
   - *Tegn selv*: klikk rundt kanten.
   Rens, forenkling og glatting styrer hvor mange punkter omrisset får.
4. **Mål.** Oppgi ekte mål i millimeter. Er bildet perspektivrettet, oppgi
   begge, for rettingen endrer sideforholdet.

**Generisk** gir tre omtrentlige utgangsformer å tegne videre på. De er
grove arketyper, ikke kopier av bestemte modeller.

## Basen

Alt du lager havner i basen av seg selv. Du trenger ikke lagre.

**Lokalt** ligger formene i IndexedDB i nettleseren. Det er sannheten, og
det er derfor verktøyet virker like godt uten nett. Referansebildene ligger
også her.

**I skya** ligger de i D1 bak en Cloudflare Worker på
`gitarformer.dreampodcast.workers.dev`. Der ligger omriss, mål, tagger og
notater. **Referansebildene synkes ikke**, de blir liggende på maskinen som
importerte dem.

Synkingen går begge veier og løser konflikter på når formen sist ble endret:
nyeste vinner. Sletting er en gravstein, ikke en tom rad, så en sletting på
én maskin når fram til de andre. Er du uten nett, blir endringene liggende og
går opp neste gang det er kontakt. Panelet sier hvor mange som venter.

En form som kommer ned fra skya legger seg i biblioteket, ikke rett på
lerretet. Ingenting dukker opp foran deg uten at du ba om det.

## Bibliotek og lerret

**Biblioteket** er alt du har. Søk i navn, tagger og notat, eller klikk en
tagg for å snevre inn. **Lerretet** er de formene du sammenligner akkurat nå.

`Hent inn` legger en form på lerretet, `Av` tar den bort igjen uten å slette
den. `Slett` i formpanelet sletter den fra basen, også på de andre maskinene.

## Sammenligning

Alle synlige former tegnes på samme kanvas, hver i sin farge. Juster dem
etter midtpunkt, halsenden, bunnen, eller plasser dem fritt.

Tabellen regner ut lengde, bredde, nedre bue, midje, øvre bue, areal,
omkrets og en anslått vekt ut fra kroppstykkelse og treslag. Velg en form
som referanse, så vises avviket i prosent for de andre.

Vekten gjelder en heltre kropp uten fresing. Den er et tak, ikke et
fasitsvar, og ekte emner varierer lett 20 prosent i tetthet.

## Verktøy

| Tast | Verktøy |
|---|---|
| 1 | Flytt utsnitt |
| 2 | Flytt form |
| 3 | Punkter |
| 4 | Mål |

Rull for å zoome, mellomrom og dra for å panorere. Piltaster flytter den
valgte formen 1 mm, med Shift 10 mm. Cmd+Z angrer.

## Punktmodus

| Handling | Slik |
|---|---|
| Marker flere | Dra en boks i tomrommet rundt punktene |
| Legg til i markeringen | Shift-dra en boks til, eller Shift-klikk et punkt |
| Marker alle | Cmd+A, eller knappen i panelet |
| Slett markerte | Backspace, eller knappen i panelet |
| Fjern markeringen | Escape, eller klikk i tomrommet |
| Flytt | Dra et markert punkt, hele markeringen følger med |
| Nytt punkt | Klikk på streken |
| Slett ett | Alt-klikk på punktet |

Nyttigst når tryllestaven har lagt igjen en tagg eller en skygge langs
kanten: dra en boks rundt rotet, trykk Backspace, og la streken gå rett
over. Et omriss må ha minst fire punkter igjen. Cmd+Z angrer alt.

## Eksport

- **SVG** i millimeter. Skriv den ut på 100 prosent, så er malen i full
  størrelse og kan limes rett på emnet.
- **PNG** av kanvaset slik det står.
- **Lagre prosjekt** gir en JSON-fil med hele biblioteket, også
  referansebildene. Den er sikkerhetskopien som tar med det skya ikke gjør.
- **Åpne prosjekt** fletter fila inn i biblioteket. Den tømmer ingenting.

## Workeren

Ligger i `worker/`. Rulles ut med `npx wrangler deploy` derfra, etter
utrullingsmønsteret i vaulten. Skjemaet står i `worker/schema.sql`.

Tokenet settes én gang med `npx wrangler secret put GITARFORMER_TOKEN`.
Workeren serverer bare API-et, aldri appen, nettopp for at tokenet ikke skal
ligge i en offentlig side.

| rute | gjør |
|---|---|
| `GET /api/helse` | antall former i basen |
| `GET /api/former` | alt, eller `?siden=<iso>` for det som er endret |
| `POST /api/former` | `{former:[...]}`, oppdaterer bare det som er nyere |
| `GET /api/tagger` | alle tagger med antall |

Alle krever `Authorization: Bearer <token>`.

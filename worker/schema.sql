-- Gitarformer, D1-skjema.
--
-- Regelen fra avgrens-alltid-sletting-til-egne-rader gjelder her:
-- ingen rader slettes noen gang med DELETE. Sletting er en gravstein
-- (slettet = 1), og all skriving er ON CONFLICT DO UPDATE på en
-- deterministisk id som klienten lager. Da trengs ingen opprydding.
--
-- `kilde` skiller rader jeg har lastet inn fra rader Espen har laget i appen.
-- Skal noe ryddes bort en gang i framtida, skal WHERE-leddet bruke den.

CREATE TABLE IF NOT EXISTS former (
  id          TEXT PRIMARY KEY,
  navn        TEXT    NOT NULL,
  farge       TEXT    NOT NULL DEFAULT '#bd6a39',
  punkter     TEXT    NOT NULL,              -- JSON: [[x,y], ...] i millimeter
  rot         REAL    NOT NULL DEFAULT 0,
  speil       INTEGER NOT NULL DEFAULT 0,
  hals_topp   INTEGER NOT NULL DEFAULT 1,
  tykkelse    REAL    NOT NULL DEFAULT 45,
  strek       REAL    NOT NULL DEFAULT 2,
  stiplet     INTEGER NOT NULL DEFAULT 0,
  fyll        INTEGER NOT NULL DEFAULT 0,
  opasitet    REAL    NOT NULL DEFAULT 0.18,
  notat       TEXT    NOT NULL DEFAULT '',

  -- Avledede mål lagres med, så basen kan sorteres og filtreres
  -- uten at noen må regne om polygonet først.
  lengde      REAL,
  bredde      REAL,
  nedre_bue   REAL,
  midje       REAL,
  ovre_bue    REAL,
  areal       REAL,

  opprettet   TEXT    NOT NULL,              -- ISO 8601, klientens tid
  endret      TEXT    NOT NULL,              -- ISO 8601, klientens tid. Avgjør hvem som vinner ved konflikt.
  synket      TEXT    NOT NULL,              -- ISO 8601, serverens tid. Avgjør hva som er nytt siden sist.
  slettet     INTEGER NOT NULL DEFAULT 0,
  kilde       TEXT    NOT NULL DEFAULT 'app'
);

-- To klokker med vilje: klientens `endret` avgjør hvem som vinner en konflikt,
-- serverens `synket` avgjør hva som er nytt siden forrige henting. Blandes de,
-- forsvinner rader når to maskiner har klokker som spriker.
CREATE INDEX IF NOT EXISTS idx_former_synket  ON former(synket);
CREATE INDEX IF NOT EXISTS idx_former_endret  ON former(endret);
CREATE INDEX IF NOT EXISTS idx_former_slettet ON former(slettet);

CREATE TABLE IF NOT EXISTS tagger (
  form_id TEXT NOT NULL,
  tagg    TEXT NOT NULL,
  PRIMARY KEY (form_id, tagg)
);

CREATE INDEX IF NOT EXISTS idx_tagger_tagg ON tagger(tagg);

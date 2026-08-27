/**
 * Gitarformer, API mot D1.
 *
 * Serverer ikke appen. Appen ligger på GitHub Pages, workeren gjør bare data.
 *
 * **Lesing er åpen, skriving er låst.** Biblioteket av former skal være
 * offentlig, så hvem som helst kan hente det ned og bruke det som
 * utgangspunkt. Å legge noe inn i det krever bearer-token, og det tokenet
 * finnes bare i Espens egen nettleser. Derfor kan appen ligge offentlig uten
 * at noe hemmelig følger med den.
 *
 * Ingen rute sletter rader. Sletting er en gravstein, all skriving er
 * ON CONFLICT DO UPDATE på en id klienten har laget. Se schema.sql.
 */

const TILLATTE_OPPHAV = new Set([
  "null",                          // file:// sender Origin: null
  "http://localhost:8731",
  "http://127.0.0.1:8731",
  "https://espenbjork.github.io"
]);

const MAKS_FORMER_PER_KALL = 500;
const MAKS_PUNKTER_TEGN = 500000;

function corsHoder(request) {
  const opphav = request.headers.get("Origin");
  const hoder = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
  if (opphav && TILLATTE_OPPHAV.has(opphav)) hoder["Access-Control-Allow-Origin"] = opphav;
  return hoder;
}

function svar(data, request, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, corsHoder(request))
  });
}

/** Sammenligning i konstant tid, så tokenet ikke kan gjettes på responstid. */
function likeStrenger(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let ulik = 0;
  for (let i = 0; i < a.length; i++) ulik |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return ulik === 0;
}

function harAdgang(request, env) {
  const h = request.headers.get("Authorization") || "";
  const m = /^Bearer (.+)$/.exec(h);
  return !!(m && env.GITARFORMER_TOKEN && likeStrenger(m[1], env.GITARFORMER_TOKEN));
}

const FELT = [
  "id", "navn", "farge", "punkter", "rot", "speil", "hals_topp", "tykkelse",
  "strek", "stiplet", "fyll", "opasitet", "notat",
  "lengde", "bredde", "nedre_bue", "midje", "ovre_bue", "areal",
  "opprettet", "endret", "synket", "slettet", "kilde"
];

function tall(v, standard) { if (v == null) return standard; const n = Number(v); return Number.isFinite(n) ? n : standard; }
function bit(v) { return v ? 1 : 0; }
function tekst(v, maks) { return String(v == null ? "" : v).slice(0, maks); }

/** Gjør en form fra klienten om til en rad, og avviser det som ikke holder mål. */
function tilRad(f, na) {
  if (!f || typeof f.id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(f.id)) return null;
  const punkter = typeof f.punkter === "string" ? f.punkter : JSON.stringify(f.punkter || []);
  if (punkter.length > MAKS_PUNKTER_TEGN) return null;
  let sjekk;
  try { sjekk = JSON.parse(punkter); } catch (e) { return null; }
  if (!Array.isArray(sjekk)) return null;
  return {
    id: f.id,
    navn: tekst(f.navn || "Uten navn", 200),
    farge: /^#[0-9a-fA-F]{6}$/.test(f.farge || "") ? f.farge : "#bd6a39",
    punkter,
    rot: tall(f.rot, 0),
    speil: bit(f.speil),
    hals_topp: bit(f.hals_topp === undefined ? 1 : f.hals_topp),
    tykkelse: tall(f.tykkelse, 45),
    strek: tall(f.strek, 2),
    stiplet: bit(f.stiplet),
    fyll: bit(f.fyll),
    opasitet: tall(f.opasitet, 0.18),
    notat: tekst(f.notat, 4000),
    lengde: tall(f.lengde, null), bredde: tall(f.bredde, null),
    nedre_bue: tall(f.nedre_bue, null), midje: tall(f.midje, null),
    ovre_bue: tall(f.ovre_bue, null), areal: tall(f.areal, null),
    opprettet: tekst(f.opprettet || na, 40),
    endret: tekst(f.endret || na, 40),
    synket: na,
    slettet: bit(f.slettet),
    kilde: tekst(f.kilde || "app", 40)
  };
}

function rensTagger(v) {
  if (!Array.isArray(v)) return [];
  const ut = new Set();
  for (const t of v) {
    const s = String(t || "").trim().toLowerCase().slice(0, 40);
    if (s) ut.add(s);
    if (ut.size >= 30) break;
  }
  return Array.from(ut);
}

async function hentFormer(env, siden) {
  // Uten `siden` er dette en full henting, og gravsteinene er bare støy.
  // Med `siden` er de hele poenget, ellers kommer aldri en sletting fram.
  const sql = siden
    ? "SELECT * FROM former WHERE synket > ? ORDER BY synket"
    : "SELECT * FROM former WHERE slettet = 0 ORDER BY navn";
  const st = siden ? env.DB.prepare(sql).bind(siden) : env.DB.prepare(sql);
  const { results } = await st.all();
  if (!results.length) return [];

  const ider = results.map(r => r.id);
  const plass = ider.map(() => "?").join(",");
  const { results: tg } = await env.DB
    .prepare("SELECT form_id, tagg FROM tagger WHERE form_id IN (" + plass + ")")
    .bind(...ider).all();
  const kart = new Map();
  for (const t of tg) {
    if (!kart.has(t.form_id)) kart.set(t.form_id, []);
    kart.get(t.form_id).push(t.tagg);
  }
  return results.map(r => Object.assign({}, r, { tagger: kart.get(r.id) || [] }));
}

async function skrivFormer(env, innkomne, na) {
  const rader = [];
  const taggkart = new Map();
  for (const f of innkomne) {
    const rad = tilRad(f, na);
    if (!rad) continue;
    rader.push(rad);
    taggkart.set(rad.id, rensTagger(f.tagger));
  }
  if (!rader.length) return { lagret: 0, avvist: innkomne.length };

  const kolonner = FELT.join(", ");
  const plass = FELT.map(() => "?").join(", ");
  // Oppdateringen skjer bare hvis den innkommende raden faktisk er nyere.
  // Da kan en gammel klient synke uten å overskrive noe ferskere.
  const sett = FELT.filter(k => k !== "id" && k !== "opprettet")
    .map(k => k + " = excluded." + k).join(", ");
  const sql = "INSERT INTO former (" + kolonner + ") VALUES (" + plass + ") " +
    "ON CONFLICT(id) DO UPDATE SET " + sett + " WHERE excluded.endret > former.endret";

  await env.DB.batch(rader.map(r => env.DB.prepare(sql).bind(...FELT.map(k => r[k]))));

  // Hvem vant? Bare de radene får taggene sine byttet ut.
  const ider = rader.map(r => r.id);
  const p = ider.map(() => "?").join(",");
  const { results } = await env.DB
    .prepare("SELECT id, endret FROM former WHERE id IN (" + p + ")").bind(...ider).all();
  const gjeldende = new Map(results.map(r => [r.id, r.endret]));

  const taggkall = [];
  for (const r of rader) {
    if (gjeldende.get(r.id) !== r.endret) continue;
    // Avgrenset til denne formens egne tagger, aldri hele tabellen.
    taggkall.push(env.DB.prepare("DELETE FROM tagger WHERE form_id = ?").bind(r.id));
    for (const t of (taggkart.get(r.id) || [])) {
      taggkall.push(env.DB.prepare(
        "INSERT INTO tagger (form_id, tagg) VALUES (?, ?) ON CONFLICT DO NOTHING").bind(r.id, t));
    }
  }
  if (taggkall.length) await env.DB.batch(taggkall);

  return { lagret: rader.length, avvist: innkomne.length - rader.length };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHoder(request) });
    }
    // Skriving krever token. Lesing gjør ikke det, biblioteket er offentlig.
    if (request.method !== "GET") {
      if (!env.GITARFORMER_TOKEN) {
        return svar({ feil: "GITARFORMER_TOKEN er ikke satt på workeren" }, request, 500);
      }
      if (!harAdgang(request, env)) {
        return svar({ feil: "ugyldig token" }, request, 401);
      }
    }

    const na = new Date().toISOString();

    try {
      if (url.pathname === "/api/helse" && request.method === "GET") {
        const r = await env.DB.prepare(
          "SELECT COUNT(*) AS antall, MAX(synket) AS sist FROM former WHERE slettet = 0").first();
        return svar({ ok: true, antall: r.antall, sist: r.sist, tid: na }, request);
      }

      if (url.pathname === "/api/former" && request.method === "GET") {
        const siden = url.searchParams.get("siden");
        const former = await hentFormer(env, siden && /^\d{4}-/.test(siden) ? siden : null);
        return svar({ tid: na, former }, request);
      }

      if (url.pathname === "/api/former" && request.method === "POST") {
        const kropp = await request.json().catch(() => null);
        const innkomne = kropp && Array.isArray(kropp.former) ? kropp.former : null;
        if (!innkomne) return svar({ feil: "forventet {former:[...]}" }, request, 400);
        if (innkomne.length > MAKS_FORMER_PER_KALL) {
          return svar({ feil: "maks " + MAKS_FORMER_PER_KALL + " former per kall" }, request, 413);
        }
        const res = await skrivFormer(env, innkomne, na);
        return svar(Object.assign({ tid: na }, res), request);
      }

      if (url.pathname === "/api/tagger" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT t.tagg AS tagg, COUNT(*) AS antall FROM tagger t " +
          "JOIN former f ON f.id = t.form_id AND f.slettet = 0 " +
          "GROUP BY t.tagg ORDER BY antall DESC, t.tagg").all();
        return svar({ tagger: results }, request);
      }

      return svar({ feil: "ukjent rute" }, request, 404);
    } catch (e) {
      return svar({ feil: String(e && e.message || e) }, request, 500);
    }
  }
};

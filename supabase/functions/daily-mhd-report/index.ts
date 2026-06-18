// daily-mhd-report
// Supabase Edge Function für MHD Kontrolle
// Benötigte Secrets:
// RESEND_API_KEY = re_...
// REPORT_TO_EMAIL = shell5682@gmx.de

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const REPORT_TO_EMAIL = Deno.env.get("REPORT_TO_EMAIL") || "shell5682@gmx.de";
const REPORT_FROM_EMAIL = Deno.env.get("REPORT_FROM_EMAIL") || "MHD Kontrolle <onboarding@resend.dev>";

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateKey, days) {
  const d = new Date(dateKey + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function deDate(dateKey) {
  try {
    return new Date(dateKey + "T00:00:00").toLocaleDateString("de-DE");
  } catch {
    return dateKey;
  }
}

async function supabaseFetch(path) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error("SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt.");
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase Fehler ${res.status}: ${text}`);
  }

  return await res.json();
}

function itemName(row) {
  return row.name || row.artikel || row.artikelname || row.produkt || row.bezeichnung || row.barcode || "Artikel";
}

function itemMenge(row) {
  return row.menge ?? row.bestand ?? row.anzahl ?? "";
}

function liMhd(row) {
  const menge = itemMenge(row);
  const nr = row.artikelnummer ? ` · Art.-Nr. ${row.artikelnummer}` : "";
  const ean = row.barcode || row.ean ? ` · EAN ${row.barcode || row.ean}` : "";
  return `<li><b>${itemName(row)}</b>${nr}${ean}${menge !== "" ? ` · Bestand ${menge}` : ""}${row.mhd ? ` · MHD ${deDate(String(row.mhd).slice(0,10))}` : ""}</li>`;
}

function liAction(row, isControl = false) {
  const menge = itemMenge(row);
  const mitarbeiter = row.mitarbeiter || row.mitarbeiter_name || row.user || "";
  return `<li><b>${itemName(row)}</b>${isControl ? " · Bestand 0 / Kontrolliert" : (menge !== "" ? ` · ${menge} Stück` : "")}${mitarbeiter ? ` · ${mitarbeiter}` : ""}</li>`;
}

Deno.serve(async (req) => {
  try {
    if (!RESEND_API_KEY) {
      return new Response("RESEND_API_KEY fehlt.", { status: 500 });
    }

    const today = todayKey();
    const tomorrow = addDays(today, 1);
    const yesterday = addDays(today, -1);

    // MHD Einträge: nutzt die in der App verwendete Tabelle mhd_artikel.
    let allMhd = [];
    try {
      allMhd = await supabaseFetch("mhd_artikel?select=*&order=mhd.asc");
    } catch (_e) {
      // Fallback falls die Tabelle anders heißt
      allMhd = [];
    }

    const abgelaufen = allMhd.filter((r) => String(r.mhd || "").slice(0, 10) < today);
    const heute = allMhd.filter((r) => String(r.mhd || "").slice(0, 10) === today);
    const morgen = allMhd.filter((r) => String(r.mhd || "").slice(0, 10) === tomorrow);

    // Abschriften/Kontrollen vom Vortag
    let abschriftenRows = [];
    try {
      abschriftenRows = await supabaseFetch(`abschriften?select=*&datum=eq.${yesterday}&order=created_at.desc`);
    } catch (_e) {
      try {
        abschriftenRows = await supabaseFetch(`abschriften?select=*&created_at=gte.${yesterday}T00:00:00&created_at=lt.${today}T00:00:00&order=created_at.desc`);
      } catch (_e2) {
        abschriftenRows = [];
      }
    }

    const abschriften = abschriftenRows.filter((r) => r.typ !== "kontrolle");
    const kontrollen = abschriftenRows.filter((r) => r.typ === "kontrolle");

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.45;color:#111">
        <h2 style="color:#b00000">MHD Kontrolle – Tagesbericht</h2>
        <p><b>Datum:</b> ${deDate(today)}</p>

        <h3>⚠️ Läuft morgen ab (${morgen.length})</h3>
        <ul>${morgen.length ? morgen.map(liMhd).join("") : "<li>Keine Artikel</li>"}</ul>

        <h3>📅 Läuft heute ab (${heute.length})</h3>
        <ul>${heute.length ? heute.map(liMhd).join("") : "<li>Keine Artikel</li>"}</ul>

        <h3>❌ Bereits abgelaufen (${abgelaufen.length})</h3>
        <ul>${abgelaufen.length ? abgelaufen.map(liMhd).join("") : "<li>Keine Artikel</li>"}</ul>

        <hr/>

        <h3>Abschriften vom Vortag ${deDate(yesterday)} (${abschriften.length})</h3>
        <ul>${abschriften.length ? abschriften.map((r) => liAction(r, false)).join("") : "<li>Keine Abschriften</li>"}</ul>

        <h3>Kontrollen vom Vortag ${deDate(yesterday)} (${kontrollen.length})</h3>
        <ul>${kontrollen.length ? kontrollen.map((r) => liAction(r, true)).join("") : "<li>Keine Kontrollen</li>"}</ul>
      </div>
    `;

    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: REPORT_FROM_EMAIL,
        to: [REPORT_TO_EMAIL],
        subject: `MHD Kontrolle – Tagesbericht ${deDate(today)}`,
        html,
      }),
    });

    if (!mailRes.ok) {
      const text = await mailRes.text();
      return new Response("Resend Fehler: " + text, { status: 500 });
    }

    const mailJson = await mailRes.json();
    return new Response(JSON.stringify({
      ok: true,
      to: REPORT_TO_EMAIL,
      today,
      morgen: morgen.length,
      heute: heute.length,
      abgelaufen: abgelaufen.length,
      abschriften: abschriften.length,
      kontrollen: kontrollen.length,
      resend: mailJson,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(String(e?.message || e), { status: 500 });
  }
});

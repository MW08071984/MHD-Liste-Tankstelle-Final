// Supabase Edge Function: daily-mhd-report
// Sends daily MHD report to shell5682@gmx.de via Resend.
// Required secret: RESEND_API_KEY

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TO_EMAIL = "shell5682@gmx.de";
const FROM_EMAIL = Deno.env.get("REPORT_FROM_EMAIL") || "MHD Kontrolle <onboarding@resend.dev>";

function dateKey(offsetDays = -1) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function deDate(s) {
  try {
    return new Date(s + "T00:00:00").toLocaleDateString("de-DE");
  } catch {
    return s;
  }
}

Deno.serve(async (req) => {
  try {
    if (!RESEND_API_KEY) {
      return new Response("RESEND_API_KEY fehlt", { status: 500 });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response("Supabase Secrets fehlen", { status: 500 });
    }

    const day = dateKey(-1); // Vortag
    const url = `${SUPABASE_URL}/rest/v1/abschriften?datum=eq.${day}&select=*`;

    const rowsRes = await fetch(url, {
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
    });

    if (!rowsRes.ok) {
      const text = await rowsRes.text();
      return new Response("Datenbankfehler: " + text, { status: 500 });
    }

    const rows = await rowsRes.json();

    const abschriften = rows.filter((r) => r.typ !== "kontrolle");
    const kontrollen = rows.filter((r) => r.typ === "kontrolle");

    const abschriftenHtml = abschriften.length
      ? abschriften.map((r) => `<li><b>${r.name || r.artikel || "Artikel"}</b> – ${r.menge || 0} Stück ${r.mitarbeiter ? "· " + r.mitarbeiter : ""}</li>`).join("")
      : "<li>Keine Abschriften</li>";

    const kontrollenHtml = kontrollen.length
      ? kontrollen.map((r) => `<li><b>${r.name || r.artikel || "Artikel"}</b> – Bestand 0 ${r.mitarbeiter ? "· " + r.mitarbeiter : ""}</li>`).join("")
      : "<li>Keine Kontrollen</li>";

    const html = `
      <h2>MHD Kontrolle Tankstelle Ludweiler</h2>
      <p><b>Bericht für:</b> ${deDate(day)}</p>

      <h3>❌ Abschriften (${abschriften.length})</h3>
      <ul>${abschriftenHtml}</ul>

      <h3>✅ Kontrollen (${kontrollen.length})</h3>
      <ul>${kontrollenHtml}</ul>
    `;

    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        subject: `MHD Kontrolle – Tagesbericht ${deDate(day)}`,
        html,
      }),
    });

    if (!mailRes.ok) {
      const text = await mailRes.text();
      return new Response("Mailfehler: " + text, { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true, day, abschriften: abschriften.length, kontrollen: kontrollen.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(String(e?.message || e), { status: 500 });
  }
});

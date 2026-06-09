// Supabase Edge Function: daily-mhd-report
// Sends daily report at 07:00 via Supabase Cron + Resend.
// Required secret: RESEND_API_KEY
// Recipient: shell5682@gmx.de

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TO_EMAIL = "shell5682@gmx.de";
const FROM_EMAIL = Deno.env.get("REPORT_FROM_EMAIL") || "MHD Kontrolle <onboarding@resend.dev>";

function dateKey(offsetDays = -1) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function deDate(s) {
  try { return new Date(s + "T00:00:00").toLocaleDateString("de-DE"); } catch { return s; }
}

Deno.serve(async () => {
  try {
    if (!RESEND_API_KEY) return new Response("RESEND_API_KEY fehlt", { status: 500 });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) return new Response("Supabase Secrets fehlen", { status: 500 });

    const day = dateKey(-1);
    const url = `${SUPABASE_URL}/rest/v1/abschriften?datum=eq.${day}&select=*`;
    const rowsRes = await fetch(url, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
    });
    if (!rowsRes.ok) return new Response("Datenbankfehler: " + await rowsRes.text(), { status: 500 });

    const rows = await rowsRes.json();
    const abschriften = rows.filter((r) => r.typ !== "kontrolle");
    const kontrollen = rows.filter((r) => r.typ === "kontrolle");

    const li = (r, control=false) => `<li><b>${r.name || r.artikel || "Artikel"}</b> – ${control ? "Bestand 0" : ((r.menge || 0) + " Stück")} ${r.mitarbeiter ? "· " + r.mitarbeiter : ""}</li>`;

    const html = `
      <h2>MHD Kontrolle Tankstelle Ludweiler</h2>
      <p><b>Bericht für:</b> ${deDate(day)}</p>
      <h3>❌ Abschriften (${abschriften.length})</h3>
      <ul>${abschriften.length ? abschriften.map(r => li(r)).join("") : "<li>Keine Abschriften</li>"}</ul>
      <h3>✅ Kontrollen (${kontrollen.length})</h3>
      <ul>${kontrollen.length ? kontrollen.map(r => li(r, true)).join("") : "<li>Keine Kontrollen</li>"}</ul>
    `;

    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        subject: `MHD Kontrolle – Tagesbericht ${deDate(day)}`,
        html,
      }),
    });

    if (!mailRes.ok) return new Response("Mailfehler: " + await mailRes.text(), { status: 500 });
    return new Response(JSON.stringify({ ok: true, day, abschriften: abschriften.length, kontrollen: kontrollen.length }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(String(e?.message || e), { status: 500 });
  }
});


import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportAbschriftenPDF(abschriften = []) {
  try {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("MHD Abschriften", 14, 20);

    const rows = abschriften.map((item) => [
      item.artikelnummer || "",
      item.name || item.artikel || "",
      String(item.menge || 0),
      item.mhd || "",
      item.mitarbeiter || "",
    ]);

    autoTable(doc, {
      startY: 30,
      head: [["Artikelnummer", "Name", "Menge", "MHD", "Mitarbeiter"]],
      body: rows,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [215, 25, 32] },
    });

    doc.save("abschriften.pdf");
  } catch (err) {
    alert("PDF Fehler: " + err.message);
    console.error(err);
  }
}

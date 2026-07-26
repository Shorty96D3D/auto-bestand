import { buildStockSheetRows, buildStatsSheetRows } from './pdfData.js';

export function generateInventoryPdf(items, movements, year) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(`Jahresinventur ${year} — Bestand`, 14, 16);
  doc.setFontSize(10);
  let y = 26;
  // True while `y` sits at the top of a page the stock loop just opened but did
  // not write to yet — starting the stats sheet then must not add ANOTHER page.
  let onFreshPage = false;
  for (const row of buildStockSheetRows(items)) {
    doc.text(`${row.category} | ${row.name} | ${row.currentQty}/${row.targetQty} ${row.unit} | ${row.status === 'ok' ? 'OK' : 'Knapp'}`, 14, y);
    y += 6;
    if (y > 280) { doc.addPage(); y = 20; onFreshPage = true; } else { onFreshPage = false; }
  }

  if (!onFreshPage) doc.addPage();
  doc.setFontSize(16);
  doc.text(`Jahresinventur ${year} — Statistik`, 14, 16);
  doc.setFontSize(10);
  y = 26;
  for (const row of buildStatsSheetRows(movements, items, year)) {
    doc.text(`${row.category} | ${row.name} | Entnahmen: ${row.removals} | Auffüllungen: ${row.additions} | Menge entnommen: ${row.totalRemovedQty}`, 14, y);
    y += 6;
    if (y > 280) { doc.addPage(); y = 20; }
  }

  return doc;
}

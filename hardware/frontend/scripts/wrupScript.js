import { jsPDF } from "jspdf";

const form = document.getElementById("computer-build-form");
const status = document.getElementById("download-status");
const answerFields = Array.from(document.querySelectorAll("[data-pdf-label]"));

function addAnswersToPdf() {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 20;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - (margin * 2);
  let y = margin;

  pdf.setProperties({
    title: "Hardware-Arbeitsheft – Abschluss",
    subject: "Zusammenstellung eines Computers",
  });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Hardware-Arbeitsheft – Abschluss", margin, y);
  y += 9;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(90);
  pdf.text("Erstellt am " + new Intl.DateTimeFormat("de-DE").format(new Date()), margin, y);
  y += 12;

  answerFields.forEach((field) => {
    const label = field.dataset.pdfLabel;
    const answer = field.value.trim() || "Keine Angabe";

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    const labelLines = pdf.splitTextToSize(label, contentWidth);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    const answerLines = pdf.splitTextToSize(answer, contentWidth);
    const sectionHeight = (labelLines.length * 6) + (answerLines.length * 5) + 8;

    if (y + sectionHeight > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }

    pdf.setTextColor(45);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(labelLines, margin, y);
    y += labelLines.length * 6;

    pdf.setTextColor(65);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(answerLines, margin, y);
    y += answerLines.length * 5 + 4;

    pdf.setDrawColor(214, 202, 187);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 7;
  });

  pdf.save("hardware-arbeitsheft-antworten.pdf");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  try {
    addAnswersToPdf();
    status.textContent = "Die PDF wurde erstellt.";
  } catch (error) {
    console.error("PDF generation failed", error);
    status.textContent = "Die PDF konnte nicht erstellt werden.";
  }
});

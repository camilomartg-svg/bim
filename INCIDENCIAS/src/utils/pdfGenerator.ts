import { jsPDF } from 'jspdf';
import { SiteReport, QualityReport } from '../types';

export const generateSiteReportPDF = async (report: SiteReport) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let y = 20;

  // Helper check for page overflow
  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = 20;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${report.title} (${report.code})`, margin, 12);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, 14, pageWidth - margin, 14);
    }
  };

  // 1. BRAND HEADER
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(67, 56, 202); // indigo-700
  doc.text("BITÁCORA TÉCNICA - INFORME DE OBRA", margin, y);
  y += 6;

  // Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(2, 6, 23); // slate-950
  doc.text(report.title.toUpperCase(), margin, y);
  y += 8;

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // METADATA BOX
  ensureSpace(25);
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(margin, y, contentWidth, 24, 3, 3, 'F');
  
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 24, 3, 3, 'D');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text("EMITIDO POR", margin + 6, y + 6);
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(report.creatorName.toUpperCase(), margin + 6, y + 12);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`${report.creatorPosition || 'Personal de Obra'} ${report.creatorTeam ? `| ${report.creatorTeam}` : ''}`, margin + 6, y + 17);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("CÓDIGO", margin + (contentWidth / 2) + 10, y + 6);
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(67, 56, 202); // indigo-700
  doc.text(report.code, margin + (contentWidth / 2) + 10, y + 12);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  
  let formattedDate = '';
  try {
    formattedDate = new Date(report.createdAt).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    formattedDate = report.createdAt || '';
  }
  doc.text(formattedDate, margin + (contentWidth / 2) + 10, y + 17);

  y += 32;

  // 2. BLOCKS / ITEMS
  let blockIndex = 1;
  const blocks = report.blocks || [];

  for (const block of blocks) {
    ensureSpace(55);

    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(`REGISTRO #${String(blockIndex).padStart(2, '0')}`, margin + 5, y + 5.5);
    
    y += 14;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("DESCRIPCIÓN:", margin, y);
    y += 5;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    
    const descLines = doc.splitTextToSize(block.description || '', contentWidth);
    doc.text(descLines, margin, y);
    y += (descLines.length * 4.5) + 6;

    // Locations Box
    ensureSpace(20);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD');

    const units = block.location?.units?.join(', ') || 'N/A';
    const levels = block.location?.levels?.join(', ') || 'N/A';
    const spaces = block.location?.spaces?.join(', ') || 'N/A';

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("UNIDAD", margin + 6, y + 4);
    doc.text("NIVEL", margin + (contentWidth / 3) + 6, y + 4);
    doc.text("ESPACIO", margin + ((contentWidth * 2) / 3) + 6, y + 4);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(units.toUpperCase(), margin + 6, y + 9);
    doc.setTextColor(37, 99, 235); // blue-600
    doc.text(levels.toUpperCase(), margin + (contentWidth / 3) + 6, y + 9);
    doc.setTextColor(22, 163, 74); // green-600
    doc.text(spaces.toUpperCase(), margin + ((contentWidth * 2) / 3) + 6, y + 9);

    y += 24;
    blockIndex++;
  }

  doc.save(`${report.code}_${report.title.replace(/\s+/g, '_')}.pdf`);
};

export const generateQualityReportPDF = async (report: QualityReport, teamMembers?: any[]) => {
  const isEnv = report.reportType === 'ENVIRONMENTAL';
  const brandTitle = isEnv ? "REGISTRO DE CONTROL - INFORME DE INSPECCIÓN AMBIENTAL" : "REGISTRO DE CONTROL - INFORME DE CALIDAD (BIM)";
  const primaryBgColor = isEnv ? [240, 253, 244] : [254, 242, 242];
  const primaryBorderColor = isEnv ? [34, 197, 94] : [239, 68, 68];
  const primaryTextDark = isEnv ? [21, 128, 61] : [153, 27, 27];
  const primaryTextColor = isEnv ? [20, 83, 45] : [127, 29, 29];
  const brandColor = isEnv ? [16, 185, 129] : [220, 38, 38];

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let y = 20;

  // Helper check for page overflow
  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = 20;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${report.title} (${report.code})`, margin, 12);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, 14, pageWidth - margin, 14);
    }
  };

  // 1. BRAND HEADER
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]); // Dynamic
  doc.text(brandTitle, margin, y);
  y += 6;

  // Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(2, 6, 23); // slate-950
  doc.text(report.title.toUpperCase(), margin, y);
  y += 8;

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // METADATA BOX
  ensureSpace(25);
  doc.setFillColor(primaryBgColor[0], primaryBgColor[1], primaryBgColor[2]);
  doc.roundedRect(margin, y, contentWidth, 24, 3, 3, 'F');
  
  doc.setDrawColor(primaryBorderColor[0], primaryBorderColor[1], primaryBorderColor[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 24, 3, 3, 'D');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryTextDark[0], primaryTextDark[1], primaryTextDark[2]);
  doc.text("EMITIDO POR", margin + 6, y + 6);
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(2, 6, 23);
  doc.text(report.creatorName.toUpperCase(), margin + 6, y + 12);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(primaryTextColor[0], primaryTextColor[1], primaryTextColor[2]);
  doc.text(`${report.creatorPosition || (isEnv ? 'Ambiental' : 'Calidad')} ${report.creatorTeam ? `| ${report.creatorTeam}` : ''}`, margin + 6, y + 17);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryTextDark[0], primaryTextDark[1], primaryTextDark[2]);
  doc.text("CÓDIGO DE INFORME", margin + (contentWidth / 2) + 10, y + 6);
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]);
  doc.text(report.code, margin + (contentWidth / 2) + 10, y + 12);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(primaryTextColor[0], primaryTextColor[1], primaryTextColor[2]);
  
  let formattedDate = '';
  try {
    formattedDate = new Date(report.createdAt).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    formattedDate = report.createdAt || '';
  }
  doc.text(formattedDate, margin + (contentWidth / 2) + 10, y + 17);

  y += 32;

  // 2. BLOCKS / ITEMS
  let blockIndex = 1;
  const blocks = report.blocks || [];

  for (const block of blocks) {
    ensureSpace(80);

    // Block ID banner
    doc.setFillColor(primaryBgColor[0], primaryBgColor[1], primaryBgColor[2]); // Dynamic
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(primaryTextDark[0], primaryTextDark[1], primaryTextDark[2]); // Dynamic
    const titleText = block.title ? ` - ${block.title.toUpperCase().slice(0, 55)}${block.title.length > 55 ? '...' : ''}` : '';
    doc.text(`HALLAZGO #${String(blockIndex).padStart(2, '0')} - ${block.code}${titleText}`, margin + 5, y + 5.5);
    
    y += 14;

    // Row with Source | Hito | Type
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("FUENTE", margin, y);
    doc.text("HITO", margin + 60, y);
    doc.text("TIPO", margin + 120, y);
    y += 4;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(block.source || 'N/A', margin, y);
    doc.text(block.hito || 'N/A', margin + 60, y);
    doc.text(block.type || 'N/A', margin + 120, y);
    y += 10;

    // Block description
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("DESCRIPCIÓN DE HALLAZGO", margin, y);
    y += 4;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    const descLines = doc.splitTextToSize(block.description || '', contentWidth);
    doc.text(descLines, margin, y);
    y += (descLines.length * 4.5) + 8;

    // Action Plan / Corrective Action
    ensureSpace(35);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("ACCIÓN CORRECTIVA MANDATORIA", margin, y);
    y += 4;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    const correctiveLines = doc.splitTextToSize(block.correctiveAction || 'S/N', contentWidth);
    doc.text(correctiveLines, margin, y);
    y += (correctiveLines.length * 4.5) + 8;

    // Responsibility Card
    ensureSpace(20);
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("RESPONSABLE ASIGNADO", margin + 6, y + 4);
    doc.text("PROCESO AUDITADO", margin + 65, y + 4);
    doc.text("FECHA DE COMPROMISO", margin + 110, y + 4);
    doc.text("CRITICIDAD", margin + 148, y + 4);

    let teamName = '';
    if (teamMembers && block.assignedEmail) {
      const found = teamMembers.find(m => m.email?.toLowerCase() === block.assignedEmail?.toLowerCase());
      if (found) teamName = found.team || '';
    }
    if (!teamName && teamMembers && block.assignedName) {
      const found = teamMembers.find(m => m.name?.toLowerCase() === block.assignedName?.toLowerCase());
      if (found) teamName = found.team || '';
    }
    if (!teamName) {
      teamName = block.assignedTeam || '';
    }

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${block.assignedName || 'N/A'} (${block.assignedPosition || 'N/A'})`, margin + 6, y + 9);
    doc.text(teamName || 'SIN ESPECIFICAR', margin + 65, y + 9);
    doc.text(block.dueDate || 'N/A', margin + 110, y + 9);
    doc.text(block.criticality || 'MEDIA', margin + 148, y + 9);

    y += 24;
    blockIndex++;
  }

  doc.save(`${report.code}_${report.title.replace(/\s+/g, '_')}.pdf`);
};

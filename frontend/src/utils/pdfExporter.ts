/**
 * pdfExporter.ts  –  Intelligent multi-page A4 PDF export
 *
 * Page Setup:
 *   - Page 1: No outer border. Content fills standard printable area (x=15mm, y=15mm, w=180mm, h=267mm).
 *   - Page 2+: Enclosed in border box (x=15mm, y=15mm, w=180mm, h=267mm).
 *     Content placed inside the border with 1 cm (10mm) top and bottom gaps:
 *     starts at (x=15mm, y=25mm), max usable height of 247mm.
 *
 * Pagination Engine:
 *   - Measures DOM element boundaries (table rows, paragraphs, lists, images, signatures).
 *   - Prevents splitting table rows, images, and signature blocks.
 *   - Safely breaks between paragraphs or falls back to text-line gaps.
 *   - Renders at 1:1 scale (no text stretching or scaling down).
 *
 * Library: dom-to-image-more (supports Tailwind v4 oklch colors natively).
 */

import domtoimage from 'dom-to-image-more';
import { jsPDF } from 'jspdf';
import {
  MARGIN_MM,
  GAP_MM,
  CONTENT_W_MM,
  BORDER_H_MM,
  CONTENT_W_PX,
  SCALE,
  getSmartCutY,
} from './pagination';

// ── Main export function ──────────────────────────────────────────────────────

export async function exportToPdf(
  filename = 'Activity_Report.pdf',
  onProgress?: (msg: string) => void
): Promise<void> {
  const el = document.getElementById('report-hidden-measure') || document.getElementById('report-a4-document');
  if (!el) throw new Error('Report content element not found – open the editor first.');

  onProgress?.('Preparing document...');

  // ── 1. Measure element boundaries in the live DOM first ────────────────────
  const elementRect = el.getBoundingClientRect();

  // Query block elements to avoid splitting
  const trs = Array.from(el.querySelectorAll('tr'));
  const paras = Array.from(el.querySelectorAll('.report-table-description p, .report-table-description li'));
  const imgs = Array.from(el.querySelectorAll('.photo-gallery-grid img'));
  const sigs = Array.from(el.querySelectorAll('.signatures-section-container, .signature-block-container'));
  const footer = Array.from(el.querySelectorAll('.document-footer-container'));

  const boundaries: Array<{ top: number; bottom: number; isUnsplittable: boolean }> = [];

  const addBoundary = (elements: Element[], isUnsplittable = false) => {
    elements.forEach(item => {
      const r = item.getBoundingClientRect();
      const relativeTop = r.top - elementRect.top;
      const relativeBottom = r.bottom - elementRect.top;
      boundaries.push({
        top: Math.round(relativeTop * SCALE),
        bottom: Math.round(relativeBottom * SCALE),
        isUnsplittable
      });
    });
  };

  addBoundary(trs, false);
  addBoundary(paras, false);
  addBoundary(imgs, true);   // never split images
  addBoundary(sigs, true);   // never split signatures
  addBoundary(footer, true); // never split footer

  // Sort boundaries ascending for scanning
  boundaries.sort((a, b) => a.top - b.top);

  // Full height of the content
  const contentHeight = Math.max(el.scrollHeight, el.offsetHeight, 400);

  onProgress?.('Capturing content...');

  // ── 2. Capture pure content at exactly 180mm width (zero margins) ──────────
  // Margins (15mm) and gaps (10mm) will be drawn dynamically in jsPDF.
  const pngDataUrl: string = await (domtoimage as any).toPng(el, {
    bgcolor: '#ffffff',
    width  : CONTENT_W_PX,
    height : contentHeight,
    style  : {
      width          : `${CONTENT_W_PX}px`,
      minHeight      : `${contentHeight}px`,
      padding        : '0',
      margin         : '0',
      boxSizing      : 'border-box',
      transform      : 'none',
      transformOrigin: 'top left',
      boxShadow      : 'none',
      borderRadius   : '0',
      background     : '#ffffff',
    },
    scale: SCALE,
  });

  onProgress?.('Analysing layout...');

  // ── 3. Decode PNG → canvas ─────────────────────────────────────────────────
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload  = () => resolve();
    img.onerror = () => reject(new Error('Failed to decode captured image.'));
    img.src = pngDataUrl;
  });

  const fullCanvas = document.createElement('canvas');
  fullCanvas.width  = img.naturalWidth;
  fullCanvas.height = img.naturalHeight;
  const ctx = fullCanvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, fullCanvas.width, fullCanvas.height);
  ctx.drawImage(img, 0, 0);

  onProgress?.('Building PDF pages...');

  // ── 4. Create jsPDF ────────────────────────────────────────────────────────
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit       : 'mm',
    format     : 'a4',
    compress   : true,
  });

  const canvasW = fullCanvas.width;
  const canvasH = fullCanvas.height;

  // Usable content heights in mm
  const USABLE_H_MM_FIRST = BORDER_H_MM; // 267 mm (no top/bottom gaps)
  const USABLE_H_MM_OTHERS = BORDER_H_MM - GAP_MM * 2; // 247 mm (includes 1cm top/bottom gaps)

  let offsetY = 0;
  let pageNum = 0;

  while (offsetY < canvasH) {
    if (pageNum > 0) pdf.addPage();
    pageNum++;

    const isFirstPage = pageNum === 1;
    const currentUsableH = isFirstPage ? USABLE_H_MM_FIRST : USABLE_H_MM_OTHERS;

    // Usable height per page in canvas pixels
    const pageHPx = Math.round((currentUsableH / CONTENT_W_MM) * canvasW);

    // Select the optimal cut coordinate
    const actualCut = getSmartCutY(offsetY, pageHPx, canvasH, boundaries, ctx, canvasW);
    const sliceH = actualCut - offsetY;

    // Draw slice onto temporary canvas
    const pageCanvas  = document.createElement('canvas');
    pageCanvas.width  = canvasW;
    pageCanvas.height = sliceH;
    const pCtx = pageCanvas.getContext('2d')!;
    pCtx.fillStyle = '#ffffff';
    pCtx.fillRect(0, 0, canvasW, sliceH);
    pCtx.drawImage(fullCanvas, 0, offsetY, canvasW, sliceH, 0, 0, canvasW, sliceH);

    const imgData = pageCanvas.toDataURL('image/jpeg', 0.93);

    // Determine placement Y coordinate
    // First page content starts at MARGIN_MM (15mm), subsequent pages at MARGIN_MM + GAP_MM (25mm)
    const placementY = isFirstPage ? MARGIN_MM : (MARGIN_MM + GAP_MM);
    const imgHeightMm = (sliceH / canvasW) * CONTENT_W_MM;

    pdf.addImage(imgData, 'JPEG', MARGIN_MM, placementY, CONTENT_W_MM, imgHeightMm, '', 'FAST');

    // Draw page outer border box ONLY on Page 2 onwards, dynamically sized to fit content + 10mm top/bottom gaps
    if (!isFirstPage) {
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.25);
      pdf.rect(MARGIN_MM, MARGIN_MM, CONTENT_W_MM, imgHeightMm + GAP_MM * 2, 'S');

      // Draw table vertical column divider (x = 69mm) if this page contains table content
      const tableBottomPx = trs.length > 0
        ? Math.round(Math.max(...trs.map(tr => tr.getBoundingClientRect().bottom - elementRect.top)) * SCALE)
        : 0;

      if (offsetY < tableBottomPx) {
        const tableEndOnPagePx = Math.min(actualCut, tableBottomPx);
        const yEndMm = tableBottomPx > actualCut
          ? (MARGIN_MM + imgHeightMm + GAP_MM * 2)
          : (placementY + ((tableEndOnPagePx - offsetY) / canvasW) * CONTENT_W_MM);

        pdf.line(
          MARGIN_MM + CONTENT_W_MM * 0.3, // x = 69 mm
          MARGIN_MM,                     // start at top border (15mm)
          MARGIN_MM + CONTENT_W_MM * 0.3, 
          yEndMm                         // end at bottom page border or table end
        );
      }
    }

    offsetY += sliceH;
    onProgress?.(`Page ${pageNum} done...`);
  }

  onProgress?.('Saving PDF...');
  pdf.save(filename);
  onProgress?.('Download complete!');
}

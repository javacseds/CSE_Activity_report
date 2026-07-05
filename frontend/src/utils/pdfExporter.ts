/**
 * pdfExporter.ts  –  Intelligent multi-page A4 PDF export
 *
 * Page Setup:
 *   - Outer border box on every page at (x=15mm, y=15mm, w=180mm, h=267mm).
 *   - Content placed inside the border with 1 cm (10mm) top and bottom gaps:
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

// ── Page Geometry (A4, 15mm margins, 10mm top/bottom gaps) ─────────────────────
const A4_W_MM     = 210;       // A4 page width
const A4_H_MM     = 297;       // A4 page height
const MARGIN_MM   = 15;        // 1.5 cm margins on all sides
const GAP_MM      = 10;        // 1 cm gap inside the border

const CONTENT_W_MM = A4_W_MM - MARGIN_MM * 2;                 // 180 mm
const BORDER_H_MM  = A4_H_MM - MARGIN_MM * 2;                 // 267 mm
const USABLE_H_MM  = BORDER_H_MM - GAP_MM * 2;                // 247 mm

const DPI          = 96;        // Standard CSS reference pixel density
const MM_PER_IN    = 25.4;

// Pixel equivalents at 96 dpi (at 1x scale)
const CONTENT_W_PX = (CONTENT_W_MM / MM_PER_IN) * DPI;         // ~680.3 px

const SCALE         = 2;       // 2x scale for print-quality rendering
const SCAN_RANGE_PX = 400;     // scan up to 400 pixels backward for safe text line gap (at 2x)
const WHITE_LEVEL   = 242;     // RGB threshold to count as white background
const WHITE_RATIO   = 0.99;    // Require 99% of scanned text column to be white

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Scan upward from maxY looking for a safe text line gap (ignoring vertical borders) */
function findSafeCutY(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  maxY: number
): number {
  // Scan 35% to 95% of the page width to ignore the table's left/right borders
  const startX = Math.floor(canvasW * 0.35);
  const endX = Math.floor(canvasW * 0.95);
  const scanW = endX - startX;

  for (let y = maxY; y >= Math.max(0, maxY - SCAN_RANGE_PX); y--) {
    const row = ctx.getImageData(startX, y, scanW, 1).data;
    let white = 0;
    for (let i = 0; i < row.length; i += 4) {
      if (row[i] >= WHITE_LEVEL && row[i + 1] >= WHITE_LEVEL && row[i + 2] >= WHITE_LEVEL) {
        white++;
      }
    }
    if (white / scanW >= WHITE_RATIO) return y;
  }
  return maxY;
}

/**
 * Intelligent pagination cut selector:
 *   - Avoids splitting signature blocks, images, or table rows if they fit.
 *   - Tries to cut at paragraph/list boundaries.
 *   - Falls back to text line gaps.
 */
function getSmartCutY(
  offsetY: number,
  pageHPx: number,
  canvasH: number,
  boundaries: Array<{ top: number; bottom: number; isUnsplittable: boolean }>,
  ctx: CanvasRenderingContext2D,
  canvasW: number
): number {
  const candidateCut = offsetY + pageHPx;
  if (candidateCut >= canvasH) return canvasH;

  // Find all blocks crossing the candidate cut line
  const crossing = boundaries.filter(
    b => b.top < candidateCut && b.bottom > candidateCut
  );

  if (crossing.length > 0) {
    // Sort by height (smallest first) to prioritize paragraph breaks over table row breaks
    crossing.sort((a, b) => (a.bottom - a.top) - (b.bottom - b.top));

    for (const block of crossing) {
      const targetCut = block.top - 2; // slice 2px above block
      const pageHeightWithCut = targetCut - offsetY;

      // Force push unsplittable items (images, signatures), or split if we preserve >= 45% fill
      if (block.isUnsplittable || pageHeightWithCut >= pageHPx * 0.45) {
        return targetCut;
      }
    }
  }

  // Fallback to text line pixel scanner
  return findSafeCutY(ctx, canvasW, candidateCut);
}

// ── Main export function ──────────────────────────────────────────────────────

export async function exportToPdf(
  filename = 'Activity_Report.pdf',
  onProgress?: (msg: string) => void
): Promise<void> {
  const el = document.getElementById('report-a4-document');
  if (!el) throw new Error('Preview element not found – open the editor first.');

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

  // Max usable height per page in canvas pixels
  const pageHPx = Math.round((USABLE_H_MM / CONTENT_W_MM) * canvasW);

  let offsetY = 0;
  let pageNum = 0;

  while (offsetY < canvasH) {
    if (pageNum > 0) pdf.addPage();
    pageNum++;

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

    // Place content inside margins: x=15mm, y=25mm (15mm margin + 10mm top gap)
    const imgHeightMm = (sliceH / canvasW) * CONTENT_W_MM;
    pdf.addImage(imgData, 'JPEG', MARGIN_MM, MARGIN_MM + GAP_MM, CONTENT_W_MM, imgHeightMm, '', 'FAST');

    // Draw page outer border box on all pages (x=15mm, y=15mm, w=180mm, h=267mm)
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.25);
    pdf.rect(MARGIN_MM, MARGIN_MM, CONTENT_W_MM, BORDER_H_MM, 'S');

    offsetY += sliceH;
    onProgress?.(`Page ${pageNum} done...`);
  }

  onProgress?.('Saving PDF...');
  pdf.save(filename);
  onProgress?.('Download complete!');
}

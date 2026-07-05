/**
 * pdfExporter.ts  –  Multi-page A4 PDF export
 *
 * Page Setup: exactly 1.5 cm (15 mm) margins on all four sides.
 *
 * How margins are achieved:
 *   - The document is forced to render at exactly 210 mm width (793 px @ 96 dpi).
 *   - 15 mm of padding (56.7 px) is baked INTO the captured image on every side.
 *   - The image is placed at (x=0, y=0) filling the FULL A4 page in jsPDF.
 *   - There are NO extra jsPDF margins — the padding inside the image IS the margin.
 *   This guarantees exactly 1.5 cm on all sides regardless of screen size.
 *
 * Smart page breaks:
 *   After capturing the full-height image, the slicer scans backward from each
 *   candidate cut-line for a mostly-white row, preventing tables or field blocks
 *   from being severed mid-content.
 *
 * Library: dom-to-image-more (supports Tailwind v4 oklch colors natively).
 */

import domtoimage from 'dom-to-image-more';
import { jsPDF } from 'jspdf';

// ── Constants ─────────────────────────────────────────────────────────────────
const A4_W_MM    = 210;       // A4 page width in mm
const A4_H_MM    = 297;       // A4 page height in mm
const MARGIN_MM  = 15;        // 1.5 cm margin on each side
const DPI        = 96;        // CSS reference pixel density
const MM_PER_IN  = 25.4;

// Pixel equivalents at 96 dpi
const A4_W_PX   = (A4_W_MM   / MM_PER_IN) * DPI;   // 793.70 px
const A4_H_PX   = (A4_H_MM   / MM_PER_IN) * DPI;   // 1122.52 px
const MARGIN_PX = (MARGIN_MM  / MM_PER_IN) * DPI;   // 56.69 px (≈ 1.5 cm)

const SCALE         = 2;     // 2x for retina-quality output
const SCAN_RANGE_PX = 180;   // pixels to scan backward for a safe cut (at 2x)
const WHITE_LEVEL   = 232;   // min RGB channel value to count as "white"
const WHITE_RATIO   = 0.80;  // fraction of row that must be white for a safe cut

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Scan upward from maxY for a row that is ≥ WHITE_RATIO white pixels. */
function findSafeCutY(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  maxY: number
): number {
  for (let y = maxY; y >= Math.max(0, maxY - SCAN_RANGE_PX); y--) {
    const row = ctx.getImageData(0, y, canvasW, 1).data;
    let white = 0;
    for (let i = 0; i < row.length; i += 4) {
      if (row[i] >= WHITE_LEVEL && row[i + 1] >= WHITE_LEVEL && row[i + 2] >= WHITE_LEVEL) white++;
    }
    if (white / canvasW >= WHITE_RATIO) return y;
  }
  return maxY;
}

// ── Main export function ──────────────────────────────────────────────────────

export async function exportToPdf(
  filename = 'Activity_Report.pdf',
  onProgress?: (msg: string) => void
): Promise<void> {
  const el = document.getElementById('report-a4-document');
  if (!el) throw new Error('Preview element not found – open the editor first.');

  onProgress?.('Preparing document...');

  // Full scroll height of the document (content may exceed one screen)
  const contentHeight = Math.max(el.scrollHeight, el.offsetHeight, 400);

  // Total capture height = content + top/bottom padding
  const captureH = contentHeight + MARGIN_PX * 2;

  onProgress?.('Capturing content...');

  // ── Capture at exactly A4 width with 1.5cm padding baked in ─────────────
  // We override:
  //   width   → 210mm (793px) so content fills the full page
  //   padding → 15mm (56.7px) on all sides — these become the PDF margins
  //   height  → full content height + top/bottom padding
  const pngDataUrl: string = await (domtoimage as any).toPng(el, {
    bgcolor: '#ffffff',
    width  : A4_W_PX,
    height : captureH,
    style  : {
      width          : `${A4_W_PX}px`,
      minHeight      : `${captureH}px`,
      padding        : `${MARGIN_PX}px`,
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

  // ── Decode PNG → canvas ───────────────────────────────────────────────────
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

  // ── Create jsPDF ─────────────────────────────────────────────────────────
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit       : 'mm',
    format     : 'a4',
    compress   : true,
  });

  const canvasW = fullCanvas.width;   // A4_W_PX * SCALE = ~1587 px
  const canvasH = fullCanvas.height;

  // One A4 page in canvas pixels (full page height at 2x scale)
  const pageHPx = Math.round((A4_H_PX / A4_W_PX) * canvasW);

  let offsetY = 0;
  let pageNum = 0;

  while (offsetY < canvasH) {
    if (pageNum > 0) pdf.addPage();
    pageNum++;

    const candidateCut = offsetY + pageHPx;

    let actualCut: number;
    if (candidateCut >= canvasH) {
      actualCut = canvasH;
    } else {
      actualCut = findSafeCutY(ctx, canvasW, candidateCut);
      if (actualCut <= offsetY) actualCut = candidateCut;
    }

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

    // Place at full page width (x=0, y=0) — margins are INSIDE the image
    // sliceH / canvasW gives the aspect ratio; multiply by A4_W_MM for mm height
    const imgHeightMm = (sliceH / canvasW) * A4_W_MM;

    pdf.addImage(
      imgData, 'JPEG',
      0, 0,           // x=0, y=0 — no extra jsPDF margins (margins are baked in)
      A4_W_MM,        // fill full 210mm page width
      imgHeightMm,    // proportional height
      '',
      'FAST'
    );

    offsetY += sliceH;
    onProgress?.(`Page ${pageNum} done...`);
  }

  onProgress?.('Saving PDF...');
  pdf.save(filename);
  onProgress?.('Download complete!');
}

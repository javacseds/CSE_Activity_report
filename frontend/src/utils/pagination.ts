/**
 * pagination.ts  –  Shared layout geometry and pagination utility
 */

// ── Page Geometry (A4, 15mm margins, 10mm top/bottom gaps) ─────────────────────
export const A4_W_MM     = 210;       // A4 page width
export const A4_H_MM     = 297;       // A4 page height
export const MARGIN_MM   = 15;        // 1.5 cm margins on all sides
export const GAP_MM      = 10;        // 1 cm gap inside the border

export const CONTENT_W_MM = A4_W_MM - MARGIN_MM * 2;                 // 180 mm
export const BORDER_H_MM  = A4_H_MM - MARGIN_MM * 2;                 // 267 mm
export const USABLE_H_MM  = BORDER_H_MM - GAP_MM * 2;                // 247 mm

export const DPI          = 96;        // Standard CSS reference pixel density
export const MM_PER_IN    = 25.4;

// Pixel equivalents at 96 dpi (at 1x scale)
export const CONTENT_W_PX = (CONTENT_W_MM / MM_PER_IN) * DPI;         // ~680.3 px

export const SCALE         = 2;       // 2x scale for print-quality rendering
export const SCAN_RANGE_PX = 300;     // scan up to 300 pixels backward for safe text line gap (at 2x)
export const WHITE_LEVEL   = 242;     // RGB threshold to count as white background
export const WHITE_RATIO   = 0.99;    // Require 99% of scanned text column to be white

export interface Boundary {
  top: number;
  bottom: number;
  isUnsplittable: boolean;
}

/** Scan upward from maxY looking for a safe text line gap (ignoring vertical borders) */
export function findSafeCutY(
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
export function getSmartCutY(
  offsetY: number,
  pageHPx: number,
  canvasH: number,
  boundaries: Boundary[],
  ctx: CanvasRenderingContext2D,
  canvasW: number
): number {
  const candidateCut = offsetY + pageHPx;
  if (candidateCut >= canvasH) return canvasH;

  // We want to fill the page as much as possible, so we only allow cutting
  // within the SCAN_RANGE_PX window at the bottom of the page.
  const minAllowedCut = candidateCut - SCAN_RANGE_PX;

  // Find all blocks crossing the candidate cut line
  const crossing = boundaries.filter(
    b => b.top < candidateCut && b.bottom > candidateCut
  );

  if (crossing.length > 0) {
    // Sort by height (smallest first) to prioritize paragraph breaks over table row breaks
    crossing.sort((a, b) => (a.bottom - a.top) - (b.bottom - b.top));

    for (const block of crossing) {
      const targetCut = block.top - 2; // slice 2px above block

      // Force push unsplittable items (images, signatures), or cut at the block top
      // if it falls within our allowed bottom window (to avoid large blank spaces).
      if (block.isUnsplittable || targetCut >= minAllowedCut) {
        if (targetCut > offsetY) {
          return targetCut;
        }
      }
    }
  }

  // Fallback to text line pixel scanner (which only scans within SCAN_RANGE_PX)
  const safeCut = findSafeCutY(ctx, canvasW, candidateCut);
  if (safeCut <= offsetY) {
    return candidateCut; // Absolute fallback: slice at candidate line
  }
  return safeCut;
}

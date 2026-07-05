import React, { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, Download } from 'lucide-react';
import { exportToPdf } from '../utils/pdfExporter';
import {
  MARGIN_MM,
  GAP_MM,
  CONTENT_W_MM,
  BORDER_H_MM,
  USABLE_H_MM,
  CONTENT_W_PX,
  SCALE
} from '../utils/pagination';
import type { Boundary } from '../utils/pagination';

interface Logo {
  id: string;
  src: string;
  visible: boolean;
  label: string;
  order: number;
  width?: number;
  height?: number;
}

interface Field {
  id: string;
  heading: string;
  description: string;
  type: string;
  order: number;
  required?: boolean;
}

interface Photo {
  id: string;
  src: string;
  caption: string;
  order: number;
}

interface Signature {
  id: string;
  designation: string;
  name: string;
  image: string;
  type: string;
  order: number;
}

interface ReportData {
  title: string;
  titleStyles: {
    fontFamily: string;
    fontSize: number;
    color: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    align: 'left' | 'center' | 'right' | 'justify';
    backgroundColor: string;
    letterSpacing?: number;
    lineSpacing?: number;
    textCase?: string;
    padding?: number;
    border?: string;
    borderRadius?: number;
  };
  headerStyles?: {
    fontFamily: string;
    fontSize: number;
    color: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    align: 'left' | 'center' | 'right' | 'justify';
    backgroundColor: string;
    height: number;
    spacing: number;
    showBorder: boolean;
    visible: boolean;
    institutionName: string;
    logoAlignment?: string;
  };
  imageConfig?: {
    layoutType: 'grid' | 'custom';
    columns: number;
    aspectRatio: 'maintain' | 'crop';
    maxPerPage: number;
    alignment: 'left' | 'center' | 'right';
  };
  logos: Logo[];
  infoTable?: {
    rows: Array<{
      id: string;
      name: string;
      value: string;
      visible: boolean;
      required: boolean;
      order: number;
    }>;
    styles: {
      showBorder: boolean;
      headerBg: string;
      headerColor: string;
      alternateRowBg: string;
      alternateRowColor: string;
      cellPadding: number;
      fontSize: number;
      fontFamily: string;
      borderThickness: number;
      borderRadius: number;
      rowHeight: number;
      colWidth: number;
      align: string;
    };
  };
  fields: Field[];
  photos: Photo[];
  signatures: Signature[];
  footer: {
    visible?: boolean;
    text: string;
    website: string;
    email: string;
    qrCode: string;
    socials: Record<string, string>;
    showBorder?: boolean;
    showLine?: boolean;
    backgroundColor?: string;
    fields?: Array<{
      id: string;
      type: string;
      label: string;
      value: string;
      visible: boolean;
      required: boolean;
      order: number;
      styles: {
        fontFamily: string;
        fontSize: number;
        color: string;
        bold: boolean;
        italic: boolean;
        underline: boolean;
        align: 'left' | 'center' | 'right';
      };
    }>;
  };
}

interface ReportPreviewProps {
  reportData: ReportData;
  zoom: number;
  setZoom: (zoom: number) => void;
  onPrint: () => void;
}

export const ReportPreview: React.FC<ReportPreviewProps> = ({
  reportData,
  zoom,
  setZoom,
}) => {
  const { title, fields, footer } = reportData;
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [pageSlices, setPageSlices] = useState<Array<{ offsetY: number; sliceH: number }>>([]);
  const [tableBottomPx, setTableBottomPx] = useState<number>(0);

  // Dynamic pagination double-pass scanner
  const measureAndSlice = () => {
    const hiddenEl = document.getElementById('report-hidden-measure');
    if (!hiddenEl) return;

    const contentHeight = hiddenEl.scrollHeight;
    const elementRect = hiddenEl.getBoundingClientRect();

    const boundaries: Boundary[] = [];
    const trs = Array.from(hiddenEl.querySelectorAll('tr'));
    const paras = Array.from(hiddenEl.querySelectorAll('.report-table-description p, .report-table-description li'));
    const imgs = Array.from(hiddenEl.querySelectorAll('.photo-gallery-grid img, .photo-gallery-grid div.flex'));
    const sigs = Array.from(hiddenEl.querySelectorAll('.signatures-section-container, .signature-block-container'));

    const addBoundary = (elements: Element[], isUnsplittable = false) => {
      elements.forEach(item => {
        const r = item.getBoundingClientRect();
        const relativeTop = r.top - elementRect.top;
        const relativeBottom = r.bottom - elementRect.top;
        boundaries.push({
          top: Math.round(relativeTop),
          bottom: Math.round(relativeBottom),
          isUnsplittable
        });
      });
    };

    addBoundary(trs, false);
    addBoundary(paras, false);
    addBoundary(imgs, true);
    addBoundary(sigs, true);

    boundaries.sort((a, b) => a.top - b.top);

    // Calculate table bottom limit for column divider line
    const calculatedTableBottom = trs.length > 0
      ? Math.max(...trs.map(tr => tr.getBoundingClientRect().bottom - elementRect.top))
      : 0;
    setTableBottomPx(calculatedTableBottom);

    // mm-to-pixel ratio
    const pxPerMm = hiddenEl.offsetWidth / CONTENT_W_MM;
    const page1MaxHPx = BORDER_H_MM * pxPerMm;
    const otherMaxHPx = USABLE_H_MM * pxPerMm;

    const slices: Array<{ offsetY: number; sliceH: number }> = [];
    let currentOffsetY = 0;
    const maxH = contentHeight;

    while (currentOffsetY < maxH) {
      const isFirstPage = slices.length === 0;
      const pageHPx = isFirstPage ? page1MaxHPx : otherMaxHPx;

      if (currentOffsetY + pageHPx >= maxH) {
        slices.push({ offsetY: currentOffsetY, sliceH: maxH - currentOffsetY });
        break;
      }

      const candidateCut = currentOffsetY + pageHPx;
      let bestCut = candidateCut;

      const minAllowedCut = candidateCut - (300 / SCALE); // Scan back 150px in 1x scale
      const crossing = boundaries.filter(b => b.top < candidateCut && b.bottom > candidateCut);

      if (crossing.length > 0) {
        crossing.sort((a, b) => (a.bottom - a.top) - (b.bottom - b.top));
        for (const block of crossing) {
          const targetCut = block.top - 2;
          if (block.isUnsplittable || targetCut >= minAllowedCut) {
            if (targetCut > currentOffsetY) {
              bestCut = targetCut;
              break;
            }
          }
        }
      }

      slices.push({ offsetY: currentOffsetY, sliceH: bestCut - currentOffsetY });
      currentOffsetY = bestCut;
    }

    setPageSlices(slices);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      measureAndSlice();
    }, 150);
    return () => clearTimeout(timer);
  }, [reportData]);

  const handleDownloadPdf = async () => {
    const emptyRequiredFields = fields.filter(
      f => f.required && (!f.description || f.description.replace(/<[^>]*>/g, '').trim() === '')
    );
    if (emptyRequiredFields.length > 0) {
      alert(`Validation Error: The following required fields are empty:\n` + emptyRequiredFields.map(f => `• ${f.heading}`).join('\n') + `\n\nPlease fill them in before downloading.`);
      return;
    }

    const safeFilename = (title || 'Activity_Report').replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, '_') + '.pdf';
    setPdfStatus('Preparing...');
    try {
      await exportToPdf(safeFilename, (msg) => setPdfStatus(msg));
    } catch (err: any) {
      console.error('PDF export failed:', err);
      const errMsg = err?.message || String(err);
      setPdfStatus('Failed');
      alert(`PDF Export Failed:\n${errMsg}`);
    } finally {
      setTimeout(() => setPdfStatus(null), 5000);
    }
  };

  const getZoomClass = () => {
    if (zoom === 75) return 'scale-75 origin-top';
    if (zoom === 90) return 'scale-90 origin-top';
    if (zoom === 110) return 'scale-110 origin-top';
    if (zoom === 125) return 'scale-125 origin-top';
    return 'scale-100 origin-top';
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-900 print:bg-transparent print:h-auto print:border-none border-l border-slate-200 dark:border-slate-800 transition-colors duration-150">
      
      {/* Zoom and Action Bar */}
      <div className="no-print flex items-center justify-between p-3 bg-white dark:bg-slate-955 border-b border-slate-200 dark:border-slate-800 shadow-sm z-10 text-slate-705 dark:text-slate-300">
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-2">Live Preview</span>
          <button
            onClick={() => setZoom(Math.max(75, zoom - 15))}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition"
            title="Zoom Out"
            disabled={zoom <= 75}
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-medium min-w-[36px] text-center">{zoom}%</span>
          <button
            onClick={() => setZoom(Math.min(125, zoom + 15))}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition"
            title="Zoom In"
            disabled={zoom >= 125}
          >
            <ZoomIn size={16} />
          </button>
        </div>

        <button
          onClick={handleDownloadPdf}
          disabled={!!pdfStatus}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-xs font-medium transition shadow-sm"
        >
          <Download size={14} />
          <span>{pdfStatus ? pdfStatus : 'Download PDF'}</span>
        </button>
      </div>

      {/* Hidden layout measurement container clipped to 1px to remain rendered at full opacity */}
      <div 
        style={{
          position: 'fixed',
          left: '0px',
          top: '0px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          opacity: 1,
          zIndex: -1000,
          pointerEvents: 'none'
        }}
      >
        <div 
          id="report-hidden-measure" 
          style={{ 
            width: `${CONTENT_W_PX}px`,
            background: '#ffffff'
          }}
        >
          <ReportContent reportData={reportData} isMeasure={true} />
        </div>
      </div>

      {/* Visible paginated document cards */}
      <div className="flex-1 overflow-auto p-6 flex flex-col items-center print:block print:p-0 print:h-auto">
        <div className={`transition-all duration-200 ${getZoomClass()} print:transform-none print:w-full print:h-auto print:static`}>
          
          {pageSlices.length === 0 ? (
            <div className="a4-page relative flex flex-col justify-between" id="report-a4-document" style={{ width: '210mm', height: '297mm', padding: '15mm', border: '1px solid #e2e8f0', background: '#ffffff' }}>
              <ReportContent reportData={reportData} />
            </div>
          ) : (
            pageSlices.map((slice, index) => {
              const pageNum = index + 1;
              const isFirstPage = index === 0;
              
              const hiddenEl = document.getElementById('report-hidden-measure');
              const pxPerMm = hiddenEl ? (hiddenEl.offsetWidth / CONTENT_W_MM) : 3.7795;
              
              const sliceHMm = slice.sliceH / pxPerMm;
              const offsetYMm = slice.offsetY / pxPerMm;
              const totalPages = pageSlices.length;

              const maxHPx = isFirstPage ? (BORDER_H_MM * pxPerMm) : (USABLE_H_MM * pxPerMm);
const remainingSpacePercent = Math.max(0, Math.round(((maxHPx - slice.sliceH) / maxHPx) * 100));

              // Determine where the vertical divider line should stop
              const sliceEndOffsetY = slice.offsetY + slice.sliceH;
              const tableEndOnPagePx = Math.min(sliceEndOffsetY, tableBottomPx);
              const tableEndOnPageMm = ((tableEndOnPagePx - slice.offsetY) / pxPerMm);
              const maxBorderHMm = isFirstPage ? (sliceHMm + GAP_MM) : (sliceHMm + GAP_MM * 2);
              const yEndMm = tableBottomPx > sliceEndOffsetY
                ? (MARGIN_MM + maxBorderHMm)
                : (isFirstPage ? MARGIN_MM : (MARGIN_MM + GAP_MM)) + tableEndOnPageMm;

              return (
                <div key={index} className="flex flex-col items-center gap-2 mb-8 no-print select-none a4-page-card">
                  {/* Page Status Bar */}
                  <div className="w-[210mm] flex justify-between items-center text-[10px] text-slate-500 font-semibold px-2">
                    <span>Page {pageNum} of {totalPages}</span>
                    <span className={remainingSpacePercent < 15 ? "text-red-500 font-bold" : "text-green-600"}>
                      {remainingSpacePercent}% space remaining
                    </span>
                  </div>

                  {/* A4 Sheet Card */}
                  <div 
                    className="relative bg-white text-black shadow-lg box-border font-serif select-text"
                    style={{
                      width: '210mm',
                      height: '297mm',
                      padding: '15mm',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      border: '1px solid #cbd5e1',
                      position: 'relative'
                    }}
                  >
                    {/* Page outer border box for all pages */}
                    <div 
                      className="absolute pointer-events-none"
                      style={{
                        top: '15mm',
                        left: '15mm',
                        width: `${CONTENT_W_MM}mm`,
                        height: `${maxBorderHMm}mm`,
                        borderLeft: '0.25mm solid #000000',
                        borderRight: '0.25mm solid #000000',
                        borderBottom: '0.25mm solid #000000',
                        borderTop: isFirstPage ? 'none' : '0.25mm solid #000000',
                        zIndex: 10
                      }}
                    />

                    {/* Column Divider Line for all pages' tables */}
                    {slice.offsetY < tableBottomPx && (
                      <div 
                        className="absolute bg-black pointer-events-none"
                        style={{
                          left: '69mm', // 15mm left margin + 180mm * 0.3 = 69mm
                          top: '15mm',  // starts at top border boundary (15mm)
                          width: '0.25mm',
                          height: `${yEndMm - 15}mm`,
                          zIndex: 12
                        }}
                      />
                    )}

                    {/* Content slice viewport */}
                    <div 
                      style={{
                        width: `${CONTENT_W_MM}mm`,
                        height: `${sliceHMm}mm`,
                        overflow: 'hidden',
                        position: 'relative',
                        marginTop: isFirstPage ? 0 : `${GAP_MM}mm`,
                        background: '#ffffff',
                        zIndex: 1
                      }}
                    >
                      <div 
                        style={{
                          position: 'absolute',
                          top: `-${offsetYMm}mm`,
                          left: 0,
                          width: `${CONTENT_W_MM}mm`
                        }}
                      >
                        <ReportContent reportData={reportData} />
                      </div>
                    </div>

                    {/* Page Footer */}
                    {footer.visible !== false && (
                      <PageFooter 
                        footer={footer} 
                        pageNum={pageNum} 
                        totalPages={totalPages} 
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// ── Sub-component: Continuous Report Content Layout ───────────────────────────
const ReportContent: React.FC<{ reportData: ReportData; isMeasure?: boolean }> = ({ reportData, isMeasure = false }) => {
  const { title, titleStyles, logos, fields, photos, signatures, headerStyles, imageConfig } = reportData;

  const isGouthami = logos && logos.some(l => l.id === 'gouthami' || l.label.toLowerCase().includes('gouthami') || l.label.toLowerCase().includes('gitamw'));

  const getTitleStyles = () => {
    return {
      fontFamily: titleStyles.fontFamily || 'Times New Roman',
      fontSize: `${titleStyles.fontSize || 24}px`,
      color: titleStyles.color || '#000000',
      fontWeight: titleStyles.bold ? 'bold' : 'normal',
      fontStyle: titleStyles.italic ? 'italic' : 'normal',
      textDecoration: titleStyles.underline ? 'underline' : 'none',
      textAlign: titleStyles.align || 'center',
      backgroundColor: titleStyles.backgroundColor || 'transparent',
      padding: `${titleStyles.padding !== undefined ? titleStyles.padding : 10}px`,
      borderRadius: `${titleStyles.borderRadius || 0}px`,
      letterSpacing: `${titleStyles.letterSpacing || 0}px`,
      lineHeight: titleStyles.lineSpacing || 1.2,
      border: titleStyles.border || 'none',
      textTransform: (titleStyles.textCase === 'uppercase' ? 'uppercase' : (titleStyles.textCase === 'lowercase' ? 'lowercase' : (titleStyles.textCase === 'capitalize' ? 'capitalize' : 'none'))) as any
    };
  };

  const sortedFields = [...fields].sort((a, b) => a.order - b.order);
  const sortedPhotos = [...photos].sort((a, b) => a.order - b.order);
  const sortedSignatures = [...signatures].sort((a, b) => a.order - b.order);
  const visibleLogos = logos.filter(l => l.visible && l.src);

  // Dynamic Image Arrangement grid columns (1, 2, or 3)
  const cols = imageConfig?.columns || 2;
  const gridClass = cols === 1 
    ? 'grid-cols-1' 
    : cols === 3 
      ? 'grid-cols-3' 
      : 'grid-cols-2';

  return (
    <div className="select-text w-[180mm] bg-white text-black font-serif text-[12pt] leading-[1.5]" style={{ boxSizing: 'border-box' }}>
      
      {/* 1. Dynamic Header */}
      {headerStyles?.visible !== false && (
        <div 
          className="pb-4 mb-4 select-text" 
          style={{
            borderBottom: headerStyles?.showBorder !== false ? '2px solid #000000' : 'none',
            marginBottom: `${headerStyles?.spacing !== undefined ? headerStyles.spacing : 15}px`,
            backgroundColor: headerStyles?.backgroundColor || 'transparent'
          }}
        >
          <div className={`flex flex-wrap items-center gap-3 w-full mb-3 select-none ${
            headerStyles?.logoAlignment === 'left' ? 'justify-start' : (headerStyles?.logoAlignment === 'right' ? 'justify-end' : 'justify-center')
          }`}>
            {visibleLogos.map((logo) => {
              const logoW = logo.width || 50;
              const logoH = logo.height || 50;
              return (
                <div key={logo.id} className="flex flex-col items-center text-center" style={{ maxWidth: `${logoW + 15}px` }}>
                  <div 
                    className="flex items-center justify-center border border-slate-300 rounded overflow-hidden p-0.5 bg-white"
                    style={{ width: `${logoW}px`, height: `${logoH}px` }}
                  >
                    <img
                      src={logo.src}
                      alt={logo.label}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <span className="text-[7pt] mt-0.5 font-bold uppercase leading-tight select-none">{logo.label}</span>
                </div>
              );
            })}
          </div>

          <div 
            style={{
              textAlign: headerStyles?.align || 'center',
              fontFamily: headerStyles?.fontFamily || 'Times New Roman',
              fontSize: `${headerStyles?.fontSize || 12}pt`,
              color: headerStyles?.color || '#000000',
              fontWeight: headerStyles?.bold !== false ? 'bold' : 'normal',
              fontStyle: headerStyles?.italic ? 'italic' : 'normal',
              textDecoration: headerStyles?.underline ? 'underline' : 'none',
            }}
          >
            <h1 className="uppercase leading-normal tracking-wide m-0">
              {headerStyles?.institutionName || 'GOUTHAMI'}
            </h1>
            {(!headerStyles?.institutionName || headerStyles.institutionName === 'GOUTHAMI') && isGouthami && (
              <>
                <p className="text-[7.5pt] font-bold text-slate-700 uppercase leading-none mt-1">
                  Institute of Technology and Management for Women
                </p>
                <p className="text-[8pt] text-purple-750 font-bold uppercase tracking-wider mt-1 select-none">
                  ★ AUTONOMOUS ★
                </p>
              </>
            )}
            {(!headerStyles?.institutionName || headerStyles.institutionName.includes("Joseph")) && !isGouthami && (
              <>
                <p className="text-[8.5pt] italic text-slate-750 m-0 mt-1">
                  An Autonomous Institution affiliated to VTU, Belagavi | Approved by AICTE, New Delhi
                </p>
                <p className="text-[8.5pt] text-slate-755 m-0">
                  Accredited by NAAC with 'A+' Grade & NBA (CSE, ECE, ME, EEE)
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* 2. Title Section */}
      {title && (
        <div className="pb-4 select-text">
          <h2 style={getTitleStyles() as any}>{title}</h2>
        </div>
      )}

      {/* 3. Predefined Information Table */}
      {reportData.infoTable && reportData.infoTable.rows.some(r => r.visible) && (
        <div className="mb-6 select-text">
          <table 
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: reportData.infoTable.styles.fontFamily || 'Times New Roman',
              fontSize: `${reportData.infoTable.styles.fontSize || 11}pt`,
              border: reportData.infoTable.styles.showBorder ? `${reportData.infoTable.styles.borderThickness || 1}px solid #000000` : 'none'
            }}
          >
            <tbody>
              {reportData.infoTable.rows
                .filter(row => row.visible)
                .sort((a, b) => a.order - b.order)
                .map((row, index) => (
                  <tr 
                    key={row.id} 
                    style={{
                      backgroundColor: index % 2 === 1 ? reportData.infoTable!.styles.alternateRowBg : '#ffffff',
                      borderBottom: reportData.infoTable!.styles.showBorder ? `${reportData.infoTable!.styles.borderThickness || 1}px solid #000000` : 'none',
                      height: `${reportData.infoTable!.styles.rowHeight || 40}px`
                    }}
                  >
                    <td 
                      style={{
                        width: `${reportData.infoTable!.styles.colWidth || 35}%`,
                        fontWeight: 'bold',
                        padding: `${reportData.infoTable!.styles.cellPadding || 8}px`,
                        borderRight: reportData.infoTable!.styles.showBorder ? `${reportData.infoTable!.styles.borderThickness || 1}px solid #000000` : 'none',
                        verticalAlign: 'top'
                      }}
                    >
                      {row.name}
                    </td>
                    <td 
                      style={{
                        width: `${100 - (reportData.infoTable!.styles.colWidth || 35)}%`,
                        padding: `${reportData.infoTable!.styles.cellPadding || 8}px`,
                        verticalAlign: 'top'
                      }}
                    >
                      {row.value}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Main Details Report Table */}
      <div className="report-content select-text mb-6">
        <table className="w-full border-collapse border border-black table-fixed">
          <tbody>
            {sortedFields.map((field) => (
              <tr key={field.id} className="border-t border-black">
                <td className="report-table-heading font-serif text-[12pt] font-bold w-[30%] border border-black p-2 bg-slate-50/50">
                  {field.heading}
                </td>
                <td className="report-table-description font-serif text-[12pt] text-justify w-[70%] border border-black p-2">
                  {field.description ? (
                    <div 
                      className="rich-text-content leading-relaxed" 
                      dangerouslySetInnerHTML={{ __html: field.description }} 
                    />
                  ) : (
                    <span className="text-slate-400 italic no-print">(No details entered)</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 5. Photo Gallery Section */}
      {sortedPhotos.length > 0 && (
        <div className="mt-8 select-text">
          <h3 className="font-serif text-[12pt] font-bold uppercase border-b border-black pb-1 mb-4">
            Photographs & Gallery
          </h3>
          <div className={`grid ${gridClass} gap-4 photo-gallery-grid`}>
            {sortedPhotos.map((photo) => (
              <div key={photo.id} className="flex flex-col border border-black p-1 bg-white break-inside-avoid">
                <div className="w-full h-[140px] flex items-center justify-center overflow-hidden bg-slate-50">
                  <img
                    src={photo.src}
                    alt={photo.caption}
                    className="max-h-full object-contain"
                    style={{
                      objectFit: imageConfig?.aspectRatio === 'crop' ? 'cover' : 'contain',
                      width: '100%',
                      height: '100%'
                    }}
                  />
                </div>
                {photo.caption && (
                  <div className="text-[10pt] font-serif italic text-center mt-1 border-t border-slate-200 pt-1">
                    {photo.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Signature Section */}
      {sortedSignatures.length > 0 && (
        <div className="mt-12 select-text signatures-section-container break-inside-avoid">
          <div className="flex flex-wrap justify-between gap-6 pt-4 border-t border-dashed border-slate-300">
            {sortedSignatures.map((sig) => (
              <div key={sig.id} className="flex flex-col items-center text-center min-w-[120px] signature-block-container">
                {sig.image ? (
                  <div className="h-[50px] w-full flex items-center justify-center mb-1">
                    <img
                      src={sig.image}
                      alt="Signature"
                      className="max-h-full object-contain mix-blend-multiply"
                    />
                  </div>
                ) : (
                  <div className="h-[50px] border-b border-black w-24 mb-1 select-none" />
                )}
                <span className="text-[10pt] font-serif font-bold">{sig.name || '___________'}</span>
                <span className="text-[9pt] font-serif text-slate-600">{sig.designation}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invisible spacer to avoid clipping boundaries in measurement pass */}
      {isMeasure && <div style={{ height: '30px' }} />}
    </div>
  );
};

// ── Sub-component: A4 Page Footer ──────────────────────────────────────────────
const PageFooter: React.FC<{ footer: any; pageNum: number; totalPages: number }> = ({ footer, pageNum, totalPages }) => {
  if (footer.visible === false) return null;

  // Default fallback if fields are missing
  const defaultFields = [
    { id: 'f_pagenum', type: 'pageNumber', label: 'Page Number', value: '', visible: true, required: true, order: 0, styles: { fontFamily: 'Times New Roman', fontSize: 8, color: '#64748b', bold: false, italic: false, underline: false, align: 'right' } },
    { id: 'f_qrcode', type: 'qrCode', label: 'QR Code', value: '', visible: true, required: false, order: 1, styles: { fontFamily: 'Times New Roman', fontSize: 8, color: '#64748b', bold: false, italic: false, underline: false, align: 'right' } },
    { id: 'f_website', type: 'website', label: 'Website', value: footer.website || 'www.gitamw.ac.in', visible: true, required: false, order: 2, styles: { fontFamily: 'Times New Roman', fontSize: 8, color: '#64748b', bold: false, italic: false, underline: false, align: 'left' } },
    { id: 'f_email', type: 'email', label: 'Email Address', value: footer.email || 'gitamw@gmail.com', visible: true, required: false, order: 3, styles: { fontFamily: 'Times New Roman', fontSize: 8, color: '#64748b', bold: false, italic: false, underline: false, align: 'left' } },
    { id: 'f_custom', type: 'customText', label: 'Custom Footer Text', value: footer.text || 'GITAMW/IQAC/AR-01', visible: true, required: false, order: 14, styles: { fontFamily: 'Times New Roman', fontSize: 8, color: '#64748b', bold: false, italic: false, underline: false, align: 'left' } }
  ];

  const fields = [...(footer.fields || defaultFields)]
    .filter(f => f.visible)
    .sort((a, b) => a.order - b.order);

  // Group fields by style alignment
  const leftFields = fields.filter(f => f.styles?.align === 'left' || !f.styles?.align);
  const centerFields = fields.filter(f => f.styles?.align === 'center');
  const rightFields = fields.filter(f => f.styles?.align === 'right');

  const renderField = (field: any) => {
    const s = field.styles || {};
    const textStyle: React.CSSProperties = {
      fontFamily: s.fontFamily || 'Times New Roman',
      fontSize: `${s.fontSize || 8}pt`,
      color: s.color || '#64748b',
      fontWeight: s.bold ? 'bold' : 'normal',
      fontStyle: s.italic ? 'italic' : 'normal',
      textDecoration: s.underline ? 'underline' : 'none'
    };

    if (field.type === 'pageNumber') {
      return (
        <span style={textStyle} className="page-number-display">
          Page {pageNum} of {totalPages}
        </span>
      );
    }

    if (field.type === 'qrCode') {
      const qrSrc = field.value || footer.qrCode;
      if (!qrSrc) return null;
      return (
        <img
          src={qrSrc}
          alt="QR Code"
          style={{ height: '24px', width: '24px', objectFit: 'contain' }}
          className="inline-block"
        />
      );
    }

    // Default label prefix check
    const displayVal = field.value;
    if (!displayVal) return null;
    const labelPrefix = field.type === 'customText' ? '' : `${field.label}: `;
    return (
      <span style={textStyle}>
        {labelPrefix}{displayVal}
      </span>
    );
  };

  const hasBorder = footer.showBorder !== false;
  const hasLine = footer.showLine !== false;
  const bgColor = footer.backgroundColor || '#ffffff';

  return (
    <div 
      style={{ 
        backgroundColor: bgColor,
        paddingTop: '6px',
        paddingBottom: '6px',
        paddingLeft: '12px',
        paddingRight: '12px',
        borderTop: hasBorder ? '0.25mm solid #000000' : 'none',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        alignItems: 'center',
        gap: '8px'
      }} 
      className="mt-auto flex-shrink-0 w-full break-inside-avoid document-footer-container text-[8pt]"
    >
      {/* Left aligned fields */}
      <div className="flex flex-col gap-1 text-left">
        {leftFields.map((f, idx) => (
          <React.Fragment key={f.id}>
            {idx > 0 && hasLine && <div className="border-t border-slate-200 my-0.5" />}
            {renderField(f)}
          </React.Fragment>
        ))}
      </div>

      {/* Center aligned fields */}
      <div className="flex flex-col gap-1 text-center items-center">
        {centerFields.map((f, idx) => (
          <React.Fragment key={f.id}>
            {idx > 0 && hasLine && <div className="border-t border-slate-200 my-0.5 w-1/2" />}
            {renderField(f)}
          </React.Fragment>
        ))}
      </div>

      {/* Right aligned fields */}
      <div className="flex flex-col gap-1 text-right items-end">
        {rightFields.map((f, idx) => (
          <React.Fragment key={f.id}>
            {idx > 0 && hasLine && <div className="border-t border-slate-200 my-0.5 w-full" />}
            {renderField(f)}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

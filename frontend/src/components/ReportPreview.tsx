import React, { useState } from 'react';
import { ZoomIn, ZoomOut, Download } from 'lucide-react';
import { exportToPdf } from '../utils/pdfExporter';

interface Logo {
  id: string;
  src: string;
  visible: boolean;
  label: string;
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
  const { title, titleStyles, logos, fields, photos, signatures, footer } = reportData;
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);

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
      setPdfStatus('Failed: ' + (err?.message || String(err)));
    } finally {
      setTimeout(() => setPdfStatus(null), 5000);
    }
  };

  const isGouthami = logos && logos.some(l => l.id === 'gouthami' || l.label.toLowerCase().includes('gouthami') || l.label.toLowerCase().includes('gitamw'));

  // Generate dynamic font style string
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

  // Sort components by order
  const sortedFields = [...fields].sort((a, b) => a.order - b.order);
  const sortedPhotos = [...photos].sort((a, b) => a.order - b.order);
  const sortedSignatures = [...signatures].sort((a, b) => a.order - b.order);

  // Group visible logos (left side, right side, etc.)
  const visibleLogos = logos.filter(l => l.visible && l.src);

  // Determine scaling class
  const getZoomClass = () => {
    if (zoom === 75) return 'scale-75 origin-top';
    if (zoom === 90) return 'scale-90 origin-top';
    if (zoom === 110) return 'scale-110 origin-top';
    if (zoom === 125) return 'scale-125 origin-top';
    return 'scale-100 origin-top';
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-900 print:bg-transparent print:h-auto print:border-none border-l border-slate-200 dark:border-slate-800 transition-colors duration-150">
      {/* Zoom and Action Bar (no-print) */}
      <div className="no-print flex items-center justify-between p-3 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shadow-sm z-10 text-slate-700 dark:text-slate-300">
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-450 mr-2">Live Preview</span>
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
          title="Download full multi-page PDF"
        >
          <Download size={14} />
          <span>{pdfStatus ? pdfStatus : 'Download PDF'}</span>
        </button>
      </div>

      {/* Preview Scroll Canvas */}
      <div className="flex-1 overflow-auto print:overflow-visible p-6 print:p-0 flex justify-center print:block items-start print:h-auto">
        <div className={`transition-all duration-200 ${getZoomClass()} print:transform-none print:w-full print:h-auto print:static`}>
          {/* Main A4 Document Sheet */}
          <div className="a4-page relative flex flex-col justify-between print:block" id="report-a4-document">
            <div>
              {/* Document Header Section */}
              <div className="border-b-2 border-black pb-4 mb-4">
                {isGouthami ? (
                  <div className="space-y-3">
                    {/* Top Row: Innovation Icons Banner Container */}
                    <div className="border border-slate-300 rounded-lg p-2 flex justify-around items-center bg-white shadow-sm">
                      {/* MoE's Innovation Cell */}
                      <div className="flex items-center gap-1.5 text-[6pt] font-bold leading-tight uppercase w-1/4 border-r border-slate-200 pr-2">
                        {logos.find(l => l.id === 'moe')?.src && (
                          <img src={logos.find(l => l.id === 'moe')?.src} className="h-7 w-7 object-contain" alt="MoE" />
                        )}
                        <div>
                          <p className="text-slate-900">MoE's</p>
                          <p className="text-red-655 font-bold">INNOVATION CELL</p>
                          <p className="text-slate-500 text-[5pt] font-semibold">(GOVERNMENT OF INDIA)</p>
                        </div>
                      </div>

                      {/* Ministry of Education */}
                      <div className="flex items-center gap-1.5 text-[6.5pt] font-bold leading-tight uppercase w-1/4 border-r border-slate-200 px-2 justify-center">
                        {logos.find(l => l.id === 'gouthami')?.src && (
                          <img src={logos.find(l => l.id === 'gouthami')?.src} className="h-6 w-6 object-contain" alt="GITAMW" />
                        )}
                        <div>
                          <p className="text-slate-900">Ministry of Education</p>
                          <p className="text-slate-500 text-[5pt] font-semibold">Government of India</p>
                        </div>
                      </div>

                      {/* AICTE */}
                      <div className="flex items-center gap-1.5 text-[7pt] font-bold leading-tight w-1/5 border-r border-slate-200 px-2 justify-center">
                        {logos.find(l => l.id === 'aicte')?.src && (
                          <img src={logos.find(l => l.id === 'aicte')?.src} className="h-6 w-6 object-contain" alt="AICTE" />
                        )}
                        <span className="text-amber-700 font-bold select-none">AICTE</span>
                      </div>

                      {/* Institution's Innovation Council */}
                      <div className="flex items-center gap-1.5 text-[6.5pt] font-bold leading-tight uppercase w-1/4 pl-2">
                        {logos.find(l => l.id === 'iic')?.src && (
                          <img src={logos.find(l => l.id === 'iic')?.src} className="h-7 w-7 object-contain" alt="IIC" />
                        )}
                        <div>
                          <p className="text-blue-700">INSTITUTION'S</p>
                          <p className="text-blue-700">INNOVATION</p>
                          <p className="text-blue-700 text-[5.5pt] font-semibold">COUNCIL</p>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: College Name & Affiliations */}
                    <div className="flex items-center justify-between gap-3 mt-2 text-left">
                      {/* Left: Gouthami Logo */}
                      <div className="w-[60px] h-[60px] flex-shrink-0 flex items-center justify-center border border-purple-200 rounded-full p-1 bg-white">
                        {logos.find(l => l.id === 'gouthami')?.src ? (
                          <img src={logos.find(l => l.id === 'gouthami')?.src} className="max-w-full max-h-full object-contain" alt="Gouthami Logo" />
                        ) : (
                          <span className="text-xs font-bold text-purple-800 uppercase">GITAMW</span>
                        )}
                      </div>

                      {/* Middle: College Titles */}
                      <div className="flex-1 text-center select-text">
                        <h1 className="text-[12pt] font-bold uppercase leading-tight tracking-normal text-purple-900 font-sans">
                          GOUTHAMI
                        </h1>
                        <p className="text-[7.5pt] font-bold text-slate-700 uppercase leading-none">
                          Institute of Technology and Management for Women
                        </p>
                        <p className="text-[8pt] text-purple-700 font-bold uppercase tracking-wider mt-1 select-none">
                          ★ AUTONOMOUS ★
                        </p>
                      </div>

                      {/* Right: Affiliations Small Text */}
                      <div className="w-[35%] text-[6.5pt] leading-tight text-slate-700 select-text border-l border-slate-205 pl-2">
                        <p className="font-bold">Approved by AICTE, New Delhi</p>
                        <p className="font-bold">Affiliated to JNTUA, Ananthapuramu</p>
                        <p className="font-bold">Accredited by NAAC with B++ Grade</p>
                        <p>Recognised under UGC 2(f) Act. 1956</p>
                        <p className="text-slate-500">Sai Nagar, Peddasettypalli(V), Proddatur</p>
                        <p className="text-slate-500">YSR Kadapa Dist., A.P - 516360</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Fallback to Standard SJEC Header layout */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center justify-center gap-3 w-full">
                        {visibleLogos.map((logo) => (
                          <div key={logo.id} className="flex flex-col items-center max-w-[65px] text-center">
                            <div className="w-[50px] h-[50px] flex items-center justify-center border border-slate-300 rounded overflow-hidden p-0.5 bg-white">
                              <img
                                src={logo.src}
                                alt={logo.label}
                                className="max-w-full max-h-full object-contain"
                              />
                            </div>
                            <span className="text-[7pt] mt-0.5 font-bold uppercase leading-tight select-none">{logo.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="text-center mt-3 select-text">
                      <h1 className="text-[13pt] font-bold uppercase leading-normal tracking-wide">
                        St. Joseph's Engineering College
                      </h1>
                      <p className="text-[8.5pt] italic text-slate-700">
                        An Autonomous Institution affiliated to VTU, Belagavi | Approved by AICTE, New Delhi
                      </p>
                      <p className="text-[8.5pt] text-slate-700">
                        Accredited by NAAC with 'A+' Grade & NBA (CSE, ECE, ME, EEE)
                      </p>
                      <p className="text-[8.5pt] font-semibold text-slate-700">
                        Vamanjoor, Mangaluru - 575028, Karnataka, India
                      </p>
                      <p className="text-[8pt] text-slate-500">
                        Website: www.sjec.ac.in | Email: sjec@sjec.ac.in | Tel: +91 824 2263753
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Fixed Activity Report on Title */}
              <div className="text-center font-serif text-[12pt] font-bold uppercase tracking-wider mb-1 select-text" style={{ fontFamily: titleStyles.fontFamily || 'Times New Roman' }}>
                Activity Report on
              </div>

              {/* Report Title */}
              <div className="mb-6 select-text">
                <h2 style={getTitleStyles()} className="select-text">
                  {title}
                </h2>
              </div>

              {/* Report Information Table */}
              {reportData.infoTable && reportData.infoTable.rows && (
                <div className="mb-6 select-text">
                  <table 
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontFamily: reportData.infoTable.styles.fontFamily || 'Times New Roman',
                      fontSize: `${reportData.infoTable.styles.fontSize || 11}pt`,
                      borderRadius: `${reportData.infoTable.styles.borderRadius || 0}px`,
                      overflow: 'hidden'
                    }}
                  >
                    <tbody>
                      {reportData.infoTable.rows
                        .filter(row => row.visible !== false)
                        .sort((a, b) => a.order - b.order)
                        .map((row, idx) => {
                          const isAlternate = idx % 2 !== 0;
                          const rowBg = isAlternate 
                            ? reportData.infoTable?.styles.alternateRowColor || '#f9fafb' 
                            : reportData.infoTable?.styles.alternateRowBg || '#ffffff';

                          const cellPadding = `${reportData.infoTable?.styles.cellPadding || 8}px`;
                          const borderStyle = reportData.infoTable?.styles.showBorder 
                            ? `${reportData.infoTable?.styles.borderThickness || 1}px solid #000000` 
                            : 'none';

                          return (
                            <tr 
                              key={row.id} 
                              style={{ 
                                backgroundColor: rowBg,
                                height: `${reportData.infoTable?.styles.rowHeight || 40}px`
                              }}
                            >
                              <td 
                                style={{
                                  width: `${reportData.infoTable?.styles.colWidth || 35}%`,
                                  padding: cellPadding,
                                  border: borderStyle,
                                  fontWeight: 'bold',
                                  color: reportData.infoTable?.styles.headerColor || '#000000',
                                  textAlign: (reportData.infoTable?.styles.align || 'left') as any
                                }}
                              >
                                {row.name}
                                {row.required && <span className="text-red-500 ml-0.5 font-bold">*</span>}
                              </td>
                              <td 
                                style={{
                                  width: `${100 - (reportData.infoTable?.styles.colWidth || 35)}%`,
                                  padding: cellPadding,
                                  border: borderStyle,
                                  textAlign: 'left'
                                }}
                              >
                                {row.value || <span className="text-slate-300 italic no-print">(Empty)</span>}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Report Table */}
              <div className="report-content select-text">
                <table>
                  <tbody>
                    {sortedFields.map((field) => (
                      <tr key={field.id} className="border-t border-black">
                        <td className="report-table-heading font-serif text-[12pt] font-bold w-[30%]">
                          {field.heading}
                        </td>
                        <td className="report-table-description font-serif text-[12pt] text-justify w-[70%]">
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

              {/* Photo Section */}
              {sortedPhotos.length > 0 && (
                <div className="mt-8 select-text">
                  <h3 className="font-serif text-[12pt] font-bold uppercase border-b border-black pb-1 mb-4">
                    Photographs & Gallery
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {sortedPhotos.map((photo) => (
                      <div key={photo.id} className="flex flex-col border border-black p-1 bg-white break-inside-avoid">
                        <div className="w-full h-[140px] flex items-center justify-center overflow-hidden bg-slate-50">
                          <img
                            src={photo.src}
                            alt={photo.caption}
                            className="max-w-full max-h-full object-contain"
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

              {/* Signature Section */}
              {sortedSignatures.length > 0 && (
                <div className="mt-12 select-text break-inside-avoid">
                  <div className="flex flex-wrap justify-between gap-6 pt-4 border-t border-dashed border-slate-300">
                    {sortedSignatures.map((sig) => (
                      <div key={sig.id} className="flex flex-col items-center text-center min-w-[120px]">
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
            </div>

            {/* Document Footer */}
            {footer.visible !== false && (
              <div className="mt-8 pt-2 border-t border-slate-300 flex justify-between items-center text-[7.5pt] text-slate-500 font-serif w-full break-inside-avoid">
                <div className="flex flex-col">
                  {footer.text && <span>{footer.text}</span>}
                  {(footer.website || footer.email) && (
                    <span>
                      {footer.website && `URL: ${footer.website}`}
                      {footer.website && footer.email && ' | '}
                      {footer.email && `Email: ${footer.email}`}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {Object.entries(footer.socials || {}).map(([key, val]) => (
                    val && <span key={key}>{key}: {val}</span>
                  ))}
                  {footer.qrCode && (
                    <img
                      src={footer.qrCode}
                      alt="Footer QR Code"
                      className="w-10 h-10 object-contain"
                    />
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

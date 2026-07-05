const { 
  Document, Packer, Paragraph, Table, TableRow, TableCell, 
  TextRun, WidthType, AlignmentType, ImageRun, BorderStyle 
} = require('docx');

// Simple HTML text to docx text runs parser
function parseHtmlToRuns(htmlText) {
  if (!htmlText) return [new TextRun('')];

  const runs = [];
  // Quick and robust regex-based parser for basic formatting tags
  // Replace HTML paragraphs and list tags with basic markup
  let text = htmlText
    .replace(/<p>/g, '')
    .replace(/<\/p>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  // Split by bold/italic/underline tags to create styled runs
  const tokenRegex = /(<\/?[b|i|u]\|?.*?>)/gi;
  const parts = text.split(tokenRegex);

  let isBold = false;
  let isItalic = false;
  let isUnderline = false;

  for (const part of parts) {
    if (!part) continue;

    const lowerPart = part.toLowerCase();
    if (lowerPart === '<b>' || lowerPart === '<strong>') {
      isBold = true;
    } else if (lowerPart === '</b>' || lowerPart === '</strong>') {
      isBold = false;
    } else if (lowerPart === '<i>' || lowerPart === '<em>') {
      isItalic = true;
    } else if (lowerPart === '</i>' || lowerPart === '</em>') {
      isItalic = false;
    } else if (lowerPart === '<u>') {
      isUnderline = true;
    } else if (lowerPart === '</u>') {
      isUnderline = false;
    } else if (part.startsWith('<') && part.endsWith('>')) {
      // Ignore other tags
    } else {
      // It is plain text
      runs.push(new TextRun({
        text: part,
        bold: isBold,
        italic: isItalic,
        underline: isUnderline ? {} : undefined,
        font: 'Times New Roman',
        size: 24 // 12pt (docx uses half-points, so 24 = 12pt)
      }));
    }
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text: '', font: 'Times New Roman', size: 24 }));
  }
  return runs;
}

// Convert HTML content containing lists or lines to docx paragraphs
function htmlToParagraphs(htmlText) {
  if (!htmlText) return [new Paragraph({ children: [new TextRun('')] })];
  
  // Split into lines/paragraphs
  const cleanHtml = htmlText.replace(/<\/li>/g, '</li>\n');
  const tempDiv = cleanHtml.split('\n');
  const paragraphs = [];

  for (let line of tempDiv) {
    line = line.trim();
    if (!line) continue;

    // Check if list item
    const isBullet = /<li[^>]*>/i.test(line);
    const textContent = line.replace(/<[^>]+>/g, '').trim();

    if (textContent) {
      const runs = parseHtmlToRuns(line);
      paragraphs.push(new Paragraph({
        children: runs,
        alignment: AlignmentType.JUSTIFY,
        bullet: isBullet ? { level: 0 } : undefined,
        spacing: { after: 120 } // Space between lines
      }));
    }
  }

  if (paragraphs.length === 0) {
    paragraphs.push(new Paragraph({ children: [new TextRun('')] }));
  }

  return paragraphs;
}

async function generateReportDocx(reportData) {
  const { title, titleStyles, logos, infoTable, fields, photos, signatures, footer } = reportData;

  // 1. Prepare Header Section
  // Check if Gouthami branding should be used (defaulting to Gouthami if gitamw or gouthami is in logos or as a clean default)
  const isGouthami = !logos || logos.some(l => l.id === 'gouthami' || l.label.toLowerCase().includes('gouthami') || l.label.toLowerCase().includes('gitamw'));

  const headerParagraphs = isGouthami ? [
    new Paragraph({
      children: [
        new TextRun({
          text: "GOUTHAMI INSTITUTE OF TECHNOLOGY AND MANAGEMENT FOR WOMEN",
          bold: true,
          font: 'Times New Roman',
          size: 26
        })
      ],
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "(Approved by AICTE, New Delhi, Affiliated to JNTUA, Ananthapuramu, Accredited by NAAC with B++ Grade)",
          italic: true,
          font: 'Times New Roman',
          size: 16
        })
      ],
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Recognised under UGC 2(f) Act. 1956, Sai Nagar, Peddasettypalli(V), Proddatur, YSR Kadapa Dist., A.P-516360",
          bold: true,
          font: 'Times New Roman',
          size: 16
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 }
    })
  ] : [
    new Paragraph({
      children: [
        new TextRun({
          text: "ST. JOSEPH'S ENGINEERING COLLEGE",
          bold: true,
          font: 'Times New Roman',
          size: 26
        })
      ],
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "An Autonomous Institution affiliated to VTU, Belagavi | Approved by AICTE, New Delhi",
          italic: true,
          font: 'Times New Roman',
          size: 18
        })
      ],
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Accredited by NAAC with 'A+' Grade & NBA (CSE, ECE, ME, EEE)",
          font: 'Times New Roman',
          size: 18
        })
      ],
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Vamanjoor, Mangaluru - 575028, Karnataka, India",
          bold: true,
          font: 'Times New Roman',
          size: 18
        })
      ],
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Website: www.sjec.ac.in | Email: sjec@sjec.ac.in | Tel: +91 824 2263753",
          font: 'Times New Roman',
          size: 16
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 }
    })
  ];

  // 2. Report Title Sections
  const titleHeaderParagraph = new Paragraph({
    children: [
      new TextRun({
        text: "ACTIVITY REPORT ON",
        bold: true,
        font: titleStyles?.fontFamily || 'Times New Roman',
        size: 24, // 12pt
      })
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 180, after: 120 }
  });

  // Handle text casing
  let titleText = title || 'Activity Report';
  const casing = titleStyles?.textCase || 'none';
  if (casing === 'uppercase') {
    titleText = titleText.toUpperCase();
  } else if (casing === 'lowercase') {
    titleText = titleText.toLowerCase();
  } else if (casing === 'capitalize') {
    titleText = titleText.replace(/\b\w/g, c => c.toUpperCase());
  }

  const titleParagraph = new Paragraph({
    children: [
      new TextRun({
        text: titleText,
        bold: titleStyles?.bold !== false,
        italic: !!titleStyles?.italic,
        underline: titleStyles?.underline ? {} : undefined,
        font: titleStyles?.fontFamily || 'Times New Roman',
        size: (titleStyles?.fontSize || 24) * 2, // docx uses half points
        color: (titleStyles?.color || '#000000').replace('#', '')
      })
    ],
    alignment: titleStyles?.align === 'left' ? AlignmentType.LEFT : (titleStyles?.align === 'right' ? AlignmentType.RIGHT : AlignmentType.CENTER),
    spacing: { before: 120, after: 240 }
  });

  // 3. Build Information Table
  let infoTableDocx = null;
  if (infoTable && infoTable.rows && infoTable.rows.length > 0) {
    const visibleInfoRows = [...infoTable.rows]
      .filter(r => r.visible)
      .sort((a, b) => a.order - b.order);

    if (visibleInfoRows.length > 0) {
      const infoStyles = infoTable.styles || {
        showBorder: true,
        cellPadding: 8,
        fontSize: 11,
        fontFamily: 'Times New Roman',
        colWidth: 35
      };

      const infoRows = visibleInfoRows.map((row, idx) => {
        // Zebra striping color mapping
        const isAlternate = idx % 2 !== 0;
        const rowBgColor = isAlternate 
          ? (infoStyles.alternateRowBg || "F9FAFB").replace('#', '') 
          : (infoStyles.rowBgColor || "FFFFFF").replace('#', '');

        // Heading cell (bold, border)
        const headingCell = new TableCell({
          width: { size: infoStyles.colWidth || 35, type: WidthType.PERCENTAGE },
          shading: { fill: rowBgColor },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: row.name,
                  bold: true,
                  font: infoStyles.fontFamily || 'Times New Roman',
                  size: (infoStyles.fontSize || 11) * 2
                })
              ],
              spacing: { before: 100, after: 100 }
            })
          ],
          borders: infoStyles.showBorder ? {
            top: { style: BorderStyle.SINGLE, size: infoStyles.borderThickness || 1, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: infoStyles.borderThickness || 1, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: infoStyles.borderThickness || 1, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: infoStyles.borderThickness || 1, color: "000000" }
          } : {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE }
          }
        });

        // Value cell
        const valueCell = new TableCell({
          width: { size: 100 - (infoStyles.colWidth || 35), type: WidthType.PERCENTAGE },
          shading: { fill: rowBgColor },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: row.value || '',
                  font: infoStyles.fontFamily || 'Times New Roman',
                  size: (infoStyles.fontSize || 11) * 2
                })
              ],
              spacing: { before: 100, after: 100 }
            })
          ],
          borders: infoStyles.showBorder ? {
            top: { style: BorderStyle.SINGLE, size: infoStyles.borderThickness || 1, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: infoStyles.borderThickness || 1, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: infoStyles.borderThickness || 1, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: infoStyles.borderThickness || 1, color: "000000" }
          } : {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE }
          }
        });

        return new TableRow({
          children: [headingCell, valueCell],
          height: { value: (infoStyles.rowHeight || 40) * 15, rule: "atLeast" }
        });
      });

      infoTableDocx = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: infoRows,
        spacing: { after: 360 }
      });
    }
  }

  // 4. Build Main Content Table rows
  const sortedFields = [...fields].sort((a, b) => a.order - b.order);
  const tableRows = sortedFields.map(field => {
    return new TableRow({
      children: [
        // Column 1: Heading
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: field.heading,
                  bold: true,
                  font: 'Times New Roman',
                  size: 24
                })
              ],
              spacing: { before: 120, after: 120 }
            })
          ],
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "000000" }
          }
        }),
        // Column 2: Content
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          children: htmlToParagraphs(field.description),
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "000000" }
          }
        })
      ]
    });
  });

  // Create Main Table
  const reportTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows
  });

  // Assemble Elements list
  const childrenElements = [
    ...headerParagraphs,
    titleHeaderParagraph,
    titleParagraph
  ];

  // Insert Info Table if populated
  if (infoTableDocx) {
    childrenElements.push(infoTableDocx);
    childrenElements.push(new Paragraph({ text: '', spacing: { after: 240 } }));
  }

  // Insert Main content table
  childrenElements.push(reportTable);

  const sortedPhotos = [...photos].sort((a, b) => a.order - b.order);
  if (sortedPhotos.length > 0) {
    childrenElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "\nPHOTOGRAPHS & GALLERY",
            bold: true,
            font: 'Times New Roman',
            size: 24
          })
        ],
        spacing: { before: 360, after: 180 }
      })
    );

    // Embed photos
    for (const photo of sortedPhotos) {
      if (photo.src && photo.src.startsWith('data:image')) {
        try {
          const imgBuffer = Buffer.from(photo.src.split(',')[1], 'base64');
          
          childrenElements.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: imgBuffer,
                  transformation: {
                    width: 320,
                    height: 240
                  }
                })
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 120 }
            })
          );
          
          if (photo.caption) {
            childrenElements.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: photo.caption,
                    italic: true,
                    font: 'Times New Roman',
                    size: 20
                  })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 240 }
              })
            );
          }
        } catch (e) {
          console.error("Failed to embed image in DOCX:", e);
        }
      }
    }
  }

  // 5. Signatures Grid
  const sortedSignatures = [...signatures].sort((a, b) => a.order - b.order);
  if (sortedSignatures.length > 0) {
    const signatureCells = [];
    
    for (const sig of sortedSignatures) {
      const cellChildren = [];
      
      if (sig.image && sig.image.startsWith('data:image')) {
        try {
          const sigBuffer = Buffer.from(sig.image.split(',')[1], 'base64');
          cellChildren.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: sigBuffer,
                  transformation: {
                    width: 100,
                    height: 40
                  }
                })
              ],
              alignment: AlignmentType.CENTER
            })
          );
        } catch (err) {
          cellChildren.push(new Paragraph({ children: [new TextRun('')] }));
        }
      } else {
        // Draw space lines
        cellChildren.push(new Paragraph({ children: [new TextRun('\n\n')], alignment: AlignmentType.CENTER }));
      }
      
      cellChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: sig.name || '___________', bold: true, font: 'Times New Roman', size: 20 }),
            new TextRun({ text: `\n${sig.designation}`, font: 'Times New Roman', size: 18 })
          ],
          alignment: AlignmentType.CENTER
        })
      );
      
      signatureCells.push(
        new TableCell({
          width: { size: 100 / sortedSignatures.length, type: WidthType.PERCENTAGE },
          children: cellChildren,
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE }
          }
        })
      );
    }
    
    const signatureTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: signatureCells })
      ],
      spacing: { before: 480 }
    });
    
    childrenElements.push(new Paragraph({ text: '', spacing: { before: 360 } }));
    childrenElements.push(signatureTable);
  }

  // 6. Footer items
  if (footer.visible !== false && (footer.text || footer.website || footer.email)) {
    const contactInfo = [];
    if (footer.website) contactInfo.push(`Website: ${footer.website}`);
    if (footer.email) contactInfo.push(`Email: ${footer.email}`);
    
    childrenElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `\n\n${footer.text || ''}\n${contactInfo.join(' | ')}`,
            font: 'Times New Roman',
            size: 16
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 360 }
      })
    );
  }

  // Build Document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: childrenElements
      }
    ]
  });

  return await Packer.toBuffer(doc);
}

module.exports = {
  generateReportDocx
};

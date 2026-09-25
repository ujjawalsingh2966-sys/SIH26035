import * as crypto from 'crypto';

export class SimplePdfGenerator {
  public static generateDocument(textLines: string[]): Buffer {
    let pdfStr = `%PDF-1.4\n%âãÏÓ\n`;

    const objOffsets: { [id: number]: number } = {};
    let currentOffset = pdfStr.length;
    let nextObjId = 1;

    const addObj = (content: string) => {
      const objId = nextObjId++;
      const objStr = `${objId} 0 obj\n${content}\nendobj\n`;
      objOffsets[objId] = currentOffset;
      pdfStr += objStr;
      currentOffset += objStr.length;
      return objId;
    };

    // 1: Catalog
    const catalogId = nextObjId;
    nextObjId++;

    // 2: Outlines (empty)
    const outlinesId = addObj(`<< /Type /Outlines /Count 0 >>`);

    // 3: Pages (will refer to page instances)
    const pagesId = nextObjId;
    nextObjId++;

    // 4: Font
    const fontId = addObj(`<< /Type /Font /Subtype /Type1 /Name /F1 /BaseFont /Helvetica >>`);

    // We can just dump all text on one page, or do pagination. For MVP, one large page is fine or just ignore page height.
    // Let's create the page content stream
    let contentStream = '';
    let y = 750;

    contentStream += `BT /F1 10 Tf\n`;

    for (const line of textLines) {
      if (y < 50) {
        // Simple page break approach - just reset y for now, we'll draw over (MVP limit)
        y = 750;
      }
      // sanitize line
      const cleanLine = line.replace(/\\/g, '\\\\').replace(/\)/g, '\\)').replace(/\(/g, '\\(').replace(/[\r\n\t]/g, ' ');
      contentStream += `1 0 0 1 50 ${y} Tm (${cleanLine}) Tj\n`;
      y -= 12;
    }
    contentStream += `ET`;

    // 5: Content stream
    const contentId = addObj(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);

    // 6: Page
    const pageId = addObj(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /ProcSet [/PDF /Text] /Font << /F1 ${fontId} 0 R >> >> >>`);

    // Add back the reserved ones
    // Catalog
    const catalogStr = `<< /Type /Catalog /Outlines ${outlinesId} 0 R /Pages ${pagesId} 0 R >>`;
    const catOff = currentOffset;
    pdfStr += `${catalogId} 0 obj\n${catalogStr}\nendobj\n`;
    objOffsets[catalogId] = catOff;
    currentOffset += (`${catalogId} 0 obj\n${catalogStr}\nendobj\n`).length;

    // Pages
    const pagesStr = `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`;
    const pagesOff = currentOffset;
    pdfStr += `${pagesId} 0 obj\n${pagesStr}\nendobj\n`;
    objOffsets[pagesId] = pagesOff;
    currentOffset += (`${pagesId} 0 obj\n${pagesStr}\nendobj\n`).length;

    // xref building
    const xrefOffset = currentOffset;
    pdfStr += `xref\n0 ${nextObjId}\n0000000000 65535 f \n`;

    // Reorder offsets because we added them out of order (1 to N)
    for (let i = 1; i < nextObjId; i++) {
        pdfStr += `${objOffsets[i].toString().padStart(10, '0')} 00000 n \n`;
    }

    pdfStr += `trailer\n<< /Size ${nextObjId} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdfStr, 'binary');
  }
}

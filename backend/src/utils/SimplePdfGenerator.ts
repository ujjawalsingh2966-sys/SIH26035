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

    // Never overwrite previous rows when a report exceeds one page. Wrap long
    // warnings so incompleteness reasons and verdicts remain on the page too.
    const wrapped = textLines.flatMap(line => {
      const printable = line.replace(/[\r\n\t]/g, ' ').replace(/[^\x20-\x7e]/g, '?');
      return printable.match(/.{1,85}/g) || [''];
    });
    const pageIds: number[] = [];
    for (let start = 0; start < Math.max(wrapped.length, 1); start += 59) {
      let contentStream = 'BT /F1 10 Tf\n';
      wrapped.slice(start, start + 59).forEach((line, index) => {
        const cleanLine = line.replace(/\\/g, '\\\\').replace(/\)/g, '\\)').replace(/\(/g, '\\(');
        contentStream += `1 0 0 1 50 ${750 - index * 12} Tm (${cleanLine}) Tj\n`;
      });
      contentStream += 'ET';
      const contentId = addObj(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);
      pageIds.push(addObj(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /ProcSet [/PDF /Text] /Font << /F1 ${fontId} 0 R >> >> >>`));
    }

    // Add back the reserved ones
    // Catalog
    const catalogStr = `<< /Type /Catalog /Outlines ${outlinesId} 0 R /Pages ${pagesId} 0 R >>`;
    const catOff = currentOffset;
    pdfStr += `${catalogId} 0 obj\n${catalogStr}\nendobj\n`;
    objOffsets[catalogId] = catOff;
    currentOffset += (`${catalogId} 0 obj\n${catalogStr}\nendobj\n`).length;

    // Pages
    const pagesStr = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
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

import { PDFDocument } from "pdf-lib";
import crypto from "node:crypto";
import { storage } from "./storage";

export interface SplitSheet {
  name: string;
  fileKey: string;
}

/**
 * Split a multi-page PDF into single-page PDFs, store each, and return the
 * generated storage keys with derived sheet names.
 */
export async function splitPdfIntoSheets(buffer: Buffer, baseName: string): Promise<SplitSheet[]> {
  const sourceDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const pageCount = sourceDoc.getPageCount();
  const sheets: SplitSheet[] = [];

  for (let i = 0; i < pageCount; i++) {
    const singlePage = await PDFDocument.create();
    const [page] = await singlePage.copyPages(sourceDoc, [i]);
    singlePage.addPage(page);
    const bytes = await singlePage.save();
    const fileKey = `${crypto.randomUUID()}.pdf`;
    await storage.save(fileKey, Buffer.from(bytes));
    sheets.push({
      name: pageCount === 1 ? baseName : `${baseName} — p${i + 1}`,
      fileKey,
    });
  }

  return sheets;
}

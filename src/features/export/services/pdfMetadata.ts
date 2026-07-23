import { PDFDocument } from 'pdf-lib';
import { BookMetadata } from '../types/bookMeta';

export async function enrichPdfMetadata(
  pdfBuffer: ArrayBuffer,
  metadata: BookMetadata
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  pdfDoc.setTitle(metadata.title);
  pdfDoc.setAuthor(metadata.authorName);
  pdfDoc.setProducer("L'Atelier de l'Écrivain");
  pdfDoc.setCreator("L'Atelier de l'Écrivain Studio PDF");

  if (metadata.subtitle) {
    pdfDoc.setSubject(metadata.subtitle);
  }

  return await pdfDoc.save();
}

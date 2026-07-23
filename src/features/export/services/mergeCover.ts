import { PDFDocument } from 'pdf-lib';

export async function mergeCoverImage(
  pdfBuffer: ArrayBuffer,
  coverImageBlob: Blob
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const imageBytes = await coverImageBlob.arrayBuffer();

  let image;
  if (coverImageBlob.type.includes('png')) {
    image = await pdfDoc.embedPng(imageBytes);
  } else {
    image = await pdfDoc.embedJpg(imageBytes);
  }

  const firstPage = pdfDoc.getPage(0);
  const { width, height } = firstPage.getSize();

  firstPage.drawImage(image, {
    x: 0,
    y: 0,
    width,
    height,
  });

  return await pdfDoc.save();
}

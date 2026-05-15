import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { PDFDocument } from '@cantoo/pdf-lib';
import { bufferHasValidPdfMarkings } from '@dereekb/util';
import { compressPdfImagesToTargetSize } from './compress.pdf';

async function makeNoiseJpeg(width: number, height: number, quality = 100): Promise<Buffer> {
  const channels = 3;
  const buffer = Buffer.alloc(width * height * channels);
  for (let i = 0; i < buffer.length; i += 1) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  return sharp(buffer, { raw: { width, height, channels } }).jpeg({ quality }).toBuffer();
}

async function makePdfWithEmbeddedJpeg(jpegBytes: Buffer): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const image = await pdfDoc.embedJpg(jpegBytes);
  const page = pdfDoc.addPage([600, 800]);
  page.drawImage(image, { x: 50, y: 100, width: 500, height: 600 });
  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

async function makeEmptyPdf(): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([600, 800]);
  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

describe('compressPdfImagesToTargetSize()', () => {
  it('compresses a PDF containing an oversized embedded JPEG', async () => {
    const jpeg = await makeNoiseJpeg(3000, 3000, 95);
    const pdfBytes = await makePdfWithEmbeddedJpeg(jpeg);

    const result = await compressPdfImagesToTargetSize(pdfBytes, {
      targetSizeBytes: 1 * 1024 * 1024,
      imageMaxDimension: 1024,
      imageQuality: 70
    });

    expect(result.imagesCompressed).toBe(1);
    expect(result.compressedSizeBytes).toBeLessThan(result.originalSizeBytes);
    expect(bufferHasValidPdfMarkings(result.buffer)).toBe(true);
  });

  it('returns the original buffer when the PDF has no images', async () => {
    const pdfBytes = await makeEmptyPdf();

    const result = await compressPdfImagesToTargetSize(pdfBytes, {
      targetSizeBytes: 10 * 1024 * 1024
    });

    expect(result.imagesCompressed).toBe(0);
    expect(result.imagesSkipped).toBe(0);
    expect(result.compressedSizeBytes).toBe(pdfBytes.byteLength);
    expect(result.buffer).toBe(pdfBytes);
  });

  it('skips embedded images below the size threshold', async () => {
    const jpeg = await makeNoiseJpeg(800, 800, 80);
    const pdfBytes = await makePdfWithEmbeddedJpeg(jpeg);

    const result = await compressPdfImagesToTargetSize(pdfBytes, {
      targetSizeBytes: 5 * 1024 * 1024,
      imageSizeThresholdBytes: 10 * 1024 * 1024 // unrealistically high to force skip
    });

    expect(result.imagesCompressed).toBe(0);
  });

  it('marks hitTarget=true when the compressed PDF fits under the target', async () => {
    const jpeg = await makeNoiseJpeg(2000, 2000, 90);
    const pdfBytes = await makePdfWithEmbeddedJpeg(jpeg);

    const result = await compressPdfImagesToTargetSize(pdfBytes, {
      targetSizeBytes: pdfBytes.byteLength, // anything ≤ original is "hit"
      imageMaxDimension: 512,
      imageQuality: 60
    });

    expect(result.hitTarget).toBe(true);
  });

  it('produces a structurally valid PDF after compression', async () => {
    const jpeg = await makeNoiseJpeg(2500, 2500, 92);
    const pdfBytes = await makePdfWithEmbeddedJpeg(jpeg);

    const result = await compressPdfImagesToTargetSize(pdfBytes, {
      targetSizeBytes: 500 * 1024,
      imageMaxDimension: 1024,
      imageQuality: 70
    });

    // Re-parse the compressed PDF; should not throw
    const reloaded = await PDFDocument.load(result.buffer);
    expect(reloaded.getPageCount()).toBeGreaterThan(0);
  });
});

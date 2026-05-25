import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { PDFDocument } from '@cantoo/pdf-lib';
import { bufferHasValidPdfMarkings } from '@dereekb/util';
import { compressPdfImagesToTargetSize } from './compress.pdf';

const TEST_ASSETS_DIR = resolve(__dirname, '../../../../../../../apps/demo-api/src/test/assets');
const CPR_PNG = resolve(TEST_ASSETS_DIR, 'cpr.png');

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

async function makePdfWithEmbeddedPng(pngBytes: Buffer): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const image = await pdfDoc.embedPng(pngBytes);
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
    expect(result.pageCount).toBe(1);
    expect(result.imageStreamCount).toBe(0);
    expect(result.imageStreamsByFilter).toEqual({});
  });

  it('reports page count and a DCTDecode entry in imageStreamsByFilter for a JPEG-embedded PDF', async () => {
    const jpeg = await makeNoiseJpeg(1200, 1200, 85);
    const pdfDoc = await PDFDocument.create();
    const image = await pdfDoc.embedJpg(jpeg);
    pdfDoc.addPage([600, 800]).drawImage(image, { x: 0, y: 0, width: 600, height: 800 });
    pdfDoc.addPage([600, 800]); // second page, no image
    pdfDoc.addPage([600, 800]); // third page, no image
    const pdfBytes = Buffer.from(await pdfDoc.save());

    const result = await compressPdfImagesToTargetSize(pdfBytes, {
      targetSizeBytes: 10 * 1024 * 1024
    });

    expect(result.pageCount).toBe(3);
    expect(result.imageStreamCount).toBe(1);
    expect(result.imageStreamsByFilter).toEqual({ DCTDecode: 1 });
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

  it('leaves a FlateDecode-image PDF untouched and reports hitTarget=false when over the target', async () => {
    // pdf-lib's embedPng stores the decoded raster as a FlateDecode stream, which the
    // v1 compressor (DCTDecode-only) cannot shrink. The PDF must remain identical and
    // hitTarget must be false so callers can reject the upload.
    const pngBytes = await readFile(CPR_PNG);
    const pdfBytes = await makePdfWithEmbeddedPng(pngBytes);

    const result = await compressPdfImagesToTargetSize(pdfBytes, {
      targetSizeBytes: 1 * 1024 * 1024
    });

    expect(result.imagesCompressed).toBe(0);
    expect(result.imagesSkipped).toBe(0);
    expect(result.compressedSizeBytes).toBe(pdfBytes.byteLength);
    expect(result.buffer).toBe(pdfBytes);
    expect(result.hitTarget).toBe(false);
    expect(result.pageCount).toBe(1);
    expect(result.imageStreamCount).toBe(1);
    expect(result.imageStreamsByFilter).toEqual({ FlateDecode: 1 });
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

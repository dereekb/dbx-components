import { describe, it, expect } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import sharp from 'sharp';
import { PDFDocument, PDFHexString, PDFName, PDFRawStream, PDFString, type PDFObject } from '@cantoo/pdf-lib';
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

function makeGradientRaster(width: number, height: number, channels: 1 | 3): Buffer {
  const raster = Buffer.alloc(width * height * channels);
  let offset = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (channels === 3) {
        raster[offset++] = Math.round((x / (width - 1)) * 255);
        raster[offset++] = Math.round((y / (height - 1)) * 255);
        raster[offset++] = 128;
      } else {
        raster[offset++] = Math.round(((x + y) / (width + height - 2)) * 255);
      }
    }
  }

  return raster;
}

function paeth(left: number, up: number, upLeft: number): number {
  const initial = left + up - upLeft;
  const distanceLeft = Math.abs(initial - left);
  const distanceUp = Math.abs(initial - up);
  const distanceUpLeft = Math.abs(initial - upLeft);
  return distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft ? left : distanceUp <= distanceUpLeft ? up : upLeft;
}

/**
 * Applies TIFF Predictor 2 (horizontal differencing) forward, producing the encoded bytes a PDF producer would deflate.
 */
function applyTiffPredictor(raw: Buffer, channels: number, width: number): Buffer {
  const rowLength = channels * width;
  const encoded = Buffer.from(raw);

  for (let rowStart = 0; rowStart < encoded.length; rowStart += rowLength) {
    for (let i = rowLength - 1; i >= channels; i -= 1) {
      encoded[rowStart + i] = (raw[rowStart + i] - raw[rowStart + i - channels]) & 0xff;
    }
  }

  return encoded;
}

interface ApplyPngPredictorConfig {
  readonly raw: Buffer;
  readonly channels: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Applies PNG row filters forward (cycling filter types 0-4 across rows to exercise every unfilter path).
 */
function applyPngPredictor(config: ApplyPngPredictorConfig): Buffer {
  const { raw, channels, width, height } = config;
  const rowLength = channels * width;
  const encoded = Buffer.alloc(height * (rowLength + 1));

  for (let row = 0; row < height; row += 1) {
    const filterType = row % 5;
    const inStart = row * rowLength;
    const outStart = row * (rowLength + 1);
    encoded[outStart] = filterType;

    for (let i = 0; i < rowLength; i += 1) {
      const value = raw[inStart + i];
      const left = i >= channels ? raw[inStart + i - channels] : 0;
      const up = row > 0 ? raw[inStart - rowLength + i] : 0;
      const upLeft = row > 0 && i >= channels ? raw[inStart - rowLength + i - channels] : 0;
      let filtered: number;

      switch (filterType) {
        case 1: // Sub
          filtered = value - left;
          break;
        case 2: // Up
          filtered = value - up;
          break;
        case 3: // Average
          filtered = value - ((left + up) >> 1);
          break;
        case 4: // Paeth
          filtered = value - paeth(left, up, upLeft);
          break;
        default: // None
          filtered = value;
      }

      encoded[outStart + 1 + i] = filtered & 0xff;
    }
  }

  return encoded;
}

interface MakeRawFlateImagePdfConfig {
  readonly width: number;
  readonly height: number;
  readonly channels: 1 | 3;
  readonly raw: Buffer;
  /**
   * PDF predictor: 1 (none, default), 2 (TIFF), or 10-15 (PNG).
   */
  readonly predictor?: number;
  readonly colorSpace?: 'DeviceRGB' | 'DeviceGray' | 'indexed' | 'iccBased';
  readonly bitsPerComponent?: number;
}

/**
 * Builds a PDF containing a FlateDecode raster image XObject built from raw pixel data.
 *
 * The stream is deflated at level 0 (stored) so the "encoded JPEG must be smaller than
 * the deflated stream" gate always passes for compressible rasters.
 */
async function makePdfWithRawFlateImage(config: MakeRawFlateImagePdfConfig): Promise<Buffer> {
  const { width, height, channels, raw, predictor = 1, colorSpace = channels === 3 ? 'DeviceRGB' : 'DeviceGray', bitsPerComponent = 8 } = config;
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([600, 800]);
  const context = pdfDoc.context;

  let encoded = raw;

  if (predictor === 2) {
    encoded = applyTiffPredictor(raw, channels, width);
  } else if (predictor >= 10) {
    encoded = applyPngPredictor({ raw, channels, width, height });
  }

  const deflated = deflateSync(encoded, { level: 0 });

  let colorSpaceObj: string | PDFObject = colorSpace;

  if (colorSpace === 'indexed') {
    colorSpaceObj = context.obj([PDFName.of('Indexed'), PDFName.of('DeviceRGB'), 255, PDFHexString.of('00'.repeat(768))]);
  } else if (colorSpace === 'iccBased') {
    const iccRef = context.register(PDFRawStream.of(context.obj({ N: channels, Length: 4 }), new Uint8Array([0, 0, 0, 0])));
    colorSpaceObj = context.obj([PDFName.of('ICCBased'), iccRef]);
  }

  const dict = context.obj({
    Type: 'XObject',
    Subtype: 'Image',
    Width: width,
    Height: height,
    ColorSpace: colorSpaceObj,
    BitsPerComponent: bitsPerComponent,
    Filter: 'FlateDecode',
    Length: deflated.length,
    ...(predictor === 1 ? {} : { DecodeParms: { Predictor: predictor, Colors: channels, Columns: width, BitsPerComponent: 8 } })
  });

  context.register(PDFRawStream.of(dict, deflated));
  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

interface ExtractedImageStream {
  readonly filter: string;
  readonly colorSpace: string;
  readonly width: number;
  readonly height: number;
  readonly contents: Buffer;
}

async function firstImageStreamOf(pdfBytes: Buffer): Promise<ExtractedImageStream> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  let result: ExtractedImageStream | undefined;

  for (const [, obj] of pdfDoc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) {
      const subtype = obj.dict.get(PDFName.of('Subtype'));

      if (subtype instanceof PDFName && subtype.asString() === '/Image') {
        result = {
          filter: String(obj.dict.get(PDFName.of('Filter'))),
          colorSpace: String(obj.dict.get(PDFName.of('ColorSpace'))),
          width: Number(String(obj.dict.get(PDFName.of('Width')))),
          height: Number(String(obj.dict.get(PDFName.of('Height')))),
          contents: Buffer.from(obj.contents)
        };
        break;
      }
    }
  }

  if (result == null) {
    throw new Error('no image stream found in PDF');
  }

  return result;
}

/**
 * Decodes a JPEG and returns the mean absolute per-byte difference against the expected raw raster.
 */
async function meanAbsPixelDiff(jpegBytes: Buffer, expectedRaw: Buffer, channels: 1 | 3): Promise<number> {
  const pipeline = sharp(jpegBytes);

  if (channels === 1) {
    pipeline.toColourspace('b-w'); // sharp otherwise decodes grayscale JPEGs to sRGB
  }

  const { data } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  expect(data.length).toBe(expectedRaw.length);

  let total = 0;

  for (const [i, expected] of expectedRaw.entries()) {
    total += Math.abs(data[i] - expected);
  }

  return total / expectedRaw.length;
}

/**
 * Mirrors the constants `@dereekb/dbx-web`'s PDF merge editor writes. Duplicated rather than imported because that is a browser package and this one is server-side; the values must stay in step with `pdf.merge.sidecar.ts`.
 */
const DBX_PDF_MERGE_SIDECAR_FILE_NAME = 'dbx-pdf-merge.json';
const DBX_PDF_MERGE_PAGE_TAG_KEY = PDFName.of('DbxPageTag');

async function makePdfWithSidecarAndEmbeddedJpeg(jpegBytes: Buffer, manifest: object, pageTag: string): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const image = await pdfDoc.embedJpg(jpegBytes);
  const page = pdfDoc.addPage([600, 800]);

  page.drawImage(image, { x: 50, y: 100, width: 500, height: 600 });
  page.node.set(DBX_PDF_MERGE_PAGE_TAG_KEY, PDFString.of(pageTag));

  await pdfDoc.attach(new Uint8Array(Buffer.from(JSON.stringify(manifest))), DBX_PDF_MERGE_SIDECAR_FILE_NAME, { mimeType: 'application/json' });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

describe('compressPdfImagesToTargetSize() sidecar preservation', () => {
  it('preserves the embedded merge manifest and page tags through image recompression', async () => {
    // The merge editor records which pages came from which slot as an embedded JSON manifest plus a
    // per-page dictionary tag. Compression rewrites image XObject streams and re-saves the whole
    // document, so this guards against a future change there quietly breaking re-import.
    const jpeg = await makeNoiseJpeg(3000, 3000, 95);
    const manifest = {
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      documents: [{ slotId: 'license', pageTags: ['license-0'] }],
      pages: [{ tag: 'license-0', slotId: 'license', sourceName: 'license.pdf', sourceIndex: 0, rotation: 0, outputIndex: 0 }]
    };
    const pdfBytes = await makePdfWithSidecarAndEmbeddedJpeg(jpeg, manifest, 'license-0');

    const result = await compressPdfImagesToTargetSize(pdfBytes, {
      targetSizeBytes: 1 * 1024 * 1024,
      imageMaxDimension: 1024,
      imageQuality: 70
    });

    // Confirm the re-save path actually ran, so the assertions below inspect the rewritten bytes
    // rather than the untouched original.
    expect(result.imagesCompressed).toBe(1);
    expect(result.compressedSizeBytes).toBeLessThan(result.originalSizeBytes);

    const output = await PDFDocument.load(result.buffer);
    const tag = output.getPages()[0].node.get(DBX_PDF_MERGE_PAGE_TAG_KEY);
    const attachment = output.getAttachments().find((x) => x.name === DBX_PDF_MERGE_SIDECAR_FILE_NAME);

    expect(tag instanceof PDFString ? tag.decodeText() : null).toBe('license-0');
    expect(attachment).toBeDefined();
    expect(JSON.parse(Buffer.from(attachment?.data as Uint8Array).toString('utf8'))).toEqual(manifest);
  });

  it('does not treat the embedded manifest stream as a compressible image', async () => {
    const jpeg = await makeNoiseJpeg(3000, 3000, 95);
    const manifest = { version: 1, documents: [], pages: [] };
    const pdfBytes = await makePdfWithSidecarAndEmbeddedJpeg(jpeg, manifest, 'license-0');

    const result = await compressPdfImagesToTargetSize(pdfBytes, { targetSizeBytes: 1 * 1024 * 1024 });

    // Only the JPEG counts as an image stream — the attachment is a raw stream with no /Subtype /Image.
    expect(result.imageStreamCount).toBe(1);
    expect(result.imagesSkipped).toBe(0);
  });
});

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

  it('compresses a FlateDecode-image PDF (embedded PNG) under the target size', async () => {
    // pdf-lib's embedPng stores the decoded raster as a plain FlateDecode /DeviceRGB
    // stream — the dominant layout for scanner-produced PDFs.
    const pngBytes = await readFile(CPR_PNG);
    const pdfBytes = await makePdfWithEmbeddedPng(pngBytes);

    const result = await compressPdfImagesToTargetSize(pdfBytes, {
      targetSizeBytes: 1 * 1024 * 1024
    });

    expect(result.imagesCompressed).toBe(1);
    expect(result.imagesSkipped).toBe(0);
    expect(result.compressedSizeBytes).toBeLessThan(result.originalSizeBytes);
    expect(result.hitTarget).toBe(true);
    expect(result.pageCount).toBe(1);
    expect(result.imageStreamCount).toBe(1);
    expect(result.imageStreamsByFilter).toEqual({ FlateDecode: 1 });
    expect(bufferHasValidPdfMarkings(result.buffer)).toBe(true);
  });

  it('re-encodes a plain FlateDecode RGB raster as a DCTDecode stream preserving pixel content', async () => {
    const width = 384;
    const height = 256;
    const raw = makeGradientRaster(width, height, 3);
    const pdfBytes = await makePdfWithRawFlateImage({ width, height, channels: 3, raw });

    const result = await compressPdfImagesToTargetSize(pdfBytes, {
      targetSizeBytes: 1 * 1024 * 1024,
      imageSizeThresholdBytes: 1
    });

    expect(result.imagesCompressed).toBe(1);

    const image = await firstImageStreamOf(result.buffer);
    expect(image.filter).toBe('/DCTDecode');
    expect(image.colorSpace).toBe('/DeviceRGB');
    expect(image.width).toBe(width);
    expect(image.height).toBe(height);
    expect(await meanAbsPixelDiff(image.contents, raw, 3)).toBeLessThan(10);
  });

  it('re-encodes a grayscale FlateDecode raster as a DeviceGray JPEG', async () => {
    const width = 320;
    const height = 240;
    const raw = makeGradientRaster(width, height, 1);
    const pdfBytes = await makePdfWithRawFlateImage({ width, height, channels: 1, raw });

    const result = await compressPdfImagesToTargetSize(pdfBytes, {
      targetSizeBytes: 1 * 1024 * 1024,
      imageSizeThresholdBytes: 1
    });

    expect(result.imagesCompressed).toBe(1);

    const image = await firstImageStreamOf(result.buffer);
    expect(image.filter).toBe('/DCTDecode');
    expect(image.colorSpace).toBe('/DeviceGray');
    expect(await meanAbsPixelDiff(image.contents, raw, 1)).toBeLessThan(10);
  });

  it('reverses PNG predictors when decoding a FlateDecode raster', async () => {
    const width = 256;
    const height = 200;
    const raw = makeGradientRaster(width, height, 3);
    const pdfBytes = await makePdfWithRawFlateImage({ width, height, channels: 3, raw, predictor: 15 });

    const result = await compressPdfImagesToTargetSize(pdfBytes, {
      targetSizeBytes: 1 * 1024 * 1024,
      imageSizeThresholdBytes: 1
    });

    expect(result.imagesCompressed).toBe(1);

    const image = await firstImageStreamOf(result.buffer);
    expect(await meanAbsPixelDiff(image.contents, raw, 3)).toBeLessThan(10);
  });

  it('reverses the TIFF predictor when decoding a FlateDecode raster', async () => {
    const width = 256;
    const height = 200;
    const raw = makeGradientRaster(width, height, 3);
    const pdfBytes = await makePdfWithRawFlateImage({ width, height, channels: 3, raw, predictor: 2 });

    const result = await compressPdfImagesToTargetSize(pdfBytes, {
      targetSizeBytes: 1 * 1024 * 1024,
      imageSizeThresholdBytes: 1
    });

    expect(result.imagesCompressed).toBe(1);

    const image = await firstImageStreamOf(result.buffer);
    expect(await meanAbsPixelDiff(image.contents, raw, 3)).toBeLessThan(10);
  });

  it('resolves ICCBased color spaces via their component count', async () => {
    const width = 256;
    const height = 200;
    const raw = makeGradientRaster(width, height, 3);
    const pdfBytes = await makePdfWithRawFlateImage({ width, height, channels: 3, raw, colorSpace: 'iccBased' });

    const result = await compressPdfImagesToTargetSize(pdfBytes, {
      targetSizeBytes: 1 * 1024 * 1024,
      imageSizeThresholdBytes: 1
    });

    expect(result.imagesCompressed).toBe(1);

    const image = await firstImageStreamOf(result.buffer);
    expect(image.filter).toBe('/DCTDecode');
    expect(image.colorSpace).toBe('/DeviceRGB');
  });

  it('skips indexed-colorspace FlateDecode images and reports hitTarget=false when over the target', async () => {
    const width = 128;
    const height = 128;
    const raw = Buffer.alloc(width * height, 7); // palette indexes, not raw pixels
    const pdfBytes = await makePdfWithRawFlateImage({ width, height, channels: 1, raw, colorSpace: 'indexed' });

    const result = await compressPdfImagesToTargetSize(pdfBytes, {
      targetSizeBytes: 1024,
      imageSizeThresholdBytes: 1
    });

    expect(result.imagesCompressed).toBe(0);
    expect(result.imagesSkipped).toBe(1);
    expect(result.compressedSizeBytes).toBe(pdfBytes.byteLength);
    expect(result.buffer).toBe(pdfBytes);
    expect(result.hitTarget).toBe(false);
    expect(result.imageStreamCount).toBe(1);
    expect(result.imageStreamsByFilter).toEqual({ FlateDecode: 1 });
  });

  it('skips 16-bit FlateDecode rasters', async () => {
    const width = 64;
    const height = 64;
    const raw = Buffer.alloc(width * height * 3 * 2, 33); // 16 bits per component
    const pdfBytes = await makePdfWithRawFlateImage({ width, height, channels: 3, raw, bitsPerComponent: 16 });

    const result = await compressPdfImagesToTargetSize(pdfBytes, {
      targetSizeBytes: 1024,
      imageSizeThresholdBytes: 1
    });

    expect(result.imagesCompressed).toBe(0);
    expect(result.imagesSkipped).toBe(1);
    expect(result.buffer).toBe(pdfBytes);
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

// MARK: External test file
const COMPRESS_PDF_TEST_FILE = process.env['COMPRESS_PDF_TEST_FILE'];
const DEFAULT_COMPRESS_PDF_TEST_TARGET_BYTES = Math.round(1.2 * 1024 * 1024);

/**
 * Compression capability harness for a real PDF on the local filesystem. Skipped unless
 * `COMPRESS_PDF_TEST_FILE` points at a PDF; that keeps real-world (potentially sensitive)
 * documents out of the repo while letting them drive the full compressor.
 *
 * @example
 * ```
 * COMPRESS_PDF_TEST_FILE="/path/to/input.pdf" npx nx test firebase-server-model --testPathPattern=compress.pdf
 * ```
 *
 * Optionally set `COMPRESS_PDF_TEST_TARGET_BYTES` (defaults to 1.2MB). The compressed
 * output is written next to the input as `<input>.compressed.pdf` for visual inspection,
 * and a diagnostic report (page/image stream breakdown) is logged.
 */
describe.runIf(Boolean(COMPRESS_PDF_TEST_FILE))('compressPdfImagesToTargetSize() with COMPRESS_PDF_TEST_FILE', () => {
  it(
    'compresses the external test file under the target size',
    async () => {
      const inputPath = COMPRESS_PDF_TEST_FILE as string;
      const targetSizeBytes = Number(process.env['COMPRESS_PDF_TEST_TARGET_BYTES'] ?? DEFAULT_COMPRESS_PDF_TEST_TARGET_BYTES);
      const input = await readFile(inputPath);

      const result = await compressPdfImagesToTargetSize(input, { targetSizeBytes });

      const outputPath = `${inputPath}.compressed.pdf`;
      await writeFile(outputPath, result.buffer);

      console.log(`compressPdfImagesToTargetSize() report for "${inputPath}":`, {
        targetSizeBytes,
        originalSizeBytes: result.originalSizeBytes,
        compressedSizeBytes: result.compressedSizeBytes,
        hitTarget: result.hitTarget,
        pageCount: result.pageCount,
        imageStreamCount: result.imageStreamCount,
        imageStreamsByFilter: result.imageStreamsByFilter,
        imagesCompressed: result.imagesCompressed,
        imagesSkipped: result.imagesSkipped,
        outputPath
      });

      expect(bufferHasValidPdfMarkings(result.buffer)).toBe(true);

      const reloaded = await PDFDocument.load(result.buffer);
      expect(reloaded.getPageCount()).toBe(result.pageCount);

      expect(result.hitTarget).toBe(true);
    },
    120 * 1000
  );
});

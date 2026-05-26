import { type Maybe } from '@dereekb/util';
import { PDFDocument, PDFName, PDFRawStream, type PDFRef, PDFArray } from '@cantoo/pdf-lib';
import { compressImageBufferToTargetSize } from './compress.image';

export const DEFAULT_COMPRESS_PDF_IMAGE_MAX_DIMENSION = 2048;
export const DEFAULT_COMPRESS_PDF_IMAGE_QUALITY = 75;
export const DEFAULT_COMPRESS_PDF_IMAGE_SIZE_THRESHOLD_BYTES = 100 * 1024;

/**
 * Configuration for {@link compressPdfImagesToTargetSize}.
 */
export interface CompressPdfImagesToTargetSizeConfig {
  /**
   * Target maximum size in bytes for the output PDF. Acts as a soft target — if the
   * best-effort recompression still exceeds this, the result is returned with `hitTarget: false`.
   */
  readonly targetSizeBytes: number;
  /**
   * Maximum dimension (longest side) of embedded images after recompression.
   * Defaults to {@link DEFAULT_COMPRESS_PDF_IMAGE_MAX_DIMENSION}.
   */
  readonly imageMaxDimension?: Maybe<number>;
  /**
   * JPEG quality applied when re-encoding extracted images. Defaults to
   * {@link DEFAULT_COMPRESS_PDF_IMAGE_QUALITY}.
   */
  readonly imageQuality?: Maybe<number>;
  /**
   * Images smaller than this byte size are left untouched (tiny icons / logos are
   * not worth recompressing). Defaults to {@link DEFAULT_COMPRESS_PDF_IMAGE_SIZE_THRESHOLD_BYTES}.
   */
  readonly imageSizeThresholdBytes?: Maybe<number>;
}

/**
 * Per-filter image stream counts (e.g. `{ DCTDecode: 2, FlateDecode: 1 }`). Streams
 * with no `/Filter` entry are bucketed under `'none'`; multi-filter chains are
 * joined with `+` (e.g. `'FlateDecode+DCTDecode'`).
 */
export type CompressPdfImageStreamsByFilter = Readonly<Record<string, number>>;

/**
 * Diagnostic context describing the source PDF — useful for explaining why a
 * compression attempt did or did not hit its target.
 */
export interface CompressPdfImagesToTargetSizeContext {
  /**
   * Number of pages in the source PDF.
   */
  readonly pageCount: number;
  /**
   * Total number of image XObjects (Subtype `/Image`) found in the PDF, regardless
   * of whether they were compressible by this implementation.
   */
  readonly imageStreamCount: number;
  /**
   * Breakdown of image XObjects by their PDF filter. If `hitTarget` is `false` and
   * this map only contains non-JPEG filters (e.g. `FlateDecode`, `CCITTFaxDecode`,
   * `JBIG2Decode`, `JPXDecode`), the v1 compressor cannot help — callers should
   * reject the upload or queue a downscale fallback.
   */
  readonly imageStreamsByFilter: CompressPdfImageStreamsByFilter;
}

/**
 * Result of {@link compressPdfImagesToTargetSize}.
 */
export interface CompressPdfImagesToTargetSizeResult extends CompressPdfImagesToTargetSizeContext {
  /**
   * Best-effort compressed PDF bytes. Equal to the original buffer if recompression
   * produced no smaller result.
   */
  readonly buffer: Buffer;
  readonly originalSizeBytes: number;
  readonly compressedSizeBytes: number;
  /**
   * Number of image XObjects that were successfully recompressed.
   */
  readonly imagesCompressed: number;
  /**
   * Number of image XObjects that were skipped (unsupported filter, mask, indexed
   * color space, or per-image error).
   */
  readonly imagesSkipped: number;
  /**
   * True if `compressedSizeBytes <= targetSizeBytes`.
   */
  readonly hitTarget: boolean;
}

/**
 * Recompresses image XObjects embedded in a PDF to shrink its overall size.
 *
 * Only DCTDecode (JPEG) image streams are touched in this implementation — the
 * dominant case for "phone photo PDFs". Images using other filters (FlateDecode,
 * CCITTFax, JBIG2, JPEG2000), indexed/CMYK color spaces, or that carry a
 * `/SMask` (soft mask) are skipped and counted in `imagesSkipped`.
 *
 * Throws on a malformed PDF — callers should catch and fall back to the original
 * bytes.
 *
 * @param input - The PDF bytes to compress.
 * @param config - Target size and image recompression parameters.
 * @returns The best-effort compressed PDF plus per-image counters.
 *
 * @example
 * ```ts
 * const result = await compressPdfImagesToTargetSize(buffer, {
 *   targetSizeBytes: 6 * 1024 * 1024
 * });
 * const finalBytes = result.hitTarget ? result.buffer : buffer;
 * ```
 */
export async function compressPdfImagesToTargetSize(input: Buffer, config: CompressPdfImagesToTargetSizeConfig): Promise<CompressPdfImagesToTargetSizeResult> {
  const { targetSizeBytes } = config;
  const imageMaxDimension = config.imageMaxDimension ?? DEFAULT_COMPRESS_PDF_IMAGE_MAX_DIMENSION;
  const imageQuality = config.imageQuality ?? DEFAULT_COMPRESS_PDF_IMAGE_QUALITY;
  const imageSizeThresholdBytes = config.imageSizeThresholdBytes ?? DEFAULT_COMPRESS_PDF_IMAGE_SIZE_THRESHOLD_BYTES;
  const originalSizeBytes = input.byteLength;

  const pdfDoc = await PDFDocument.load(input, { ignoreEncryption: true, updateMetadata: false });
  const pageCount = pdfDoc.getPageCount();
  const indirectObjects = pdfDoc.context.enumerateIndirectObjects();

  const counters: ImageCompressionCounters = {
    imagesCompressed: 0,
    imagesSkipped: 0,
    imageStreamCount: 0,
    imageStreamsByFilter: {}
  };

  for (const [ref, obj] of indirectObjects) {
    if (!(obj instanceof PDFRawStream)) {
      continue;
    }
    await processPdfStream({ pdfDoc, ref, obj, counters, imageMaxDimension, imageQuality, imageSizeThresholdBytes });
  }

  let outputBuffer: Buffer = input;
  let compressedSizeBytes = originalSizeBytes;

  if (counters.imagesCompressed > 0) {
    const savedBytes = await pdfDoc.save({ useObjectStreams: true });
    const savedBuffer = Buffer.from(savedBytes);

    if (savedBuffer.byteLength < originalSizeBytes) {
      outputBuffer = savedBuffer;
      compressedSizeBytes = savedBuffer.byteLength;
    }
  }

  const result: CompressPdfImagesToTargetSizeResult = {
    buffer: outputBuffer,
    originalSizeBytes,
    compressedSizeBytes,
    imagesCompressed: counters.imagesCompressed,
    imagesSkipped: counters.imagesSkipped,
    hitTarget: compressedSizeBytes <= targetSizeBytes,
    pageCount,
    imageStreamCount: counters.imageStreamCount,
    imageStreamsByFilter: counters.imageStreamsByFilter
  };
  return result;
}

interface ImageCompressionCounters {
  imagesCompressed: number;
  imagesSkipped: number;
  imageStreamCount: number;
  imageStreamsByFilter: Record<string, number>;
}

interface ProcessPdfStreamInput {
  readonly pdfDoc: PDFDocument;
  readonly ref: PDFRef;
  readonly obj: PDFRawStream;
  readonly counters: ImageCompressionCounters;
  readonly imageMaxDimension: number;
  readonly imageQuality: number;
  readonly imageSizeThresholdBytes: number;
}

async function processPdfStream(input: ProcessPdfStreamInput): Promise<void> {
  const { pdfDoc, ref, obj, counters, imageMaxDimension, imageQuality, imageSizeThresholdBytes } = input;

  if (isImageStream(obj)) {
    counters.imageStreamCount += 1;
    const filterKey = imageStreamFilterKey(obj);
    counters.imageStreamsByFilter[filterKey] = (counters.imageStreamsByFilter[filterKey] ?? 0) + 1;
  }

  if (!isCompressibleImageStream(obj)) {
    return;
  }

  if (obj.contents.byteLength < imageSizeThresholdBytes) {
    return; // tiny image — not worth recompressing
  }

  try {
    const compressedImage = await compressImageBufferToTargetSize(Buffer.from(obj.contents), {
      targetSizeBytes: obj.contents.byteLength, // we just want it smaller than the current image
      maxDimension: imageMaxDimension,
      initialQuality: imageQuality,
      format: 'jpeg'
    });

    if (compressedImage.compressedSizeBytes >= obj.contents.byteLength) {
      return; // no gain — leave it alone
    }

    replaceImageStream({
      pdfDoc,
      ref,
      newImageBytes: compressedImage.buffer,
      newWidth: compressedImage.finalWidth,
      newHeight: compressedImage.finalHeight
    });

    counters.imagesCompressed += 1;
  } catch {
    counters.imagesSkipped += 1;
  }
}

function isImageStream(stream: PDFRawStream): boolean {
  const dict = stream.dict;
  const type = dict.get(PDF_NAME_TYPE);
  const typeOk = type === undefined || pdfNameEquals(type, PDF_NAME_XOBJECT);
  let result = false;

  if (typeOk) {
    const subtype = dict.get(PDF_NAME_SUBTYPE);
    result = subtype !== undefined && pdfNameEquals(subtype, PDF_NAME_IMAGE);
  }

  return result;
}

function imageStreamFilterKey(stream: PDFRawStream): string {
  const filter = stream.dict.get(PDF_NAME_FILTER);
  let result: string;

  if (filter === undefined) {
    result = 'none';
  } else if (filter instanceof PDFArray) {
    result = filter
      .asArray()
      .map((entry) => (entry instanceof PDFName ? stripPdfNameSlash(entry.asString()) : 'unknown'))
      .join('+');
  } else if (filter instanceof PDFName) {
    result = stripPdfNameSlash(filter.asString());
  } else {
    result = 'unknown';
  }

  return result;
}

function stripPdfNameSlash(name: string): string {
  return name.startsWith('/') ? name.slice(1) : name;
}

const PDF_NAME_TYPE = PDFName.of('Type');
const PDF_NAME_XOBJECT = PDFName.of('XObject');
const PDF_NAME_SUBTYPE = PDFName.of('Subtype');
const PDF_NAME_IMAGE = PDFName.of('Image');
const PDF_NAME_FILTER = PDFName.of('Filter');
const PDF_NAME_DCTDECODE = PDFName.of('DCTDecode');
const PDF_NAME_SMASK = PDFName.of('SMask');
const PDF_NAME_MASK = PDFName.of('Mask');

function isCompressibleImageStream(stream: PDFRawStream): boolean {
  const dict = stream.dict;
  let result = false;

  // Must be Type /XObject (when present) and Subtype /Image
  const type = dict.get(PDF_NAME_TYPE);
  const typeOk = type === undefined || pdfNameEquals(type, PDF_NAME_XOBJECT);

  if (typeOk) {
    const subtype = dict.get(PDF_NAME_SUBTYPE);
    const subtypeOk = subtype !== undefined && pdfNameEquals(subtype, PDF_NAME_IMAGE);

    // Skip images with masks; replacing them risks breaking the mask alignment.
    const hasMask = dict.get(PDF_NAME_SMASK) !== undefined || dict.get(PDF_NAME_MASK) !== undefined;

    if (subtypeOk && !hasMask) {
      // Only DCTDecode (JPEG) streams in v1.
      const filter = dict.get(PDF_NAME_FILTER);

      if (filter !== undefined) {
        if (filter instanceof PDFArray) {
          result = filter.size() === 1 && pdfNameEquals(filter.get(0), PDF_NAME_DCTDECODE);
        } else {
          result = pdfNameEquals(filter, PDF_NAME_DCTDECODE);
        }
      }
    }
  }

  return result;
}

function pdfNameEquals(candidate: unknown, name: PDFName): boolean {
  return candidate instanceof PDFName && candidate.asString() === name.asString();
}

interface ReplaceImageStreamInput {
  readonly pdfDoc: PDFDocument;
  readonly ref: PDFRef;
  readonly newImageBytes: Buffer;
  readonly newWidth: number;
  readonly newHeight: number;
}

function replaceImageStream(input: ReplaceImageStreamInput): void {
  const { pdfDoc, ref, newImageBytes, newWidth, newHeight } = input;
  const context = pdfDoc.context;

  const newDict = context.obj({
    Type: 'XObject',
    Subtype: 'Image',
    Width: newWidth,
    Height: newHeight,
    ColorSpace: 'DeviceRGB',
    BitsPerComponent: 8,
    Filter: 'DCTDecode',
    Length: newImageBytes.length
  });

  const newStream = PDFRawStream.of(newDict, newImageBytes);
  context.assign(ref, newStream);
}

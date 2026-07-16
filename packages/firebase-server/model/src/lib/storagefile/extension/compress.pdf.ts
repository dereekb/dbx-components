import { inflateSync } from 'node:zlib';
import { type Maybe } from '@dereekb/util';
import { PDFDocument, PDFName, PDFRawStream, PDFRef, PDFArray, PDFDict, PDFNumber, PDFStream } from '@cantoo/pdf-lib';
import { compressImageBufferToTargetSize, type CompressImageBufferToTargetSizeResult } from './compress.image';

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
   * this map only contains filters this compressor cannot handle (e.g.
   * `CCITTFaxDecode`, `JBIG2Decode`, `JPXDecode`), recompression cannot help —
   * callers should reject the upload or queue a downscale fallback.
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
   * Number of image XObjects that were candidates but could not be recompressed
   * (unsupported color space, bit depth or predictor, or a per-image error).
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
 * Two stream kinds are recompressed to JPEG (DCTDecode):
 * - DCTDecode (JPEG) image streams — the dominant case for "phone photo PDFs".
 * - FlateDecode raster image streams (zlib-deflated raw pixels, 8 bits per
 *   component, DeviceRGB/DeviceGray/CalRGB/CalGray/ICCBased color spaces, with
 *   optional PNG/TIFF predictors) — the dominant case for scanner-produced PDFs.
 *
 * Images using other filters (CCITTFax, JBIG2, JPEG2000), indexed/CMYK/other
 * color spaces, non-8-bit rasters, or that carry a `/SMask` or `/Mask` are
 * skipped and counted in `imagesSkipped`.
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

  const streamType = compressibleImageStreamType(obj);

  if (streamType == null) {
    return;
  }

  if (obj.contents.byteLength < imageSizeThresholdBytes) {
    return; // tiny image — not worth recompressing
  }

  try {
    let compressedImage: Maybe<CompressImageBufferToTargetSizeResult>;

    if (streamType === 'jpeg') {
      compressedImage = await compressImageBufferToTargetSize(Buffer.from(obj.contents), {
        targetSizeBytes: obj.contents.byteLength, // we just want it smaller than the current image
        maxDimension: imageMaxDimension,
        initialQuality: imageQuality,
        format: 'jpeg'
      });
    } else {
      const decoded = decodeFlateRasterImage(pdfDoc, obj);

      if (decoded == null) {
        counters.imagesSkipped += 1; // unsupported raster layout (color space, bit depth, predictor, or decode array)
      } else {
        compressedImage = await compressImageBufferToTargetSize(decoded.data, {
          targetSizeBytes: obj.contents.byteLength, // the encoded JPEG must beat the current deflated stream
          maxDimension: imageMaxDimension,
          initialQuality: imageQuality,
          format: 'jpeg',
          rawPixelInput: { width: decoded.width, height: decoded.height, channels: decoded.channels }
        });
      }
    }

    if (compressedImage == null || compressedImage.compressedSizeBytes >= obj.contents.byteLength) {
      return; // no gain — leave it alone
    }

    replaceImageStream({
      pdfDoc,
      ref,
      newImageBytes: compressedImage.buffer,
      newWidth: compressedImage.finalWidth,
      newHeight: compressedImage.finalHeight,
      colorSpace: compressedImage.finalChannels === 1 ? 'DeviceGray' : 'DeviceRGB'
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
const PDF_NAME_FLATEDECODE = PDFName.of('FlateDecode');
const PDF_NAME_SMASK = PDFName.of('SMask');
const PDF_NAME_MASK = PDFName.of('Mask');
const PDF_NAME_WIDTH = PDFName.of('Width');
const PDF_NAME_HEIGHT = PDFName.of('Height');
const PDF_NAME_BITS_PER_COMPONENT = PDFName.of('BitsPerComponent');
const PDF_NAME_COLOR_SPACE = PDFName.of('ColorSpace');
const PDF_NAME_DECODE = PDFName.of('Decode');
const PDF_NAME_IMAGE_MASK = PDFName.of('ImageMask');
const PDF_NAME_DECODE_PARMS = PDFName.of('DecodeParms');
const PDF_NAME_PREDICTOR = PDFName.of('Predictor');
const PDF_NAME_COLORS = PDFName.of('Colors');
const PDF_NAME_COLUMNS = PDFName.of('Columns');
const PDF_NAME_DEVICE_RGB = PDFName.of('DeviceRGB');
const PDF_NAME_DEVICE_GRAY = PDFName.of('DeviceGray');
const PDF_NAME_CAL_RGB = PDFName.of('CalRGB');
const PDF_NAME_CAL_GRAY = PDFName.of('CalGray');
const PDF_NAME_ICC_BASED = PDFName.of('ICCBased');
const PDF_NAME_N = PDFName.of('N');

/**
 * Kind of image stream {@link compressPdfImagesToTargetSize} can recompress.
 *
 * - `jpeg`: a DCTDecode (JPEG) stream, re-encoded directly.
 * - `flateRaster`: a FlateDecode stream holding raw pixel data, inflated and
 *   re-encoded as JPEG.
 */
type CompressiblePdfImageStreamType = 'jpeg' | 'flateRaster';

function compressibleImageStreamType(stream: PDFRawStream): Maybe<CompressiblePdfImageStreamType> {
  const dict = stream.dict;
  let result: Maybe<CompressiblePdfImageStreamType>;

  // Must be Type /XObject (when present) and Subtype /Image
  const type = dict.get(PDF_NAME_TYPE);
  const typeOk = type === undefined || pdfNameEquals(type, PDF_NAME_XOBJECT);

  if (typeOk) {
    const subtype = dict.get(PDF_NAME_SUBTYPE);
    const subtypeOk = subtype !== undefined && pdfNameEquals(subtype, PDF_NAME_IMAGE);

    // Skip images with masks; replacing them risks breaking the mask alignment.
    const hasMask = dict.get(PDF_NAME_SMASK) !== undefined || dict.get(PDF_NAME_MASK) !== undefined;

    if (subtypeOk && !hasMask) {
      let filter = dict.get(PDF_NAME_FILTER);

      if (filter instanceof PDFArray && filter.size() === 1) {
        filter = filter.get(0);
      }

      if (filter instanceof PDFName) {
        if (pdfNameEquals(filter, PDF_NAME_DCTDECODE)) {
          result = 'jpeg';
        } else if (pdfNameEquals(filter, PDF_NAME_FLATEDECODE)) {
          result = 'flateRaster';
        }
      }
    }
  }

  return result;
}

function pdfNameEquals(candidate: unknown, name: PDFName): boolean {
  return candidate instanceof PDFName && candidate.asString() === name.asString();
}

function lookupPdfObject(pdfDoc: PDFDocument, value: unknown): unknown {
  return value instanceof PDFRef ? pdfDoc.context.lookup(value) : value;
}

function dictNumber(dict: PDFDict, name: PDFName): Maybe<number> {
  const value = dict.get(name);
  return value instanceof PDFNumber ? value.asNumber() : undefined;
}

/**
 * Number of color channels in a decodable flate raster (1 = grayscale, 3 = RGB).
 */
type FlateRasterChannels = 1 | 3;

function resolveImageColorSpaceChannels(pdfDoc: PDFDocument, colorSpaceValue: unknown): Maybe<FlateRasterChannels> {
  const colorSpace = lookupPdfObject(pdfDoc, colorSpaceValue);
  let result: Maybe<FlateRasterChannels>;

  if (colorSpace instanceof PDFName) {
    if (pdfNameEquals(colorSpace, PDF_NAME_DEVICE_RGB) || pdfNameEquals(colorSpace, PDF_NAME_CAL_RGB)) {
      result = 3;
    } else if (pdfNameEquals(colorSpace, PDF_NAME_DEVICE_GRAY) || pdfNameEquals(colorSpace, PDF_NAME_CAL_GRAY)) {
      result = 1;
    }
  } else if (colorSpace instanceof PDFArray && colorSpace.size() > 0) {
    const family = colorSpace.get(0);

    if (pdfNameEquals(family, PDF_NAME_ICC_BASED) && colorSpace.size() > 1) {
      const iccStream = lookupPdfObject(pdfDoc, colorSpace.get(1));

      if (iccStream instanceof PDFStream) {
        const componentCount = dictNumber(iccStream.dict, PDF_NAME_N);

        if (componentCount === 3) {
          result = 3;
        } else if (componentCount === 1) {
          result = 1;
        }
      }
    } else if (pdfNameEquals(family, PDF_NAME_CAL_RGB)) {
      result = 3;
    } else if (pdfNameEquals(family, PDF_NAME_CAL_GRAY)) {
      result = 1;
    }
  }

  return result;
}

interface FlatePredictorParams {
  readonly predictor: number;
  readonly colors: number;
  readonly columns: number;
  readonly bitsPerComponent: number;
}

function readFlatePredictorParams(pdfDoc: PDFDocument, dict: PDFDict): FlatePredictorParams {
  let parmsValue = lookupPdfObject(pdfDoc, dict.get(PDF_NAME_DECODE_PARMS));

  // A filter array pairs with a DecodeParms array; a single flate filter uses the first entry.
  if (parmsValue instanceof PDFArray) {
    parmsValue = lookupPdfObject(pdfDoc, parmsValue.size() > 0 ? parmsValue.get(0) : undefined);
  }

  const parms = parmsValue instanceof PDFDict ? parmsValue : undefined;
  const result: FlatePredictorParams = {
    predictor: (parms ? dictNumber(parms, PDF_NAME_PREDICTOR) : undefined) ?? 1,
    colors: (parms ? dictNumber(parms, PDF_NAME_COLORS) : undefined) ?? 1,
    columns: (parms ? dictNumber(parms, PDF_NAME_COLUMNS) : undefined) ?? 1,
    bitsPerComponent: (parms ? dictNumber(parms, PDF_NAME_BITS_PER_COMPONENT) : undefined) ?? 8
  };
  return result;
}

function unpredictFlateImageData(data: Buffer, params: FlatePredictorParams): Maybe<Buffer> {
  const { predictor, colors, columns, bitsPerComponent } = params;
  let result: Maybe<Buffer>;

  if (predictor === 1) {
    result = data;
  } else if (bitsPerComponent !== 8) {
    result = undefined; // only 8-bit predictor data is supported
  } else if (predictor === 2) {
    result = unpredictTiffImageData(data, colors, columns);
  } else if (predictor >= 10 && predictor <= 15) {
    result = unpredictPngImageData(data, colors, columns);
  }

  return result;
}

/**
 * Reverses TIFF Predictor 2 (horizontal differencing) on 8-bit sample data, in place.
 *
 * @param data - Predictor-encoded sample bytes.
 * @param colors - Samples per pixel.
 * @param columns - Pixels per row.
 * @returns The same buffer with the differencing undone, or `undefined` when the length is not a whole number of rows.
 */
function unpredictTiffImageData(data: Buffer, colors: number, columns: number): Maybe<Buffer> {
  const rowLength = colors * columns;
  let result: Maybe<Buffer>;

  if (rowLength > 0 && data.byteLength % rowLength === 0) {
    for (let rowStart = 0; rowStart < data.byteLength; rowStart += rowLength) {
      for (let i = colors; i < rowLength; i += 1) {
        data[rowStart + i] = (data[rowStart + i] + data[rowStart + i - colors]) & 0xff;
      }
    }

    result = data;
  }

  return result;
}

/**
 * Reverses PNG row filters (predictors 10–15) on 8-bit sample data.
 *
 * @param data - Predictor-encoded bytes: each row is one filter-type byte followed by `colors * columns` filtered bytes.
 * @param colors - Samples per pixel.
 * @param columns - Pixels per row.
 * @returns The unfiltered raster bytes, or `undefined` for a malformed length or an unknown filter type.
 */
function unpredictPngImageData(data: Buffer, colors: number, columns: number): Maybe<Buffer> {
  const rowLength = colors * columns;
  const encodedRowLength = rowLength + 1;
  let result: Maybe<Buffer>;

  if (rowLength > 0 && data.byteLength % encodedRowLength === 0) {
    const rows = data.byteLength / encodedRowLength;
    const output = Buffer.alloc(rows * rowLength);
    let valid = true;

    for (let row = 0; row < rows && valid; row += 1) {
      valid = unpredictPngRow({
        filterType: data[row * encodedRowLength],
        rowIn: data.subarray(row * encodedRowLength + 1, (row + 1) * encodedRowLength),
        output,
        outStart: row * rowLength,
        prevStart: (row - 1) * rowLength,
        colors,
        isFirstRow: row === 0
      });
    }

    result = valid ? output : undefined;
  }

  return result;
}

interface UnpredictPngRowInput {
  readonly filterType: number;
  readonly rowIn: Buffer;
  readonly output: Buffer;
  readonly outStart: number;
  readonly prevStart: number;
  readonly colors: number;
  readonly isFirstRow: boolean;
}

function unpredictPngRow(input: UnpredictPngRowInput): boolean {
  const { filterType, rowIn, output, outStart, prevStart, colors, isFirstRow } = input;
  let valid = true;

  for (let i = 0; i < rowIn.length && valid; i += 1) {
    const left = i >= colors ? output[outStart + i - colors] : 0;
    const up = isFirstRow ? 0 : output[prevStart + i];
    let value = 0;

    switch (filterType) {
      case 0: // None
        value = rowIn[i];
        break;
      case 1: // Sub
        value = rowIn[i] + left;
        break;
      case 2: // Up
        value = rowIn[i] + up;
        break;
      case 3: // Average
        value = rowIn[i] + ((left + up) >> 1);
        break;
      case 4: {
        // Paeth
        const upLeft = !isFirstRow && i >= colors ? output[prevStart + i - colors] : 0;
        value = rowIn[i] + paethPredictor(left, up, upLeft);
        break;
      }
      default:
        valid = false;
    }

    output[outStart + i] = value & 0xff;
  }

  return valid;
}

function paethPredictor(left: number, up: number, upLeft: number): number {
  const initial = left + up - upLeft;
  const distanceLeft = Math.abs(initial - left);
  const distanceUp = Math.abs(initial - up);
  const distanceUpLeft = Math.abs(initial - upLeft);
  let result: number;

  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) {
    result = left;
  } else if (distanceUp <= distanceUpLeft) {
    result = up;
  } else {
    result = upLeft;
  }

  return result;
}

interface DecodedFlateRasterImage {
  readonly data: Buffer;
  readonly width: number;
  readonly height: number;
  readonly channels: FlateRasterChannels;
}

/**
 * Inflates a FlateDecode image stream into raw interleaved 8-bit pixel data.
 *
 * @param pdfDoc - Document the stream belongs to, used to resolve indirect references.
 * @param stream - The FlateDecode image XObject stream.
 * @returns The decoded raster, or `undefined` when the stream's raster layout is
 * unsupported: a non-8-bit depth, an image mask, a custom `/Decode` array, an
 * unresolvable or non-gray/RGB color space, an unsupported predictor, or a decoded
 * length that does not match the declared dimensions.
 */
function decodeFlateRasterImage(pdfDoc: PDFDocument, stream: PDFRawStream): Maybe<DecodedFlateRasterImage> {
  const dict = stream.dict;
  const width = dictNumber(dict, PDF_NAME_WIDTH);
  const height = dictNumber(dict, PDF_NAME_HEIGHT);
  const bitsPerComponent = dictNumber(dict, PDF_NAME_BITS_PER_COMPONENT);
  const hasDecodeArray = dict.get(PDF_NAME_DECODE) !== undefined;
  const isImageMask = dict.get(PDF_NAME_IMAGE_MASK) !== undefined;
  const channels = resolveImageColorSpaceChannels(pdfDoc, dict.get(PDF_NAME_COLOR_SPACE));

  let result: Maybe<DecodedFlateRasterImage>;

  if (width != null && width > 0 && height != null && height > 0 && bitsPerComponent === 8 && !hasDecodeArray && !isImageMask && channels != null) {
    const predictorParams = readFlatePredictorParams(pdfDoc, dict);
    // when a predictor is in play its params must describe the same raster layout the image dict declares
    const predictorParamsOk = predictorParams.predictor === 1 || (predictorParams.colors === channels && predictorParams.columns === width && predictorParams.bitsPerComponent === 8);

    if (predictorParamsOk) {
      const inflated = inflateSync(stream.contents);
      const data = unpredictFlateImageData(inflated, predictorParams);

      if (data?.byteLength === width * height * channels) {
        result = { data, width, height, channels };
      }
    }
  }

  return result;
}

interface ReplaceImageStreamInput {
  readonly pdfDoc: PDFDocument;
  readonly ref: PDFRef;
  readonly newImageBytes: Buffer;
  readonly newWidth: number;
  readonly newHeight: number;
  readonly colorSpace: 'DeviceRGB' | 'DeviceGray';
}

function replaceImageStream(input: ReplaceImageStreamInput): void {
  const { pdfDoc, ref, newImageBytes, newWidth, newHeight, colorSpace } = input;
  const context = pdfDoc.context;

  const newDict = context.obj({
    Type: 'XObject',
    Subtype: 'Image',
    Width: newWidth,
    Height: newHeight,
    ColorSpace: colorSpace,
    BitsPerComponent: 8,
    Filter: 'DCTDecode',
    Length: newImageBytes.length
  });

  const newStream = PDFRawStream.of(newDict, newImageBytes);
  context.assign(ref, newStream);
}

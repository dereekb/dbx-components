import { Maybe } from '../value/maybe.type';

/**
 * A simple mime type string with just the type/subtype and no parameters.
 *
 * I.E. "application/json"
 */
export type MimeTypeWithoutParameters = string;

/**
 * A mime type string that may contain additional parameters.
 *
 * I.E. "text/plain", "application/json; charset=utf-8"
 */
export type ContentTypeMimeType = string;

/**
 * Input for mimetypeForImageType().
 *
 * This is a non-exhaustive list of common image types.
 */
export type MimeTypeForImageTypeInputType = 'jpeg' | 'jpg' | 'png' | 'webp' | 'gif' | 'svg' | 'raw' | 'heif' | 'tiff';

export const JPEG_MIME_TYPE: MimeTypeWithoutParameters = 'image/jpeg';
export const PNG_MIME_TYPE: MimeTypeWithoutParameters = 'image/png';
export const WEBP_MIME_TYPE: MimeTypeWithoutParameters = 'image/webp';
export const GIF_MIME_TYPE: MimeTypeWithoutParameters = 'image/gif';
export const SVG_MIME_TYPE: MimeTypeWithoutParameters = 'image/svg+xml';
export const RAW_MIME_TYPE: MimeTypeWithoutParameters = 'image/raw';
export const HEIF_MIME_TYPE: MimeTypeWithoutParameters = 'image/heif';
export const TIFF_MIME_TYPE: MimeTypeWithoutParameters = 'image/tiff';

/**
 * Returns the mimetype for the given image type, or undefined if the type is not known.
 */
export function mimetypeForImageType(imageType: MimeTypeForImageTypeInputType): MimeTypeWithoutParameters;
export function mimetypeForImageType(imageType: MimeTypeForImageTypeInputType | string): Maybe<MimeTypeWithoutParameters>;
export function mimetypeForImageType(imageType: MimeTypeForImageTypeInputType | string): Maybe<MimeTypeWithoutParameters> {
  let result: Maybe<MimeTypeWithoutParameters> = undefined;

  switch (imageType) {
    case 'jpeg':
    case 'jpg':
      result = JPEG_MIME_TYPE;
      break;
    case 'png':
      result = PNG_MIME_TYPE;
      break;
    case 'webp':
      result = WEBP_MIME_TYPE;
      break;
    case 'gif':
      result = GIF_MIME_TYPE;
      break;
    case 'svg':
      result = SVG_MIME_TYPE;
      break;
    case 'raw':
      result = RAW_MIME_TYPE;
      break;
    case 'tiff':
      result = TIFF_MIME_TYPE;
      break;
    case 'heif':
      result = HEIF_MIME_TYPE;
      break;
  }

  return result;
}

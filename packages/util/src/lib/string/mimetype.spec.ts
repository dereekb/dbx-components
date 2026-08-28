import {
  mimeTypeForImageFileExtension,
  imageFileExtensionForMimeType,
  mimeTypeForDocumentFileExtension,
  documentFileExtensionForMimeType,
  mimeTypeForApplicationFileExtension,
  applicationFileExtensionForMimeType,
  mimeTypeForCalendarFileExtension,
  calendarFileExtensionForMimeType,
  mimeTypeForFileExtension,
  fileExtensionForMimeType,
  JPEG_MIME_TYPE,
  PNG_MIME_TYPE,
  PDF_MIME_TYPE,
  JSON_MIME_TYPE,
  ZIP_FILE_MIME_TYPE,
  TEXT_CALENDAR_MIME_TYPE,
  TEXT_CALENDAR_UTF8_CONTENT_TYPE,
  IMAGE_FILE_EXTENSION_TO_MIME_TYPES_RECORD,
  DOCUMENT_FILE_EXTENSION_TO_MIME_TYPES_RECORD,
  APPLICATION_FILE_EXTENSION_TO_MIME_TYPES_RECORD,
  CALENDAR_FILE_EXTENSION_TO_MIME_TYPES_RECORD
} from './mimetype';

describe('mimeTypeForImageFileExtension()', () => {
  it('should return the MIME type for a known image extension', () => {
    expect(mimeTypeForImageFileExtension('jpeg')).toBe(JPEG_MIME_TYPE);
    expect(mimeTypeForImageFileExtension('png')).toBe(PNG_MIME_TYPE);
  });

  it('should return undefined for an unknown extension', () => {
    expect(mimeTypeForImageFileExtension('unknown' as any)).toBeUndefined();
  });

  it('should return undefined for null/undefined input', () => {
    expect(mimeTypeForImageFileExtension(undefined)).toBeUndefined();
    expect(mimeTypeForImageFileExtension(null as any)).toBeUndefined();
  });
});

describe('imageFileExtensionForMimeType()', () => {
  it('should return the file extension for a known image MIME type', () => {
    const result = imageFileExtensionForMimeType(PNG_MIME_TYPE);
    expect(result).toBe('png');
  });

  it('should return undefined for an unknown MIME type', () => {
    expect(imageFileExtensionForMimeType('application/pdf')).toBeUndefined();
  });

  it('should return undefined for null/undefined input', () => {
    expect(imageFileExtensionForMimeType(undefined)).toBeUndefined();
  });
});

describe('mimeTypeForDocumentFileExtension()', () => {
  it('should return the MIME type for a known document extension', () => {
    expect(mimeTypeForDocumentFileExtension('pdf')).toBe(PDF_MIME_TYPE);
    expect(mimeTypeForDocumentFileExtension('json')).toBe(JSON_MIME_TYPE);
  });

  it('should return undefined for an unknown extension', () => {
    expect(mimeTypeForDocumentFileExtension('unknown' as any)).toBeUndefined();
  });

  it('should return undefined for null/undefined input', () => {
    expect(mimeTypeForDocumentFileExtension(undefined)).toBeUndefined();
  });
});

describe('documentFileExtensionForMimeType()', () => {
  it('should return the file extension for a known document MIME type', () => {
    expect(documentFileExtensionForMimeType(PDF_MIME_TYPE)).toBe('pdf');
  });

  it('should return undefined for an unknown MIME type', () => {
    expect(documentFileExtensionForMimeType('image/png')).toBeUndefined();
  });

  it('should return undefined for null/undefined input', () => {
    expect(documentFileExtensionForMimeType(undefined)).toBeUndefined();
  });
});

describe('mimeTypeForApplicationFileExtension()', () => {
  it('should return the MIME type for a known application extension', () => {
    expect(mimeTypeForApplicationFileExtension('zip')).toBe(ZIP_FILE_MIME_TYPE);
  });

  it('should return undefined for an unknown extension', () => {
    expect(mimeTypeForApplicationFileExtension('unknown' as any)).toBeUndefined();
  });

  it('should return undefined for null/undefined input', () => {
    expect(mimeTypeForApplicationFileExtension(undefined)).toBeUndefined();
  });
});

describe('applicationFileExtensionForMimeType()', () => {
  it('should return the file extension for a known application MIME type', () => {
    expect(applicationFileExtensionForMimeType(ZIP_FILE_MIME_TYPE)).toBe('zip');
  });

  it('should return undefined for an unknown MIME type', () => {
    expect(applicationFileExtensionForMimeType('text/plain')).toBeUndefined();
  });

  it('should return undefined for null/undefined input', () => {
    expect(applicationFileExtensionForMimeType(undefined)).toBeUndefined();
  });
});

describe('mimeTypeForCalendarFileExtension()', () => {
  it('should return the MIME type for a known calendar extension', () => {
    expect(mimeTypeForCalendarFileExtension('ics')).toBe(TEXT_CALENDAR_MIME_TYPE);
  });

  it('should return undefined for an unknown extension', () => {
    expect(mimeTypeForCalendarFileExtension('unknown' as any)).toBeUndefined();
  });

  it('should return undefined for null/undefined input', () => {
    expect(mimeTypeForCalendarFileExtension(undefined)).toBeUndefined();
  });
});

describe('calendarFileExtensionForMimeType()', () => {
  it('should return the file extension for a known calendar MIME type', () => {
    expect(calendarFileExtensionForMimeType(TEXT_CALENDAR_MIME_TYPE)).toBe('ics');
  });

  it('should return undefined for an unknown MIME type', () => {
    expect(calendarFileExtensionForMimeType('text/plain')).toBeUndefined();
  });

  it('should return undefined for null/undefined input', () => {
    expect(calendarFileExtensionForMimeType(undefined)).toBeUndefined();
  });
});

describe('TEXT_CALENDAR_UTF8_CONTENT_TYPE', () => {
  it('should carry the charset parameter that calendar clients expect', () => {
    expect(TEXT_CALENDAR_UTF8_CONTENT_TYPE).toBe('text/calendar; charset=utf-8');
    expect(TEXT_CALENDAR_UTF8_CONTENT_TYPE.startsWith(TEXT_CALENDAR_MIME_TYPE)).toBe(true);
  });
});

describe('mimeTypeForFileExtension()', () => {
  it('should return the MIME type for a known image extension', () => {
    expect(mimeTypeForFileExtension('png')).toBe(PNG_MIME_TYPE);
  });

  it('should return the MIME type for a known document extension', () => {
    expect(mimeTypeForFileExtension('pdf')).toBe(PDF_MIME_TYPE);
  });

  it('should return the MIME type for a known application extension', () => {
    expect(mimeTypeForFileExtension('zip')).toBe(ZIP_FILE_MIME_TYPE);
  });

  it('should return the MIME type for a known calendar extension', () => {
    expect(mimeTypeForFileExtension('ics')).toBe(TEXT_CALENDAR_MIME_TYPE);
  });

  it('should return undefined for an unknown extension', () => {
    expect(mimeTypeForFileExtension('unknown' as any)).toBeUndefined();
  });

  it('should return undefined for null/undefined input', () => {
    expect(mimeTypeForFileExtension(undefined)).toBeUndefined();
  });
});

describe('fileExtensionForMimeType()', () => {
  it('should return the extension for a known image MIME type', () => {
    expect(fileExtensionForMimeType(PNG_MIME_TYPE)).toBe('png');
  });

  it('should return the extension for a known document MIME type', () => {
    expect(fileExtensionForMimeType(PDF_MIME_TYPE)).toBe('pdf');
  });

  it('should return the extension for a known application MIME type', () => {
    expect(fileExtensionForMimeType(ZIP_FILE_MIME_TYPE)).toBe('zip');
  });

  it('should return the extension for a known calendar MIME type', () => {
    expect(fileExtensionForMimeType(TEXT_CALENDAR_MIME_TYPE)).toBe('ics');
  });

  it('should return undefined for an unknown MIME type', () => {
    expect(fileExtensionForMimeType('application/unknown')).toBeUndefined();
  });

  it('should return undefined for null/undefined input', () => {
    expect(fileExtensionForMimeType(undefined)).toBeUndefined();
  });
});

describe('lookup records', () => {
  it('IMAGE_FILE_EXTENSION_TO_MIME_TYPES_RECORD should contain expected entries', () => {
    expect(IMAGE_FILE_EXTENSION_TO_MIME_TYPES_RECORD['jpeg']).toBe(JPEG_MIME_TYPE);
    expect(IMAGE_FILE_EXTENSION_TO_MIME_TYPES_RECORD['jpg']).toBe(JPEG_MIME_TYPE);
  });

  it('DOCUMENT_FILE_EXTENSION_TO_MIME_TYPES_RECORD should contain expected entries', () => {
    expect(DOCUMENT_FILE_EXTENSION_TO_MIME_TYPES_RECORD['pdf']).toBe(PDF_MIME_TYPE);
    expect(DOCUMENT_FILE_EXTENSION_TO_MIME_TYPES_RECORD['json']).toBe(JSON_MIME_TYPE);
  });

  it('APPLICATION_FILE_EXTENSION_TO_MIME_TYPES_RECORD should contain expected entries', () => {
    expect(APPLICATION_FILE_EXTENSION_TO_MIME_TYPES_RECORD['zip']).toBe(ZIP_FILE_MIME_TYPE);
  });

  it('CALENDAR_FILE_EXTENSION_TO_MIME_TYPES_RECORD should contain expected entries', () => {
    expect(CALENDAR_FILE_EXTENSION_TO_MIME_TYPES_RECORD['ics']).toBe(TEXT_CALENDAR_MIME_TYPE);
  });
});

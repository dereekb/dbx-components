import { slashPathDetails } from '@dereekb/util';
import { describe, expect, it } from 'vitest';
import { FORM_SPACE_UPLOAD_POLICY, formSpaceFileStoragePath, formSpaceUploadFileNameDetails, formSpaceUploadsFilePath, formSpaceUploadsFolderPath, parseFormSpaceUploadPath } from './formspace.upload';

describe('formSpaceUploadsFilePath()', () => {
  it('should build the slot upload folder and file paths', () => {
    expect(formSpaceUploadsFolderPath('user123', 'fsp1', 'resume')).toBe('uploads/u/user123/formSpace/fsp1/resume/');
    expect(formSpaceUploadsFilePath({ uid: 'user123', formSpaceId: 'fsp1', slot: 'resume', filename: 'resume.pdf' })).toBe('uploads/u/user123/formSpace/fsp1/resume/resume.pdf');
  });
});

describe('parseFormSpaceUploadPath()', () => {
  it('should round-trip a built path', () => {
    const path = formSpaceUploadsFilePath({ uid: 'user123', formSpaceId: 'fsp1', slot: 'resume', filename: 'resume.pdf' });
    expect(parseFormSpaceUploadPath(path)).toEqual({ uid: 'user123', formSpaceId: 'fsp1', slot: 'resume', filename: 'resume.pdf' });
  });

  it('should tolerate a leading slash', () => {
    expect(parseFormSpaceUploadPath('/uploads/u/user123/formSpace/fsp1/resume/resume.pdf')).toEqual({ uid: 'user123', formSpaceId: 'fsp1', slot: 'resume', filename: 'resume.pdf' });
  });

  it('should reject a path in a different uploads folder', () => {
    expect(parseFormSpaceUploadPath('uploads/u/user123/test/resume.pdf')).toBeUndefined();
  });

  it('should reject a nested path, rather than widening the slot', () => {
    expect(parseFormSpaceUploadPath('uploads/u/user123/formSpace/fsp1/resume/nested/resume.pdf')).toBeUndefined();
  });

  it('should reject a path missing the filename', () => {
    expect(parseFormSpaceUploadPath('uploads/u/user123/formSpace/fsp1/resume')).toBeUndefined();
  });
});

describe('FORM_SPACE_UPLOAD_POLICY', () => {
  it('should require both a filename and a scope', () => {
    expect(FORM_SPACE_UPLOAD_POLICY.requiresFilenameInput).toBe(true);
    expect(FORM_SPACE_UPLOAD_POLICY.requiresScopeInput).toBe(true);
  });

  it('should build a path that parses back into its scope', () => {
    const path = FORM_SPACE_UPLOAD_POLICY.buildUploadPath({ uid: 'user123', filename: 'resume.pdf', scope: { id: 'fsp1', subgroup: 'resume' } });
    expect(parseFormSpaceUploadPath(path)).toEqual({ uid: 'user123', formSpaceId: 'fsp1', slot: 'resume', filename: 'resume.pdf' });
  });
});

describe('formSpaceFileStoragePath()', () => {
  it('should key the permanent path by the space, slot and index', () => {
    expect(formSpaceFileStoragePath({ formSpaceId: 'fsp1', slot: 'resume', index: 0, extension: 'pdf' })).toBe('/fsp/fsp1/resume/0.pdf');
    expect(formSpaceFileStoragePath({ formSpaceId: 'fsp1', slot: 'resume', index: 12, extension: 'pdf' })).toBe('/fsp/fsp1/resume/12.pdf');
  });

  it('should omit the separator when there is no extension', () => {
    expect(formSpaceFileStoragePath({ formSpaceId: 'fsp1', slot: 'resume', index: 0 })).toBe('/fsp/fsp1/resume/0');
  });

  it('should build a leaf that parses back into an extension', () => {
    // the whole naming chain rests on this: the destination is what supplies a download's extension, and
    // slashPathDetails() reads a leaf with two or more separators as invalid
    const path = formSpaceFileStoragePath({ formSpaceId: 'fsp1', slot: 'resume', index: 3, extension: 'pdf' });
    expect(slashPathDetails(path).typedFileExtension).toBe('pdf');
  });

  it('should give two files of the same name two different paths', () => {
    const first = formSpaceFileStoragePath({ formSpaceId: 'fsp1', slot: 'documents', index: 0, extension: 'pdf' });
    const second = formSpaceFileStoragePath({ formSpaceId: 'fsp1', slot: 'documents', index: 1, extension: 'pdf' });
    expect(first).not.toBe(second);
  });
});

describe('formSpaceUploadFileNameDetails()', () => {
  it('should split a typed filename', () => {
    expect(formSpaceUploadFileNameDetails({ filename: 'resume.pdf' })).toEqual({ displayName: 'resume', extension: 'pdf', fileName: 'resume.pdf' });
  });

  it('should name the extension from the mime type when the filename has none', () => {
    expect(formSpaceUploadFileNameDetails({ filename: 'README', mimeType: 'text/plain' })).toEqual({ displayName: 'README', extension: 'txt', fileName: 'README.txt' });
  });

  it('should leave a name with no extension and no known mime type alone', () => {
    expect(formSpaceUploadFileNameDetails({ filename: 'README', mimeType: 'application/nonsense' })).toEqual({ displayName: 'README', extension: undefined, fileName: 'README' });
  });

  it('should collapse interior separators rather than losing the extension', () => {
    expect(formSpaceUploadFileNameDetails({ filename: 'my.report.pdf' })).toEqual({ displayName: 'my_report', extension: 'pdf', fileName: 'my_report.pdf' });
  });

  it('should treat a name that is only an extension as having no display name', () => {
    expect(formSpaceUploadFileNameDetails({ filename: '.gitignore' })).toEqual({ displayName: undefined, extension: 'gitignore', fileName: '.gitignore' });
  });
});

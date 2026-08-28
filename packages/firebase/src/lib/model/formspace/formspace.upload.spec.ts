import { describe, expect, it } from 'vitest';
import { FORM_SPACE_UPLOAD_POLICY, formSpaceFileStoragePath, formSpaceUploadsFilePath, formSpaceUploadsFolderPath, parseFormSpaceUploadPath } from './formspace.upload';

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
  it('should key the permanent path by the space and slot', () => {
    expect(formSpaceFileStoragePath('fsp1', 'resume', 'resume.pdf')).toBe('/fsp/fsp1/resume/resume.pdf');
  });
});

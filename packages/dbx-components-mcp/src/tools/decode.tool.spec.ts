import { describe, expect, it } from 'vitest';
import { runDecode } from './decode.tool.js';

describe('dbx_decode', () => {
  it('returns isError when required `data` is missing', () => {
    const result = runDecode({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('returns isError when `data` is a non-JSON string', () => {
    const result = runDecode({ data: 'not json at all {' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not valid JSON');
  });

  it('returns isError when parsed data is an array rather than an object', () => {
    const result = runDecode({ data: '[1, 2, 3]' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('must be a JSON object');
  });

  it('decodes a StorageFile document via explicit model hint', () => {
    const doc = {
      bucketId: 'hellosubsapp.appspot.com',
      pathString: '/u/abc123/jr/19.N-555923.pdf',
      n: 'Better Kid Care Intro',
      cat: '2026-04-15T22:02:36.433Z',
      ct: 2,
      fs: 2,
      ps: 4,
      u: 'abc123',
      o: 'pr/abc123',
      g: ['wk_abc123']
    };
    const result = runDecode({ data: doc, model: 'StorageFile' });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('# StorageFile');
    expect(text).toContain('prefix `sf`');
    expect(text).toContain('StorageFileState.OK');
    expect(text).toContain('StorageFileProcessingState.SUCCESS');
    expect(text).toContain('StorageFileCreationType.INIT_FROM_UPLOAD');
    expect(text).toContain('_Model selected from explicit hint._');
  });

  it('auto-detects a StorageFile by document-key prefix', () => {
    const doc = {
      key: 'sf/abc',
      bucketId: 'x',
      pathString: '/y',
      fs: 2,
      ps: 0,
      g: []
    };
    const result = runDecode({ data: doc });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# StorageFile');
    expect(result.content[0].text).toContain('_Model detected from document key prefix._');
  });

  it('auto-detects via field-name score when no hint or key is available', () => {
    const doc = {
      bucketId: 'b',
      pathString: 'p',
      fs: 1,
      ps: 0
    };
    const result = runDecode({ data: doc });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# StorageFile');
    expect(result.content[0].text).toMatch(/Model detected by field-name match/);
  });

  it('parses a JSON string input', () => {
    const doc = { key: 'sf/x', bucketId: 'b', pathString: 'p', fs: 2, ps: 0, g: [] };
    const result = runDecode({ data: JSON.stringify(doc) });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# StorageFile');
  });

  it('surfaces foreign-key relationships via collection prefix lookup', () => {
    const doc = {
      bucketId: 'b',
      pathString: 'p',
      fs: 2,
      ps: 0,
      g: [],
      o: 'nb/abc123'
    };
    const result = runDecode({ data: doc, model: 'StorageFile' });
    expect(result.content[0].text).toContain('## Detected relationships');
    expect(result.content[0].text).toContain('NotificationBox');
    expect(result.content[0].text).toContain('prefix `nb`');
  });

  it('falls back to a guidance message when no model matches the hint', () => {
    const result = runDecode({ data: { unknown: 1 }, model: 'ThereIsNoSuchModel' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain(`No Firebase model matched hint 'ThereIsNoSuchModel'`);
    expect(result.content[0].text).toContain('Known models:');
  });

  it('flags unknown fields that are on the document but not the registry', () => {
    const doc = { bucketId: 'b', pathString: 'p', fs: 2, ps: 0, g: [], brandNewField: true };
    const result = runDecode({ data: doc, model: 'StorageFile' });
    expect(result.content[0].text).toContain('## Unknown keys on document');
    expect(result.content[0].text).toContain('brandNewField');
  });
});

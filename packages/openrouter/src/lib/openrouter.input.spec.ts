import { describe, expect, it } from 'vitest';
import { openRouterFileAnnotationMessage, openRouterInputFileDataPart, openRouterInputFilePartsForSignedFiles, openRouterInputFileUrlPart, openRouterInputImagePart, openRouterInputMessages, openRouterInputTextPart } from './openrouter.input';

describe('openRouterInputMessages()', () => {
  it('should wrap a string as a single user text message', () => {
    expect(openRouterInputMessages('hi')).toEqual([{ role: 'user', content: [{ type: 'input_text', text: 'hi' }] }]);
  });

  it('should pass a message array through unchanged', () => {
    const messages = [{ role: 'user' as const, content: 'a' }];
    expect(openRouterInputMessages(messages)).toBe(messages);
  });

  it('should return an empty array for no input', () => {
    expect(openRouterInputMessages(null)).toEqual([]);
  });
});

describe('content part builders', () => {
  it('should build a text part', () => {
    expect(openRouterInputTextPart('t')).toEqual({ type: 'input_text', text: 't' });
  });

  it('should default image detail to auto', () => {
    expect(openRouterInputImagePart('https://i/1')).toEqual({ type: 'input_image', imageUrl: 'https://i/1', detail: 'auto' });
  });

  it('should build a file url part', () => {
    expect(openRouterInputFileUrlPart('https://signed/a', 'a.pdf')).toEqual({ type: 'input_file', fileUrl: 'https://signed/a', filename: 'a.pdf' });
  });

  it('should add a data url prefix to raw base64', () => {
    expect(openRouterInputFileDataPart('QUJD', 'a.pdf').fileData).toBe('data:application/pdf;base64,QUJD');
  });

  it('should leave an existing data url prefix alone', () => {
    expect(openRouterInputFileDataPart('data:image/png;base64,QUJD', 'a.png').fileData).toBe('data:image/png;base64,QUJD');
  });

  it('should honour a custom content type', () => {
    expect(openRouterInputFileDataPart('QUJD', 'a.png', 'image/png').fileData).toBe('data:image/png;base64,QUJD');
  });
});

describe('openRouterInputFilePartsForSignedFiles()', () => {
  it('should expand one part per signed file, using the per-attempt url', () => {
    const parts = openRouterInputFilePartsForSignedFiles([
      { file: { storagePath: 'a/1.pdf', filename: '1.pdf' }, signedUrl: 'https://signed/1' },
      { file: { storagePath: 'a/2.pdf', filename: '2.pdf' }, signedUrl: 'https://signed/2' }
    ]);

    expect(parts.map((x) => x.fileUrl)).toEqual(['https://signed/1', 'https://signed/2']);
    expect(parts.map((x) => x.filename)).toEqual(['1.pdf', '2.pdf']);
  });

  it('should return nothing for no files', () => {
    expect(openRouterInputFilePartsForSignedFiles(null)).toEqual([]);
  });
});

describe('openRouterFileAnnotationMessage()', () => {
  it('should build an assistant echo message carrying the file hashes', () => {
    const message = openRouterFileAnnotationMessage([{ hash: 'h1', filename: 'a.pdf', content: 'parsed' }]);
    expect(message?.role).toBe('assistant');
    expect(message?.annotations).toEqual([{ type: 'file', file: { hash: 'h1', name: 'a.pdf', content: 'parsed' } }]);
  });

  it('should return undefined when there is nothing cached', () => {
    expect(openRouterFileAnnotationMessage([])).toBeUndefined();
    expect(openRouterFileAnnotationMessage(null)).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import {
  openRouterFileAnnotationMessage,
  openRouterInputFileDataPart,
  openRouterInputFilePartsForAttachedFiles,
  openRouterInputFileUrlPart,
  openRouterInputImagePart,
  openRouterInputMessages,
  openRouterInputTextPart,
  openRouterMessagesWithFreshFileAttachments,
  openRouterMessagesWithoutFileAttachmentData,
  openRouterUnparsedAttachedFiles
} from './openrouter.input';

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

describe('openRouterInputFilePartsForAttachedFiles()', () => {
  it('should expand one part per signed file, using the per-attempt url', () => {
    const parts = openRouterInputFilePartsForAttachedFiles([
      { file: { storagePath: 'a/1.pdf', filename: '1.pdf' }, fileUrl: 'https://signed/1' },
      { file: { storagePath: 'a/2.pdf', filename: '2.pdf' }, fileUrl: 'https://signed/2' }
    ]);

    expect(parts.map((x) => x.fileUrl)).toEqual(['https://signed/1', 'https://signed/2']);
    expect(parts.map((x) => x.filename)).toEqual(['1.pdf', '2.pdf']);
  });

  it('should emit an inline data part for an attachment carrying base64', () => {
    const parts = openRouterInputFilePartsForAttachedFiles([{ file: { storagePath: 'a/1.pdf', filename: '1.pdf' }, fileData: 'data:application/pdf;base64,QUJD' }]);

    expect(parts).toEqual([{ type: 'input_file', fileData: 'data:application/pdf;base64,QUJD', filename: '1.pdf' }]);
    // No url alongside the data: sending both would leave it undefined which one OpenRouter reads.
    expect(parts[0].fileUrl).toBeUndefined();
  });

  it('should choose per file rather than per list', () => {
    const parts = openRouterInputFilePartsForAttachedFiles([
      { file: { storagePath: 'a/1.pdf', filename: '1.pdf' }, fileUrl: 'https://signed/1' },
      { file: { storagePath: 'a/2.pdf', filename: '2.pdf' }, fileData: 'data:application/pdf;base64,QUJD' }
    ]);

    expect(parts.map((x) => x.fileUrl)).toEqual(['https://signed/1', undefined]);
    expect(parts.map((x) => x.fileData)).toEqual([undefined, 'data:application/pdf;base64,QUJD']);
  });

  it('should return nothing for no files', () => {
    expect(openRouterInputFilePartsForAttachedFiles(null)).toEqual([]);
  });
});

describe('openRouterFileAnnotationMessage()', () => {
  it('should build an assistant echo message carrying the file hashes', () => {
    const message = openRouterFileAnnotationMessage([{ hash: 'h1', filename: 'a.pdf', content: 'parsed' }]);
    expect(message?.role).toBe('assistant');
    expect(message?.annotations).toEqual([{ type: 'file', file: { hash: 'h1', name: 'a.pdf', content: 'parsed' } }]);
  });

  it('should carry the parse in the message text as well as the annotation', () => {
    // The annotation alone is not enough: the SDK's request schema has no `annotations` field on any
    // message variant, so it is stripped during outbound serialization. The text is what survives.
    const message = openRouterFileAnnotationMessage([{ hash: 'h1', filename: 'a.pdf', content: 'PARSED' }]);
    expect(message?.content).toContain('PARSED');
    expect(message?.content).toContain('h1');
  });

  it('should stringify non-string cached content', () => {
    expect(openRouterFileAnnotationMessage([{ hash: 'h1', content: { pages: 2 } }])?.content).toContain('"pages":2');
  });

  it('should return undefined when there is nothing cached', () => {
    expect(openRouterFileAnnotationMessage([])).toBeUndefined();
    expect(openRouterFileAnnotationMessage(null)).toBeUndefined();
  });
});

describe('openRouterUnparsedAttachedFiles()', () => {
  const cached = { file: { storagePath: 'p/a.pdf', filename: 'a.pdf' }, fileUrl: 'https://signed/a' };
  const fresh = { file: { storagePath: 'p/b.pdf', filename: 'b.pdf' }, fileUrl: 'https://signed/b' };

  it('should drop a file whose parse is already cached', () => {
    // Not re-sending the document is the only thing that actually prevents a re-parse.
    expect(openRouterUnparsedAttachedFiles([cached, fresh], [{ hash: 'h1', filename: 'a.pdf' }])).toEqual([fresh]);
  });

  it('should keep every file when nothing is cached', () => {
    expect(openRouterUnparsedAttachedFiles([cached, fresh], null)).toEqual([cached, fresh]);
  });

  it('should keep a file whose cached annotation has no filename to match on', () => {
    expect(openRouterUnparsedAttachedFiles([cached], [{ hash: 'h1' }])).toEqual([cached]);
  });
});

describe('openRouterMessagesWithFreshFileAttachments()', () => {
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'input_text' as const, text: 'read this' },
        { type: 'input_file' as const, fileUrl: 'https://signed/OLD', filename: 'a.pdf' }
      ]
    },
    { role: 'assistant', content: 'sure' }
  ];

  it('should re-point a persisted file part at this attempt url', () => {
    // A conversation persisted mid-run carries the url signed for the attempt that persisted it, which
    // has expired by the time a deferred resume replays it.
    const result = openRouterMessagesWithFreshFileAttachments(messages, [{ file: { storagePath: 'p/a.pdf', filename: 'a.pdf' }, fileUrl: 'https://signed/NEW' }]);
    expect(JSON.stringify(result)).toContain('https://signed/NEW');
    expect(JSON.stringify(result)).not.toContain('https://signed/OLD');
  });

  it('should leave a part whose filename matches nothing alone', () => {
    const result = openRouterMessagesWithFreshFileAttachments(messages, [{ file: { storagePath: 'p/z.pdf', filename: 'z.pdf' }, fileUrl: 'https://signed/NEW' }]);
    expect(JSON.stringify(result)).toContain('https://signed/OLD');
  });

  it('should clear the stored url when this attempt carries the file inline', () => {
    // The failure this exists for: a naive merge leaves the stale `fileUrl` sitting next to the fresh
    // `fileData`, so OpenRouter receives both and it is not defined which one it reads.
    const result = openRouterMessagesWithFreshFileAttachments(messages, [{ file: { storagePath: 'p/a.pdf', filename: 'a.pdf' }, fileData: 'data:application/pdf;base64,QUJD' }]);
    const part = (result[0].content as { type: string; fileUrl?: unknown; fileData?: unknown }[])[1];

    expect(part.fileData).toBe('data:application/pdf;base64,QUJD');
    expect('fileUrl' in part).toBe(false);
  });

  it('should clear a stored inline payload when this attempt carries a url', () => {
    const inlined = [{ role: 'user', content: [{ type: 'input_file' as const, fileData: 'data:application/pdf;base64,STALE', filename: 'a.pdf' }] }];
    const result = openRouterMessagesWithFreshFileAttachments(inlined, [{ file: { storagePath: 'p/a.pdf', filename: 'a.pdf' }, fileUrl: 'https://signed/NEW' }]);
    const part = (result[0].content as { type: string; fileUrl?: unknown; fileData?: unknown }[])[0];

    expect(part.fileUrl).toBe('https://signed/NEW');
    expect('fileData' in part).toBe(false);
  });

  it('should pass the messages through when there is nothing attached', () => {
    expect(openRouterMessagesWithFreshFileAttachments(messages, [])).toBe(messages);
  });
});

describe('openRouterMessagesWithoutFileAttachmentData()', () => {
  it('should strip both a url and inline data, keeping the filename to rejoin on', () => {
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'input_text' as const, text: 'read this' },
          { type: 'input_file' as const, fileUrl: 'https://signed/OLD', filename: 'a.pdf' },
          { type: 'input_file' as const, fileData: 'data:application/pdf;base64,QUJD', filename: 'b.pdf' }
        ]
      }
    ];

    const result = openRouterMessagesWithoutFileAttachmentData(messages);

    expect(result[0].content).toEqual([
      { type: 'input_text', text: 'read this' },
      { type: 'input_file', fileUrl: null, fileData: null, filename: 'a.pdf' },
      { type: 'input_file', fileUrl: null, fileData: null, filename: 'b.pdf' }
    ]);
  });

  it('should leave a string-content message alone', () => {
    const messages = [{ role: 'assistant', content: 'sure' }];
    expect(openRouterMessagesWithoutFileAttachmentData(messages)).toEqual(messages);
  });

  it('should return an empty list for no messages', () => {
    expect(openRouterMessagesWithoutFileAttachmentData(null)).toEqual([]);
  });
});

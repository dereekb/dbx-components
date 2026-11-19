import { describe, expect, it } from 'vitest';
import { toLlmAttachmentDataUrl, toLlmThreadChatMessages } from './llm.strategy.message';

describe('toLlmThreadChatMessages()', () => {
  it('maps an empty thread onto no messages', () => {
    expect(toLlmThreadChatMessages([])).toEqual([]);
  });

  it('keeps the order and roles and drops the cache segments', () => {
    const messages = toLlmThreadChatMessages([
      { role: 'user', content: 'PREFIX|SUFFIX', cacheSegments: { cachePrefix: 'PREFIX|', volatileSuffix: 'SUFFIX' } },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'follow-up' }
    ]);

    expect(messages).toEqual([
      { role: 'user', content: 'PREFIX|SUFFIX' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'follow-up' }
    ]);
    expect(Object.keys(messages[0])).toEqual(['role', 'content']);
  });
});

describe('toLlmAttachmentDataUrl()', () => {
  it('builds the inline data URL', () => {
    expect(toLlmAttachmentDataUrl({ mime: 'image/png', dataBase64: 'QUJD' })).toBe('data:image/png;base64,QUJD');
  });
});

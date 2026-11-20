import { describe, expect, it } from 'vitest';
import { LLM_REASONING_OFF_ENCODINGS } from '@dereekb/llm';
import { LLM_OPENAI_REASONING_OFF_PARAMS, toLlmOpenAiReasoningParams, toLlmOpenAiChatMessages, toLlmOpenAiImagePart, toLlmOpenAiResponseFormat } from './openai.chat';

describe('LLM_OPENAI_REASONING_OFF_PARAMS', () => {
  it('maps every reasoning-OFF encoding, in the root order', () => {
    expect(Object.keys(LLM_OPENAI_REASONING_OFF_PARAMS)).toEqual([...LLM_REASONING_OFF_ENCODINGS]);
  });

  it('holds each wire shape', () => {
    expect(LLM_OPENAI_REASONING_OFF_PARAMS).toEqual({
      'effort-none': { reasoning_effort: 'none' },
      'effort-minimal': { reasoning_effort: 'minimal' },
      'nested-disabled': { reasoning: { enabled: false } },
      omit: {}
    });
  });
});

describe('toLlmOpenAiReasoningParams()', () => {
  it('contributes nothing for an unset reasoning config', () => {
    expect(toLlmOpenAiReasoningParams({ offEncoding: 'effort-none' })).toEqual({});
    expect(toLlmOpenAiReasoningParams({ reasoning: null, offEncoding: 'effort-none' })).toEqual({});
  });

  it('maps an effort band onto reasoning_effort', () => {
    expect(toLlmOpenAiReasoningParams({ reasoning: { effort: 'high' }, offEncoding: 'effort-none' })).toEqual({ reasoning_effort: 'high' });
  });

  it('encodes an explicit OFF even when an effort is co-present', () => {
    expect(toLlmOpenAiReasoningParams({ reasoning: { enabled: false, effort: 'high' }, offEncoding: 'effort-minimal' })).toEqual({ reasoning_effort: 'minimal' });
    expect(toLlmOpenAiReasoningParams({ reasoning: { enabled: false }, offEncoding: 'nested-disabled' })).toEqual({ reasoning: { enabled: false } });
  });

  it('contributes nothing for an empty reasoning config', () => {
    expect(toLlmOpenAiReasoningParams({ reasoning: {}, offEncoding: 'effort-none' })).toEqual({});
  });
});

describe('toLlmOpenAiResponseFormat()', () => {
  it('builds the strict json_schema response_format', () => {
    expect(toLlmOpenAiResponseFormat({ name: 'summarize', schema: { type: 'object' } })).toEqual({ type: 'json_schema', json_schema: { name: 'summarize', schema: { type: 'object' }, strict: true } });
  });
});

describe('toLlmOpenAiImagePart()', () => {
  it('carries the attachment as a data URL', () => {
    expect(toLlmOpenAiImagePart({ kind: 'image', mime: 'image/png', dataBase64: 'QUJD' })).toEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } });
  });
});

describe('toLlmOpenAiChatMessages()', () => {
  it('replays the thread as plain strings (cache segments dropped) and sends the plain prompt with no attachments', () => {
    const messages = toLlmOpenAiChatMessages({
      prompt: 'FOLLOW',
      thread: [
        { role: 'user', content: 'PRE|SUF', cacheSegments: { cachePrefix: 'PRE|', volatileSuffix: 'SUF' } },
        { role: 'assistant', content: 'REPLY' }
      ],
      attachments: []
    });

    expect(messages).toEqual([
      { role: 'user', content: 'PRE|SUF' },
      { role: 'assistant', content: 'REPLY' },
      { role: 'user', content: 'FOLLOW' }
    ]);
  });

  it('sends the prompt as a text part followed by one image part per attachment, in order', () => {
    const messages = toLlmOpenAiChatMessages({
      prompt: 'Describe',
      attachments: [
        { kind: 'image', mime: 'image/png', dataBase64: 'QUJD' },
        { kind: 'image', mime: 'image/jpeg', dataBase64: 'REVG' }
      ]
    });

    expect(messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,REVG' } }
        ]
      }
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { openRouterFileParserPlugin } from './openrouter.config';
import { type OpenRouterFileAnnotationEchoMessage, type OpenRouterInputFilePart, type OpenRouterInputMessage, type OpenRouterInputTextPart } from './openrouter.input';
import { type OpenRouterResolvedPrompt } from './openrouter.prompt';
import { openRouterPromptRequest } from './openrouter.request';

const TEST_PROMPT: OpenRouterResolvedPrompt = {
  promptKey: 'test-prompt',
  version: 3,
  instructions: 'You are a test.',
  messages: [
    { role: 'system', content: 'static-a' },
    { role: 'user', content: 'static-b' }
  ],
  config: { model: 'openai/gpt-5.1', temperature: 0.1 }
};

function textOf(message: OpenRouterInputMessage): string[] {
  return typeof message.content === 'string' ? [message.content] : message.content.filter((x): x is OpenRouterInputTextPart => x.type === 'input_text').map((x) => x.text);
}

describe('openRouterPromptRequest()', () => {
  it('should carry the version instructions through', () => {
    expect(openRouterPromptRequest({ prompt: TEST_PROMPT }).instructions).toBe('You are a test.');
  });

  it('should merge overrides over the version config', () => {
    const request = openRouterPromptRequest({ prompt: TEST_PROMPT, overrides: { temperature: 0.9, plugins: [openRouterFileParserPlugin()] } });
    expect(request.config.model).toBe('openai/gpt-5.1');
    expect(request.config.temperature).toBe(0.9);
    expect(request.config.plugins?.length).toBe(1);
  });

  it('should emit static seed content BEFORE dynamic input', () => {
    // The whole point: a prompt cache only hits on a shared prefix.
    const request = openRouterPromptRequest({ prompt: TEST_PROMPT, input: 'dynamic' });
    expect(request.input.length).toBe(3);
    expect(textOf(request.input[0] as OpenRouterInputMessage)).toEqual(['static-a']);
    expect(textOf(request.input[1] as OpenRouterInputMessage)).toEqual(['static-b']);
    expect(textOf(request.input[2] as OpenRouterInputMessage)).toEqual(['dynamic']);
  });

  it('should accept a string input as a single user message', () => {
    const request = openRouterPromptRequest({ prompt: { ...TEST_PROMPT, messages: undefined }, input: 'hello' });
    expect(request.input.length).toBe(1);
    expect(request.input[0].role).toBe('user');
  });

  it('should place continued history after seed content and before the new input', () => {
    const request = openRouterPromptRequest({
      prompt: TEST_PROMPT,
      history: [{ role: 'assistant', content: 'prior-answer' }],
      input: 'follow-up'
    });

    expect(request.input.map((x) => textOf(x as OpenRouterInputMessage)[0])).toEqual(['static-a', 'static-b', 'prior-answer', 'follow-up']);
  });

  it('should attach files to the last user message', () => {
    const request = openRouterPromptRequest({
      prompt: { ...TEST_PROMPT, messages: undefined },
      input: [{ role: 'user', content: [{ type: 'input_text', text: 'read this' }] }],
      files: [{ file: { storagePath: 'resumes/a.pdf', filename: 'a.pdf' }, signedUrl: 'https://signed/a' }]
    });

    const parts = (request.input[0] as OpenRouterInputMessage).content as OpenRouterInputFilePart[];
    expect(parts.length).toBe(2);
    expect(parts[1].type).toBe('input_file');
    expect(parts[1].fileUrl).toBe('https://signed/a');
    expect(parts[1].filename).toBe('a.pdf');
  });

  it('should promote a string-content user message to parts when attaching files', () => {
    const request = openRouterPromptRequest({
      prompt: { ...TEST_PROMPT, messages: undefined },
      input: [{ role: 'user', content: 'read this' }],
      files: [{ file: { storagePath: 'resumes/a.pdf', filename: 'a.pdf' }, signedUrl: 'https://signed/a' }]
    });

    const parts = (request.input[0] as OpenRouterInputMessage).content as OpenRouterInputFilePart[];
    expect(parts.length).toBe(2);
    expect(parts[0].type).toBe('input_text');
  });

  it('should create a user message for a file-only run', () => {
    const request = openRouterPromptRequest({
      prompt: { ...TEST_PROMPT, messages: undefined },
      files: [{ file: { storagePath: 'resumes/a.pdf', filename: 'a.pdf' }, signedUrl: 'https://signed/a' }]
    });

    expect(request.input.length).toBe(1);
    expect(request.input[0].role).toBe('user');
    expect(((request.input[0] as OpenRouterInputMessage).content as OpenRouterInputFilePart[])[0].fileUrl).toBe('https://signed/a');
  });

  it('should not attach files to a seed system message', () => {
    const request = openRouterPromptRequest({
      prompt: { ...TEST_PROMPT, messages: [{ role: 'system', content: 'static-a' }] },
      files: [{ file: { storagePath: 'a.pdf', filename: 'a.pdf' }, signedUrl: 'https://signed/a' }]
    });

    expect(request.input.length).toBe(2);
    expect(request.input[0].role).toBe('system');
    expect(request.input[1].role).toBe('user');
  });

  it('should echo cached file annotations before the dynamic input', () => {
    const request = openRouterPromptRequest({
      prompt: { ...TEST_PROMPT, messages: undefined },
      fileAnnotations: [{ hash: 'h1', filename: 'a.pdf', content: 'parsed' }],
      input: 'go'
    });

    expect(request.input.length).toBe(2);
    expect(request.input[0].role).toBe('assistant');
    expect((request.input[0] as OpenRouterFileAnnotationEchoMessage).annotations[0].file.hash).toBe('h1');
  });

  it('should omit the annotation echo when there is nothing cached', () => {
    const request = openRouterPromptRequest({ prompt: { ...TEST_PROMPT, messages: undefined }, fileAnnotations: [], input: 'go' });
    expect(request.input.length).toBe(1);
  });

  it('should carry the trace through for cost reconciliation', () => {
    const request = openRouterPromptRequest({ prompt: TEST_PROMPT, trace: { runTaskKey: 'rt_1' } });
    expect(request.trace?.runTaskKey).toBe('rt_1');
  });
});

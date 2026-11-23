import { describe, expect, it } from 'vitest';
import { stripMarkdownCodeFence } from './markdown';

describe('stripMarkdownCodeFence()', () => {
  it('should unwrap a bare fence', () => {
    expect(stripMarkdownCodeFence('```\nhello\n```')).toBe('hello');
  });

  it('should unwrap a fence with a language tag', () => {
    expect(stripMarkdownCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('should unwrap a fence with any info string', () => {
    expect(stripMarkdownCodeFence('```json5\n{a:1}\n```')).toBe('{a:1}');
    expect(stripMarkdownCodeFence('```ts title="x"\nconst a = 1;\n```')).toBe('const a = 1;');
  });

  it('should unwrap a CRLF fence', () => {
    expect(stripMarkdownCodeFence('```json\r\n{}\r\n```')).toBe('{}');
  });

  it('should unwrap a fence whose closing fence follows the body directly', () => {
    expect(stripMarkdownCodeFence('```\nabc```')).toBe('abc');
  });

  it('should unwrap an empty body', () => {
    expect(stripMarkdownCodeFence('```\n```')).toBe('');
  });

  it('should match after trimming surrounding whitespace, without trimming the body', () => {
    expect(stripMarkdownCodeFence('  \n```\n  body  \n```\n  ')).toBe('  body  ');
  });

  it('should return unfenced text unchanged (not trimmed)', () => {
    expect(stripMarkdownCodeFence('  plain  ')).toBe('  plain  ');
  });

  it('should return text with prose before the fence unchanged', () => {
    const text = 'Here you go:\n```json\n{}\n```';
    expect(stripMarkdownCodeFence(text)).toBe(text);
  });

  it('should return text with prose after the fence unchanged', () => {
    const text = '```json\n{}\n```\nHope that helps.';
    expect(stripMarkdownCodeFence(text)).toBe(text);
  });

  it('should return a fence missing its closing fence unchanged', () => {
    const text = '```json\n{}';
    expect(stripMarkdownCodeFence(text)).toBe(text);
  });
});

import { describe, expect, it } from 'vitest';
import { jsDocInlineLinksToText } from './jsdoc';

describe('jsDocInlineLinksToText()', () => {
  it('should return text without tags unchanged', () => {
    expect(jsDocInlineLinksToText('Plain text.')).toBe('Plain text.');
  });

  it('should replace {@link X} with its target', () => {
    expect(jsDocInlineLinksToText('Creates a {@link NotificationBox}.')).toBe('Creates a NotificationBox.');
  });

  it('should replace {@link X.y} with its dotted target', () => {
    expect(jsDocInlineLinksToText('See {@link CancelParams.skipPenalty} for details.')).toBe('See CancelParams.skipPenalty for details.');
  });

  it('should keep a plural suffix attached to the link', () => {
    expect(jsDocInlineLinksToText('Queries {@link OpenRouterPrompt}s for the user.')).toBe('Queries OpenRouterPrompts for the user.');
  });

  it('should use a pipe label', () => {
    expect(jsDocInlineLinksToText('{@link Foo | the foo}')).toBe('the foo');
  });

  it('should use a space label', () => {
    expect(jsDocInlineLinksToText('{@link Foo the foo}')).toBe('the foo');
  });

  it('should convert Class#member to Class.member', () => {
    expect(jsDocInlineLinksToText('{@link Foo#bar}')).toBe('Foo.bar');
  });

  it('should keep only the member of a path target', () => {
    expect(jsDocInlineLinksToText('{@link ./path/mod#member}')).toBe('member');
  });

  it('should wrap {@linkcode X} in backticks', () => {
    expect(jsDocInlineLinksToText('{@linkcode Foo}')).toBe('`Foo`');
  });

  it('should handle {@linkplain X}', () => {
    expect(jsDocInlineLinksToText('{@linkplain Foo}')).toBe('Foo');
  });

  it('should render a URL target', () => {
    expect(jsDocInlineLinksToText('{@link https://example.com/a#b}')).toBe('https://example.com/a#b');
  });

  it('should render a URL label', () => {
    expect(jsDocInlineLinksToText('{@link https://example.com | the docs}')).toBe('the docs');
  });

  it('should leave a malformed tag with no target unchanged', () => {
    expect(jsDocInlineLinksToText('{@link }')).toBe('{@link }');
  });

  it('should replace multiple tags', () => {
    expect(jsDocInlineLinksToText('{@link A} and {@link B.c}')).toBe('A and B.c');
  });
});

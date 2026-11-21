import { describe, expect, it } from 'vitest';
import { CutTextPipe } from './cuttext.pipe';

describe('CutTextPipe', () => {
  const pipe = new CutTextPipe();

  it('should return null for a null input', () => {
    expect(pipe.transform(null, 8)).toBeNull();
  });

  it('should cut the text and append the default end text', () => {
    expect(pipe.transform('Hello World', 8)).toBe('Hello...');
  });

  it('should cut the text and append the custom end text', () => {
    expect(pipe.transform('Hello World', 8, '…')).toBe('Hello W…');
  });

  it('should cut the text without end text when endText is null', () => {
    expect(pipe.transform('Hello World', 8, null)).toBe('Hello Wo');
  });

  it('should not cut text within the max length', () => {
    expect(pipe.transform('Hello', 8, '…')).toBe('Hello');
  });
});

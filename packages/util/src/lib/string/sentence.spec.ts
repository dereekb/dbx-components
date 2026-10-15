import { describe, expect, it } from 'vitest';
import { firstSentence } from './sentence';

describe('firstSentence()', () => {
  it('should return the first sentence of a hard-wrapped description', () => {
    const input = 'Creates a NotificationUser for the given user, initializing their notification configs before\nthey are added to any NotificationBox. Called automatically.';
    expect(firstSentence(input)).toBe('Creates a NotificationUser for the given user, initializing their notification configs before they are added to any NotificationBox.');
  });

  it('should not end a sentence after e.g.', () => {
    expect(firstSentence('Pass a key, e.g. gb/abc. Then call it.')).toBe('Pass a key, e.g. gb/abc.');
  });

  it('should not end a sentence after i.e. or vs.', () => {
    expect(firstSentence('Use the id, i.e. The thing vs. Other thing. Next.')).toBe('Use the id, i.e. The thing vs. Other thing.');
  });

  it('should stop at a blank-line paragraph break', () => {
    expect(firstSentence('First paragraph without a terminator\n\nSecond paragraph.')).toBe('First paragraph without a terminator');
  });

  it('should return the whole flattened paragraph when there is no terminator', () => {
    expect(firstSentence('  no terminator\n  here  ')).toBe('no terminator here');
  });

  it('should treat "etc. Then" as a boundary', () => {
    expect(firstSentence('Apples, pears, etc. Then more.')).toBe('Apples, pears, etc.');
  });

  it('should not treat "etc. and" as a boundary', () => {
    expect(firstSentence('Apples, pears, etc. and more. Next.')).toBe('Apples, pears, etc. and more.');
  });

  it('should include closing quotes and brackets', () => {
    expect(firstSentence('It is called "done." Next.')).toBe('It is called "done."');
  });

  it('should end at ! and ?', () => {
    expect(firstSentence('Is it ready? Yes.')).toBe('Is it ready?');
    expect(firstSentence('Stop! Now.')).toBe('Stop!');
  });

  it('should not end at a period inside a word', () => {
    expect(firstSentence('Calls model.update.reopen for the item. Next.')).toBe('Calls model.update.reopen for the item.');
  });

  it('should cap at maxLength on a word boundary with the end text', () => {
    const result = firstSentence('one two three four five six', { maxLength: 15 });
    expect(result).toBe('one two three…');
    expect(result.length).toBeLessThanOrEqual(15);
  });

  it('should use a custom end text', () => {
    expect(firstSentence('one two three four five six', { maxLength: 15, endText: '...' })).toBe('one two...');
  });

  it('should hard cut when there is no space', () => {
    expect(firstSentence('abcdefghijklmnop', { maxLength: 6 })).toBe('abcde…');
  });

  it('should not cut a sentence that fits', () => {
    expect(firstSentence('Short.', { maxLength: 240 })).toBe('Short.');
  });
});

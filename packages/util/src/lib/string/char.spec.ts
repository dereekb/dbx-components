import { firstAndLastCharacterOccurrence, replaceCharacterAtIndexWith, splitStringAtIndex } from './char';

describe('firstAndLastCharacterOccurrence', () => {
  it('should find all the occurrences of the input character.', () => {
    const value = 'aaa' + 'bdfjsfdkgljsdfkgjksdjfgsd'.replace('a', '');
    const result = firstAndLastCharacterOccurrence(value, 'a');

    expect(result.occurences).toBe(3);
    expect(result.first).toBe(0);
    expect(result.last).toBe(2);
  });

  it('should return the first index occurrence for last if there was only one occurence .', () => {
    const value = 'xxxxa' + 'bdfjsfdkgljsdfkgjksdjfgsd'.replace('a', '');
    const result = firstAndLastCharacterOccurrence(value, 'a');

    expect(result.occurences).toBe(1);
    expect(result.first).toBe(4);
    expect(result.last).toBe(4);
  });

  it('should return -1 for first and last if no occurences were found.', () => {
    const value = 'bdfjsfdkgljsdfkgjksdjfgsd'.replace('a', '');
    const result = firstAndLastCharacterOccurrence(value, 'a');

    expect(result.occurences).toBe(0);
    expect(result.first).toBe(-1);
    expect(result.last).toBe(-1);
  });
});

describe('replaceCharacterAtIndexWith', () => {
  it('should replace the character at the index.', () => {
    const value = 'aaaab';
    const result = replaceCharacterAtIndexWith(value, 4, 'a');
    expect(result).toBe('aaaaa');
  });
});

describe('splitStringAtIndex', () => {
  it('should split the string at the given index', () => {
    const value = 'a.b';
    const result = splitStringAtIndex(value, 1, false);

    expect(result[0]).toBe('a');
    expect(result[1]).toBe('b');
  });

  describe('inclusive=true', () => {
    it('should split the string at the given index inclusively', () => {
      const value = 'a.b';
      const result = splitStringAtIndex(value, 1, true);

      expect(result[0]).toBe('a');
      expect(result[1]).toBe('.b');
    });
  });
});

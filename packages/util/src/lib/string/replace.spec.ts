import { escapeStringForRegex, findFirstCharacterOccurence, removeCharactersAfterFirstCharacterOccurence, replaceStringsFunction, splitStringAtFirstCharacterOccurence } from './replace';

describe('replaceStringsFunction', () => {
  describe('function', () => {
    const replaceFn = replaceStringsFunction({
      replace: ['a', 'b', '#', '/', '.', '...'],
      replaceWith: ''
    });

    it('should replace all values.', () => {
      const result = replaceFn('.acabc.c#/c...');
      expect(result).toBe('cccc');
    });
  });
});

describe('escapeStringForRegex', () => {
  it('should escape a single character', () => {
    const result = escapeStringForRegex('.');
    expect(result).toBe('\\.');
  });

  it('should escape the regex characters within a string', () => {
    const result = escapeStringForRegex('hello.world');
    expect(result).toBe('hello\\.world');
  });

  it('should escape multiple regex characters within a string', () => {
    const result = escapeStringForRegex('h.e.l.l.o.w.o.r.l.d');
    expect(result).toBe('h\\.e\\.l\\.l\\.o\\.w\\.o\\.r\\.l\\.d');
  });
});

describe('findFirstCharacterOccurence()', () => {
  it('should find the first occurence of a character in the input string', () => {
    const result = findFirstCharacterOccurence(new Set(['.']), 'hello.world');
    expect(result).toBe(5);
  });
  it('should return undefined if the character is not found', () => {
    const result = findFirstCharacterOccurence(new Set(['.']), 'helloworld');
    expect(result).toBe(undefined);
  });
});

describe('splitStringAtFirstCharacterOccurence()', () => {
  it('should split a string at the first occurence of a character', () => {
    const a = `hello`;
    const b = `world`;
    const splitter = `.`;
    const c = `${a}${splitter}${b}`;

    const result = splitStringAtFirstCharacterOccurence(c, splitter);
    expect(result[0]).toEqual(a);
    expect(result[1]).toEqual(b);
  });

  it('should return the entire input string if the character is not found', () => {
    const result = splitStringAtFirstCharacterOccurence('helloworld', '.');
    expect(result).toEqual(['helloworld']);
  });
});

describe('removeCharactersAfterFirstCharacterOccurence()', () => {
  it('should remove all characters from the input string after the first character occurence', () => {
    const result = removeCharactersAfterFirstCharacterOccurence('hello.world', '.');
    expect(result).toBe('hello');
  });
});

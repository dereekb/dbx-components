import { escapeStringForRegex, replaceStringsFunction } from './replace';

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

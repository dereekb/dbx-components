import { cssClassesSet, spaceSeparatedCssClasses } from './html';

describe('spaceSeparatedCssClasses()', () => {
  it('should handle a single class string', () => {
    const expected = 'a';

    const result = spaceSeparatedCssClasses(expected);
    expect(result).toBe(expected);
  });

  it('should join together an array of classes', () => {
    const expected = 'a b c d e f';
    const splitClasses = expected.split(' ');
    const result = spaceSeparatedCssClasses([splitClasses, splitClasses, 'a', 'f']);

    expect(result).toBe(expected);
  });

  it('should filter out empty spaces/content', () => {
    const expected = 'a b c';
    const splitClasses = expected.split(' ');
    const result = spaceSeparatedCssClasses([splitClasses, [' ', '           ', ''], splitClasses, ' ']);
    expect(result).toBe(expected);
  });
});

describe('cssClassesSet()', () => {
  it('should handle a single class string', () => {
    const cssClass = 'a';
    const result = cssClassesSet(cssClass);
    expect(result).toContain(cssClass);
  });
});

import { replaceInvalidFilePathTypeSeparatorsInSlashPath, slashPathFactory, slashPathName, slashPathValidationFactory } from './path';

describe('slashPathName', () => {
  it('should return the file name', () => {
    const expected = 'test.txt';
    const result = slashPathName('/a/b/c/d/' + expected);
    expect(result).toBe(expected);
  });

  it('should return the folder name', () => {
    const expected = 'test';
    const result = slashPathName('/a/b/c/d/' + expected + '/');
    expect(result).toBe(expected);
  });
});

describe('replaceInvalidFilePathTypeSeparatorsInSlashPath()', () => {
  it('should replace all extra file path type separators', () => {
    const value = '/path/to/file.who.thought.about.it.test.png';
    const expectedValue = '/path/to/file_who_thought_about_it_test.png';

    const result = replaceInvalidFilePathTypeSeparatorsInSlashPath(value);
    expect(result).toBe(expectedValue);
  });

  it('should ignore any trailing file path separators.', () => {
    const expectedValue = '/path/to/file.test';
    const value = expectedValue + '.';

    const result = replaceInvalidFilePathTypeSeparatorsInSlashPath(value);
    expect(result).toBe(expectedValue);
  });

  it('should convert any file path separators before a slash.', () => {
    const expectedValue = '/path/to/file_test/';
    const value = '/path/to/file.test/';

    const result = replaceInvalidFilePathTypeSeparatorsInSlashPath(value);
    expect(result).toBe(expectedValue);
  });
});

describe('slashPathValidationFactory()', () => {
  describe('function', () => {
    const validator = slashPathValidationFactory();

    it('should fix the input slashpath', () => {
      const value = '/path/to/file.who.thought.about.it.test.png';
      const expectedValue = '/path/to/file_who_thought_about_it_test.png';

      const result = validator(value);
      expect(result).toBe(expectedValue);
    });

    it('should replace the illegal slash path characters', () => {
      const value = '/path/#/to/**my**[beta]?.png';
      const expectedValue = '/path/_/to/__my___beta__.png';

      const result = validator(value);
      expect(result).toBe(expectedValue);
    });
  });
});

describe('slashPathFactory', () => {
  describe('function', () => {
    const slashPathFn = slashPathFactory();

    it('should merge two paths together.', () => {
      const result = slashPathFn(['test/', 'hello.png']);
      expect(result).toBe('test/hello.png');
    });

    describe('with absolute start type', () => {
      const slashPathAbsoluteStartType = slashPathFactory({
        startType: 'absolute'
      });

      it('should merge two paths together.', () => {
        const result = slashPathAbsoluteStartType(['test/', 'hello.png']);
        expect(result).toBe('/test/hello.png');
      });
    });

    describe('with base path', () => {
      const slashPathWithBasePathFn = slashPathFactory({
        basePath: '/test/'
      });

      it('should append the input with the base path', () => {
        const result = slashPathWithBasePathFn('hello.png');
        expect(result).toBe('/test/hello.png');
      });
    });
  });
});

import { DEFAULT_CUT_STRING_END_TEXT, cutStringFunction, joinStringsWithSpaces, repeatString, splitJoinNameString, splitJoinRemainder } from './string';

describe('splitJoinRemainder()', () => {
  it('should handle having a single value', () => {
    const values = ['a'];
    const string = values.join(',');

    const result = splitJoinRemainder(string, ',', 3);
    expect(result[0]).toBe(values[0]);
  });

  it('should split the value up to the limit (1) and join the remainder', () => {
    const values = ['a,b,c,d,e'];
    const string = values.join(',');

    const result = splitJoinRemainder(string, ',', 1);
    expect(result[0]).toBe(values[0]);
  });

  it('should split the value up to the limit (2) and join the remainder', () => {
    const values = ['a', 'b,c,d,e'];
    const string = values.join(',');

    const result = splitJoinRemainder(string, ',', 2);
    expect(result[0]).toBe(values[0]);
    expect(result[1]).toBe(values[1]);
  });

  it('should split the value up to the limit (3) and join the remainder', () => {
    const values = ['a', 'b', 'c,d,e'];
    const string = values.join(',');

    const result = splitJoinRemainder(string, ',', 3);
    expect(result[0]).toBe(values[0]);
    expect(result[1]).toBe(values[1]);
    expect(result[2]).toBe(values[2]);
  });

  it('should split the value up to the limit (8) and join the remainder', () => {
    const values = ['a', 'b', 'c', 'd', 'e'];
    const string = values.join(',');

    const result = splitJoinRemainder(string, ',', 8);
    expect(result[0]).toBe(values[0]);
    expect(result[1]).toBe(values[1]);
    expect(result[2]).toBe(values[2]);
    expect(result[3]).toBe(values[3]);
    expect(result[4]).toBe(values[4]);
  });
});

describe('splitJoinNameString()', () => {
  it('should split the name into a first and last name.', () => {
    const first = 'Derek';
    const last = 'Burgman';

    const name = `${first} ${last}`;
    const result = splitJoinNameString(name);

    expect(result[0]).toBe(first);
    expect(result[1]).toBe(last);
  });
});

describe('joinStringsWithSpaces()', () => {
  it('should join the input strings.', () => {
    const result = joinStringsWithSpaces(['a', 'b', 'c']);
    expect(result).toBe('a b c');
  });

  it('should join the input strings and ignore undefined values.', () => {
    const result = joinStringsWithSpaces(['a', undefined, 'b', null, 'c']);
    expect(result).toBe('a b c');
  });
});

describe('repeatString()', () => {
  it('should repeat the given string', () => {
    const result = repeatString('a', 3);
    expect(result).toBe('aaa');
  });
});

describe('cutStringFunction()', () => {
  describe('function', () => {
    it('should return undefined if undefined is input', () => {
      const testString = undefined;
      const fn = cutStringFunction({ maxLength: 4 });

      const result = fn(testString);
      expect(result).toBeUndefined();
    });

    it('should return null if null is input', () => {
      const testString = null;
      const fn = cutStringFunction({ maxLength: 4 });

      const result = fn(testString);
      expect(result).toBeNull();
    });

    it('should not cut the string if its length is under the max length', () => {
      const testString = 'abcde';
      const fn = cutStringFunction({ maxLength: testString.length + 1 });

      const result = fn(testString);
      expect(result).toBe(testString);
    });

    it('should not cut the string if its length is equal to the max length', () => {
      const testString = 'abcde';
      const fn = cutStringFunction({ maxLength: testString.length });

      const result = fn(testString);
      expect(result).toBe(testString);
    });

    it('should cut the string to the expected length including the default end text', () => {
      const testString = 'abcde';
      const fn = cutStringFunction({ maxLength: 4 });

      const result = fn(testString);
      expect(result).toBe(`a${DEFAULT_CUT_STRING_END_TEXT}`);
    });

    describe('maxLengthIncludesEndText=false', () => {
      it('should cut the string to the expected length including the default end text', () => {
        const testString = 'abcde';
        const fn = cutStringFunction({ maxLength: 4, maxLengthIncludesEndText: false });

        const result = fn(testString);
        expect(result).toBe(`abcd${DEFAULT_CUT_STRING_END_TEXT}`);
      });
    });
  });
});

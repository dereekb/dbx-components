import { COMMA_STRING_SPLIT_JOIN, DEFAULT_CUT_STRING_END_TEXT, SPACE_STRING_SPLIT_JOIN, cutStringFunction, flattenWhitespace, joinStrings, joinStringsInstance, joinStringsWithSpaces, repeatString, simplifyWhitespace, splitJoinNameString, splitJoinRemainder, stringSplitJoinInstance } from './string';

describe('joinStrings()', () => {
  it('should join the strings', () => {
    const values = ['a', 'b', 'c'];
    const string = values.join(',');

    const result = joinStrings(values);
    expect(result).toBe(string);
  });

  it('should return null if null is input', () => {
    const result = joinStrings(null);
    expect(result).toBeNull();
  });
});

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

describe('flattenWhitespace()', () => {
  it('should flatten the whitespace', () => {
    const testString = 'a b      c    d\n  \n       \ne';
    const expected = 'a b c d\n \n \ne';

    const result = flattenWhitespace(testString);
    expect(result).toBe(expected);
  });
});

describe('simplifyWhitespace()', () => {
  it('should simplify the whitespace and trim whitespace from the end', () => {
    const testString = 'a      b\n\nc          d\ne       ';
    const expected = 'a b\nc d\ne';

    const result = simplifyWhitespace(testString);
    expect(result).toBe(expected);
  });
});

describe('joinStringsInstance()', () => {
  const commaJoin = joinStringsInstance({ joiner: ',' });
  const spaceJoin = joinStringsInstance({ joiner: ' ', trimByDefault: true });

  describe('properties', () => {
    it('should expose the joiner', () => {
      expect(commaJoin.joiner).toBe(',');
    });

    it('should expose trimByDefault as false when not configured', () => {
      expect(commaJoin.trimByDefault).toBe(false);
    });

    it('should expose trimByDefault as true when configured', () => {
      expect(spaceJoin.trimByDefault).toBe(true);
    });
  });

  describe('comma joiner', () => {
    it('should join strings with commas', () => {
      const result = commaJoin(['a', 'b', 'c']);
      expect(result).toBe('a,b,c');
    });

    it('should return null for null input', () => {
      const result = commaJoin(null);
      expect(result).toBeNull();
    });

    it('should return undefined for undefined input', () => {
      const result = commaJoin(undefined);
      expect(result).toBeUndefined();
    });

    it('should filter out null and undefined values', () => {
      const result = commaJoin(['a', null, 'b', undefined, 'c']);
      expect(result).toBe('a,b,c');
    });

    it('should handle a single string value', () => {
      const result = commaJoin('a');
      expect(result).toBe('a');
    });

    it('should not trim by default', () => {
      const result = commaJoin([' a ', ' b ']);
      expect(result).toBe(' a , b ');
    });

    it('should trim when trim is passed as true', () => {
      const result = commaJoin([' a ', ' b '], true);
      expect(result).toBe('a,b');
    });
  });

  describe('space joiner with trimByDefault', () => {
    it('should join strings with spaces', () => {
      const result = spaceJoin(['a', 'b', 'c']);
      expect(result).toBe('a b c');
    });

    it('should trim values by default', () => {
      const result = spaceJoin([' a ', ' b ']);
      expect(result).toBe('a b');
    });

    it('should filter out null/undefined and trim by default', () => {
      const result = spaceJoin(['a', null, ' b ', undefined, 'c']);
      expect(result).toBe('a b c');
    });
  });
});

describe('stringSplitJoinInstance()', () => {
  describe('custom instance', () => {
    const pipeInstance = stringSplitJoinInstance({ joiner: '|' });

    describe('joinStrings()', () => {
      it('should join strings with the configured delimiter', () => {
        const result = pipeInstance.joinStrings(['a', 'b', 'c']);
        expect(result).toBe('a|b|c');
      });
    });

    describe('splitStrings()', () => {
      it('should split strings by the configured delimiter', () => {
        const result = pipeInstance.splitStrings('a|b|c');
        expect(result).toEqual(['a', 'b', 'c']);
      });
    });

    describe('splitJoinRemainder()', () => {
      it('should split and rejoin overflow segments using the configured delimiter', () => {
        const result = pipeInstance.splitJoinRemainder('a|b|c|d|e', 2);
        expect(result).toEqual(['a', 'b|c|d|e']);
      });

      it('should return all segments when limit exceeds segment count', () => {
        const result = pipeInstance.splitJoinRemainder('a|b|c', 10);
        expect(result).toEqual(['a', 'b', 'c']);
      });

      it('should return the full string as a single segment when limit is 1', () => {
        const result = pipeInstance.splitJoinRemainder('a|b|c', 1);
        expect(result).toEqual(['a|b|c']);
      });
    });
  });

  describe('COMMA_STRING_SPLIT_JOIN', () => {
    describe('joinStrings()', () => {
      it('should join strings with commas', () => {
        const result = COMMA_STRING_SPLIT_JOIN.joinStrings(['a', 'b', 'c']);
        expect(result).toBe('a,b,c');
      });

      it('should return null for null input', () => {
        const result = COMMA_STRING_SPLIT_JOIN.joinStrings(null);
        expect(result).toBeNull();
      });

      it('should filter out null and undefined values', () => {
        const result = COMMA_STRING_SPLIT_JOIN.joinStrings(['a', null, 'b', undefined, 'c']);
        expect(result).toBe('a,b,c');
      });
    });

    describe('splitStrings()', () => {
      it('should split a comma-separated string', () => {
        const result = COMMA_STRING_SPLIT_JOIN.splitStrings('a,b,c');
        expect(result).toEqual(['a', 'b', 'c']);
      });

      it('should trim whitespace from split values', () => {
        const result = COMMA_STRING_SPLIT_JOIN.splitStrings('a, b , c');
        expect(result).toEqual(['a', 'b', 'c']);
      });

      it('should map split values with a mapFn', () => {
        const result = COMMA_STRING_SPLIT_JOIN.splitStrings('1,2,3', Number);
        expect(result).toEqual([1, 2, 3]);
      });
    });

    describe('splitStringsToSet()', () => {
      it('should return a Set of unique values', () => {
        const result = COMMA_STRING_SPLIT_JOIN.splitStringsToSet('a,b,a');
        expect(result).toEqual(new Set(['a', 'b']));
      });

      it('should return an empty set for null input', () => {
        const result = COMMA_STRING_SPLIT_JOIN.splitStringsToSet(null);
        expect(result).toEqual(new Set());
      });

      it('should return an empty set for undefined input', () => {
        const result = COMMA_STRING_SPLIT_JOIN.splitStringsToSet(undefined);
        expect(result).toEqual(new Set());
      });
    });

    describe('splitJoinRemainder()', () => {
      it('should split and rejoin overflow segments using commas', () => {
        const result = COMMA_STRING_SPLIT_JOIN.splitJoinRemainder('a,b,c,d,e', 3);
        expect(result).toEqual(['a', 'b', 'c,d,e']);
      });
    });
  });

  describe('SPACE_STRING_SPLIT_JOIN', () => {
    describe('joinStrings()', () => {
      it('should join strings with spaces', () => {
        const result = SPACE_STRING_SPLIT_JOIN.joinStrings(['a', 'b', 'c']);
        expect(result).toBe('a b c');
      });

      it('should filter out null/undefined and trim by default', () => {
        const result = SPACE_STRING_SPLIT_JOIN.joinStrings(['a', null, ' b ', undefined, 'c']);
        expect(result).toBe('a b c');
      });
    });

    describe('splitStrings()', () => {
      it('should split a space-separated string', () => {
        const result = SPACE_STRING_SPLIT_JOIN.splitStrings('a b c');
        expect(result).toEqual(['a', 'b', 'c']);
      });
    });

    describe('splitStringsToSet()', () => {
      it('should return a Set of unique values', () => {
        const result = SPACE_STRING_SPLIT_JOIN.splitStringsToSet('a b a');
        expect(result).toEqual(new Set(['a', 'b']));
      });
    });
  });
});

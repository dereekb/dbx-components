import { StringKeyPropertyKeys } from '@dereekb/util';
import { AllCommaSeparatedKeysOfObject, CommaSeparatedKeyCombinationsOfObject, CommaSeparatedKeysOfObject, HasThreeCharacters, HasThreeOrMoreCharacters, IsSingleCharacter, KeyAsString, KeyCanBeString, MergeReplace, OrderedCommaSeparatedKeysOfObject, PopUnion, Replace, ReplaceType, StringConcatenation, StringKeyProperties } from './type';

type TYPE_A = {
  aOnly: boolean;
  test: boolean;
};

type TYPE_B = {
  test: string;
  notInA: boolean;
};

type TYPE_C = {
  test: string;
  200: number;
};

describe('KeyAsString', () => {
  it('should not allow functions as key strings', () => {
    const x = () => 't';
    const replaced: KeyAsString<typeof x> = undefined as never;
  });
});

describe('MergeReplace', () => {
  it('should compile', () => {
    const replaced: MergeReplace<TYPE_A, TYPE_B> = {
      aOnly: true,
      test: 'replaced',
      notInA: false
    };

    expect(replaced).toBeDefined();
  });
});

describe('Replace', () => {
  it('should compile', () => {
    const replaced: Replace<TYPE_A, TYPE_B> = {
      aOnly: true,
      test: 'replaced'
    };

    expect(replaced).toBeDefined();
  });
});

describe('ReplaceType', () => {
  it('should compile', () => {
    const replaced: ReplaceType<TYPE_A, TYPE_B> = {
      aOnly: 'any value',
      test: 'replaced'
    };

    expect(replaced).toBeDefined();
  });
});

describe('StringKeyProperties', () => {
  it('should compile', () => {
    const replaced: StringKeyProperties<TYPE_C> = {
      test: 'replaced'
    };

    expect(replaced).toBeDefined();
  });
});

describe('StringKeyPropertyKeys', () => {
  it('should compile', () => {
    const replaced: StringKeyPropertyKeys<TYPE_C> = 'test';
    expect(replaced).toBeDefined();
  });
});

describe('CommaSeparatedKeyCombinationsOfObject', () => {
  it('should compile', () => {
    const object = {
      _: 0,
      a: 0,
      b: 0,
      c: 0,
      d: 0,
      1: 0
    };

    const replaced: CommaSeparatedKeyCombinationsOfObject<typeof object> = 'a,b,1';
    expect(replaced).toBeDefined();

    const a0: CommaSeparatedKeyCombinationsOfObject<typeof object> = '_,a,b,c';
    const a1: CommaSeparatedKeyCombinationsOfObject<typeof object> = '_,a,c';
    // const a2: CommaSeparatedKeyCombinationsOfObject<typeof object> = '_,c,b,a';
    // const a3: CommaSeparatedKeyCombinationsOfObject<typeof object> = '_,c,a,b';
    // const a4: CommaSeparatedKeyCombinationsOfObject<typeof object> = '_,b,a,c';
    // const a5: CommaSeparatedKeyCombinationsOfObject<typeof object> = '_,b,c,a';
    const a6: CommaSeparatedKeyCombinationsOfObject<typeof object> = 'b,_,a,c';
    const a7: CommaSeparatedKeyCombinationsOfObject<typeof object> = 'd,c,b,_';
    const a8: CommaSeparatedKeyCombinationsOfObject<typeof object> = 'a,_,b,c';
  });
});

describe('OrderedCommaSeparatedKeysOfObject', () => {
  it('should compile', () => {
    const object = {
      _: 0,
      b: 0,
      a: 0,
      c: 0,
      1: 0
    };

    const replaced: OrderedCommaSeparatedKeysOfObject<typeof object> = '_,a,b,c,1';
    expect(replaced).toBeDefined();
  });

  it('should compile', () => {
    const object = {
      _: 0,
      bbbbb: 0,
      a: 0,
      c: 0,
      1: 0
    };

    const replaced: OrderedCommaSeparatedKeysOfObject<typeof object> = '_,a,c,1,bbbbb';
    expect(replaced).toBeDefined();
  });
});

describe('AllCommaSeparatedKeysOfObject', () => {
  it('should compile', () => {
    const object = {
      a: 0,
      b: 0,
      c: 0,
      _: 0,
      1: 0
    };

    const replaced: AllCommaSeparatedKeysOfObject<typeof object> = 'a,b,c,1,_';
    expect(replaced).toBeDefined();
  });

  it('should contain every concatenation (2)', () => {
    const object = {
      _: 0,
      a: 0
    };

    const a0: AllCommaSeparatedKeysOfObject<typeof object> = '_,a';
    const a1: AllCommaSeparatedKeysOfObject<typeof object> = 'a,_';

    const a0a: StringConcatenation<'_' | 'a', ','> = 'a,_';
    const a1a: StringConcatenation<'_' | 'a', ','> = '_,a';
    const a1b: StringConcatenation<'_' | 'b', ','> = 'b,_';
    const a0b: StringConcatenation<'_' | 'b', ','> = '_,b';
    const ab0: StringConcatenation<'a' | 'b', ','> = 'a,b';
    const ab1: StringConcatenation<'a' | 'b', ','> = 'b,a';
  });

  it('should contain every concatenation (3)', () => {
    const object = {
      _: 0,
      a: 0,
      b: 0
    };

    const _: `${KeyCanBeString<keyof typeof object>}` = '_';
    const a: `${KeyCanBeString<keyof typeof object>}` = 'a';
    const b: `${KeyCanBeString<keyof typeof object>}` = 'b';

    const a0: AllCommaSeparatedKeysOfObject<typeof object> = '_,a,b';
    const a1: AllCommaSeparatedKeysOfObject<typeof object> = '_,b,a';
    const a2: AllCommaSeparatedKeysOfObject<typeof object> = 'a,_,b';
    const a3: AllCommaSeparatedKeysOfObject<typeof object> = 'b,_,a';
    const a4: AllCommaSeparatedKeysOfObject<typeof object> = 'a,b,_';
    const a5: AllCommaSeparatedKeysOfObject<typeof object> = 'b,a,_';

    const a0x: StringConcatenation<'a' | 'b' | '_', ','> = '_,a,b';
    const a1x: StringConcatenation<'_' | 'a' | 'b', ','> = '_,b,a';
    const a2x: StringConcatenation<'_' | 'a' | 'b', ','> = 'a,_,b';
    const a3x: StringConcatenation<'_' | 'a' | 'b', ','> = 'b,_,a';
    const a4x: StringConcatenation<'_' | 'a' | 'b', ','> = 'a,b,_';
    const a5x: StringConcatenation<'_' | 'a' | 'b', ','> = 'b,a,_';
  });

  it('should contain every concatenation (4)', () => {
    const object = {
      _: 0,
      a: 0,
      b: 0,
      c: 0
    };

    const a0: AllCommaSeparatedKeysOfObject<typeof object> = '_,a,b,c';
    const a1: AllCommaSeparatedKeysOfObject<typeof object> = '_,a,c,b';
    const a2: AllCommaSeparatedKeysOfObject<typeof object> = '_,c,b,a';
    const a3: AllCommaSeparatedKeysOfObject<typeof object> = '_,c,a,b';
    const a4: AllCommaSeparatedKeysOfObject<typeof object> = '_,b,a,c';
    const a5: AllCommaSeparatedKeysOfObject<typeof object> = '_,b,c,a';
    const a6: AllCommaSeparatedKeysOfObject<typeof object> = 'b,_,a,c';
    const a7: AllCommaSeparatedKeysOfObject<typeof object> = 'c,b,_,a';
    const a8: AllCommaSeparatedKeysOfObject<typeof object> = 'a,_,b,c';
  });

  it('should contain every concatenation (5)', () => {
    const object = {
      _: 0,
      a: 0,
      b: 0,
      c: 0,
      d: 0
    };

    const a0: AllCommaSeparatedKeysOfObject<typeof object> = '_,a,b,c,d';
    const a1: AllCommaSeparatedKeysOfObject<typeof object> = '_,c,d,a,b';
  });

  it('should contain every concatenation (6)', () => {
    const object = {
      _: 0,
      a: 0,
      b: 0,
      c: 0,
      d: 0,
      e: 0
    };

    const a0: AllCommaSeparatedKeysOfObject<typeof object> = 'e,d,b,c,a,_';
  });

  it('should contain every concatenation (7)', () => {
    const object = {
      _: 0,
      a: 0,
      b: 0,
      c: 0,
      d: 0,
      e: 0,
      f: 0
    };

    const a0: AllCommaSeparatedKeysOfObject<typeof object> = 'f,e,d,c,a,_,b';
  });

  it('should approximate concatenations with 8 or greater keys', () => {
    const object = {
      _: 0,
      a: 0,
      b: 0,
      c: 0,
      d: 0,
      e: 0,
      f: 0,
      g: 0
    };

    const a0: AllCommaSeparatedKeysOfObject<typeof object> = 'g,f,e,d,c,b,a,_';
  });
});

describe('HasThreeCharacters', () => {
  it('should compile.', () => {
    const type: HasThreeCharacters<'a' | 'b' | 'c'> = 'a';
  });
});

describe('HasThreeOrMoreCharacters', () => {
  it('should compile.', () => {
    const type: HasThreeOrMoreCharacters<'a' | 'b' | 'c'> = 'a';
  });
});

describe('IsSingleCharacter', () => {
  it('should compile.', () => {
    const type: IsSingleCharacter<'a'> = 'a';
  });
});

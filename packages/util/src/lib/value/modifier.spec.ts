import { modifier, addModifiers, removeModifiers, modifierMapToFunction, maybeModifierMapToFunction, mergeModifiers, maybeMergeModifiers, NOOP_MODIFIER } from './modifier';

interface TestObj {
  x: number;
}

describe('modifier()', () => {
  it('should create a modifier with the given key and function', () => {
    const uppercaseName = modifier<{ name: string }>('uppercase', (x) => {
      x.name = x.name.toUpperCase();
    });
    const obj = { name: 'alice' };
    uppercaseName.modify(obj);
    expect(obj.name).toBe('ALICE');
    expect(uppercaseName.key).toBe('uppercase');
  });
});

describe('NOOP_MODIFIER', () => {
  it('should not modify the input', () => {
    const obj = { x: 5 };
    NOOP_MODIFIER(obj);
    expect(obj.x).toBe(5);
  });
});

describe('addModifiers()', () => {
  it('should add a modifier to a new map when no map is provided', () => {
    const mod = modifier<TestObj>('double', (o) => {
      o.x *= 2;
    });
    const map = addModifiers(mod);
    expect(map.has('double')).toBe(true);
    expect(map.size).toBe(1);
  });

  it('should add a modifier to an existing map', () => {
    const mod1 = modifier<TestObj>('inc', (o) => {
      o.x += 1;
    });
    const mod2 = modifier<TestObj>('double', (o) => {
      o.x *= 2;
    });
    const map = addModifiers(mod1);
    addModifiers(mod2, map);
    expect(map.size).toBe(2);
  });

  it('should accept an array of modifiers', () => {
    const mod1 = modifier<TestObj>('a', (o) => {
      o.x += 1;
    });
    const mod2 = modifier<TestObj>('b', (o) => {
      o.x += 2;
    });
    const map = addModifiers([mod1, mod2]);
    expect(map.size).toBe(2);
  });
});

describe('removeModifiers()', () => {
  it('should remove a modifier from the map by key', () => {
    const mod = modifier<TestObj>('double', (o) => {
      o.x *= 2;
    });
    const map = addModifiers(mod);
    const result = removeModifiers(mod, map);
    expect(result.has('double')).toBe(false);
  });

  it('should return an empty map when no map is provided', () => {
    const mod = modifier<TestObj>('double', (o) => {
      o.x *= 2;
    });
    const result = removeModifiers(mod, undefined);
    expect(result.size).toBe(0);
  });
});

describe('modifierMapToFunction()', () => {
  it('should create a function that applies all modifiers in the map', () => {
    const mod = modifier<TestObj>('inc', (o) => {
      o.x += 1;
    });
    const map = addModifiers(mod);
    const fn = modifierMapToFunction(map);
    const obj: TestObj = { x: 0 };
    fn(obj);
    expect(obj.x).toBe(1);
  });

  it('should return NOOP_MODIFIER when the map is undefined', () => {
    const fn = modifierMapToFunction(undefined);
    const obj: TestObj = { x: 5 };
    fn(obj);
    expect(obj.x).toBe(5);
  });
});

describe('maybeModifierMapToFunction()', () => {
  it('should return a function when the map is non-null', () => {
    const mod = modifier<TestObj>('inc', (o) => {
      o.x += 1;
    });
    const map = addModifiers(mod);
    const fn = maybeModifierMapToFunction(map);
    expect(fn).toBeDefined();

    const obj: TestObj = { x: 0 };
    fn!(obj);
    expect(obj.x).toBe(1);
  });

  it('should return undefined when the map is null', () => {
    const fn = maybeModifierMapToFunction(undefined);
    expect(fn).toBeUndefined();
  });
});

describe('mergeModifiers()', () => {
  it('should merge multiple modifier functions into one that applies them in order', () => {
    const add1 = (o: TestObj) => {
      o.x += 1;
    };
    const double = (o: TestObj) => {
      o.x *= 2;
    };
    const merged = mergeModifiers([add1, double]);
    const obj: TestObj = { x: 3 };
    merged(obj);
    expect(obj.x).toBe(8); // (3 + 1) * 2
  });

  it('should return NOOP_MODIFIER for an empty array', () => {
    const merged = mergeModifiers<TestObj>([]);
    const obj: TestObj = { x: 5 };
    merged(obj);
    expect(obj.x).toBe(5);
  });
});

describe('maybeMergeModifiers()', () => {
  it('should return the single function directly when given one modifier', () => {
    const fn = (o: TestObj) => {
      o.x += 1;
    };
    const result = maybeMergeModifiers([fn]);
    expect(result).toBe(fn);
  });

  it('should return undefined when input is undefined', () => {
    const result = maybeMergeModifiers<TestObj>(undefined);
    expect(result).toBeUndefined();
  });
});

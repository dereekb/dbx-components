import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { utilEslintPlugin } from './plugin';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: {
        parser: tsParser as any,
        parserOptions: {
          ecmaVersion: 2022,
          sourceType: 'module'
        }
      },
      plugins: {
        'dereekb-util': utilEslintPlugin as any
      },
      rules: {
        'dereekb-util/require-single-return': 'error'
      }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/require-single-return');
}

describe('require-single-return rule', () => {
  describe('valid', () => {
    it('function with a single return statement passes', () => {
      const errors = lintCode(`
function foo(x: number) {
  let result = 0;
  if (x > 0) {
    result = x;
  }
  return result;
}
`);
      expect(errors).toHaveLength(0);
    });

    it('function with no return statements passes', () => {
      const errors = lintCode(`
function doWork(x: number): void {
  console.log(x);
}
`);
      expect(errors).toHaveLength(0);
    });

    it('arrow function with implicit return passes', () => {
      const errors = lintCode(`
const double = (x: number) => x * 2;
`);
      expect(errors).toHaveLength(0);
    });

    it('nested function with its own returns does not count against the outer function', () => {
      const errors = lintCode(`
function outer() {
  function inner(x: number) {
    let r = 0;
    if (x > 0) {
      r = x;
    }
    return r;
  }
  return inner(1);
}
`);
      expect(errors).toHaveLength(0);
    });

    it('method on a class with a single return passes', () => {
      const errors = lintCode(`
class Foo {
  bar(x: number) {
    return x + 1;
  }
}
`);
      expect(errors).toHaveLength(0);
    });

    it('single-line early-exit guard (`if (...) return X;`) is exempt', () => {
      const errors = lintCode(`
function removeSuffix(input: string, suffix: string) {
  if (!input.endsWith(suffix)) return undefined;
  return input.slice(0, -suffix.length);
}
`);
      expect(errors).toHaveLength(0);
    });

    it('block-form early-exit guard with only a return is exempt', () => {
      const errors = lintCode(`
function joinStrings(input: unknown) {
  if (input == null) {
    return input;
  }
  return String(input);
}
`);
      expect(errors).toHaveLength(0);
    });

    it('block-form early-exit guard whose last statement is a return is exempt', () => {
      const errors = lintCode(`
function telUrlString(phone: string) {
  if (phone.startsWith('+')) {
    const formatted = phone.replace(/\\s+/g, '');
    return 'tel:' + formatted;
  }
  return 'tel:' + phone;
}
`);
      expect(errors).toHaveLength(0);
    });

    it('stacked top-level guards followed by a single main return are exempt', () => {
      const errors = lintCode(`
function classify(x: number) {
  if (x < 0) {
    return -1;
  }
  if (x === 0) {
    return 0;
  }
  return 1;
}
`);
      expect(errors).toHaveLength(0);
    });

    it('early-exit guard nested inside a loop is exempt', () => {
      const errors = lintCode(`
function findItem<T>(items: T[], predicate: (x: T) => boolean) {
  for (const item of items) {
    if (predicate(item)) return item;
  }
  return undefined;
}
`);
      expect(errors).toHaveLength(0);
    });

    it('arrow function with a single guard followed by a final return is exempt', () => {
      const errors = lintCode(`
const fn = (x: number) => {
  if (x > 0) {
    return x;
  }
  return 0;
};
`);
      expect(errors).toHaveLength(0);
    });

    it('arrow callback inside a function with a guard + final return does not count', () => {
      const errors = lintCode(`
function outer(items: number[]) {
  const mapped = items.map((x) => {
    if (x > 0) {
      return x * 2;
    }
    return 0;
  });
  return mapped;
}
`);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid', () => {
    it('flags if/else where both branches return', () => {
      const errors = lintCode(`
function foo(x: number) {
  if (x > 0) {
    return x;
  } else {
    return 0;
  }
}
`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('foo');
    });

    it('flags returns from if/else-if/else chains', () => {
      const errors = lintCode(`
function classify(x: number) {
  if (x < 0) {
    return -1;
  } else if (x === 0) {
    return 0;
  } else {
    return 1;
  }
}
`);
      // 3 returns total, none qualify as bare-guard (each if has an else),
      // so 2 extras are reported.
      expect(errors).toHaveLength(2);
      expect(errors.every((e) => e.message.includes('3 non-guard return'))).toBe(true);
    });

    it('flags a class method with non-guard multiple returns', () => {
      const errors = lintCode(`
class Foo {
  bar(x: number) {
    if (x > 0) {
      return x;
    } else {
      return 0;
    }
  }
}
`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('bar');
    });

    it('counts returns inside switch/case as multiple returns', () => {
      const errors = lintCode(`
function classify(kind: string) {
  switch (kind) {
    case 'a':
      return 1;
    case 'b':
      return 2;
    default:
      return 0;
  }
}
`);
      expect(errors).toHaveLength(2);
    });

    it('counts returns inside try/catch as multiple returns', () => {
      const errors = lintCode(`
function safeRun(fn: () => number) {
  try {
    return fn();
  } catch (e) {
    return 0;
  }
}
`);
      expect(errors).toHaveLength(1);
    });

    it('flags non-last returns inside an if-guard block (return mixed into main logic)', () => {
      const errors = lintCode(`
function foo(x: number) {
  if (x > 0) {
    if (x > 10) {
      return 100;
    }
    return x;
  }
  return 0;
}
`);
      // Both inner returns are last-in-their-block within if-no-else and exempt.
      // Outer `return 0` is the only counted return — passes.
      expect(errors).toHaveLength(0);
    });

    it('flags a return that is not the last statement of an if-block', () => {
      const errors = lintCode(`
function foo(x: number, log: (s: string) => void) {
  if (x > 0) {
    return x;
    log('unreachable');
  }
  return 0;
}
`);
      // The return is not the last statement of the consequent block, so it is counted.
      expect(errors).toHaveLength(1);
    });
  });
});

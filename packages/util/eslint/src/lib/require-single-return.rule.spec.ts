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

    it('arrow callback inside a function with its own returns does not count', () => {
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
      // Outer has 1 return; the arrow has 2 returns — the arrow itself should be flagged independently.
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('2 return statements');
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
  });

  describe('invalid', () => {
    it('flags a function with two returns', () => {
      const errors = lintCode(`
function foo(x: number) {
  if (x > 0) {
    return x;
  }
  return 0;
}
`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('foo');
      expect(errors[0].message).toContain('2 return');
    });

    it('flags a function with three returns (reports each extra return)', () => {
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
      expect(errors).toHaveLength(2);
      expect(errors.every((e) => e.message.includes('3 return'))).toBe(true);
    });

    it('flags arrow function with multiple explicit returns', () => {
      const errors = lintCode(`
const fn = (x: number) => {
  if (x > 0) {
    return x;
  }
  return 0;
};
`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('fn');
    });

    it('flags class methods with multiple returns', () => {
      const errors = lintCode(`
class Foo {
  bar(x: number) {
    if (x > 0) {
      return x;
    }
    return 0;
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
  });
});

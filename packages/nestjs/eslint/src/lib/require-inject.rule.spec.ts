import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { nestjsEslintPlugin } from './plugin';

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  const config: Linter.Config[] = [
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
        'dereekb-nestjs': nestjsEslintPlugin as any
      },
      rules: {
        'dereekb-nestjs/require-nest-inject': 'error'
      }
    }
  ];

  return linter.verify(code, config, { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-nestjs/require-nest-inject');
}

function fixCode(code: string): string {
  const linter = new Linter({ configType: 'flat' });
  const config: Linter.Config[] = [
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
        'dereekb-nestjs': nestjsEslintPlugin as any
      },
      rules: {
        'dereekb-nestjs/require-nest-inject': 'error'
      }
    }
  ];

  const result = linter.verifyAndFix(code, config, { filename: 'test.ts' });
  return result.output;
}

describe('require-nest-inject rule', () => {
  describe('should pass', () => {
    it('@Injectable with @Inject on all params', () => {
      const errors = lintCode(`
        import { Injectable, Inject } from '@nestjs/common';

        @Injectable()
        export class GoodService {
          constructor(@Inject(FooApi) fooApi: FooApi, @Inject(BarApi) barApi: BarApi) {}
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('plain class without NestJS decorator', () => {
      const errors = lintCode(`
        export class PlainClass {
          constructor(foo: string) {}
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('@Injectable with no constructor', () => {
      const errors = lintCode(`
        import { Injectable } from '@nestjs/common';

        @Injectable()
        export class NoCtorService {}
      `);

      expect(errors).toHaveLength(0);
    });

    it('@Injectable with empty constructor', () => {
      const errors = lintCode(`
        import { Injectable } from '@nestjs/common';

        @Injectable()
        export class EmptyCtorService {
          constructor() {}
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('@Optional() decorator is accepted', () => {
      const errors = lintCode(`
        import { Injectable, Inject, Optional } from '@nestjs/common';

        @Injectable()
        export class OptionalService {
          constructor(@Optional() @Inject(FooApi) fooApi: FooApi) {}
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('@Controller with @Inject on all params', () => {
      const errors = lintCode(`
        import { Controller, Inject } from '@nestjs/common';

        @Controller()
        export class GoodController {
          constructor(@Inject(MyService) myService: MyService) {}
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('Angular @Injectable without @Inject is not flagged', () => {
      const errors = lintCode(`
        import { Injectable } from '@angular/core';

        @Injectable()
        export class AngularService {
          constructor(fooService: FooService) {}
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('unknown @Injectable source is not flagged', () => {
      const errors = lintCode(`
        import { Injectable } from 'some-other-lib';

        @Injectable()
        export class OtherService {
          constructor(foo: Foo) {}
        }
      `);

      expect(errors).toHaveLength(0);
    });
  });

  describe('should fail', () => {
    it('@Injectable with missing @Inject', () => {
      const errors = lintCode(`
        import { Injectable } from '@nestjs/common';

        @Injectable()
        export class BadService {
          constructor(fooApi: FooApi) {}
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('fooApi');
      expect(errors[0].message).toContain('@Injectable()');
    });

    it('@Injectable with partial @Inject (one param missing)', () => {
      const errors = lintCode(`
        import { Injectable, Inject } from '@nestjs/common';

        @Injectable()
        export class PartialService {
          constructor(@Inject(FooApi) fooApi: FooApi, barApi: BarApi) {}
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('barApi');
    });

    it('@Controller with missing @Inject', () => {
      const errors = lintCode(`
        import { Controller } from '@nestjs/common';

        @Controller()
        export class BadController {
          constructor(myService: MyService) {}
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('myService');
      expect(errors[0].message).toContain('@Controller()');
    });
  });

  describe('auto-fix', () => {
    it('adds @Inject(ClassName) for class-typed params', () => {
      const input = `
import { Injectable } from '@nestjs/common';

@Injectable()
export class FixableService {
  constructor(fooApi: FooApi) {}
}`;

      const output = fixCode(input);
      expect(output).toContain('@Inject(FooApi) fooApi: FooApi');
    });

    it('adds Inject to the import when not already imported', () => {
      const input = `
import { Injectable } from '@nestjs/common';

@Injectable()
export class FixableService {
  constructor(fooApi: FooApi) {}
}`;

      const output = fixCode(input);
      expect(output).toContain("import { Injectable, Inject } from '@nestjs/common'");
    });

    it('does not duplicate Inject in import when already present', () => {
      const input = `
import { Injectable, Inject } from '@nestjs/common';

@Injectable()
export class FixableService {
  constructor(fooApi: FooApi) {}
}`;

      const output = fixCode(input);
      expect(output).not.toContain('Inject, Inject');
      expect(output).toContain('@Inject(FooApi) fooApi: FooApi');
    });

    it('fixes multiple params at once', () => {
      const input = `
import { Injectable } from '@nestjs/common';

@Injectable()
export class MultiService {
  constructor(fooApi: FooApi, barApi: BarApi) {}
}`;

      const output = fixCode(input);
      expect(output).toContain('@Inject(FooApi) fooApi: FooApi');
      expect(output).toContain('@Inject(BarApi) barApi: BarApi');
    });

    it('does not auto-fix primitive-typed params', () => {
      const input = `
import { Injectable } from '@nestjs/common';

@Injectable()
export class PrimitiveService {
  constructor(name: string) {}
}`;

      const errors = lintCode(input);
      expect(errors).toHaveLength(1);

      // The fix should not be applied since 'string' is a primitive
      const output = fixCode(input);
      expect(output).not.toContain('@Inject(string)');
    });

    it('auto-fixes params typed with abstract class references', () => {
      const input = `
import { Injectable } from '@nestjs/common';

@Injectable()
export class ConcreteService {
  constructor(base: AbstractBaseService) {}
}`;

      const output = fixCode(input);
      expect(output).toContain('@Inject(AbstractBaseService) base: AbstractBaseService');
    });

    it('does not auto-fix generic-typed params', () => {
      const input = `
import { Injectable } from '@nestjs/common';

@Injectable()
export class GenericService {
  constructor(items: Map<string, number>) {}
}`;

      const errors = lintCode(input);
      expect(errors).toHaveLength(1);

      // The fix should not be applied since Map<string, number> has type arguments
      const output = fixCode(input);
      expect(output).not.toContain('@Inject(Map)');
    });
  });
});

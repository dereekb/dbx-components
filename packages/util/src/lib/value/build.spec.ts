import { build } from './build';

describe('build()', () => {
  it('should build an object by mutating the base', () => {
    interface User {
      name: string;
      age: number;
    }

    const user = build<User>({
      base: {},
      build: (x) => {
        x.name = 'Alice';
        x.age = 30;
      }
    });

    expect(user).toEqual({ name: 'Alice', age: 30 });
  });

  it('should pass an empty object to the build function when no base is provided', () => {
    let receivedBase: unknown;

    build<{ enabled: boolean }>({
      build: (x) => {
        receivedBase = x;
        x.enabled = true;
      }
    });

    expect(receivedBase).toBeDefined();
    expect((receivedBase as { enabled: boolean }).enabled).toBe(true);
  });

  it('should mutate an existing base object', () => {
    interface Item {
      value: number;
    }

    const base = { value: 1 };

    const result = build<Item>({
      base,
      build: (x) => {
        x.value = 42;
      }
    });

    expect(result).toBe(base);
    expect(result.value).toBe(42);
  });
});

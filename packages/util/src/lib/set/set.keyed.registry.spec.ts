import { describe, expect, it } from 'vitest';
import { createKeyedRegistry } from './set.keyed.registry';

interface TestEntry {
  readonly id: string;
  readonly kind: string;
}

const readKey = (entry: TestEntry) => entry.id;

describe('createKeyedRegistry()', () => {
  describe('replace (default)', () => {
    it('should register and read a value by its key, reporting newly-added', () => {
      const registry = createKeyedRegistry<TestEntry, string>({ readKey });
      const a: TestEntry = { id: 'a', kind: 'x' };

      expect(registry.register(a)).toBe(true);
      expect(registry.get('a')).toBe(a);
      expect(registry.has('a')).toBe(true);
      expect(registry.size).toBe(1);
    });

    it('should overwrite the value under an existing key (last wins) and report not-newly-added', () => {
      const registry = createKeyedRegistry<TestEntry, string>({ readKey });
      const first: TestEntry = { id: 'a', kind: 'x' };
      const second: TestEntry = { id: 'a', kind: 'y' };

      registry.register(first);

      expect(registry.register(second)).toBe(false);
      expect(registry.get('a')).toBe(second);
      expect(registry.size).toBe(1);
    });

    it('should keep a replaced value in its original insertion position', () => {
      const registry = createKeyedRegistry<TestEntry, string>({ readKey });
      registry.register({ id: 'a', kind: 'x' });
      registry.register({ id: 'b', kind: 'x' });
      const replacement: TestEntry = { id: 'a', kind: 'z' };
      registry.register(replacement);

      expect(registry.keys()).toEqual(['a', 'b']);
      expect(registry.values()[0]).toBe(replacement);
    });

    it('should read undefined for an absent or nullish key', () => {
      const registry = createKeyedRegistry<TestEntry, string>({ readKey });

      expect(registry.get('missing')).toBeUndefined();
      expect(registry.get(undefined)).toBeUndefined();
      expect(registry.has(null)).toBe(false);
    });
  });

  describe('throwOnDuplicateKey', () => {
    it('should be a no-op for the same instance', () => {
      const registry = createKeyedRegistry<TestEntry, string>({ readKey, throwOnDuplicateKey: true });
      const a: TestEntry = { id: 'a', kind: 'x' };
      registry.register(a);

      expect(registry.register(a)).toBe(false);
      expect(registry.size).toBe(1);
    });

    it('should throw the default error when a different value claims an occupied key', () => {
      const registry = createKeyedRegistry<TestEntry, string>({ readKey, throwOnDuplicateKey: true });
      registry.register({ id: 'a', kind: 'x' });

      expect(() => registry.register({ id: 'a', kind: 'y' })).toThrow(/key 'a' is already registered/);
    });

    it('should throw the error from a custom factory', () => {
      const registry = createKeyedRegistry<TestEntry, string>({ readKey, throwOnDuplicateKey: (key, value) => new Error(`custom ${key} ${value.kind}`) });
      registry.register({ id: 'a', kind: 'x' });

      expect(() => registry.register({ id: 'a', kind: 'y' })).toThrow('custom a y');
    });

    it('should throw while seeding two different values with the same key', () => {
      expect(() =>
        createKeyedRegistry<TestEntry, string>({
          readKey,
          throwOnDuplicateKey: true,
          seed: [
            { id: 'a', kind: 'x' },
            { id: 'a', kind: 'y' }
          ]
        })
      ).toThrow(/key 'a' is already registered/);
    });
  });

  describe('seed', () => {
    it('should register seed values at construction, in order', () => {
      const registry = createKeyedRegistry<TestEntry, string>({
        readKey,
        seed: [
          { id: 'b', kind: 'x' },
          { id: 'a', kind: 'y' }
        ]
      });

      expect(registry.keys()).toEqual(['b', 'a']);
      expect(registry.values().map((x) => x.kind)).toEqual(['x', 'y']);
    });

    it('should accept any iterable', () => {
      const registry = createKeyedRegistry<TestEntry, string>({ readKey, seed: new Set([{ id: 'a', kind: 'x' }]) });
      expect(registry.keys()).toEqual(['a']);
    });
  });

  describe('unregister and clear', () => {
    it('should remove a value by key', () => {
      const registry = createKeyedRegistry<TestEntry, string>({ readKey, seed: [{ id: 'a', kind: 'x' }] });

      expect(registry.unregister('a')).toBe(true);
      expect(registry.has('a')).toBe(false);
      expect(registry.size).toBe(0);
    });

    it('should report false when unregistering an absent key', () => {
      const registry = createKeyedRegistry<TestEntry, string>({ readKey });
      expect(registry.unregister('a')).toBe(false);
    });

    it('should clear every value', () => {
      const registry = createKeyedRegistry<TestEntry, string>({
        readKey,
        seed: [
          { id: 'a', kind: 'x' },
          { id: 'b', kind: 'y' }
        ]
      });
      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.keys()).toEqual([]);
    });
  });

  describe('listing', () => {
    it('should return fresh keys() and values() arrays in registration order', () => {
      const registry = createKeyedRegistry<TestEntry, string>({ readKey });
      registry.register({ id: 'c', kind: 'x' });
      registry.register({ id: 'a', kind: 'y' });

      const keys = registry.keys();
      keys.push('mutated');

      expect(registry.keys()).toEqual(['c', 'a']);
      expect(registry.values().filter((x) => x.kind === 'y')).toEqual([{ id: 'a', kind: 'y' }]);
    });
  });
});

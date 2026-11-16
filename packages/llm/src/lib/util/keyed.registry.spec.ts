import { describe, it, expect } from 'vitest';
import { createKeyedRegistry, type KeyedRegistryCollision } from './keyed.registry';

// A minimal value with one stable key (the single-index case) and, where a test needs it, a second
// independent handle (the multi-index case).
interface Item {
  readonly key: string;
  readonly name: string;
  readonly note?: string;
}

const item = (key: string, name: string, note?: string): Item => ({ key, name, ...(note == null ? {} : { note }) });

describe('createKeyedRegistry', () => {
  describe("collision: 'replace' (default)", () => {
    it('registers and reads a value by its primary key, reporting newly-added', () => {
      const registry = createKeyedRegistry<Item>({ indexes: [{ name: 'key', keyOf: (it) => it.key }] });
      const a = item('a', 'A');

      expect(registry.register(a)).toBe(true);
      expect(registry.get('a')).toBe(a);
      expect(registry.has('a')).toBe(true);
      expect(registry.size).toBe(1);
    });

    it('overwrites the value under an existing key (last-wins) and reports not-newly-added', () => {
      const registry = createKeyedRegistry<Item>({ indexes: [{ name: 'key', keyOf: (it) => it.key }] });
      const first = item('a', 'First');
      const second = item('a', 'Second');

      registry.register(first);
      expect(registry.register(second)).toBe(false);
      expect(registry.get('a')).toBe(second);
      expect(registry.size).toBe(1);
    });

    it('keeps a replaced value in its original insertion position', () => {
      const registry = createKeyedRegistry<Item>({ indexes: [{ name: 'key', keyOf: (it) => it.key }] });
      registry.register(item('a', 'A'));
      registry.register(item('b', 'B'));
      registry.register(item('c', 'C'));
      const replacement = item('a', 'A2');
      registry.register(replacement);

      expect(registry.keys()).toEqual(['a', 'b', 'c']);
      expect(registry.get('a')).toBe(replacement);
    });

    it('reads undefined for an absent key', () => {
      const registry = createKeyedRegistry<Item>({ indexes: [{ name: 'key', keyOf: (it) => it.key }] });
      expect(registry.get('missing')).toBeUndefined();
      expect(registry.has('missing')).toBe(false);
    });
  });

  describe("collision: 'throw'", () => {
    it('is an idempotent no-op for the same instance (returns false, size unchanged)', () => {
      const registry = createKeyedRegistry<Item>({ indexes: [{ name: 'key', keyOf: (it) => it.key }], collision: 'throw' });
      const a = item('a', 'A');

      expect(registry.register(a)).toBe(true);
      expect(registry.register(a)).toBe(false);
      expect(registry.size).toBe(1);
    });

    it('throws when a different value claims an occupied primary key', () => {
      const registry = createKeyedRegistry<Item>({ indexes: [{ name: 'key', keyOf: (it) => it.key }], collision: 'throw' });
      registry.register(item('a', 'A'));
      expect(() => registry.register(item('a', 'Other'))).toThrow(/key 'a' is already registered/);
    });

    it('throws on a secondary-index collision', () => {
      const registry = createKeyedRegistry<Item>({
        indexes: [
          { name: 'key', keyOf: (it) => it.key },
          { name: 'name', keyOf: (it) => it.name }
        ],
        collision: 'throw'
      });
      registry.register(item('a', 'shared'));
      // Distinct primary key, but the same secondary `name` — must be rejected on the secondary index.
      expect(() => registry.register(item('b', 'shared'))).toThrow(/name 'shared' is already registered/);
      expect(registry.size).toBe(1);
    });

    it('formats the message via a custom collisionMessage', () => {
      const messages: KeyedRegistryCollision<Item>[] = [];
      const registry = createKeyedRegistry<Item>({
        indexes: [{ name: 'key', keyOf: (it) => it.key }],
        collision: 'throw',
        collisionMessage: (info) => {
          messages.push(info);
          return `boom: ${info.index}=${info.key}`;
        }
      });
      const a = item('a', 'A');
      registry.register(a);
      const dup = item('a', 'Dup');

      expect(() => registry.register(dup)).toThrow('boom: key=a');
      expect(messages).toHaveLength(1);
      expect(messages[0].value).toBe(dup);
      expect(messages[0].existing).toBe(a);
    });
  });

  describe('multi-index reads', () => {
    it('resolves a value through both its primary and secondary index', () => {
      const registry = createKeyedRegistry<Item>({
        indexes: [
          { name: 'key', keyOf: (it) => it.key },
          { name: 'name', keyOf: (it) => it.name }
        ]
      });
      const a = item('a', 'Alpha');
      registry.register(a);

      expect(registry.getBy('key', 'a')).toBe(a);
      expect(registry.getBy('name', 'Alpha')).toBe(a);
      expect(registry.index('name').get('Alpha')).toBe(a);
    });

    it('exposes a LIVE index view that reflects later registrations', () => {
      const registry = createKeyedRegistry<Item>({ indexes: [{ name: 'key', keyOf: (it) => it.key }] });
      const view = registry.index('key');
      expect(view.size).toBe(0);

      registry.register(item('a', 'A'));
      expect(view.size).toBe(1);
      expect(view.has('a')).toBe(true);
    });

    it('throws for an unknown index name', () => {
      const registry = createKeyedRegistry<Item>({ indexes: [{ name: 'key', keyOf: (it) => it.key }] });
      expect(() => registry.index('nope')).toThrow(/no index named 'nope'/);
    });
  });

  describe('seed', () => {
    it('registers seed values at construction, in order', () => {
      const registry = createKeyedRegistry<Item>({
        indexes: [{ name: 'key', keyOf: (it) => it.key }],
        seed: [item('a', 'A'), item('b', 'B')]
      });

      expect(registry.size).toBe(2);
      expect(registry.keys()).toEqual(['a', 'b']);
    });
  });

  describe('unregister + clear', () => {
    it('removes a value by primary key and clears all of its index entries', () => {
      const registry = createKeyedRegistry<Item>({
        indexes: [
          { name: 'key', keyOf: (it) => it.key },
          { name: 'name', keyOf: (it) => it.name }
        ]
      });
      registry.register(item('a', 'Alpha'));

      expect(registry.unregister('a')).toBe(true);
      expect(registry.get('a')).toBeUndefined();
      expect(registry.getBy('name', 'Alpha')).toBeUndefined();
      expect(registry.size).toBe(0);
    });

    it('reports false when unregistering an absent key', () => {
      const registry = createKeyedRegistry<Item>({ indexes: [{ name: 'key', keyOf: (it) => it.key }] });
      expect(registry.unregister('missing')).toBe(false);
    });

    it('clears every value from every index', () => {
      const registry = createKeyedRegistry<Item>({
        indexes: [
          { name: 'key', keyOf: (it) => it.key },
          { name: 'name', keyOf: (it) => it.name }
        ],
        seed: [item('a', 'Alpha'), item('b', 'Beta')]
      });

      registry.clear();
      expect(registry.size).toBe(0);
      expect(registry.values()).toEqual([]);
      expect(registry.index('name').size).toBe(0);
    });
  });

  describe('order + listing', () => {
    it('returns keys() and values() in registration order', () => {
      const registry = createKeyedRegistry<Item>({ indexes: [{ name: 'key', keyOf: (it) => it.key }] });
      const a = item('a', 'A');
      const b = item('b', 'B');
      const c = item('c', 'C');
      registry.register(c);
      registry.register(a);
      registry.register(b);

      expect(registry.keys()).toEqual(['c', 'a', 'b']);
      expect(registry.values()).toEqual([c, a, b]);
    });
  });

  describe('a shared secondary key in replace mode', () => {
    // Several values may share one secondary key in 'replace' mode (the strategy registry's `kind` index is the
    // motivating case). The entry points at the LAST registered value; replacing or removing a value must never
    // leave the key pointing at nothing while another value carrying it is still registered.
    const seeded = () => {
      const a = item('a', 'shared');
      const b = item('b', 'shared');
      const registry = createKeyedRegistry<Item>({
        indexes: [
          { name: 'key', keyOf: (it) => it.key },
          { name: 'name', keyOf: (it) => it.name }
        ],
        collision: 'replace',
        seed: [a, b]
      });

      return { registry, a, b };
    };

    it('points the shared key at the last registered value', () => {
      const { registry, b } = seeded();
      expect(registry.getBy('name', 'shared')).toBe(b);
    });

    it('keeps the holder when a non-holder sharing the key is unregistered', () => {
      const { registry, b } = seeded();
      registry.unregister('a');
      expect(registry.getBy('name', 'shared')).toBe(b);
    });

    it('falls back to the remaining value when the holder is unregistered', () => {
      const { registry, a } = seeded();
      registry.unregister('b');
      expect(registry.getBy('name', 'shared')).toBe(a);
    });

    it('keeps the holder when a non-holder is replaced under a different secondary key', () => {
      const { registry, b } = seeded();
      const a2 = item('a', 'other');
      registry.register(a2);
      expect(registry.getBy('name', 'shared')).toBe(b);
      expect(registry.getBy('name', 'other')).toBe(a2);
    });

    it('falls back when the holder is replaced under a different secondary key', () => {
      const { registry, a } = seeded();
      const b2 = item('b', 'other');
      registry.register(b2);
      expect(registry.getBy('name', 'shared')).toBe(a);
      expect(registry.getBy('name', 'other')).toBe(b2);
    });

    it('drops the key once no registered value carries it', () => {
      const { registry } = seeded();
      registry.unregister('a');
      registry.unregister('b');
      expect(registry.getBy('name', 'shared')).toBeUndefined();
      expect(registry.index('name').size).toBe(0);
    });
  });
});

import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import { findInterfaces } from './find-interfaces.js';

function interfaces(source: string) {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sf = project.createSourceFile('x.ts', source, { overwrite: true });
  return findInterfaces(sf);
}

describe('findInterfaces() extends-name peeling', () => {
  it('returns a bare extends identifier unchanged', () => {
    const result = interfaces(`
      export interface Base { a: string; }
      export interface Child extends Base {}
    `);
    const child = result.find((i) => i.name === 'Child');
    expect(child?.extendsNames).toEqual(['Base']);
  });

  it('peels Partial<Base> to Base', () => {
    const result = interfaces(`
      export interface Base { a: string; }
      export interface Child extends Partial<Base> {}
    `);
    const child = result.find((i) => i.name === 'Child');
    expect(child?.extendsNames).toEqual(['Base']);
  });

  it('peels nested Partial<MaybeMap<Omit<Base, "k">>> to Base', () => {
    const result = interfaces(`
      export interface Base { a: string; b: string; }
      export interface Child extends Partial<MaybeMap<Omit<Base, 'b'>>> {}
    `);
    const child = result.find((i) => i.name === 'Child');
    expect(child?.extendsNames).toEqual(['Base']);
  });

  it('peels Partial<MaybeMap<Omit<Base,…>>>, Pick<Base,…> to two Base entries', () => {
    const result = interfaces(`
      export interface Base { a: string; b: string; c: string; }
      export interface Child extends
        Partial<MaybeMap<Omit<Base, 'a' | 'b'>>>,
        Pick<Base, 'a' | 'b'> {}
    `);
    const child = result.find((i) => i.name === 'Child');
    expect(child?.extendsNames).toEqual(['Base', 'Base']);
  });

  it('leaves an unknown wrapper as the leftmost identifier', () => {
    const result = interfaces(`
      export interface Base { a: string; }
      export interface Child extends UnknownWrapper<Base> {}
    `);
    const child = result.find((i) => i.name === 'Child');
    expect(child?.extendsNames).toEqual(['UnknownWrapper']);
  });

  it('falls back to the wrapper name when its type argument is not a type reference', () => {
    const result = interfaces(`
      export interface Child extends Partial<{ a: string }> {}
    `);
    const child = result.find((i) => i.name === 'Child');
    expect(child?.extendsNames).toEqual(['Partial']);
  });

  it('peels Required<Readonly<NonNullable<Base>>> to Base', () => {
    const result = interfaces(`
      export interface Base { a: string; }
      export interface Child extends Required<Readonly<NonNullable<Base>>> {}
    `);
    const child = result.find((i) => i.name === 'Child');
    expect(child?.extendsNames).toEqual(['Base']);
  });
});

describe('findInterfaces() JSDoc tag parsing', () => {
  it('collects repeated @dbxModelArchetype tags into the dbxModelArchetypes array', () => {
    const result = interfaces(`
      /**
       * @dbxModel
       * @dbxModelArchetype composite-key-root
       * @dbxModelArchetype denormalised-aggregate
       */
      export interface CountryState { a: string; }
    `);
    const iface = result.find((i) => i.name === 'CountryState');
    expect(iface?.tags.dbxModelArchetypes.map((t) => t.slug)).toEqual(['composite-key-root', 'denormalised-aggregate']);
  });

  it('collects repeated @dbxModelAggregatesFrom tags into a string array', () => {
    const result = interfaces(`
      /**
       * @dbxModel
       * @dbxModelAggregatesFrom Agent
       * @dbxModelAggregatesFrom Worker
       */
      export interface AgentSummary { a: string; }
    `);
    const iface = result.find((i) => i.name === 'AgentSummary');
    expect([...iface!.tags.dbxModelAggregatesFrom]).toEqual(['Agent', 'Worker']);
  });

  it('captures @dbxModelOrganizationalGroupRoot as a boolean flag', () => {
    const result = interfaces(`
      /**
       * @dbxModel
       * @dbxModelOrganizationalGroupRoot
       */
      export interface SchoolGroup { a: string; }
    `);
    const iface = result.find((i) => i.name === 'SchoolGroup');
    expect(iface?.tags.dbxModelOrganizationalGroupRoot).toBe(true);
  });

  it('parses @dbxModelCompositeKey with concrete model list and two-way encoding', () => {
    const result = interfaces(`
      /**
       * @dbxModel
       * @dbxModelArchetype composite-key-root
       * @dbxModelCompositeKey from=SchoolGroup,Region encoding=two-way
       */
      export interface SchoolGroupRegion { a: string; }
    `);
    const iface = result.find((i) => i.name === 'SchoolGroupRegion');
    expect(iface?.tags.dbxModelCompositeKey).toEqual({ from: ['SchoolGroup', 'Region'], encoding: 'two-way' });
  });

  it('parses @dbxModelCompositeKey with from=* wildcard', () => {
    const result = interfaces(`
      /**
       * @dbxModel
       * @dbxModelArchetype composite-key-root
       * @dbxModelCompositeKey from=* encoding=two-way
       */
      export interface NotificationBox { a: string; }
    `);
    const iface = result.find((i) => i.name === 'NotificationBox');
    expect(iface?.tags.dbxModelCompositeKey).toEqual({ from: '*', encoding: 'two-way' });
  });

  it('captures a malformed @dbxModelCompositeKey for the validator to flag', () => {
    const result = interfaces(`
      /**
       * @dbxModel
       * @dbxModelCompositeKey encoding=triple-way
       */
      export interface SomeRoot { a: string; }
    `);
    const iface = result.find((i) => i.name === 'SomeRoot');
    // from defaulted to empty list, encoding undefined — validator flags both.
    expect(iface?.tags.dbxModelCompositeKey).toEqual({ from: [], encoding: undefined });
  });

  it('preserves * mixed with concrete entries so the validator can flag the mix', () => {
    const result = interfaces(`
      /**
       * @dbxModel
       * @dbxModelCompositeKey from=*,Group encoding=one-way
       */
      export interface Bad { a: string; }
    `);
    const iface = result.find((i) => i.name === 'Bad');
    expect(iface?.tags.dbxModelCompositeKey).toEqual({ from: ['*', 'Group'], encoding: 'one-way' });
  });

  it('skips invalid (non-camelCase) names on @dbxModelAggregatesFrom', () => {
    const result = interfaces(`
      /**
       * @dbxModel
       * @dbxModelAggregatesFrom lowercaseInvalid
       * @dbxModelAggregatesFrom ValidModel
       */
      export interface X { a: string; }
    `);
    const iface = result.find((i) => i.name === 'X');
    expect([...iface!.tags.dbxModelAggregatesFrom]).toEqual(['ValidModel']);
  });

  it('captures @dbxModelRead permissions', () => {
    const result = interfaces(`
      /**
       * @dbxModel
       * @dbxModelRead permissions
       */
      export interface Foo { a: string; }
    `);
    const iface = result.find((i) => i.name === 'Foo');
    expect(iface?.tags.dbxModelRead).toBe('permissions');
  });

  it('captures @dbxModelRead admin-only', () => {
    const result = interfaces(`
      /**
       * @dbxModel
       * @dbxModelRead admin-only
       */
      export interface Foo { a: string; }
    `);
    const iface = result.find((i) => i.name === 'Foo');
    expect(iface?.tags.dbxModelRead).toBe('admin-only');
  });

  it('omits dbxModelRead from the tag bag when the tag is missing', () => {
    const result = interfaces(`
      /**
       * @dbxModel
       */
      export interface Foo { a: string; }
    `);
    const iface = result.find((i) => i.name === 'Foo');
    expect(iface?.tags.dbxModelRead).toBeUndefined();
  });

  it('silently drops invalid @dbxModelRead values', () => {
    const result = interfaces(`
      /**
       * @dbxModel
       * @dbxModelRead public
       */
      export interface Foo { a: string; }
    `);
    const iface = result.find((i) => i.name === 'Foo');
    expect(iface?.tags.dbxModelRead).toBeUndefined();
  });

  it('keeps only the first @dbxModelRead when multiple are declared', () => {
    const result = interfaces(`
      /**
       * @dbxModel
       * @dbxModelRead owner
       * @dbxModelRead permissions
       */
      export interface Foo { a: string; }
    `);
    const iface = result.find((i) => i.name === 'Foo');
    expect(iface?.tags.dbxModelRead).toBe('owner');
  });
});

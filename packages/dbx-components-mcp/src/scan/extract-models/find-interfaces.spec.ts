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

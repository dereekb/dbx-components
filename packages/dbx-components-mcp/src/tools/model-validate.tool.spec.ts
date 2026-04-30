import { describe, expect, it } from 'vitest';
import { runModelValidate } from './model-validate.tool.js';

describe('dbx_model_validate', () => {
  it('returns isError when no input form is supplied', async () => {
    const result = await runModelValidate({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('at least one of');
  });

  it('returns isError for malformed sources payload', async () => {
    const result = await runModelValidate({ sources: [{ name: 'x.ts' }] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('validates a canonical source and reports PASS', async () => {
    const text = `
/**
 * @dbxModelGroup Foo
 */
export interface FooFirestoreCollections {
  fooCollection: FooFirestoreCollection;
}

export type FooTypes = typeof fooIdentity;

export const fooIdentity = firestoreModelIdentity('foo', 'fo');

/**
 * @dbxModel
 */
export interface Foo { n: string; }

export type FooRoles = 'owner';

export class FooDocument extends AbstractFirestoreDocument<Foo, FooDocument, typeof fooIdentity> {
  get modelIdentity() { return fooIdentity; }
}

export const fooConverter = snapshotConverterFunctions<Foo>({ fields: { n: firestoreString() } });

export function fooCollectionReference(context: FirestoreContext): CollectionReference<Foo> {
  return context.collection(fooIdentity.collectionName);
}

export type FooFirestoreCollection = FirestoreCollection<Foo, FooDocument>;

export function fooFirestoreCollection(firestoreContext: FirestoreContext): FooFirestoreCollection {
  return firestoreContext.firestoreCollection({ modelIdentity: fooIdentity, converter: fooConverter, collection: fooCollectionReference(firestoreContext), makeDocument: (a, b) => new FooDocument(a, b), firestoreContext });
}
`;
    const result = await runModelValidate({ sources: [{ name: 'foo.ts', text }] });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('PASS');
    expect(result.content[0].text).toContain('1 model(s)');
  });

  it('reports FAIL and lists violations for a broken source', async () => {
    const text = `
export const fooIdentity = firestoreModelIdentity('foo', 'fo');
export interface Foo { n: string; }
`;
    const result = await runModelValidate({ sources: [{ name: 'foo.ts', text }] });
    expect(result.isError).toBe(true);
    const output = result.content[0].text;
    expect(output).toContain('FAIL');
    expect(output).toContain('FILE_MISSING_GROUP_INTERFACE');
    expect(output).toContain('FILE_MISSING_GROUP_TYPES');
    expect(output).toContain('MODEL_MISSING_ROLES');
  });

  it('reports PASS WITH WARNINGS for long field names without errors', async () => {
    const text = `
/** @dbxModelGroup Foo */
export interface FooFirestoreCollections { fooCollection: FooFirestoreCollection; }
export type FooTypes = typeof fooIdentity;
export const fooIdentity = firestoreModelIdentity('foo', 'fo');
/** @dbxModel */
export interface Foo { tooLongField: string; n: string; }
export type FooRoles = 'owner';
export class FooDocument extends AbstractFirestoreDocument<Foo, FooDocument, typeof fooIdentity> { get modelIdentity() { return fooIdentity; } }
export const fooConverter = snapshotConverterFunctions<Foo>({ fields: { n: firestoreString() } });
export function fooCollectionReference(context: FirestoreContext): CollectionReference<Foo> { return context.collection(fooIdentity.collectionName); }
export type FooFirestoreCollection = FirestoreCollection<Foo, FooDocument>;
export function fooFirestoreCollection(firestoreContext: FirestoreContext): FooFirestoreCollection { return firestoreContext.firestoreCollection({ modelIdentity: fooIdentity, converter: fooConverter, collection: fooCollectionReference(firestoreContext), makeDocument: (a, b) => new FooDocument(a, b), firestoreContext }); }
`;
    const result = await runModelValidate({ sources: [{ name: 'foo.ts', text }] });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('PASS WITH WARNINGS');
    expect(result.content[0].text).toContain('MODEL_FIELD_NAME_TOO_LONG');
    expect(result.content[0].text).toContain('tooLongField');
  });
});

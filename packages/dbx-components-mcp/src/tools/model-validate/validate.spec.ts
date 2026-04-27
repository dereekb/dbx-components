import { describe, expect, it } from 'vitest';
import { validateFirebaseModelSources } from './index.js';
import type { ViolationCode } from './types.js';

function expectCodes(codes: readonly ViolationCode[], expected: readonly ViolationCode[]): void {
  for (const c of expected) {
    expect(codes, `expected code ${c} in ${JSON.stringify(codes)}`).toContain(c);
  }
}

// A canonical happy-path fixture: one root model (Profile) plus one
// subcollection model (ProfilePrivate) under the same file.
const HAPPY_SOURCE = `
import { firestoreModelIdentity, type FirestoreContext, type CollectionReference, type CollectionGroup, type FirestoreCollection, type FirestoreCollectionGroup, type SingleItemFirestoreCollection, AbstractFirestoreDocument, AbstractFirestoreDocumentWithParent, snapshotConverterFunctions, firestoreUID, firestoreString, firestoreDate } from '@dereekb/firebase';

export interface ProfileFirestoreCollections {
  profileCollection: ProfileFirestoreCollection;
  profilePrivateCollectionFactory: ProfilePrivateFirestoreCollectionFactory;
  profilePrivateCollectionGroup: ProfilePrivateFirestoreCollectionGroup;
}

export type ProfileTypes = typeof profileIdentity | typeof profilePrivateIdentity;

export const profileIdentity = firestoreModelIdentity('profile', 'pr');

export interface Profile {
  uid: string;
  n: string;
}

export type ProfileRoles = 'owner';

export class ProfileDocument extends AbstractFirestoreDocument<Profile, ProfileDocument, typeof profileIdentity> {
  get modelIdentity() {
    return profileIdentity;
  }
}

export const profileConverter = snapshotConverterFunctions<Profile>({
  fields: {
    uid: firestoreUID(),
    n: firestoreString()
  }
});

export function profileCollectionReference(context: FirestoreContext): CollectionReference<Profile> {
  return context.collection(profileIdentity.collectionName);
}

export type ProfileFirestoreCollection = FirestoreCollection<Profile, ProfileDocument>;

export function profileFirestoreCollection(firestoreContext: FirestoreContext): ProfileFirestoreCollection {
  return firestoreContext.firestoreCollection({
    modelIdentity: profileIdentity,
    converter: profileConverter,
    collection: profileCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new ProfileDocument(accessor, documentAccessor),
    firestoreContext
  });
}

export const profilePrivateIdentity = firestoreModelIdentity(profileIdentity, 'profilePrivate', 'prp');

export interface ProfilePrivate {
  cat: Date;
}

export type ProfilePrivateRoles = 'owner';

export class ProfilePrivateDocument extends AbstractFirestoreDocumentWithParent<Profile, ProfilePrivate, ProfilePrivateDocument, typeof profilePrivateIdentity> {
  get modelIdentity() {
    return profilePrivateIdentity;
  }
}

export const profilePrivateConverter = snapshotConverterFunctions<ProfilePrivate>({
  fields: {
    cat: firestoreDate()
  }
});

export function profilePrivateCollectionReferenceFactory(context: FirestoreContext): (profile: ProfileDocument) => CollectionReference<ProfilePrivate> {
  return (profile: ProfileDocument) => context.subcollection(profile.documentRef, profilePrivateIdentity.collectionName);
}

export type ProfilePrivateFirestoreCollection = SingleItemFirestoreCollection<ProfilePrivate, Profile, ProfilePrivateDocument, ProfileDocument>;
export type ProfilePrivateFirestoreCollectionFactory = (parent: ProfileDocument) => ProfilePrivateFirestoreCollection;

export function profilePrivateFirestoreCollectionFactory(firestoreContext: FirestoreContext): ProfilePrivateFirestoreCollectionFactory {
  const factory = profilePrivateCollectionReferenceFactory(firestoreContext);
  return (parent: ProfileDocument) => firestoreContext.singleItemFirestoreCollection({
    modelIdentity: profilePrivateIdentity,
    converter: profilePrivateConverter,
    collection: factory(parent),
    makeDocument: (accessor, documentAccessor) => new ProfilePrivateDocument(accessor, documentAccessor),
    firestoreContext,
    parent
  });
}

export function profilePrivateCollectionReference(context: FirestoreContext): CollectionGroup<ProfilePrivate> {
  return context.collectionGroup(profilePrivateIdentity.collectionName);
}

export type ProfilePrivateFirestoreCollectionGroup = FirestoreCollectionGroup<ProfilePrivate, ProfilePrivateDocument>;

export function profilePrivateFirestoreCollectionGroup(firestoreContext: FirestoreContext): ProfilePrivateFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    modelIdentity: profilePrivateIdentity,
    converter: profilePrivateConverter,
    queryLike: profilePrivateCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new ProfilePrivateDocument(accessor, documentAccessor),
    firestoreContext
  });
}
`;

describe('validateFirebaseModelSources', () => {
  it('has zero errors for a canonical root + subcollection file (warnings OK — fixture lacks JSDocs)', () => {
    const result = validateFirebaseModelSources([{ name: 'profile.ts', text: HAPPY_SOURCE }]);
    expect(result.filesChecked).toBe(1);
    expect(result.modelsChecked).toBe(2);
    expect(
      result.errorCount,
      JSON.stringify(
        result.violations.filter((v) => v.severity === 'error'),
        null,
        2
      )
    ).toBe(0);
  });

  it('skips files with no firestoreModelIdentity calls', () => {
    const result = validateFirebaseModelSources([{ name: 'helpers.ts', text: 'export const foo = 1;' }]);
    expect(result.filesChecked).toBe(1);
    expect(result.modelsChecked).toBe(0);
    expect(result.violations).toHaveLength(0);
  });

  it('flags a missing group interface', () => {
    const text = HAPPY_SOURCE.replace(/export interface ProfileFirestoreCollections[\s\S]*?^}/m, '');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['FILE_MISSING_GROUP_INTERFACE']
    );
  });

  it('flags a missing group types union', () => {
    const text = HAPPY_SOURCE.replace(/export type ProfileTypes = .*;/, '');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['FILE_MISSING_GROUP_TYPES']
    );
  });

  it('flags an identity missing from the types union', () => {
    const text = HAPPY_SOURCE.replace('export type ProfileTypes = typeof profileIdentity | typeof profilePrivateIdentity;', 'export type ProfileTypes = typeof profileIdentity;');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
    const codes = result.violations.map((v) => v.code);
    expectCodes(codes, ['FILE_GROUP_TYPES_MISSING_IDENTITY']);
  });

  it('flags a group interface declared after the first model', () => {
    const text = HAPPY_SOURCE.replace(/export interface ProfileFirestoreCollections \{[\s\S]*?\n\}\n\n/, '').replace(
      'export function profilePrivateFirestoreCollectionGroup(firestoreContext: FirestoreContext): ProfilePrivateFirestoreCollectionGroup {',
      'export interface ProfileFirestoreCollections {\n  profileCollection: ProfileFirestoreCollection;\n  profilePrivateCollectionFactory: ProfilePrivateFirestoreCollectionFactory;\n  profilePrivateCollectionGroup: ProfilePrivateFirestoreCollectionGroup;\n}\n\nexport function profilePrivateFirestoreCollectionGroup(firestoreContext: FirestoreContext): ProfilePrivateFirestoreCollectionGroup {'
    );
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['FILE_GROUP_INTERFACE_AFTER_MODEL']
    );
  });

  it('flags an un-exported identity', () => {
    const text = HAPPY_SOURCE.replace("export const profileIdentity = firestoreModelIdentity('profile', 'pr');", "const profileIdentity = firestoreModelIdentity('profile', 'pr');");
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['MODEL_IDENTITY_NOT_EXPORTED']
    );
  });

  it('flags a missing roles type', () => {
    const text = HAPPY_SOURCE.replace("export type ProfileRoles = 'owner';", '');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['MODEL_MISSING_ROLES']
    );
  });

  it('flags a document class with the wrong base', () => {
    const text = HAPPY_SOURCE.replace('export class ProfileDocument extends AbstractFirestoreDocument<Profile, ProfileDocument, typeof profileIdentity>', 'export class ProfileDocument extends AbstractFirestoreDocumentWithParent<Profile, Profile, ProfileDocument, typeof profileIdentity>');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['MODEL_DOCUMENT_WRONG_BASE_CLASS']
    );
  });

  it('flags a document class with the wrong modelIdentity return', () => {
    const text = HAPPY_SOURCE.replace(/get modelIdentity\(\) \{\s*return profileIdentity;\s*\}/, 'get modelIdentity() {\n    return profilePrivateIdentity;\n  }');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['MODEL_DOCUMENT_WRONG_IDENTITY_GETTER']
    );
  });

  it('flags a wrong root collection type generic', () => {
    const text = HAPPY_SOURCE.replace('export type ProfileFirestoreCollection = FirestoreCollection<Profile, ProfileDocument>;', 'export type ProfileFirestoreCollection = FirestoreCollection<Profile>;');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['MODEL_COLLECTION_TYPE_WRONG_GENERIC']
    );
  });

  it('flags a subcollection missing the collection-group triple', () => {
    const text = HAPPY_SOURCE.replace(/export function profilePrivateCollectionReference\(context: FirestoreContext\): CollectionGroup<ProfilePrivate> \{[\s\S]*?^}/m, '')
      .replace('export type ProfilePrivateFirestoreCollectionGroup = FirestoreCollectionGroup<ProfilePrivate, ProfilePrivateDocument>;', '')
      .replace(/export function profilePrivateFirestoreCollectionGroup\(firestoreContext: FirestoreContext\): ProfilePrivateFirestoreCollectionGroup \{[\s\S]*?^}/m, '');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
    const codes = result.violations.map((v) => v.code);
    expectCodes(codes, ['SUB_MISSING_COLLECTION_GROUP_REFERENCE', 'SUB_MISSING_COLLECTION_GROUP_TYPE', 'SUB_MISSING_COLLECTION_GROUP_FN']);
  });

  it('warns when a field has no JSDoc comment', () => {
    const result = validateFirebaseModelSources([{ name: 'x.ts', text: HAPPY_SOURCE }]);
    const missing = result.violations.filter((v) => v.code === 'MODEL_FIELD_MISSING_JSDOC');
    expect(missing.length).toBeGreaterThan(0);
    expect(missing[0].severity).toBe('warning');
  });

  it('does not warn when JSDoc first line has `FullName -- description`', () => {
    const withFullName = HAPPY_SOURCE.replace('export interface Profile {\n  uid: string;\n  n: string;\n}', 'export interface Profile {\n  /** Uid -- the user auth UID. */\n  uid: string;\n  /** Name -- the user display name. */\n  n: string;\n}');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text: withFullName }]);
    const profileFields = result.violations.filter((v) => (v.code === 'MODEL_FIELD_MISSING_JSDOC' || v.code === 'MODEL_FIELD_JSDOC_NO_FULL_NAME') && v.model === 'Profile');
    expect(profileFields).toHaveLength(0);
  });

  it('warns when a JSDoc is present but the first line lacks a full name', () => {
    const noFullName = HAPPY_SOURCE.replace('export interface Profile {\n  uid: string;\n  n: string;\n}', 'export interface Profile {\n  /** the user auth UID. */\n  uid: string;\n  /** Name -- ok. */\n  n: string;\n}');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text: noFullName }]);
    const badFormat = result.violations.filter((v) => v.code === 'MODEL_FIELD_JSDOC_NO_FULL_NAME' && v.message.includes('`uid`'));
    expect(badFormat).toHaveLength(1);
    expect(badFormat[0].severity).toBe('warning');
  });

  it('accepts all supported separators (`--`, em dash, en dash, `-`, `:`)', () => {
    const variants = ['export interface Profile {\n  /** Uid -- the user auth UID. */\n  uid: string;\n  /** Name — the user display name. */\n  n: string;\n}', 'export interface Profile {\n  /** Uid – the user auth UID. */\n  uid: string;\n  /** Name: the user display name. */\n  n: string;\n}', 'export interface Profile {\n  /** Uid - the user auth UID. */\n  uid: string;\n  /** Name -- the user display name. */\n  n: string;\n}'];
    for (const replacement of variants) {
      const text = HAPPY_SOURCE.replace('export interface Profile {\n  uid: string;\n  n: string;\n}', replacement);
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const profileIssues = result.violations.filter((v) => (v.code === 'MODEL_FIELD_MISSING_JSDOC' || v.code === 'MODEL_FIELD_JSDOC_NO_FULL_NAME') && v.model === 'Profile');
      expect(profileIssues, `variant: ${replacement}`).toHaveLength(0);
    }
  });

  it('warns on interface field names longer than 4 characters', () => {
    const text = HAPPY_SOURCE.replace('export interface Profile {\n  uid: string;\n  n: string;\n}', 'export interface Profile {\n  uid: string;\n  n: string;\n  tooLong: string;\n}');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
    expect(result.errorCount).toBe(0);
    const nameWarnings = result.violations.filter((v) => v.code === 'MODEL_FIELD_NAME_TOO_LONG');
    expect(nameWarnings).toHaveLength(1);
    expect(nameWarnings[0].severity).toBe('warning');
    expect(nameWarnings[0].message).toContain('tooLong');
    expect(nameWarnings[0].message).toContain('Profile');
  });

  it('does not warn on fields with names of exactly 4 characters', () => {
    const text = HAPPY_SOURCE.replace('export interface Profile {\n  uid: string;\n  n: string;\n}', 'export interface Profile {\n  uid: string;\n  n: string;\n  user: string;\n}');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
    const nameWarnings = result.violations.filter((v) => v.code === 'MODEL_FIELD_NAME_TOO_LONG');
    expect(nameWarnings).toHaveLength(0);
  });

  it('flags out-of-order declarations', () => {
    const text = HAPPY_SOURCE.replace("export type ProfileRoles = 'owner';", '').replace('export const profileConverter = snapshotConverterFunctions<Profile>({', "export type ProfileRoles = 'owner';\n\nexport const profileConverter = snapshotConverterFunctions<Profile>({");
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['MODEL_OUT_OF_ORDER']
    );
  });
});

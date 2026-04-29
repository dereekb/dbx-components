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

  // Multi-item subcollection mirrors the canonical NotificationWeek-under-NotificationBox
  // pattern: typed as `FirestoreCollectionWithParent`, factory body calls
  // `firestoreContext.firestoreCollectionWithParent({...})`.
  const MULTI_ITEM_SOURCE = `
import { firestoreModelIdentity, type FirestoreContext, type CollectionReference, type CollectionGroup, type FirestoreCollection, type FirestoreCollectionGroup, type FirestoreCollectionWithParent, AbstractFirestoreDocument, AbstractFirestoreDocumentWithParent, snapshotConverterFunctions, firestoreUID, firestoreString, firestoreDate } from '@dereekb/firebase';

export interface JobFirestoreCollections {
  jobCollection: JobFirestoreCollection;
  jobApplicationCollectionFactory: JobApplicationFirestoreCollectionFactory;
  jobApplicationCollectionGroup: JobApplicationFirestoreCollectionGroup;
}

export type JobTypes = typeof jobIdentity | typeof jobApplicationIdentity;

export const jobIdentity = firestoreModelIdentity('job', 'j');

export interface Job {
  uid: string;
  n: string;
}

export type JobRoles = 'owner';

export class JobDocument extends AbstractFirestoreDocument<Job, JobDocument, typeof jobIdentity> {
  get modelIdentity() {
    return jobIdentity;
  }
}

export const jobConverter = snapshotConverterFunctions<Job>({
  fields: {
    uid: firestoreUID(),
    n: firestoreString()
  }
});

export function jobCollectionReference(context: FirestoreContext): CollectionReference<Job> {
  return context.collection(jobIdentity.collectionName);
}

export type JobFirestoreCollection = FirestoreCollection<Job, JobDocument>;

export function jobFirestoreCollection(firestoreContext: FirestoreContext): JobFirestoreCollection {
  return firestoreContext.firestoreCollection({
    modelIdentity: jobIdentity,
    converter: jobConverter,
    collection: jobCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new JobDocument(accessor, documentAccessor),
    firestoreContext
  });
}

export const jobApplicationIdentity = firestoreModelIdentity(jobIdentity, 'jobApplication', 'ja');

export interface JobApplication {
  cat: Date;
}

export type JobApplicationRoles = 'owner';

export class JobApplicationDocument extends AbstractFirestoreDocumentWithParent<Job, JobApplication, JobApplicationDocument, typeof jobApplicationIdentity> {
  get modelIdentity() {
    return jobApplicationIdentity;
  }
}

export const jobApplicationConverter = snapshotConverterFunctions<JobApplication>({
  fields: {
    cat: firestoreDate()
  }
});

export function jobApplicationCollectionReferenceFactory(context: FirestoreContext): (job: JobDocument) => CollectionReference<JobApplication> {
  return (job: JobDocument) => context.subcollection(job.documentRef, jobApplicationIdentity.collectionName);
}

export type JobApplicationFirestoreCollection = FirestoreCollectionWithParent<JobApplication, Job, JobApplicationDocument, JobDocument>;
export type JobApplicationFirestoreCollectionFactory = (parent: JobDocument) => JobApplicationFirestoreCollection;

export function jobApplicationFirestoreCollectionFactory(firestoreContext: FirestoreContext): JobApplicationFirestoreCollectionFactory {
  const factory = jobApplicationCollectionReferenceFactory(firestoreContext);
  return (parent: JobDocument) => firestoreContext.firestoreCollectionWithParent({
    modelIdentity: jobApplicationIdentity,
    converter: jobApplicationConverter,
    collection: factory(parent),
    makeDocument: (accessor, documentAccessor) => new JobApplicationDocument(accessor, documentAccessor),
    firestoreContext,
    parent
  });
}

export function jobApplicationCollectionReference(context: FirestoreContext): CollectionGroup<JobApplication> {
  return context.collectionGroup(jobApplicationIdentity.collectionName);
}

export type JobApplicationFirestoreCollectionGroup = FirestoreCollectionGroup<JobApplication, JobApplicationDocument>;

export function jobApplicationFirestoreCollectionGroup(firestoreContext: FirestoreContext): JobApplicationFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    modelIdentity: jobApplicationIdentity,
    converter: jobApplicationConverter,
    queryLike: jobApplicationCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new JobApplicationDocument(accessor, documentAccessor),
    firestoreContext
  });
}
`;

  it('passes a multi-item subcollection (FirestoreCollectionWithParent + firestoreCollectionWithParent)', () => {
    const result = validateFirebaseModelSources([{ name: 'job.ts', text: MULTI_ITEM_SOURCE }]);
    expect(
      result.errorCount,
      JSON.stringify(
        result.violations.filter((v) => v.severity === 'error'),
        null,
        2
      )
    ).toBe(0);
    expect(result.modelsChecked).toBe(2);
  });

  it('flags MODEL_COLLECTION_FACTORY_TYPE_MISMATCH when alias is SingleItem but factory body uses firestoreCollectionWithParent', () => {
    const text = MULTI_ITEM_SOURCE.replace('export type JobApplicationFirestoreCollection = FirestoreCollectionWithParent<JobApplication, Job, JobApplicationDocument, JobDocument>;', 'export type JobApplicationFirestoreCollection = SingleItemFirestoreCollection<JobApplication, Job, JobApplicationDocument, JobDocument>;');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
    const codes = result.violations.map((v) => v.code);
    expectCodes(codes, ['MODEL_COLLECTION_FACTORY_TYPE_MISMATCH']);
    expect(codes).not.toContain('MODEL_COLLECTION_TYPE_WRONG_GENERIC');
  });

  it('flags MODEL_COLLECTION_FACTORY_TYPE_MISMATCH when alias is FirestoreCollectionWithParent but factory body uses singleItemFirestoreCollection', () => {
    const text = HAPPY_SOURCE.replace('export type ProfilePrivateFirestoreCollection = SingleItemFirestoreCollection<ProfilePrivate, Profile, ProfilePrivateDocument, ProfileDocument>;', 'export type ProfilePrivateFirestoreCollection = FirestoreCollectionWithParent<ProfilePrivate, Profile, ProfilePrivateDocument, ProfileDocument>;');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
    const codes = result.violations.map((v) => v.code);
    expectCodes(codes, ['MODEL_COLLECTION_FACTORY_TYPE_MISMATCH']);
    expect(codes).not.toContain('MODEL_COLLECTION_TYPE_WRONG_GENERIC');
  });

  // Root-singleton mirrors the canonical AgentSummary pattern in
  // hellosubs-firebase: typed as `RootSingleItemFirestoreCollection<T, D>`,
  // factory body calls `firestoreContext.rootSingleItemFirestoreCollection({...})`.
  const ROOT_SINGLETON_SOURCE = `
import { firestoreModelIdentity, type FirestoreContext, type CollectionReference, type RootSingleItemFirestoreCollection, AbstractFirestoreDocument, snapshotConverterFunctions, firestoreString } from '@dereekb/firebase';

export interface AgentSummaryFirestoreCollections {
  agentSummaryCollection: AgentSummaryFirestoreCollection;
}

export type AgentSummaryTypes = typeof agentSummaryIdentity;

export const agentSummaryIdentity = firestoreModelIdentity('agentSummary', 'ags');

export interface AgentSummary {
  n: string;
}

export type AgentSummaryRoles = 'owner';

export class AgentSummaryDocument extends AbstractFirestoreDocument<AgentSummary, AgentSummaryDocument, typeof agentSummaryIdentity> {
  get modelIdentity() {
    return agentSummaryIdentity;
  }
}

export const agentSummaryConverter = snapshotConverterFunctions<AgentSummary>({
  fields: {
    n: firestoreString()
  }
});

export function agentSummaryCollectionReference(context: FirestoreContext): CollectionReference<AgentSummary> {
  return context.collection(agentSummaryIdentity.collectionName);
}

export type AgentSummaryFirestoreCollection = RootSingleItemFirestoreCollection<AgentSummary, AgentSummaryDocument>;

export function agentSummaryFirestoreCollection(firestoreContext: FirestoreContext): AgentSummaryFirestoreCollection {
  return firestoreContext.rootSingleItemFirestoreCollection({
    modelIdentity: agentSummaryIdentity,
    converter: agentSummaryConverter,
    collection: agentSummaryCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new AgentSummaryDocument(accessor, documentAccessor),
    firestoreContext
  }) as AgentSummaryFirestoreCollection;
}
`;

  it('passes a root-singleton collection (RootSingleItemFirestoreCollection + rootSingleItemFirestoreCollection)', () => {
    const result = validateFirebaseModelSources([{ name: 'agent-summary.ts', text: ROOT_SINGLETON_SOURCE }]);
    expect(
      result.errorCount,
      JSON.stringify(
        result.violations.filter((v) => v.severity === 'error'),
        null,
        2
      )
    ).toBe(0);
    expect(result.modelsChecked).toBe(1);
  });

  it('flags MODEL_COLLECTION_FACTORY_TYPE_MISMATCH when root alias is RootSingleItem but factory body uses firestoreCollection', () => {
    const text = ROOT_SINGLETON_SOURCE.replace('return firestoreContext.rootSingleItemFirestoreCollection({', 'return firestoreContext.firestoreCollection({');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
    const codes = result.violations.map((v) => v.code);
    expectCodes(codes, ['MODEL_COLLECTION_FACTORY_TYPE_MISMATCH']);
    expect(codes).not.toContain('MODEL_COLLECTION_TYPE_WRONG_GENERIC');
  });

  it('flags MODEL_COLLECTION_FACTORY_TYPE_MISMATCH when a root model declares a subcollection alias', () => {
    const text = ROOT_SINGLETON_SOURCE.replace('export type AgentSummaryFirestoreCollection = RootSingleItemFirestoreCollection<AgentSummary, AgentSummaryDocument>;', 'export type AgentSummaryFirestoreCollection = SingleItemFirestoreCollection<AgentSummary, Parent, AgentSummaryDocument, ParentDocument>;');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
    const codes = result.violations.map((v) => v.code);
    expectCodes(codes, ['MODEL_COLLECTION_FACTORY_TYPE_MISMATCH']);
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

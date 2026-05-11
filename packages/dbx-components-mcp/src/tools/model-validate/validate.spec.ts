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

/**
 * @dbxModelGroup Profile
 */
export interface ProfileFirestoreCollections {
  profileCollection: ProfileFirestoreCollection;
  profilePrivateCollectionFactory: ProfilePrivateFirestoreCollectionFactory;
  profilePrivateCollectionGroup: ProfilePrivateFirestoreCollectionGroup;
}

export type ProfileTypes = typeof profileIdentity | typeof profilePrivateIdentity;

export const profileIdentity = firestoreModelIdentity('profile', 'pr');

/**
 * @dbxModel
 */
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

/**
 * @dbxModel
 */
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

  it('warns when a field has no JSDoc description', () => {
    const result = validateFirebaseModelSources([{ name: 'x.ts', text: HAPPY_SOURCE }]);
    const missing = result.violations.filter((v) => v.code === 'MODEL_FIELD_MISSING_JSDOC');
    expect(missing.length).toBeGreaterThan(0);
    expect(missing[0].severity).toBe('warning');
  });

  it('does not warn MODEL_FIELD_MISSING_JSDOC when each field has a JSDoc description', () => {
    const withDocs = HAPPY_SOURCE.replace('export interface Profile {\n  uid: string;\n  n: string;\n}', 'export interface Profile {\n  /** the user auth UID. */\n  uid: string;\n  /** the user display name. */\n  n: string;\n}');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text: withDocs }]);
    const profileFields = result.violations.filter((v) => v.code === 'MODEL_FIELD_MISSING_JSDOC' && v.model === 'Profile');
    expect(profileFields).toHaveLength(0);
  });

  it('does not require a `<FullName> -- <description>` JSDoc opener', () => {
    const freeFormDocs = HAPPY_SOURCE.replace('export interface Profile {\n  uid: string;\n  n: string;\n}', 'export interface Profile {\n  /** the user auth UID. */\n  uid: string;\n  /** the user display name. */\n  n: string;\n}');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text: freeFormDocs }]);
    const fullNameWarnings = result.violations.filter((v) => (v.code as string) === 'MODEL_FIELD_JSDOC_NO_FULL_NAME');
    expect(fullNameWarnings).toHaveLength(0);
  });

  it('warns on interface field names longer than the default limit (5)', () => {
    const text = HAPPY_SOURCE.replace('export interface Profile {\n  uid: string;\n  n: string;\n}', 'export interface Profile {\n  uid: string;\n  n: string;\n  tooLong: string;\n}');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
    expect(result.errorCount).toBe(0);
    const nameWarnings = result.violations.filter((v) => v.code === 'MODEL_FIELD_NAME_TOO_LONG');
    expect(nameWarnings).toHaveLength(1);
    expect(nameWarnings[0].severity).toBe('warning');
    expect(nameWarnings[0].message).toContain('tooLong');
    expect(nameWarnings[0].message).toContain('Profile');
    expect(nameWarnings[0].message).toContain('limit 5');
  });

  it('does not warn on fields with names of exactly 5 characters', () => {
    const text = HAPPY_SOURCE.replace('export interface Profile {\n  uid: string;\n  n: string;\n}', 'export interface Profile {\n  uid: string;\n  n: string;\n  cuid: string;\n  email: string;\n}');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
    const nameWarnings = result.violations.filter((v) => v.code === 'MODEL_FIELD_NAME_TOO_LONG');
    expect(nameWarnings).toHaveLength(0);
  });

  it('honors maxFieldNameLength override (limit lowered to 3 makes `user` warn)', () => {
    const text = HAPPY_SOURCE.replace('export interface Profile {\n  uid: string;\n  n: string;\n}', 'export interface Profile {\n  uid: string;\n  n: string;\n  user: string;\n}');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }], { maxFieldNameLength: 3 });
    const nameWarnings = result.violations.filter((v) => v.code === 'MODEL_FIELD_NAME_TOO_LONG');
    expect(nameWarnings).toHaveLength(1);
    expect(nameWarnings[0].message).toContain('user');
    expect(nameWarnings[0].message).toContain('limit 3');
  });

  it('honors maxFieldNameLength override (limit raised to 8 makes `tooLong` pass)', () => {
    const text = HAPPY_SOURCE.replace('export interface Profile {\n  uid: string;\n  n: string;\n}', 'export interface Profile {\n  uid: string;\n  n: string;\n  tooLong: string;\n}');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }], { maxFieldNameLength: 8 });
    const nameWarnings = result.violations.filter((v) => v.code === 'MODEL_FIELD_NAME_TOO_LONG');
    expect(nameWarnings).toHaveLength(0);
  });

  it('honors ignoredFieldNames — exempts a long name despite default limit', () => {
    const text = HAPPY_SOURCE.replace('export interface Profile {\n  uid: string;\n  n: string;\n}', 'export interface Profile {\n  uid: string;\n  n: string;\n  tooLong: string;\n}');
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }], { ignoredFieldNames: new Set(['tooLong']) });
    const nameWarnings = result.violations.filter((v) => v.code === 'MODEL_FIELD_NAME_TOO_LONG');
    expect(nameWarnings).toHaveLength(0);
  });

  // Multi-item subcollection mirrors the canonical NotificationWeek-under-NotificationBox
  // pattern: typed as `FirestoreCollectionWithParent`, factory body calls
  // `firestoreContext.firestoreCollectionWithParent({...})`.
  const MULTI_ITEM_SOURCE = `
import { firestoreModelIdentity, type FirestoreContext, type CollectionReference, type CollectionGroup, type FirestoreCollection, type FirestoreCollectionGroup, type FirestoreCollectionWithParent, AbstractFirestoreDocument, AbstractFirestoreDocumentWithParent, snapshotConverterFunctions, firestoreUID, firestoreString, firestoreDate } from '@dereekb/firebase';

/**
 * @dbxModelGroup Job
 */
export interface JobFirestoreCollections {
  jobCollection: JobFirestoreCollection;
  jobApplicationCollectionFactory: JobApplicationFirestoreCollectionFactory;
  jobApplicationCollectionGroup: JobApplicationFirestoreCollectionGroup;
}

export type JobTypes = typeof jobIdentity | typeof jobApplicationIdentity;

export const jobIdentity = firestoreModelIdentity('job', 'j');

/**
 * @dbxModel
 */
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

/**
 * @dbxModel
 */
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

/**
 * @dbxModelGroup AgentSummary
 */
export interface AgentSummaryFirestoreCollections {
  agentSummaryCollection: AgentSummaryFirestoreCollection;
}

export type AgentSummaryTypes = typeof agentSummaryIdentity;

export const agentSummaryIdentity = firestoreModelIdentity('agentSummary', 'ags');

/**
 * @dbxModel
 */
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

  it('auto-attaches remediation hints from the rule catalog', () => {
    const text = HAPPY_SOURCE.replace("export type ProfileRoles = 'owner';", "type ProfileRoles = 'owner';");
    const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
    const v = result.violations.find((violation) => violation.code === 'MODEL_ROLES_NOT_EXPORTED');
    expect(v).toBeDefined();
    expect(v?.remediation).toBeDefined();
    expect(v?.remediation?.fix).toBeTruthy();
  });

  // MARK: JSDoc tag rules
  describe('JSDoc tag rules', () => {
    it('flags MODEL_GROUP_INTERFACE_MISSING_TAG when the group container has no `@dbxModelGroup`', () => {
      const text = HAPPY_SOURCE.replace('/**\n * @dbxModelGroup Profile\n */\n', '');
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const codes = result.violations.map((v) => v.code);
      expectCodes(codes, ['MODEL_GROUP_INTERFACE_MISSING_TAG']);
    });

    it('flags MODEL_INTERFACE_MISSING_TAG and MODEL_IDENTITY_NOT_TAGGED when a model interface lacks `@dbxModel`', () => {
      const text = HAPPY_SOURCE.replace('/**\n * @dbxModel\n */\nexport interface Profile {', 'export interface Profile {');
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const codes = result.violations.map((v) => v.code);
      expectCodes(codes, ['MODEL_INTERFACE_MISSING_TAG', 'MODEL_IDENTITY_NOT_TAGGED']);
      const identityErr = result.violations.find((v) => v.code === 'MODEL_IDENTITY_NOT_TAGGED');
      expect(identityErr?.message).toContain('profileIdentity');
      expect(identityErr?.message).toContain('Profile');
    });

    it('anchors MODEL_IDENTITY_NOT_TAGGED at the firestoreModelIdentity line, not the interface line', () => {
      const text = HAPPY_SOURCE.replace('/**\n * @dbxModel\n */\nexport interface Profile {', 'export interface Profile {');
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const identityErr = result.violations.find((v) => v.code === 'MODEL_IDENTITY_NOT_TAGGED');
      const interfaceErr = result.violations.find((v) => v.code === 'MODEL_INTERFACE_MISSING_TAG');
      expect(identityErr?.line).toBeDefined();
      expect(interfaceErr?.line).toBeDefined();
      // Identity line is the `export const profileIdentity` line; the interface line is below it.
      expect(identityErr!.line!).toBeLessThan(interfaceErr!.line!);
    });

    it('emits both errors when both Profile and ProfilePrivate are untagged', () => {
      const text = HAPPY_SOURCE.replace('/**\n * @dbxModel\n */\nexport interface Profile {', 'export interface Profile {').replace('/**\n * @dbxModel\n */\nexport interface ProfilePrivate {', 'export interface ProfilePrivate {');
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const identityErrs = result.violations.filter((v) => v.code === 'MODEL_IDENTITY_NOT_TAGGED');
      expect(identityErrs).toHaveLength(2);
      const models = identityErrs.map((v) => v.model).sort((a, b) => (a ?? '').localeCompare(b ?? ''));
      expect(models).toEqual(['Profile', 'ProfilePrivate']);
    });

    it('warns MODEL_FIELD_MISSING_VARIABLE_TAG on tagged-interface fields without `@dbxModelVariable`', () => {
      const result = validateFirebaseModelSources([{ name: 'x.ts', text: HAPPY_SOURCE }]);
      const tagWarnings = result.violations.filter((v) => v.code === 'MODEL_FIELD_MISSING_VARIABLE_TAG');
      expect(tagWarnings.length).toBeGreaterThan(0);
      expect(tagWarnings[0].severity).toBe('warning');
    });

    it('does not warn MODEL_FIELD_MISSING_VARIABLE_TAG when the parent interface lacks `@dbxModel`', () => {
      const text = HAPPY_SOURCE.replace('/**\n * @dbxModel\n */\nexport interface Profile {', 'export interface Profile {');
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const profileTagWarnings = result.violations.filter((v) => v.code === 'MODEL_FIELD_MISSING_VARIABLE_TAG' && v.model === 'Profile');
      expect(profileTagWarnings).toHaveLength(0);
    });

    it('passes when every field on a tagged interface has `@dbxModelVariable`', () => {
      const text = HAPPY_SOURCE.replace('export interface Profile {\n  uid: string;\n  n: string;\n}', 'export interface Profile {\n  /** @dbxModelVariable userUid */\n  uid: string;\n  /** @dbxModelVariable name */\n  n: string;\n}');
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const profileTagWarnings = result.violations.filter((v) => v.code === 'MODEL_FIELD_MISSING_VARIABLE_TAG' && v.model === 'Profile');
      expect(profileTagWarnings).toHaveLength(0);
    });

    it('warns MODEL_FIELD_LONG_NAME_EQUALS_NAME when `@dbxModelVariable` value equals the field name', () => {
      const text = HAPPY_SOURCE.replace('export interface Profile {\n  uid: string;\n  n: string;\n}', 'export interface Profile {\n  /** @dbxModelVariable uid */\n  uid: string;\n  /** @dbxModelVariable n */\n  n: string;\n}');
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const equalsWarnings = result.violations.filter((v) => v.code === 'MODEL_FIELD_LONG_NAME_EQUALS_NAME' && v.model === 'Profile');
      expect(equalsWarnings.map((v) => v.severity)).toEqual(['warning', 'warning']);
      expect(equalsWarnings.map((v) => v.message)).toEqual(expect.arrayContaining([expect.stringContaining('`uid`'), expect.stringContaining('`n`')]));
    });

    it('does not warn MODEL_FIELD_LONG_NAME_EQUALS_NAME when the long name differs from the field name', () => {
      const text = HAPPY_SOURCE.replace('export interface Profile {\n  uid: string;\n  n: string;\n}', 'export interface Profile {\n  /** @dbxModelVariable userUid */\n  uid: string;\n  /** @dbxModelVariable name */\n  n: string;\n}');
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const equalsWarnings = result.violations.filter((v) => v.code === 'MODEL_FIELD_LONG_NAME_EQUALS_NAME');
      expect(equalsWarnings).toHaveLength(0);
    });

    it('does not warn MODEL_FIELD_LONG_NAME_EQUALS_NAME when the field is in `ignoredFieldNames`', () => {
      const text = HAPPY_SOURCE.replace('export interface Profile {\n  uid: string;\n  n: string;\n}', 'export interface Profile {\n  /** @dbxModelVariable uid */\n  uid: string;\n  /** @dbxModelVariable name */\n  n: string;\n}');
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }], { ignoredFieldNames: new Set(['uid']) });
      const equalsWarnings = result.violations.filter((v) => v.code === 'MODEL_FIELD_LONG_NAME_EQUALS_NAME');
      expect(equalsWarnings).toHaveLength(0);
    });

    it('does not warn MODEL_FIELD_LONG_NAME_EQUALS_NAME when the parent interface lacks `@dbxModel`', () => {
      const text = HAPPY_SOURCE.replace('/**\n * @dbxModel\n */\nexport interface Profile {', 'export interface Profile {').replace('export interface Profile {\n  uid: string;\n  n: string;\n}', 'export interface Profile {\n  /** @dbxModelVariable uid */\n  uid: string;\n  /** @dbxModelVariable n */\n  n: string;\n}');
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const equalsWarnings = result.violations.filter((v) => v.code === 'MODEL_FIELD_LONG_NAME_EQUALS_NAME' && v.model === 'Profile');
      expect(equalsWarnings).toHaveLength(0);
    });
  });

  // MARK: @dbxModelSubObject embedded sub-object interfaces
  describe('@dbxModelSubObject', () => {
    const SUB_OBJECT_UNTAGGED = `\n/**\n * Embedded sub-object — fields lack @dbxModelVariable on purpose.\n */\nexport interface ProfileEmbeddedSubItem {\n  a: string;\n  bb: string;\n}\n`;
    const SUB_OBJECT_TAGGED = `\n/**\n * Embedded sub-object — fields lack @dbxModelVariable on purpose.\n *\n * @dbxModelSubObject\n */\nexport interface ProfileEmbeddedSubItem {\n  a: string;\n  bb: string;\n}\n`;

    it('warns MODEL_FIELD_MISSING_VARIABLE_TAG on `@dbxModelSubObject` interface fields lacking `@dbxModelVariable`', () => {
      const text = HAPPY_SOURCE + SUB_OBJECT_TAGGED;
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const subWarnings = result.violations.filter((v) => v.code === 'MODEL_FIELD_MISSING_VARIABLE_TAG' && v.model === 'ProfileEmbeddedSubItem');
      expect(subWarnings.map((v) => v.severity)).toEqual(['warning', 'warning']);
      expect(subWarnings.map((v) => v.message)).toEqual(expect.arrayContaining([expect.stringContaining('`a`'), expect.stringContaining('`bb`')]));
    });

    it('warns MODEL_FIELD_LONG_NAME_EQUALS_NAME on `@dbxModelSubObject` interface fields whose long name equals the short name', () => {
      const text = HAPPY_SOURCE + SUB_OBJECT_TAGGED.replace('export interface ProfileEmbeddedSubItem {\n  a: string;\n  bb: string;\n}', 'export interface ProfileEmbeddedSubItem {\n  /** @dbxModelVariable a */\n  a: string;\n  /** @dbxModelVariable bb */\n  bb: string;\n}');
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const equalsWarnings = result.violations.filter((v) => v.code === 'MODEL_FIELD_LONG_NAME_EQUALS_NAME' && v.model === 'ProfileEmbeddedSubItem');
      expect(equalsWarnings).toHaveLength(2);
      expect(equalsWarnings.map((v) => v.severity)).toEqual(['warning', 'warning']);
    });

    it('stays silent on an untagged embedded sub-object interface (preserves current opt-in behavior)', () => {
      const text = HAPPY_SOURCE + SUB_OBJECT_UNTAGGED;
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const subFieldWarnings = result.violations.filter((v) => (v.code === 'MODEL_FIELD_MISSING_VARIABLE_TAG' || v.code === 'MODEL_FIELD_LONG_NAME_EQUALS_NAME') && v.model === 'ProfileEmbeddedSubItem');
      expect(subFieldWarnings).toHaveLength(0);
    });

    it('honors `ignoredFieldNames` for `@dbxModelSubObject` fields whose long name equals the short name', () => {
      const text = HAPPY_SOURCE + SUB_OBJECT_TAGGED.replace('export interface ProfileEmbeddedSubItem {\n  a: string;\n  bb: string;\n}', 'export interface ProfileEmbeddedSubItem {\n  /** @dbxModelVariable a */\n  a: string;\n  /** @dbxModelVariable bb */\n  bb: string;\n}');
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }], { ignoredFieldNames: new Set(['a']) });
      const equalsWarnings = result.violations.filter((v) => v.code === 'MODEL_FIELD_LONG_NAME_EQUALS_NAME' && v.model === 'ProfileEmbeddedSubItem');
      expect(equalsWarnings).toHaveLength(1);
      expect(equalsWarnings[0].message).toContain('`bb`');
    });

    it('flags MODEL_SUBOBJECT_TAG_CONFLICT (error) when both `@dbxModel` and `@dbxModelSubObject` are present on the same interface', () => {
      const conflict = `\n/**\n * Conflict fixture — both tags present.\n *\n * @dbxModel\n * @dbxModelSubObject\n */\nexport interface ProfileEmbeddedSubItem {\n  a: string;\n}\n`;
      const text = HAPPY_SOURCE + conflict;
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const conflicts = result.violations.filter((v) => v.code === 'MODEL_SUBOBJECT_TAG_CONFLICT' && v.model === 'ProfileEmbeddedSubItem');
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].severity).toBe('error');
      expect(conflicts[0].message).toContain('ProfileEmbeddedSubItem');
    });
  });

  // MARK: MODEL_SUBOBJECT_NOT_TAGGED — suggest @dbxModelSubObject on untagged sub-object interfaces
  describe('MODEL_SUBOBJECT_NOT_TAGGED', () => {
    const UNTAGGED_SUB_OBJECT_DECL = `\n/**\n * Embedded sub-object — declaration intentionally carries no tags.\n */\nexport interface ProfileEmbeddedSubItem {\n  a: string;\n  bb: string;\n}\n`;
    const TAGGED_SUB_OBJECT_DECL = `\n/**\n * @dbxModelSubObject\n */\nexport interface ProfileEmbeddedSubItem {\n  /** @dbxModelVariable alpha */\n  a: string;\n  /** @dbxModelVariable bravo */\n  bb: string;\n}\n`;
    const FIRESTORE_SUB_OBJECT_CALL = `\nexport const profileEmbeddedSubItem = firestoreSubObject<ProfileEmbeddedSubItem>({\n  objectField: {\n    fields: {}\n  }\n});\n`;
    const FIRESTORE_OBJECT_ARRAY_CALL = `\nexport const profileEmbeddedSubItemArray = firestoreObjectArray<ProfileEmbeddedSubItem>({\n  objectField: profileEmbeddedSubItem\n});\n`;
    const FIRESTORE_MAP_CALL = `\nexport const profileEmbeddedSubItemMap = firestoreMap<ProfileEmbeddedSubItem>({\n  objectField: profileEmbeddedSubItem\n});\n`;

    it('warns MODEL_SUBOBJECT_NOT_TAGGED when an untagged interface is referenced by `firestoreSubObject<T>`', () => {
      const text = HAPPY_SOURCE + UNTAGGED_SUB_OBJECT_DECL + FIRESTORE_SUB_OBJECT_CALL;
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const warnings = result.violations.filter((v) => v.code === 'MODEL_SUBOBJECT_NOT_TAGGED' && v.model === 'ProfileEmbeddedSubItem');
      expect(warnings).toHaveLength(1);
      expect(warnings[0].severity).toBe('warning');
      expect(warnings[0].message).toContain('firestoreSubObject<ProfileEmbeddedSubItem>');
      expect(warnings[0].message).toContain('`@dbxModelSubObject`');
    });

    it('warns MODEL_SUBOBJECT_NOT_TAGGED when an untagged interface is referenced by `firestoreObjectArray<T>`', () => {
      const text = HAPPY_SOURCE + UNTAGGED_SUB_OBJECT_DECL + FIRESTORE_OBJECT_ARRAY_CALL;
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const warnings = result.violations.filter((v) => v.code === 'MODEL_SUBOBJECT_NOT_TAGGED' && v.model === 'ProfileEmbeddedSubItem');
      expect(warnings).toHaveLength(1);
      expect(warnings[0].message).toContain('firestoreObjectArray<ProfileEmbeddedSubItem>');
    });

    it('warns MODEL_SUBOBJECT_NOT_TAGGED when an untagged interface is referenced by `firestoreMap<T>`', () => {
      const text = HAPPY_SOURCE + UNTAGGED_SUB_OBJECT_DECL + FIRESTORE_MAP_CALL;
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const warnings = result.violations.filter((v) => v.code === 'MODEL_SUBOBJECT_NOT_TAGGED' && v.model === 'ProfileEmbeddedSubItem');
      expect(warnings).toHaveLength(1);
      expect(warnings[0].message).toContain('firestoreMap<ProfileEmbeddedSubItem>');
    });

    it('stays silent when the referenced interface is tagged `@dbxModelSubObject`', () => {
      const text = HAPPY_SOURCE + TAGGED_SUB_OBJECT_DECL + FIRESTORE_SUB_OBJECT_CALL;
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const warnings = result.violations.filter((v) => v.code === 'MODEL_SUBOBJECT_NOT_TAGGED');
      expect(warnings).toHaveLength(0);
    });

    it('stays silent when the referenced interface is tagged `@dbxModel`', () => {
      // A top-level model used as a sub-object via converter composition — uncommon
      // but valid. The @dbxModel tag already opts the interface into long-name checks.
      const modelTaggedDecl = `\n/**\n * @dbxModel\n */\nexport interface ProfileEmbeddedSubItem {\n  /** @dbxModelVariable alpha */\n  a: string;\n  /** @dbxModelVariable bravo */\n  bb: string;\n}\n`;
      const text = HAPPY_SOURCE + modelTaggedDecl + FIRESTORE_SUB_OBJECT_CALL;
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const warnings = result.violations.filter((v) => v.code === 'MODEL_SUBOBJECT_NOT_TAGGED');
      expect(warnings).toHaveLength(0);
    });

    it('de-duplicates so a single untagged interface referenced from N call-sites emits one finding', () => {
      const text = HAPPY_SOURCE + UNTAGGED_SUB_OBJECT_DECL + FIRESTORE_SUB_OBJECT_CALL + FIRESTORE_OBJECT_ARRAY_CALL + FIRESTORE_MAP_CALL;
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const warnings = result.violations.filter((v) => v.code === 'MODEL_SUBOBJECT_NOT_TAGGED' && v.model === 'ProfileEmbeddedSubItem');
      expect(warnings).toHaveLength(1);
    });

    it('resolves cross-file references: call-site in file A, interface declared in file B', () => {
      const fileA = HAPPY_SOURCE + FIRESTORE_SUB_OBJECT_CALL;
      const fileB = `export interface ProfileEmbeddedSubItem { a: string; bb: string; }\n`;
      const result = validateFirebaseModelSources([
        { name: 'a.ts', text: fileA },
        { name: 'b.ts', text: fileB }
      ]);
      const warnings = result.violations.filter((v) => v.code === 'MODEL_SUBOBJECT_NOT_TAGGED' && v.model === 'ProfileEmbeddedSubItem');
      expect(warnings).toHaveLength(1);
      expect(warnings[0].file).toBe('b.ts');
    });

    it('does not emit when the type-arg cannot be resolved (interface declared outside the source set)', () => {
      // No declaration of ExternalSubObject anywhere in the supplied sources.
      const externalCall = `\nexport const externalSubObject = firestoreSubObject<ExternalSubObject>({\n  objectField: { fields: {} }\n});\n`;
      const text = HAPPY_SOURCE + externalCall;
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const warnings = result.violations.filter((v) => v.code === 'MODEL_SUBOBJECT_NOT_TAGGED');
      expect(warnings).toHaveLength(0);
    });

    it('does not emit when the type-arg is an inline type (not a TypeReference identifier)', () => {
      const inlineCall = `\nexport const inlineSubObject = firestoreSubObject<{ a: string; bb: string }>({\n  objectField: { fields: {} }\n});\n`;
      const text = HAPPY_SOURCE + inlineCall;
      const result = validateFirebaseModelSources([{ name: 'x.ts', text }]);
      const warnings = result.violations.filter((v) => v.code === 'MODEL_SUBOBJECT_NOT_TAGGED');
      expect(warnings).toHaveLength(0);
    });

    it('flags untagged sub-objects in a file with no firestoreModelIdentity calls (sibling sub-file pattern)', () => {
      // Mirrors the worker.pay.ts pattern in hellosubs: a sibling file with no
      // top-level model but its own interface + firestoreSubObject<T> call.
      const subFile = `import { firestoreSubObject } from '@dereekb/firebase';\n\nexport interface WorkerPaySubItem {\n  a: string;\n}\n\nexport const workerPaySubItem = firestoreSubObject<WorkerPaySubItem>({\n  objectField: { fields: {} }\n});\n`;
      const result = validateFirebaseModelSources([
        { name: 'worker.ts', text: HAPPY_SOURCE },
        { name: 'worker.pay.ts', text: subFile }
      ]);
      const warnings = result.violations.filter((v) => v.code === 'MODEL_SUBOBJECT_NOT_TAGGED' && v.model === 'WorkerPaySubItem');
      expect(warnings).toHaveLength(1);
      expect(warnings[0].file).toBe('worker.pay.ts');
    });
  });

  // MARK: Sub-file (no top-level models) field-rule scan
  describe('sub-file field rules', () => {
    it('runs MODEL_FIELD_MISSING_VARIABLE_TAG on @dbxModelSubObject interfaces in a sub-file with no firestoreModelIdentity calls', () => {
      const subFile = `/**\n * @dbxModelSubObject\n */\nexport interface WorkerPayStubItem {\n  a: string;\n  bb: string;\n}\n`;
      const result = validateFirebaseModelSources([{ name: 'worker.pay.ts', text: subFile }]);
      const warnings = result.violations.filter((v) => v.code === 'MODEL_FIELD_MISSING_VARIABLE_TAG' && v.model === 'WorkerPayStubItem');
      expect(warnings).toHaveLength(2);
      expect(warnings.map((v) => v.severity)).toEqual(['warning', 'warning']);
    });

    it('runs MODEL_FIELD_NAME_TOO_LONG on @dbxModelSubObject interfaces in a sub-file', () => {
      const subFile = `/**\n * @dbxModelSubObject\n */\nexport interface WorkerPayStubItem {\n  /** @dbxModelVariable foo */\n  fooBarBaz: string;\n}\n`;
      const result = validateFirebaseModelSources([{ name: 'worker.pay.ts', text: subFile }]);
      const tooLong = result.violations.filter((v) => v.code === 'MODEL_FIELD_NAME_TOO_LONG' && v.model === 'WorkerPayStubItem');
      expect(tooLong).toHaveLength(1);
      expect(tooLong[0].message).toContain('`fooBarBaz`');
    });

    it('runs MODEL_FIELD_LONG_NAME_EQUALS_NAME on @dbxModelSubObject fields in a sub-file', () => {
      const subFile = `/**\n * @dbxModelSubObject\n */\nexport interface WorkerPayStubItem {\n  /** @dbxModelVariable a */\n  a: string;\n}\n`;
      const result = validateFirebaseModelSources([{ name: 'worker.pay.ts', text: subFile }]);
      const equals = result.violations.filter((v) => v.code === 'MODEL_FIELD_LONG_NAME_EQUALS_NAME' && v.model === 'WorkerPayStubItem');
      expect(equals).toHaveLength(1);
    });

    it('stays silent on untagged helper interfaces in a sub-file (scope tightens to tagged interfaces when no top-level model is present)', () => {
      const subFile = `// Random helper types that shouldn't trigger field rules.\nexport interface SomeHelperType {\n  veryLongFieldNameHere: string;\n}\n`;
      const result = validateFirebaseModelSources([{ name: 'worker.pay.ts', text: subFile }]);
      const warnings = result.violations.filter((v) => v.model === 'SomeHelperType');
      expect(warnings).toHaveLength(0);
    });

    it('does NOT emit FILE_MISSING_GROUP_INTERFACE / FILE_MISSING_GROUP_TYPES on a sub-file', () => {
      const subFile = `/**\n * @dbxModelSubObject\n */\nexport interface WorkerPayStubItem {\n  a: string;\n}\n`;
      const result = validateFirebaseModelSources([{ name: 'worker.pay.ts', text: subFile }]);
      const fileLevel = result.violations.filter((v) => v.code === 'FILE_MISSING_GROUP_INTERFACE' || v.code === 'FILE_MISSING_GROUP_TYPES');
      expect(fileLevel).toHaveLength(0);
    });

    it('reports filesChecked but not modelsChecked for a sub-file-only validation', () => {
      const subFile = `/**\n * @dbxModelSubObject\n */\nexport interface WorkerPayStubItem {\n  /** @dbxModelVariable amount */\n  a: number;\n}\n`;
      const result = validateFirebaseModelSources([{ name: 'worker.pay.ts', text: subFile }]);
      expect(result.filesChecked).toBe(1);
      expect(result.modelsChecked).toBe(0);
    });
  });

  // MARK: MODEL_SUBOBJECT_PARENT_NOT_TAGGED
  describe('MODEL_SUBOBJECT_PARENT_NOT_TAGGED', () => {
    it('warns when @dbxModelSubObject extends an untagged in-package parent (same file)', () => {
      const text = `/**\n * Parent interface — intentionally untagged.\n */\nexport interface WorkerPayStubCostItem {\n  hours: number;\n}\n\n/**\n * @dbxModelSubObject\n */\nexport interface WorkerPayStubItem extends WorkerPayStubCostItem {\n  /** @dbxModelVariable amount */\n  a: number;\n}\n`;
      const result = validateFirebaseModelSources([{ name: 'worker.pay.ts', text }]);
      const warnings = result.violations.filter((v) => v.code === 'MODEL_SUBOBJECT_PARENT_NOT_TAGGED');
      expect(warnings).toHaveLength(1);
      expect(warnings[0].severity).toBe('warning');
      expect(warnings[0].model).toBe('WorkerPayStubCostItem');
      expect(warnings[0].file).toBe('worker.pay.ts');
      expect(warnings[0].message).toContain('declared in the same package');
      expect(warnings[0].message).toContain('Fix (preferred)');
    });

    it('warns when @dbxModelSubObject extends an untagged in-package parent declared in a sibling file', () => {
      const childFile = `/**\n * @dbxModelSubObject\n */\nexport interface WorkerPayStubItem extends WorkerPayStubCostItem {\n  /** @dbxModelVariable amount */\n  a: number;\n}\n`;
      const parentFile = `export interface WorkerPayStubCostItem {\n  hours: number;\n}\n`;
      const result = validateFirebaseModelSources([
        { name: 'worker.pay.ts', text: childFile },
        { name: 'worker.cost.ts', text: parentFile }
      ]);
      const warnings = result.violations.filter((v) => v.code === 'MODEL_SUBOBJECT_PARENT_NOT_TAGGED');
      expect(warnings).toHaveLength(1);
      expect(warnings[0].file).toBe('worker.cost.ts');
      expect(warnings[0].model).toBe('WorkerPayStubCostItem');
    });

    it('warns with the external-parent template when the parent is not in the validated source set', () => {
      const text = `/**\n * @dbxModelSubObject\n */\nexport interface WorkerPayStubItem extends IndexRef {\n  /** @dbxModelVariable amount */\n  a: number;\n}\n`;
      const result = validateFirebaseModelSources([{ name: 'worker.pay.ts', text }]);
      const warnings = result.violations.filter((v) => v.code === 'MODEL_SUBOBJECT_PARENT_NOT_TAGGED');
      expect(warnings).toHaveLength(1);
      expect(warnings[0].model).toBe('WorkerPayStubItem');
      expect(warnings[0].file).toBe('worker.pay.ts');
      expect(warnings[0].message).toContain('declared outside this package');
      expect(warnings[0].message).toContain('ignoredExternalParents');
    });

    it('stays silent when the in-package parent is itself tagged with @dbxModelSubObject', () => {
      const text = `/**\n * @dbxModelSubObject\n */\nexport interface WorkerPayStubCostItem {\n  /** @dbxModelVariable hours */\n  h: number;\n}\n\n/**\n * @dbxModelSubObject\n */\nexport interface WorkerPayStubItem extends WorkerPayStubCostItem {\n  /** @dbxModelVariable amount */\n  a: number;\n}\n`;
      const result = validateFirebaseModelSources([{ name: 'worker.pay.ts', text }]);
      const warnings = result.violations.filter((v) => v.code === 'MODEL_SUBOBJECT_PARENT_NOT_TAGGED');
      expect(warnings).toHaveLength(0);
    });

    it('stays silent when the in-package parent is tagged with @dbxModel (top-level model used as a sub-object base)', () => {
      const text = `/**\n * @dbxModel\n */\nexport interface WorkerPayStubCostItem {\n  /** @dbxModelVariable hours */\n  h: number;\n}\n\n/**\n * @dbxModelSubObject\n */\nexport interface WorkerPayStubItem extends WorkerPayStubCostItem {\n  /** @dbxModelVariable amount */\n  a: number;\n}\n`;
      const result = validateFirebaseModelSources([{ name: 'worker.pay.ts', text }]);
      const warnings = result.violations.filter((v) => v.code === 'MODEL_SUBOBJECT_PARENT_NOT_TAGGED');
      expect(warnings).toHaveLength(0);
    });

    it('suppresses external-parent warnings when the parent name is in ignoredExternalParents', () => {
      const text = `/**\n * @dbxModelSubObject\n */\nexport interface WorkerPayStubItem extends IndexRef {\n  /** @dbxModelVariable amount */\n  a: number;\n}\n`;
      const result = validateFirebaseModelSources([{ name: 'worker.pay.ts', text }], { ignoredExternalParents: new Set(['IndexRef']) });
      const warnings = result.violations.filter((v) => v.code === 'MODEL_SUBOBJECT_PARENT_NOT_TAGGED');
      expect(warnings).toHaveLength(0);
    });

    it('does NOT suppress in-package parent warnings when the parent name appears in ignoredExternalParents', () => {
      const text = `export interface WorkerPayStubCostItem {\n  hours: number;\n}\n\n/**\n * @dbxModelSubObject\n */\nexport interface WorkerPayStubItem extends WorkerPayStubCostItem {\n  /** @dbxModelVariable amount */\n  a: number;\n}\n`;
      const result = validateFirebaseModelSources([{ name: 'worker.pay.ts', text }], { ignoredExternalParents: new Set(['WorkerPayStubCostItem']) });
      const warnings = result.violations.filter((v) => v.code === 'MODEL_SUBOBJECT_PARENT_NOT_TAGGED');
      expect(warnings).toHaveLength(1);
      expect(warnings[0].message).toContain('declared in the same package');
    });

    it('emits one warning per (child, parent) pair (multiple parents → multiple warnings)', () => {
      const text = `export interface ParentA {\n  hours: number;\n}\n\nexport interface ParentB {\n  rate: number;\n}\n\n/**\n * @dbxModelSubObject\n */\nexport interface ChildItem extends ParentA, ParentB {\n  /** @dbxModelVariable amount */\n  a: number;\n}\n`;
      const result = validateFirebaseModelSources([{ name: 'worker.pay.ts', text }]);
      const warnings = result.violations.filter((v) => v.code === 'MODEL_SUBOBJECT_PARENT_NOT_TAGGED');
      expect(warnings).toHaveLength(2);
      expect(warnings.map((v) => v.model).sort()).toEqual(['ParentA', 'ParentB']);
    });

    it('unwraps Partial<T> / Pick<T,K> / Omit<T,K> wrappers in extends clauses', () => {
      const text = `export interface WorkerPayStubCostItem {\n  hours: number;\n}\n\n/**\n * @dbxModelSubObject\n */\nexport interface WorkerPayStubItem extends Partial<WorkerPayStubCostItem> {\n  /** @dbxModelVariable amount */\n  a: number;\n}\n`;
      const result = validateFirebaseModelSources([{ name: 'worker.pay.ts', text }]);
      const warnings = result.violations.filter((v) => v.code === 'MODEL_SUBOBJECT_PARENT_NOT_TAGGED');
      expect(warnings).toHaveLength(1);
      expect(warnings[0].model).toBe('WorkerPayStubCostItem');
      expect(warnings[0].message).toContain('declared in the same package');
    });

    it('does not run on interfaces without @dbxModelSubObject', () => {
      const text = `export interface ParentA {\n  hours: number;\n}\n\nexport interface ChildItem extends ParentA {\n  amount: number;\n}\n`;
      const result = validateFirebaseModelSources([{ name: 'worker.pay.ts', text }]);
      const warnings = result.violations.filter((v) => v.code === 'MODEL_SUBOBJECT_PARENT_NOT_TAGGED');
      expect(warnings).toHaveLength(0);
    });
  });
});

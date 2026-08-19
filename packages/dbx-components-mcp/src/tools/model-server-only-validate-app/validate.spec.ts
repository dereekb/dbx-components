import { describe, expect, it } from 'vitest';
import { scanFirestoreRules } from '@dereekb/dbx-cli/firestore-rules';
import { extractModelServiceFlags } from './extract-service-flags.js';
import { validateModelServerOnly, type ServerOnlyIdentityFact, type ServerOnlyInterfaceFact, type ValidateModelServerOnlyInput } from './validate.js';

const RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /gb/{guestbook} {
      allow read: if true;
    }
    match /nb/{notificationBox} {
      allow read: if true;
      match /nbn/{notification} {
        allow read: if false;
      }
    }
  }
}
`;

const SCAN = scanFirestoreRules(RULES);

const IDENTITIES: readonly ServerOnlyIdentityFact[] = [
  { modelType: 'guestbook', collection: 'gb' },
  { modelType: 'notification', collection: 'nbn' },
  { modelType: 'systemState', collection: 'sys' },
  { modelType: 'pagedThing', collection: 'pgt' }
];

function buildInput(input: { readonly services: ValidateModelServerOnlyInput['services']; readonly interfaces: readonly ServerOnlyInterfaceFact[]; readonly manifestModelTypes?: readonly string[] }): ValidateModelServerOnlyInput {
  return {
    componentDir: 'components/demo-firebase',
    serviceFile: 'components/demo-firebase/src/lib/model/service.ts',
    rulesFile: 'firestore.rules',
    modelDirs: ['components/demo-firebase/src/lib'],
    ...(input.manifestModelTypes === undefined ? {} : { manifestFile: 'apps/demo-cli/src/lib/manifest/api.manifest.generated.ts', manifestModelTypes: input.manifestModelTypes }),
    services: input.services,
    interfaces: input.interfaces,
    identities: IDENTITIES,
    rulesScan: SCAN
  };
}

function buildService(input: { readonly modelType: string; readonly modelName?: string; readonly serverOnly?: boolean }) {
  return { modelType: input.modelType, exportName: `${input.modelType}FirebaseModelServiceFactory`, modelName: input.modelName ?? capitalize(input.modelType), serverOnly: input.serverOnly === true, line: 1 };
}

function buildInterface(input: { readonly name: string; readonly serverOnly?: boolean; readonly hasModelTag?: boolean }): ServerOnlyInterfaceFact {
  return { name: input.name, serverOnly: input.serverOnly === true, hasModelTag: input.hasModelTag !== false, file: 'components/demo-firebase/src/lib/model/x.ts' };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

describe('validateModelServerOnly()', () => {
  it('passes when a client-readable model declares nothing', () => {
    const report = validateModelServerOnly(buildInput({ services: [buildService({ modelType: 'guestbook' })], interfaces: [buildInterface({ name: 'Guestbook' })] }));

    expect(report.violations).toEqual([]);
    expect(report.failed).toBe(false);
    expect(report.reconciliations[0]).toMatchObject({ modelType: 'guestbook', collection: 'gb', tag: false, flag: false, rules: false, agrees: true });
  });

  it('passes when a rules-refused model declares both halves', () => {
    const report = validateModelServerOnly(buildInput({ services: [buildService({ modelType: 'notification', serverOnly: true })], interfaces: [buildInterface({ name: 'Notification', serverOnly: true })] }));

    expect(report.violations).toEqual([]);
    expect(report.reconciliations[0]).toMatchObject({ collection: 'nbn', tag: true, flag: true, rules: true, agrees: true });
  });

  it('reports MISSING_RUNTIME_FLAG as an error — the live authorization leak', () => {
    const report = validateModelServerOnly(buildInput({ services: [buildService({ modelType: 'notification' })], interfaces: [buildInterface({ name: 'Notification' })] }));

    expect(report.failed).toBe(true);
    const codes = report.violations.map((v) => v.code);
    expect(codes).toContain('MODEL_SERVER_ONLY_MISSING_RUNTIME_FLAG');
    expect(codes).toContain('MODEL_SERVER_ONLY_MISSING_TAG');
    expect(report.violations.find((v) => v.code === 'MODEL_SERVER_ONLY_MISSING_RUNTIME_FLAG')?.severity).toBe('error');
  });

  it('attaches the rule catalog remediation to a violation', () => {
    const report = validateModelServerOnly(buildInput({ services: [buildService({ modelType: 'notification' })], interfaces: [buildInterface({ name: 'Notification' })] }));
    expect(report.violations.find((v) => v.code === 'MODEL_SERVER_ONLY_MISSING_RUNTIME_FLAG')?.remediation?.fix).toContain('serverOnly: true');
  });

  it('reports MISSING_TAG as a warning when only the runtime flag is set', () => {
    const report = validateModelServerOnly(buildInput({ services: [buildService({ modelType: 'notification', serverOnly: true })], interfaces: [buildInterface({ name: 'Notification' })] }));
    const missingTag = report.violations.find((v) => v.code === 'MODEL_SERVER_ONLY_MISSING_TAG');

    expect(missingTag?.severity).toBe('warning');
    expect(report.violations.map((v) => v.code)).toContain('MODEL_SERVER_ONLY_TAG_FLAG_MISMATCH');
  });

  it('reports RULES_ALLOW_READ when a client-readable model is declared server-only', () => {
    const report = validateModelServerOnly(buildInput({ services: [buildService({ modelType: 'guestbook', serverOnly: true })], interfaces: [buildInterface({ name: 'Guestbook', serverOnly: true })] }));

    expect(report.failed).toBe(true);
    expect(report.violations.map((v) => v.code)).toContain('MODEL_SERVER_ONLY_RULES_ALLOW_READ');
    expect(report.reconciliations[0]?.agrees).toBe(false);
  });

  it('reports TAG_FLAG_MISMATCH when the tag is set but the flag is not', () => {
    const report = validateModelServerOnly(buildInput({ services: [buildService({ modelType: 'notification' })], interfaces: [buildInterface({ name: 'Notification', serverOnly: true })] }));
    const mismatch = report.violations.find((v) => v.code === 'MODEL_SERVER_ONLY_TAG_FLAG_MISMATCH');

    expect(mismatch).toBeDefined();
    expect(mismatch?.severity).toBe('error');
  });

  it('reports UNRESOLVED_IDENTITY when the model type has no identity in the scanned dirs', () => {
    const report = validateModelServerOnly(buildInput({ services: [buildService({ modelType: 'notInAnyIdentity' })], interfaces: [] }));
    const violation = report.violations.find((v) => v.code === 'MODEL_SERVER_ONLY_UNRESOLVED_IDENTITY');

    expect(violation?.severity).toBe('warning');
    expect(report.reconciliations[0]).toMatchObject({ collection: undefined, rules: undefined });
    // an unresolvable leg is not a disagreement
    expect(report.reconciliations[0]?.agrees).toBe(true);
  });

  it('reports NO_INTERFACE instead of a phantom mismatch for a type-alias data model', () => {
    const report = validateModelServerOnly(buildInput({ services: [buildService({ modelType: 'pagedThing', modelName: 'PagedItemPageData<NotificationItem>', serverOnly: true })], interfaces: [] }));
    const codes = report.violations.map((v) => v.code);

    expect(codes).toContain('MODEL_SERVER_ONLY_NO_INTERFACE');
    expect(codes).not.toContain('MODEL_SERVER_ONLY_TAG_FLAG_MISMATCH');
    expect(report.failed).toBe(false);
  });

  it('joins a generic data type against its base declaration name', () => {
    const report = validateModelServerOnly(buildInput({ services: [buildService({ modelType: 'pagedThing', modelName: 'PagedItemPageData<NotificationItem>' })], interfaces: [buildInterface({ name: 'PagedItemPageData' })] }));
    expect(report.reconciliations[0]?.tag).toBe(false);
  });

  it('reports TAG_WITHOUT_MODEL_TAG for an inert @dbxModelServerOnly tag', () => {
    const report = validateModelServerOnly(buildInput({ services: [], interfaces: [buildInterface({ name: 'ProfilePrivateData', serverOnly: true, hasModelTag: false })] }));
    const violation = report.violations.find((v) => v.code === 'MODEL_SERVER_ONLY_TAG_WITHOUT_MODEL_TAG');

    expect(violation?.severity).toBe('warning');
    expect(violation?.message).toContain('ProfilePrivateData');
    expect(violation?.modelType).toBeUndefined();
  });

  it('reports NOT_IN_MANIFEST only when a manifest was supplied', () => {
    const services = [buildService({ modelType: 'notification', serverOnly: true })];
    const interfaces = [buildInterface({ name: 'Notification', serverOnly: true })];

    expect(validateModelServerOnly(buildInput({ services, interfaces })).violations).toEqual([]);
    expect(validateModelServerOnly(buildInput({ services, interfaces, manifestModelTypes: ['guestbook'] })).violations.map((v) => v.code)).toContain('MODEL_SERVER_ONLY_NOT_IN_MANIFEST');
    expect(validateModelServerOnly(buildInput({ services, interfaces, manifestModelTypes: ['notification'] })).violations).toEqual([]);
  });

  it('counts errors and warnings separately', () => {
    const report = validateModelServerOnly(
      buildInput({
        services: [buildService({ modelType: 'notification' }), buildService({ modelType: 'guestbook' })],
        interfaces: [buildInterface({ name: 'Notification' }), buildInterface({ name: 'Guestbook' })]
      })
    );

    expect(report.errorCount).toBe(1);
    expect(report.warningCount).toBe(1);
  });
});

describe('extractModelServiceFlags()', () => {
  const SOURCE = `
import { firebaseModelServiceFactory } from '@dereekb/firebase';

/**
 * @dbxModelServiceFactory systemState
 */
export const systemStateFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, SystemState, SystemStateDocument, SystemStateRoles>({
  // SERVER-ONLY: firestore.rules has no match block for \`sys\`.
  serverOnly: true,
  roleMapForModel: function (output, context, _model) {
    return grantFullAccessIfAdmin(context);
  },
  getFirestoreCollection: (c) => c.app.systemStateCollection
});

/**
 * @dbxModelServiceFactory guestbook
 */
export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, Guestbook, GuestbookDocument, GuestbookRoles>({
  roleMapForModel: function (output, context, _model) {
    return { read: true };
  },
  getFirestoreCollection: (c) => c.app.guestbookCollection
});

/**
 * @dbxModelServiceFactory pagedThing
 */
export const pagedThingFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, PagedItemPageData<NotificationItem>, PageDocument, PageRoles>({
  serverOnly: true,
  getFirestoreCollection: (c) => c.app.pageCollectionGroup
});

// untagged — not a registered model service the validator should reconcile
export const strayFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, Stray, StrayDocument, StrayRoles>({
  getFirestoreCollection: (c) => c.app.strayCollection
});
`;

  const extracted = extractModelServiceFlags(SOURCE);

  it('captures only the @dbxModelServiceFactory-tagged declarations', () => {
    expect(extracted.map((x) => x.modelType)).toEqual(['systemState', 'guestbook', 'pagedThing']);
  });

  it('reads the export name and declaration line', () => {
    expect(extracted[0]).toMatchObject({ exportName: 'systemStateFirebaseModelServiceFactory' });
    expect(extracted[0]?.line).toBeGreaterThan(1);
  });

  it("reads the model's data type off the second type argument", () => {
    expect(extracted.map((x) => x.modelName)).toEqual(['SystemState', 'Guestbook', 'PagedItemPageData<NotificationItem>']);
  });

  it('reads serverOnly: true off the config object', () => {
    expect(extracted.map((x) => x.serverOnly)).toEqual([true, false, true]);
  });

  it("does not miscredit a later declaration's serverOnly onto an earlier one", () => {
    expect(extracted.find((x) => x.modelType === 'guestbook')?.serverOnly).toBe(false);
  });

  it('returns nothing for a source with no tagged factories', () => {
    expect(extractModelServiceFlags('export const x = 1;')).toEqual([]);
  });
});

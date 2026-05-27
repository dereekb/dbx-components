import { afterAll, describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { FIREBASE_REQUIRE_FIRESTORE_RULE_FOR_SERVICE_MODEL_RULE, type VirtualModelIdentity } from './require-firestore-rule-for-service-model.rule';

const RULE_ID = 'dereekb-firebase/require-firestore-rule-for-service-model';

interface RuleOptions {
  readonly virtualFirestoreRules?: string;
  readonly virtualModelIdentities?: readonly VirtualModelIdentity[];
  readonly registryFactoryCallName?: string;
  readonly identityFactoryName?: string;
  readonly allowedMissingCollectionNames?: readonly string[];
  readonly firestoreRulesPath?: string;
  readonly modelSearchRoots?: readonly string[];
}

function buildConfig(options?: RuleOptions): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-firebase': { rules: { 'require-firestore-rule-for-service-model': FIREBASE_REQUIRE_FIRESTORE_RULE_FOR_SERVICE_MODEL_RULE } } as any },
      rules: { [RULE_ID]: options ? ['warn', options] : 'warn' }
    }
  ];
}

function lintCode(code: string, options?: RuleOptions): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(options), { filename: 'service.ts' }).filter((m) => m.ruleId === RULE_ID);
}

const GUESTBOOK_AND_ENTRY_IDENTITIES: readonly VirtualModelIdentity[] = [
  { modelName: 'guestbook', collectionName: 'gb', identityVariableName: 'guestbookIdentity' },
  { modelName: 'guestbookEntry', collectionName: 'gbe', identityVariableName: 'guestbookEntryIdentity', parentIdentityVariableName: 'guestbookIdentity' }
];

const REGISTRY_WITH_GUESTBOOK_ONLY = `
const REGISTRY = { guestbook: () => null };
firebaseModelsService(REGISTRY);
`;

const REGISTRY_WITH_BOTH = `
const REGISTRY = { guestbook: () => null, guestbookEntry: () => null };
firebaseModelsService(REGISTRY);
`;

const RULES_WITH_NESTED_GBE = `
service cloud.firestore {
  match /databases/{database}/documents {
    match /gb/{guestbook} {
      allow read: if true;
      match /gbe/{guestbookEntry} {
        allow read: if true;
      }
    }
  }
}
`;

const RULES_WITH_GB_ONLY = `
service cloud.firestore {
  match /databases/{database}/documents {
    match /gb/{guestbook} {
      allow read: if true;
    }
  }
}
`;

const RULES_WITH_GBE_COLLECTION_GROUP_ONLY = `
service cloud.firestore {
  match /databases/{database}/documents {
    match /gb/{guestbook} {
      allow read: if true;
    }
    match /{path=**}/gbe/{guestbookEntry} {
      allow read: if true;
    }
  }
}
`;

const RULES_WITH_GBE_AT_ROOT_NOT_NESTED = `
service cloud.firestore {
  match /databases/{database}/documents {
    match /gb/{guestbook} {
      allow read: if true;
    }
    match /gbe/{guestbookEntry} {
      allow read: if true;
    }
  }
}
`;

const EMPTY_RULES = `
service cloud.firestore {
  match /databases/{database}/documents {
  }
}
`;

// firestore.rules covering the framework collections exercised by the downstream-simulation tests:
// notificationBox (nb) with nested notification (nbn), storageFile (sf), and oidcEntry (oidc_e).
const FRAMEWORK_RULES = `
service cloud.firestore {
  match /databases/{database}/documents {
    match /nb/{notificationBox} {
      allow read: if true;
      match /nbn/{notification} {
        allow read: if true;
      }
    }
    match /sf/{storageFile} {
      allow read: if true;
    }
    match /oidc_e/{oidcEntry} {
      allow read: if true;
    }
  }
}
`;

describe('require-firestore-rule-for-service-model', () => {
  it('passes when registered root model has a matching match block', () => {
    const messages = lintCode(REGISTRY_WITH_GUESTBOOK_ONLY, {
      virtualFirestoreRules: RULES_WITH_GB_ONLY,
      virtualModelIdentities: GUESTBOOK_AND_ENTRY_IDENTITIES
    });
    expect(messages).toHaveLength(0);
  });

  it('passes when subcollection is nested under the correct parent', () => {
    const messages = lintCode(REGISTRY_WITH_BOTH, {
      virtualFirestoreRules: RULES_WITH_NESTED_GBE,
      virtualModelIdentities: GUESTBOOK_AND_ENTRY_IDENTITIES
    });
    expect(messages).toHaveLength(0);
  });

  it('passes when a subcollection is only covered by a top-level collection-group match', () => {
    const messages = lintCode(REGISTRY_WITH_BOTH, {
      virtualFirestoreRules: RULES_WITH_GBE_COLLECTION_GROUP_ONLY,
      virtualModelIdentities: GUESTBOOK_AND_ENTRY_IDENTITIES
    });
    expect(messages).toHaveLength(0);
  });

  it('warns missingMatchBlock when a root model has no matching block', () => {
    const messages = lintCode(REGISTRY_WITH_GUESTBOOK_ONLY, {
      virtualFirestoreRules: EMPTY_RULES,
      virtualModelIdentities: GUESTBOOK_AND_ENTRY_IDENTITIES
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('missingMatchBlock');
    expect(messages[0].message).toContain("'guestbook'");
    expect(messages[0].message).toContain("'gb'");
  });

  it('warns wrongNestingDepth when a subcollection sits at the root with no collection-group fallback', () => {
    const messages = lintCode(REGISTRY_WITH_BOTH, {
      virtualFirestoreRules: RULES_WITH_GBE_AT_ROOT_NOT_NESTED,
      virtualModelIdentities: GUESTBOOK_AND_ENTRY_IDENTITIES
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('wrongNestingDepth');
    expect(messages[0].message).toContain('guestbookEntry');
    expect(messages[0].message).toContain('gb / gbe');
  });

  it('warns unresolvedModelIdentity when a registered key has no identity declaration', () => {
    const code = `
      const REGISTRY = { mystery: () => null };
      firebaseModelsService(REGISTRY);
    `;
    const messages = lintCode(code, {
      virtualFirestoreRules: RULES_WITH_GB_ONLY,
      virtualModelIdentities: GUESTBOOK_AND_ENTRY_IDENTITIES
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('unresolvedModelIdentity');
    expect(messages[0].message).toContain("'mystery'");
  });

  it('suppresses missingMatchBlock for models listed in allowedMissingCollectionNames', () => {
    const messages = lintCode(REGISTRY_WITH_GUESTBOOK_ONLY, {
      virtualFirestoreRules: EMPTY_RULES,
      virtualModelIdentities: GUESTBOOK_AND_ENTRY_IDENTITIES,
      allowedMissingCollectionNames: ['guestbook']
    });
    expect(messages).toHaveLength(0);
  });

  it('warns rulesFileMissing when no rules can be loaded', () => {
    const messages = lintCode(REGISTRY_WITH_GUESTBOOK_ONLY, {
      firestoreRulesPath: '/nonexistent/firestore.rules',
      virtualModelIdentities: GUESTBOOK_AND_ENTRY_IDENTITIES
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('rulesFileMissing');
  });

  it('skips silently when no firebaseModelsService call is present', () => {
    const code = `
      const NOT_A_REGISTRY = { guestbook: () => null };
      export { NOT_A_REGISTRY };
    `;
    const messages = lintCode(code, {
      virtualFirestoreRules: RULES_WITH_GB_ONLY,
      virtualModelIdentities: GUESTBOOK_AND_ENTRY_IDENTITIES
    });
    expect(messages).toHaveLength(0);
  });

  it('accepts an inline ObjectExpression registry argument', () => {
    const code = `
      firebaseModelsService({ guestbook: () => null });
    `;
    const messages = lintCode(code, {
      virtualFirestoreRules: RULES_WITH_GB_ONLY,
      virtualModelIdentities: GUESTBOOK_AND_ENTRY_IDENTITIES
    });
    expect(messages).toHaveLength(0);
  });

  it('treats a missing parent identity as unresolvable', () => {
    const messages = lintCode(REGISTRY_WITH_BOTH, {
      virtualFirestoreRules: RULES_WITH_NESTED_GBE,
      // Provide only the leaf identity; parent reference dangles.
      virtualModelIdentities: [{ modelName: 'guestbookEntry', collectionName: 'gbe', identityVariableName: 'guestbookEntryIdentity', parentIdentityVariableName: 'guestbookIdentity' }]
    });
    // guestbook lookup fails → unresolvedModelIdentity for 'guestbook'.
    // guestbookEntry's parent chain breaks at the dangling parent → unresolvedModelIdentity for 'guestbookEntry'.
    expect(messages).toHaveLength(2);
    expect(messages.every((m) => m.messageId === 'unresolvedModelIdentity')).toBe(true);
  });

  // Resolution against the REAL in-repo framework source (`packages/firebase/src/lib/model`) via the
  // `modelSearchRoots` option — exercises the `firestoreModelIdentity(...)` call-expression discovery
  // path end-to-end, including parent-chain resolution, with no hand-maintained identity list.
  it('resolves framework identities from real source via modelSearchRoots (call-expression path)', () => {
    const code = `
      const REGISTRY = { notificationBox: () => null, notification: () => null, storageFile: () => null, oidcEntry: () => null };
      firebaseModelsService(REGISTRY);
    `;
    const messages = lintCode(code, { virtualFirestoreRules: FRAMEWORK_RULES, modelSearchRoots: [FRAMEWORK_MODEL_SOURCE_GLOB] });
    expect(messages).toHaveLength(0);
  });

  it('still reports a genuinely-missing model when resolving against real framework source', () => {
    const code = `
      const REGISTRY = { notificationBox: () => null, mysteryLocalModel: () => null };
      firebaseModelsService(REGISTRY);
    `;
    const messages = lintCode(code, { virtualFirestoreRules: FRAMEWORK_RULES, modelSearchRoots: [FRAMEWORK_MODEL_SOURCE_GLOB] });
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('unresolvedModelIdentity');
    expect(messages[0].message).toContain('mysteryLocalModel');
  });
});

const SPEC_DIRECTORY: string = dirname(fileURLToPath(import.meta.url));
const FRAMEWORK_MODEL_SOURCE_GLOB: string = resolve(SPEC_DIRECTORY, '../../../src/lib/model/**/*.ts');

// Mirrors what `@dereekb/firebase` ships in its `.d.ts`: identity *type annotations* on
// `export declare const` (no `firestoreModelIdentity(...)` calls), using the `import("..").X<...>`
// form the compiler emits for cross-module type references, a plain `TSTypeReference` form
// (`oidcEntryIdentity`), and a doubly-nested parent chain (`notificationLoggedEventDayPage`).
const FRAMEWORK_DTS_FIXTURE = `
export declare const notificationBoxIdentity: import("../..").RootFirestoreModelIdentity<"notificationBox", "nb">;
export declare const notificationIdentity: import("../..").FirestoreModelIdentityWithParent<import("../..").RootFirestoreModelIdentity<"notificationBox", "nb">, "notification", "nbn">;
export declare const notificationLoggedEventDayIdentity: import("../..").FirestoreModelIdentityWithParent<import("../..").RootFirestoreModelIdentity<"notificationBox", "nb">, "notificationLoggedEventDay", "nbnle">;
export declare const notificationLoggedEventDayPageIdentity: import("../..").FirestoreModelIdentityWithParent<import("../..").FirestoreModelIdentityWithParent<import("../..").RootFirestoreModelIdentity<"notificationBox", "nb">, "notificationLoggedEventDay", "nbnle">, "notificationLoggedEventDayPage", "nbnlep">;
export declare const storageFileIdentity: import("../..").RootFirestoreModelIdentity<"storageFile", "sf">;
export declare const oidcEntryIdentity: RootFirestoreModelIdentity<"oidcEntry", "oidc_e">;
`;

describe('require-firestore-rule-for-service-model .d.ts identity discovery', () => {
  const fixtureDirs: string[] = [];

  const writeFixtureDir = (contents: string): string => {
    const dir = mkdtempSync(join(tmpdir(), 'dbx-fw-dts-'));
    writeFileSync(join(dir, 'identities.d.ts'), contents, 'utf8');
    fixtureDirs.push(dir);
    return dir;
  };

  afterAll(() => {
    for (const dir of fixtureDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('resolves root and one-level-parent identities from .d.ts type annotations', () => {
    const dir = writeFixtureDir(FRAMEWORK_DTS_FIXTURE);
    const code = `
      const REGISTRY = { notificationBox: () => null, notification: () => null, storageFile: () => null, oidcEntry: () => null };
      firebaseModelsService(REGISTRY);
    `;
    const messages = lintCode(code, { virtualFirestoreRules: FRAMEWORK_RULES, modelSearchRoots: [join(dir, '**/*.ts')] });
    expect(messages).toHaveLength(0);
  });

  it('recovers a deeply-nested parent chain from .d.ts type annotations', () => {
    const dir = writeFixtureDir(FRAMEWORK_DTS_FIXTURE);
    const code = `
      const REGISTRY = { notificationLoggedEventDayPage: () => null };
      firebaseModelsService(REGISTRY);
    `;
    const correctlyNested = `
service cloud.firestore {
  match /databases/{database}/documents {
    match /nb/{notificationBox} {
      match /nbnle/{notificationLoggedEventDay} {
        match /nbnlep/{notificationLoggedEventDayPage} { allow read: if true; }
      }
    }
  }
}
`;
    const ok = lintCode(code, { virtualFirestoreRules: correctlyNested, modelSearchRoots: [join(dir, '**/*.ts')] });
    expect(ok).toHaveLength(0);

    // Leaf placed at the root (no nesting) must still be flagged — proves the full nb/nbnle/nbnlep
    // chain was recovered from the doubly-nested type, not flattened to a single segment.
    const flat = `
service cloud.firestore {
  match /databases/{database}/documents {
    match /nbnlep/{notificationLoggedEventDayPage} { allow read: if true; }
  }
}
`;
    const bad = lintCode(code, { virtualFirestoreRules: flat, modelSearchRoots: [join(dir, '**/*.ts')] });
    expect(bad).toHaveLength(1);
    expect(bad[0].messageId).toBe('wrongNestingDepth');
    expect(bad[0].message).toContain('nb / nbnle / nbnlep');
  });

  it('reports a registered model absent from the .d.ts declarations', () => {
    const dir = writeFixtureDir(FRAMEWORK_DTS_FIXTURE);
    const code = `
      const REGISTRY = { storageFile: () => null, mysteryModel: () => null };
      firebaseModelsService(REGISTRY);
    `;
    const messages = lintCode(code, { virtualFirestoreRules: FRAMEWORK_RULES, modelSearchRoots: [join(dir, '**/*.ts')] });
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('unresolvedModelIdentity');
    expect(messages[0].message).toContain('mysteryModel');
  });
});

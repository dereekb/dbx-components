import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { FIREBASE_REQUIRE_FIRESTORE_RULE_FOR_SERVICE_MODEL_RULE, type VirtualModelIdentity } from './require-firestore-rule-for-service-model.rule';

const RULE_ID = 'dereekb-firebase/require-firestore-rule-for-service-model';

interface RuleOptions {
  readonly virtualFirestoreRules?: string;
  readonly virtualModelIdentities?: readonly VirtualModelIdentity[];
  readonly registryFactoryCallName?: string;
  readonly identityFactoryName?: string;
  readonly allowedMissingCollectionNames?: readonly string[];
  readonly firestoreRulesPath?: string;
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
});

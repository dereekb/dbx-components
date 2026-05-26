import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { FIREBASE_REQUIRE_STORAGEFILE_POLICY_MATCHES_RULES_RULE } from './require-storagefile-policy-matches-rules.rule';
import { parseStorageRules } from './storage-rules-parser';

const RULE_ID = 'dereekb-firebase/require-storagefile-policy-matches-rules';

function buildConfig(options?: object): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-firebase': { rules: { 'require-storagefile-policy-matches-rules': FIREBASE_REQUIRE_STORAGEFILE_POLICY_MATCHES_RULES_RULE } } as any },
      rules: { [RULE_ID]: options ? ['warn', options] : 'warn' }
    }
  ];
}

function lintCode(code: string, options?: object): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(options), { filename: 'test.ts' }).filter((m) => m.ruleId === RULE_ID);
}

const POLICY_TYPE_DEFS = `
type StorageFilePurpose = string;
type StorageFilePurposeUploadPolicy = { purpose: string; allowedMimeTypes: readonly string[]; maxFileSizeBytes: number; buildUploadPath: (input: { uid: string; filename?: string }) => string; requiresFilenameInput: boolean };
declare function userAvatarUploadsFilePath(uid: string): string;
declare function userTestFileUploadsFilePath(uid: string, filename: string): string;
`;

// === storage.rules fixtures ===

const AVATAR_RULES_OK = `
service firebase.storage {
  match /b/{bucket}/o {
    // Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[USER_AVATAR_PURPOSE]
    match /uploads/u/{uid}/avatar.img {
      allow write: if isAllowedAvatarSize();
    }
    function isAllowedAvatarSize() {
      return request.resource.size < 16 * 1024 * 1024 && request.resource.contentType.matches('image/.*')
    }
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
`;

const AVATAR_RULES_MIME_ONLY_JPEG = `
service firebase.storage {
  match /b/{bucket}/o {
    // Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[USER_AVATAR_PURPOSE]
    match /uploads/u/{uid}/avatar.img {
      allow write: if request.resource.size < 16 * 1024 * 1024 && request.resource.contentType == 'image/jpeg';
    }
  }
}
`;

const JOB_REQUIREMENT_RULES = `
service firebase.storage {
  match /b/{bucket}/o {
    match /uploads/u/{uid} {

      // Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[USER_JOB_REQUIREMENT_PURPOSE]
      match /jr/{shortKey} {
        allow write: if (isUploadUser() || userClaimsIsHellosubsAdmin()) && isAllowedJobRequirementDocument();
      }

      function isUploadUser() {
        return request.auth.uid == uid;
      }

      function isAllowedJobRequirementDocument() {
        return isAllowedJobRequirementPdfDocument() || isAllowedJobRequirementImageDocument();
      }

      function isAllowedJobRequirementPdfDocument() {
        return (request.resource.size < (16 * 1024 * 1024)) && (request.resource.contentType.matches('application/pdf'));
      }

      function isAllowedJobRequirementImageDocument() {
        return (request.resource.size < (16 * 1024 * 1024)) && (request.resource.contentType.matches('image/.*'));
      }
    }
  }
}
`;

const UNSUPPORTED_RULES = `
service firebase.storage {
  match /b/{bucket}/o {
    // Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[USER_AVATAR_PURPOSE]
    match /uploads/u/{uid}/avatar.img {
      allow write: if request.auth.uid == uid;
    }
  }
}
`;

// Mirrors the live `storage.rules` shape: `(authHelper && resourceHelper) || adminHelper`.
// The right disjunct is auth-only and must be dropped; the left disjunct must DNF-distribute
// into one branch per MIME literal inside the resource helper.
const AUTH_OR_RESOURCE_RULES = `
service firebase.storage {
  match /b/{bucket}/o {
    function userClaimsIsSysAdmin() {
      return request.auth.token.keys().hasAll(['a']) && request.auth.token.a == 1;
    }
    match /uploads/u/{uid} {
      // Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[USER_TEST_FILE_PURPOSE]
      match /test/{filename=**} {
        allow write: if (isUploadUser() && isAllowedTestFile()) || userClaimsIsSysAdmin();
      }
      function isUploadUser() {
        return request.auth.uid == uid;
      }
      function isAllowedTestFile() {
        return request.resource.size < 8 * 1024 * 1024 && (
          request.resource.contentType == 'text/plain'
            || request.resource.contentType == 'image/jpeg'
            || request.resource.contentType == 'image/png'
        );
      }
    }
  }
}
`;

const NEGATED_HELPER_RULES = `
service firebase.storage {
  match /b/{bucket}/o {
    function isUploadUser() {
      return request.auth.uid == uid;
    }
    match /uploads/u/{uid} {
      // Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[USER_AVATAR_PURPOSE]
      match /avatar.img {
        allow write: if !isUploadUser() && request.resource.size < 1024 && request.resource.contentType == 'text/plain';
      }
    }
  }
}
`;

const TERNARY_SIZE_RULES = `
service firebase.storage {
  match /b/{bucket}/o {
    // Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[USER_AVATAR_PURPOSE]
    match /uploads/u/{uid}/avatar.img {
      allow write: if request.resource.size < (request.auth.uid == uid ? 8 : 16) && request.resource.contentType == 'text/plain';
    }
  }
}
`;

const IN_LIST_MIME_RULES = `
service firebase.storage {
  match /b/{bucket}/o {
    // Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[USER_AVATAR_PURPOSE]
    match /uploads/u/{uid}/avatar.img {
      allow write: if request.resource.size < 1024 && request.resource.contentType in ['image/png', 'image/jpeg'];
    }
  }
}
`;

// === Typed-declaration fixtures ===

function singleAvatarPolicy(maxFileSizeBytes: string, mimeTypes: string): string {
  return `${POLICY_TYPE_DEFS}
export const USER_AVATAR_PURPOSE: StorageFilePurpose = 'avatar';
export const USER_AVATAR_UPLOADS_MAX_FILE_SIZE_BYTES = ${maxFileSizeBytes};
export const USER_AVATAR_UPLOADS_ALLOWED_FILE_TYPES = ${mimeTypes};
export const USER_AVATAR_UPLOAD_POLICY: StorageFilePurposeUploadPolicy = {
  purpose: USER_AVATAR_PURPOSE,
  allowedMimeTypes: USER_AVATAR_UPLOADS_ALLOWED_FILE_TYPES,
  maxFileSizeBytes: USER_AVATAR_UPLOADS_MAX_FILE_SIZE_BYTES,
  buildUploadPath: ({ uid }) => userAvatarUploadsFilePath(uid),
  requiresFilenameInput: false
};
`;
}

describe('storage-rules-parser', () => {
  it('parses a single mirrored match block with wildcard image regex', () => {
    const blocks = parseStorageRules(AVATAR_RULES_OK);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].mirrorsPolicyKey).toBe('USER_AVATAR_PURPOSE');
    expect(blocks[0].matchPath).toBe('/uploads/u/{uid}/avatar.img');
    expect(blocks[0].branches).toHaveLength(1);
    expect(blocks[0].branches[0].maxFileSizeBytes).toBe(16 * 1024 * 1024);
    expect(blocks[0].branches[0].allowedMimeRegexes).toEqual(['image/.*']);
  });

  it('parses parenthesised size expressions and ignores auth-only disjuncts', () => {
    const blocks = parseStorageRules(JOB_REQUIREMENT_RULES);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].matchPath).toBe('/uploads/u/{uid}/jr/{shortKey}');
    expect(blocks[0].branches).toHaveLength(2);
    const caps = blocks[0].branches.map((b) => b.maxFileSizeBytes).sort();
    expect(caps).toEqual([16 * 1024 * 1024, 16 * 1024 * 1024]);
    const literals = new Set(blocks[0].branches.flatMap((b) => b.allowedMimeLiterals));
    const regexes = new Set(blocks[0].branches.flatMap((b) => b.allowedMimeRegexes));
    expect(literals).toContain('application/pdf');
    expect(regexes).toContain('image/.*');
  });

  it('ignores catch-all deny blocks', () => {
    const source = `
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
`;
    expect(parseStorageRules(source)).toEqual([]);
  });

  it('returns unsupported when no resource-constraining branch is present', () => {
    const blocks = parseStorageRules(UNSUPPORTED_RULES);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].unsupported).toBeDefined();
  });

  it('extracts one branch per MIME when an auth-only disjunct sits beside a resource conjunction', () => {
    const blocks = parseStorageRules(AUTH_OR_RESOURCE_RULES);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].mirrorsPolicyKey).toBe('USER_TEST_FILE_PURPOSE');
    expect(blocks[0].matchPath).toBe('/uploads/u/{uid}/test/{filename=**}');
    expect(blocks[0].unsupported).toBeUndefined();
    expect(blocks[0].branches).toHaveLength(3);
    const caps = blocks[0].branches.map((b) => b.maxFileSizeBytes);
    expect(caps).toEqual([8 * 1024 * 1024, 8 * 1024 * 1024, 8 * 1024 * 1024]);
    const literals = new Set(blocks[0].branches.flatMap((b) => b.allowedMimeLiterals));
    expect(literals).toEqual(new Set(['text/plain', 'image/jpeg', 'image/png']));
  });

  it('ignores a negated atom and still reduces sibling size + MIME constraints', () => {
    const blocks = parseStorageRules(NEGATED_HELPER_RULES);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].unsupported).toBeUndefined();
    expect(blocks[0].branches).toHaveLength(1);
    expect(blocks[0].branches[0].maxFileSizeBytes).toBe(1024);
    expect(blocks[0].branches[0].allowedMimeLiterals).toEqual(['text/plain']);
  });

  it('emits unsupported when the size cap RHS is a ternary expression', () => {
    const blocks = parseStorageRules(TERNARY_SIZE_RULES);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].unsupported).toBeDefined();
    expect(blocks[0].branches).toHaveLength(0);
  });

  it('treats `contentType in [...]` as a list of literal MIMEs', () => {
    const blocks = parseStorageRules(IN_LIST_MIME_RULES);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].unsupported).toBeUndefined();
    expect(blocks[0].branches).toHaveLength(1);
    expect(blocks[0].branches[0].maxFileSizeBytes).toBe(1024);
    expect(new Set(blocks[0].branches[0].allowedMimeLiterals)).toEqual(new Set(['image/png', 'image/jpeg']));
  });
});

describe('require-storagefile-policy-matches-rules rule', () => {
  it('does not flag when storage.rules matches the typed policy exactly', () => {
    const code = singleAvatarPolicy('16 * 1024 * 1024', "['image/jpeg', 'image/png']");
    const messages = lintCode(code, { virtualStorageRules: AVATAR_RULES_OK });
    expect(messages).toEqual([]);
  });

  it('flags maxFileSizeMismatch when policy cap exceeds the rules cap', () => {
    const code = singleAvatarPolicy('32 * 1024 * 1024', "['image/jpeg', 'image/png']");
    const messages = lintCode(code, { virtualStorageRules: AVATAR_RULES_OK });
    expect(messages).toHaveLength(2);
    for (const msg of messages) {
      expect(msg.messageId).toBe('maxFileSizeMismatch');
      expect(msg.message).toContain('USER_AVATAR_PURPOSE');
      expect(msg.message).toContain('33554432');
      expect(msg.message).toContain('16777216');
    }
  });

  it('does NOT flag when policy cap is below the rules cap (policy is stricter)', () => {
    const code = singleAvatarPolicy('4 * 1024 * 1024', "['image/jpeg', 'image/png']");
    const messages = lintCode(code, { virtualStorageRules: AVATAR_RULES_OK });
    expect(messages).toEqual([]);
  });

  it('flags mimeTypeNotAllowed when a TS MIME has no matching rule branch', () => {
    const code = singleAvatarPolicy('16 * 1024 * 1024', "['image/webp']");
    const messages = lintCode(code, { virtualStorageRules: AVATAR_RULES_MIME_ONLY_JPEG });
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('mimeTypeNotAllowed');
    expect(messages[0].message).toContain('image/webp');
  });

  it('accepts MIME types covered by a regex branch', () => {
    const code = singleAvatarPolicy('16 * 1024 * 1024', "['image/jpeg', 'image/png', 'image/webp']");
    const messages = lintCode(code, { virtualStorageRules: AVATAR_RULES_OK });
    expect(messages).toEqual([]);
  });

  it('flags missingRuleBlock when the policy has no Mirrors marker', () => {
    const code = singleAvatarPolicy('16 * 1024 * 1024', "['image/jpeg']");
    const noMarkerRules = `
service firebase.storage {
  match /b/{bucket}/o {
    match /uploads/u/{uid}/avatar.img {
      allow write: if request.resource.size < 16 * 1024 * 1024 && request.resource.contentType.matches('image/.*');
    }
  }
}
`;
    const messages = lintCode(code, { virtualStorageRules: noMarkerRules });
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('missingRuleBlock');
  });

  it('flags orphanRuleBlock when storage.rules has a marker for a key with no matching typed declaration', () => {
    const code = singleAvatarPolicy('16 * 1024 * 1024', "['image/jpeg']");
    const combined = `
service firebase.storage {
  match /b/{bucket}/o {
    // Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[USER_AVATAR_PURPOSE]
    match /uploads/u/{uid}/avatar.img {
      allow write: if request.resource.size < 16 * 1024 * 1024 && request.resource.contentType.matches('image/.*');
    }
    // Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[REMOVED_PURPOSE]
    match /uploads/u/{uid}/removed.dat {
      allow write: if request.resource.size < 1024 && request.resource.contentType == 'text/plain';
    }
  }
}
`;
    const messages = lintCode(code, { virtualStorageRules: combined });
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('orphanRuleBlock');
    expect(messages[0].message).toContain('REMOVED_PURPOSE');
  });

  it('flags unsupportedRuleShape when the parser cannot reduce the allow predicate', () => {
    const code = singleAvatarPolicy('16 * 1024 * 1024', "['image/jpeg']");
    const messages = lintCode(code, { virtualStorageRules: UNSUPPORTED_RULES });
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('unsupportedRuleShape');
  });

  it('flags rulesFileMissing when neither virtual rules nor a readable file is provided', () => {
    const code = singleAvatarPolicy('16 * 1024 * 1024', "['image/jpeg']");
    const messages = lintCode(code, { storageRulesPath: '/nonexistent/storage.rules' });
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('rulesFileMissing');
  });

  it('no-ops on TS files that do not declare any StorageFilePurposeUploadPolicy', () => {
    const code = `export const FOO = 1;`;
    const messages = lintCode(code, { virtualStorageRules: AVATAR_RULES_OK });
    expect(messages).toEqual([]);
  });

  it('accepts a multi-branch (PDF || image) helper disjunction', () => {
    const code = `${POLICY_TYPE_DEFS}
export const USER_JOB_REQUIREMENT_PURPOSE: StorageFilePurpose = 'job_requirement';
export const USER_JR_MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024;
export const USER_JR_ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
declare function userJobRequirementUploadPath(uid: string, filename: string): string;
export const USER_JOB_REQUIREMENT_UPLOAD_POLICY: StorageFilePurposeUploadPolicy = {
  purpose: USER_JOB_REQUIREMENT_PURPOSE,
  allowedMimeTypes: USER_JR_ALLOWED_FILE_TYPES,
  maxFileSizeBytes: USER_JR_MAX_FILE_SIZE_BYTES,
  buildUploadPath: ({ uid, filename }) => userJobRequirementUploadPath(uid, filename as string),
  requiresFilenameInput: true
};
`;
    const messages = lintCode(code, { virtualStorageRules: JOB_REQUIREMENT_RULES });
    expect(messages).toEqual([]);
  });

  it('flags size mismatch when the smaller branch cap is below the TS cap for a specific MIME', () => {
    const code = `${POLICY_TYPE_DEFS}
export const USER_JOB_REQUIREMENT_PURPOSE: StorageFilePurpose = 'job_requirement';
export const USER_JOB_REQUIREMENT_UPLOAD_POLICY: StorageFilePurposeUploadPolicy = {
  purpose: USER_JOB_REQUIREMENT_PURPOSE,
  allowedMimeTypes: ['application/pdf'],
  maxFileSizeBytes: 32 * 1024 * 1024,
  buildUploadPath: ({ uid, filename }) => '' + uid + filename,
  requiresFilenameInput: true
};
`;
    const messages = lintCode(code, { virtualStorageRules: JOB_REQUIREMENT_RULES });
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('maxFileSizeMismatch');
    expect(messages[0].message).toContain('application/pdf');
  });

  it('does not flag unsupportedRuleShape on an auth-only OR resource-conjunction predicate', () => {
    const code = `${POLICY_TYPE_DEFS}
export const USER_TEST_FILE_PURPOSE: StorageFilePurpose = 'test_file';
export const USER_TEST_FILE_UPLOAD_POLICY: StorageFilePurposeUploadPolicy = {
  purpose: USER_TEST_FILE_PURPOSE,
  allowedMimeTypes: ['text/plain', 'image/jpeg', 'image/png'],
  maxFileSizeBytes: 8 * 1024 * 1024,
  buildUploadPath: ({ uid, filename }) => userTestFileUploadsFilePath(uid, filename as string),
  requiresFilenameInput: true
};
`;
    const messages = lintCode(code, { virtualStorageRules: AUTH_OR_RESOURCE_RULES });
    expect(messages).toEqual([]);
  });

  it('respects a custom policyTypeName option', () => {
    const code = `${POLICY_TYPE_DEFS}
type AppUploadPolicy = StorageFilePurposeUploadPolicy;
export const USER_AVATAR_PURPOSE: StorageFilePurpose = 'avatar';
export const USER_AVATAR_UPLOAD_POLICY: AppUploadPolicy = {
  purpose: USER_AVATAR_PURPOSE,
  allowedMimeTypes: ['image/jpeg'],
  maxFileSizeBytes: 16 * 1024 * 1024,
  buildUploadPath: ({ uid }) => userAvatarUploadsFilePath(uid),
  requiresFilenameInput: false
};
`;
    const messages = lintCode(code, { virtualStorageRules: AVATAR_RULES_OK, policyTypeName: 'AppUploadPolicy' });
    expect(messages).toEqual([]);
  });

  it('flags unresolvedPolicyField when the purpose value is neither an identifier nor a literal', () => {
    const code = `${POLICY_TYPE_DEFS}
declare function buildPurpose(): string;
export const SOME_POLICY: StorageFilePurposeUploadPolicy = {
  purpose: buildPurpose(),
  allowedMimeTypes: ['image/jpeg'],
  maxFileSizeBytes: 1024,
  buildUploadPath: ({ uid }) => userAvatarUploadsFilePath(uid),
  requiresFilenameInput: false
};
`;
    const messages = lintCode(code, { virtualStorageRules: AVATAR_RULES_OK });
    // purpose unresolvable + the existing storage.rules block becomes an orphan
    const ids = messages.map((m) => m.messageId).sort();
    expect(ids).toEqual(['orphanRuleBlock', 'unresolvedPolicyField']);
  });
});

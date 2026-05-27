import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { FIREBASE_REQUIRE_STORAGEFILE_POLICY_MATCHES_RULES_RULE } from './require-storagefile-policy-matches-rules.rule';
import { parseStorageRules } from './storage-rules-parser';
import { createImportRegistry, trackImportDeclaration, type AstNode } from './util';
import { foldUploadPath, describeFoldedPath, foldStringArrayExpression, foldNumericExpression, type FoldScope, type FoldUploadPathResult } from './storagefile-path-fold';

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

// === shared TS preamble ===
// `mergeSlashPaths` is declared so fixtures read naturally; the analyzer models it by name, so
// it needs no body. The builders / consts below are all defined in-file so the within-file
// folder (no type program in this harness) can resolve them.
const PREAMBLE = `
type StorageFilePurpose = string;
type StorageFilePurposeUploadPolicy = { purpose: string; allowedMimeTypes: readonly string[]; maxFileSizeBytes: number; buildUploadPath: (input: { uid: string; filename?: string }) => string; requiresFilenameInput: boolean };
declare function mergeSlashPaths(paths: (string | null | undefined)[]): string;

export const ALL_USER_UPLOADS_FOLDER_PATH = 'uploads/u';
// Annotated -> the checker widens to \`string\`, but the analyzer folds the AST initializer.
export const JOB_REQUIREMENT_DOCUMENT_UPLOADS_FOLDER_NAME: string = 'jr';
export const WORKER_PHOTO_UPLOADS_FILE_NAME: string = 'photo.img';
export const USERS_ROOT_FOLDER_PATH: string = '/u/';

export function userAvatarUploadsFilePath(uid: string): string {
  return mergeSlashPaths([ALL_USER_UPLOADS_FOLDER_PATH, uid, 'avatar.img']);
}
export function jobRequirementDocumentUploadsFolderPath(uid: string): string {
  return \`\${ALL_USER_UPLOADS_FOLDER_PATH}/\${uid}/\${JOB_REQUIREMENT_DOCUMENT_UPLOADS_FOLDER_NAME}/\`;
}
export function jobRequirementDocumentUploadsFilePath(uid: string, shortKey: string): string {
  return \`\${jobRequirementDocumentUploadsFolderPath(uid)}\${shortKey}\`;
}
export function workerPhotoUploadsFilePath(uid: string): string {
  return mergeSlashPaths([ALL_USER_UPLOADS_FOLDER_PATH, uid, WORKER_PHOTO_UPLOADS_FILE_NAME]);
}
export function userStorageFolderPath(userId: string, ...subPath: string[]): string {
  return mergeSlashPaths([USERS_ROOT_FOLDER_PATH, userId, '/', ...subPath]);
}
`;

// === storage.rules fixtures (no Mirrors markers — pairing is by path) ===

const AVATAR_RULES = `
service firebase.storage {
  match /b/{bucket}/o {
    match /uploads/u/{uid} {
      match /avatar.img {
        allow write: if request.resource.size < 16 * 1024 * 1024 && request.resource.contentType.matches('image/.*');
      }
    }
    match /{allPaths=**} { allow read, write: if false; }
  }
}
`;

const JOB_REQUIREMENT_RULES = `
service firebase.storage {
  match /b/{bucket}/o {
    match /uploads/u/{uid} {
      match /jr/{shortKey} {
        allow write: if (isUploadUser() || userClaimsIsAdmin()) && isAllowedJobRequirementDocument();
      }
      function isUploadUser() { return request.auth.uid == uid; }
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

const WORKER_PHOTO_RULES = `
service firebase.storage {
  match /b/{bucket}/o {
    match /uploads/u/{uid} {
      match /photo.img {
        allow write: if request.resource.size < 4 * 1024 * 1024 && request.resource.contentType.matches('image/.*');
      }
    }
  }
}
`;

const USER_STORAGE_FOLDER_RULES = `
service firebase.storage {
  match /b/{bucket}/o {
    match /u/{uid} {
      match /settings.json {
        allow write: if request.resource.size < 1024 && request.resource.contentType == 'application/json';
      }
    }
  }
}
`;

const AUTH_ONLY_AVATAR_RULES = `
service firebase.storage {
  match /b/{bucket}/o {
    match /uploads/u/{uid} {
      match /avatar.img {
        allow write: if request.auth.uid == uid;
      }
    }
  }
}
`;

// === policy builders ===

function avatarPolicy(maxFileSizeBytes: string, mimeTypes: string): string {
  return `${PREAMBLE}
export const USER_AVATAR_PURPOSE: StorageFilePurpose = 'avatar';
export const AVATAR_MAX = ${maxFileSizeBytes};
export const AVATAR_MIMES = ${mimeTypes};
export const USER_AVATAR_UPLOAD_POLICY: StorageFilePurposeUploadPolicy = {
  purpose: USER_AVATAR_PURPOSE,
  allowedMimeTypes: AVATAR_MIMES,
  maxFileSizeBytes: AVATAR_MAX,
  buildUploadPath: ({ uid }) => userAvatarUploadsFilePath(uid),
  requiresFilenameInput: false
};
`;
}

const JOB_REQUIREMENT_POLICY = `${PREAMBLE}
export const JOB_REQUIREMENT_PURPOSE: StorageFilePurpose = 'job_requirement';
export const JR_MAX = 16 * 1024 * 1024;
export const JR_MIMES = ['image/jpeg', 'image/png', 'image/heif', 'image/webp', 'application/pdf'];
export const JOB_REQUIREMENT_DOCUMENT_PURPOSE: StorageFilePurposeUploadPolicy = {
  purpose: JOB_REQUIREMENT_PURPOSE,
  allowedMimeTypes: JR_MIMES,
  maxFileSizeBytes: JR_MAX,
  buildUploadPath: ({ uid, filename }) => jobRequirementDocumentUploadsFilePath(uid, filename as string),
  requiresFilenameInput: true
};
`;

const WORKER_PHOTO_POLICY = `${PREAMBLE}
export const WORKER_PHOTO_PURPOSE: StorageFilePurpose = 'worker_photo';
export const WORKER_PHOTO_MAX = 4 * 1024 * 1024;
export const WORKER_PHOTO_PURPOSE_POLICY: StorageFilePurposeUploadPolicy = {
  purpose: WORKER_PHOTO_PURPOSE,
  allowedMimeTypes: ['image/jpeg', 'image/png'],
  maxFileSizeBytes: WORKER_PHOTO_MAX,
  buildUploadPath: ({ uid }) => workerPhotoUploadsFilePath(uid),
  requiresFilenameInput: false
};
`;

const USER_STORAGE_FOLDER_POLICY = `${PREAMBLE}
export const USER_SETTINGS_PURPOSE: StorageFilePurpose = 'user_settings';
export const USER_SETTINGS_UPLOAD_POLICY: StorageFilePurposeUploadPolicy = {
  purpose: USER_SETTINGS_PURPOSE,
  allowedMimeTypes: ['application/json'],
  maxFileSizeBytes: 1024,
  buildUploadPath: ({ uid }) => userStorageFolderPath(uid, 'settings.json'),
  requiresFilenameInput: false
};
`;

// === fold-engine direct harness ===

function programFromCode(code: string): AstNode {
  const result = tsParser.parseForESLint(code, { ecmaVersion: 2022, sourceType: 'module', range: true, loc: true } as any);
  return result.ast as unknown as AstNode;
}

function scopeFor(program: AstNode): FoldScope {
  const importRegistry = createImportRegistry();
  for (const statement of program.body ?? []) {
    if (statement?.type === 'ImportDeclaration') {
      trackImportDeclaration(importRegistry, statement);
    }
  }
  return { program, importRegistry, resolver: null };
}

function policyPropertyNodeOf(program: AstNode, policyName: string, propertyName: string): AstNode {
  for (const statement of program.body ?? []) {
    const declaration: AstNode = statement?.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations ?? []) {
        if (declarator.id?.type === 'Identifier' && declarator.id.name === policyName) {
          let init: AstNode = declarator.init;
          while (init?.type === 'TSAsExpression') init = init.expression;
          for (const property of init?.properties ?? []) {
            if (property.type === 'Property' && property.key?.name === propertyName) {
              return property.value;
            }
          }
        }
      }
    }
  }
  throw new Error(`${propertyName} not found for ${policyName}`);
}

function buildUploadPathNodeOf(program: AstNode, policyName: string): AstNode {
  return policyPropertyNodeOf(program, policyName, 'buildUploadPath');
}

function foldPolicy(code: string, policyName: string): FoldUploadPathResult {
  const program = programFromCode(code);
  return foldUploadPath(buildUploadPathNodeOf(program, policyName), scopeFor(program));
}

describe('storage-rules-parser', () => {
  it('parses every leaf allow-write block with its full match path', () => {
    const blocks = parseStorageRules(AVATAR_RULES);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].matchPath).toBe('/uploads/u/{uid}/avatar.img');
    expect(blocks[0].branches).toHaveLength(1);
    expect(blocks[0].branches[0].maxFileSizeBytes).toBe(16 * 1024 * 1024);
    expect(blocks[0].branches[0].allowedMimeRegexes).toEqual(['image/.*']);
  });

  it('records nested leaf blocks even without a Mirrors marker', () => {
    const blocks = parseStorageRules(JOB_REQUIREMENT_RULES);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].matchPath).toBe('/uploads/u/{uid}/jr/{shortKey}');
    expect(blocks[0].branches).toHaveLength(2);
    const literals = new Set(blocks[0].branches.flatMap((b) => b.allowedMimeLiterals));
    const regexes = new Set(blocks[0].branches.flatMap((b) => b.allowedMimeRegexes));
    expect(literals).toContain('application/pdf');
    expect(regexes).toContain('image/.*');
  });

  it('ignores catch-all deny blocks', () => {
    const source = `
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} { allow read, write: if false; }
  }
}
`;
    expect(parseStorageRules(source)).toEqual([]);
  });

  it('marks a block unsupported when no resource-constraining branch is present', () => {
    const blocks = parseStorageRules(AUTH_ONLY_AVATAR_RULES);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].unsupported).toBeDefined();
  });
});

describe('storagefile-path-fold', () => {
  it('folds a fixed-leaf merge builder to literal + wildcard segments', () => {
    const result = foldPolicy(WORKER_PHOTO_POLICY, 'WORKER_PHOTO_PURPOSE_POLICY');
    expect(result.ok).toBe(true);
    if (result.ok) expect(describeFoldedPath(result.path)).toBe('uploads/u/{*}/photo.img');
  });

  it('folds nested template builders with cross-reference + annotated-widened consts', () => {
    const result = foldPolicy(JOB_REQUIREMENT_POLICY, 'JOB_REQUIREMENT_DOCUMENT_PURPOSE');
    expect(result.ok).toBe(true);
    if (result.ok) expect(describeFoldedPath(result.path)).toBe('uploads/u/{*}/jr/{*}');
  });

  it('folds mergeSlashPaths with leading/trailing-slash literals and a variadic spread', () => {
    const result = foldPolicy(USER_STORAGE_FOLDER_POLICY, 'USER_SETTINGS_UPLOAD_POLICY');
    expect(result.ok).toBe(true);
    if (result.ok) expect(describeFoldedPath(result.path)).toBe('u/{*}/settings.json');
  });

  it('bails (does not guess) on a runtime value in the path', () => {
    const code = `${PREAMBLE}
declare function stringFromTimeFactory(n: number): (d: Date) => string;
export const TS_PURPOSE: StorageFilePurpose = 'ts';
export const TS_POLICY: StorageFilePurposeUploadPolicy = {
  purpose: TS_PURPOSE,
  allowedMimeTypes: ['image/jpeg'],
  maxFileSizeBytes: 1024,
  buildUploadPath: ({ uid }) => \`uploads/u/\${uid}/\${stringFromTimeFactory(6)(new Date())}\`,
  requiresFilenameInput: false
};
`;
    const result = foldPolicy(code, 'TS_POLICY');
    expect(result.ok).toBe(false);
  });

  it('bails on a statically-unknown spread/merge element', () => {
    const code = `${PREAMBLE}
declare function runtimeName(): string;
export const UNK_PURPOSE: StorageFilePurpose = 'unk';
export const UNK_POLICY: StorageFilePurposeUploadPolicy = {
  purpose: UNK_PURPOSE,
  allowedMimeTypes: ['image/jpeg'],
  maxFileSizeBytes: 1024,
  buildUploadPath: ({ uid }) => mergeSlashPaths(['uploads/u', uid, runtimeName()]),
  requiresFilenameInput: false
};
`;
    const result = foldPolicy(code, 'UNK_POLICY');
    expect(result.ok).toBe(false);
  });
});

// === scalar folders (allowedMimeTypes / maxFileSizeBytes) ===
// The harness has no type program (resolver is null), so cross-module imports do not resolve;
// these fixtures use in-file consts to exercise the AST-initializer fold (annotated-widened consts
// + array-of-identifier elements) that the old literal-only resolver bailed on. The identical
// resolution path covers cross-module consts when a resolver is present (verified end-to-end).

const MIME_BRAND_PREAMBLE = `${PREAMBLE}
type MimeBrand = string & { readonly _brand: 'mime' };
// Annotated-widened: the checker reports \`MimeBrand\`, but the analyzer folds the AST initializer.
export const JPEG_MT: MimeBrand = 'image/jpeg';
export const PNG_MT: MimeBrand = 'image/png';
export const AVATAR_SIZE_CONST: number = 4 * 1024 * 1024;
`;

function mimeConstPolicy(mimeArrayExpr: string, sizeExpr: string): string {
  return `${MIME_BRAND_PREAMBLE}
export const USER_AVATAR_PURPOSE: StorageFilePurpose = 'avatar';
export const USER_AVATAR_UPLOAD_POLICY: StorageFilePurposeUploadPolicy = {
  purpose: USER_AVATAR_PURPOSE,
  allowedMimeTypes: ${mimeArrayExpr},
  maxFileSizeBytes: ${sizeExpr},
  buildUploadPath: ({ uid }) => userAvatarUploadsFilePath(uid),
  requiresFilenameInput: false
};
`;
}

function foldMimes(code: string, policyName: string) {
  const program = programFromCode(code);
  return foldStringArrayExpression(policyPropertyNodeOf(program, policyName, 'allowedMimeTypes'), scopeFor(program));
}

function foldSize(code: string, policyName: string) {
  const program = programFromCode(code);
  return foldNumericExpression(policyPropertyNodeOf(program, policyName, 'maxFileSizeBytes'), scopeFor(program));
}

describe('storagefile-path-fold scalar folders', () => {
  it('folds allowedMimeTypes built from annotated-widened string consts', () => {
    const code = mimeConstPolicy('[JPEG_MT, PNG_MT]', '4 * 1024 * 1024');
    expect(foldMimes(code, 'USER_AVATAR_UPLOAD_POLICY')).toEqual(['image/jpeg', 'image/png']);
  });

  it('folds a mixed array of an inline literal and an imported-style const', () => {
    const code = mimeConstPolicy("[JPEG_MT, 'image/png']", '4 * 1024 * 1024');
    expect(foldMimes(code, 'USER_AVATAR_UPLOAD_POLICY')).toEqual(['image/jpeg', 'image/png']);
  });

  it('bails (returns null) when an array element is genuinely unresolvable', () => {
    const code = `${MIME_BRAND_PREAMBLE}
declare function runtimeMime(): string;
export const USER_AVATAR_PURPOSE: StorageFilePurpose = 'avatar';
export const USER_AVATAR_UPLOAD_POLICY: StorageFilePurposeUploadPolicy = {
  purpose: USER_AVATAR_PURPOSE,
  allowedMimeTypes: [JPEG_MT, runtimeMime()],
  maxFileSizeBytes: 1024,
  buildUploadPath: ({ uid }) => userAvatarUploadsFilePath(uid),
  requiresFilenameInput: false
};
`;
    expect(foldMimes(code, 'USER_AVATAR_UPLOAD_POLICY')).toBeNull();
  });

  it('folds maxFileSizeBytes from a numeric const', () => {
    const code = mimeConstPolicy('[JPEG_MT]', 'AVATAR_SIZE_CONST');
    expect(foldSize(code, 'USER_AVATAR_UPLOAD_POLICY')).toBe(4 * 1024 * 1024);
  });
});

describe('require-storagefile-policy-matches-rules rule', () => {
  it('does not flag when the folded path pairs with storage.rules and constraints align', () => {
    const code = avatarPolicy('16 * 1024 * 1024', "['image/jpeg', 'image/png']");
    expect(lintCode(code, { virtualStorageRules: AVATAR_RULES })).toEqual([]);
  });

  it('does not flag when allowedMimeTypes folds from annotated-widened string consts', () => {
    const code = mimeConstPolicy('[JPEG_MT, PNG_MT]', '16 * 1024 * 1024');
    expect(lintCode(code, { virtualStorageRules: AVATAR_RULES })).toEqual([]);
  });

  it('does not flag when maxFileSizeBytes folds from a numeric const (policy stricter)', () => {
    const code = mimeConstPolicy('[JPEG_MT]', 'AVATAR_SIZE_CONST');
    expect(lintCode(code, { virtualStorageRules: AVATAR_RULES })).toEqual([]);
  });

  it('flags unresolvedPolicyField when an allowedMimeTypes element is unresolvable', () => {
    const code = `${MIME_BRAND_PREAMBLE}
declare function runtimeMime(): string;
export const USER_AVATAR_PURPOSE: StorageFilePurpose = 'avatar';
export const USER_AVATAR_UPLOAD_POLICY: StorageFilePurposeUploadPolicy = {
  purpose: USER_AVATAR_PURPOSE,
  allowedMimeTypes: [JPEG_MT, runtimeMime()],
  maxFileSizeBytes: 1024,
  buildUploadPath: ({ uid }) => userAvatarUploadsFilePath(uid),
  requiresFilenameInput: false
};
`;
    const messages = lintCode(code, { virtualStorageRules: AVATAR_RULES });
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('unresolvedPolicyField');
    expect(messages[0].message).toContain('allowedMimeTypes');
  });

  it('pairs a nested folder + leaf path (job requirement) with all five MIME types passing', () => {
    expect(lintCode(JOB_REQUIREMENT_POLICY, { virtualStorageRules: JOB_REQUIREMENT_RULES })).toEqual([]);
  });

  it('pairs a fixed-leaf worker-photo path with a 4MB image-only rule', () => {
    expect(lintCode(WORKER_PHOTO_POLICY, { virtualStorageRules: WORKER_PHOTO_RULES })).toEqual([]);
  });

  it('pairs a variadic mergeSlashPaths folder path with collapsed slashes', () => {
    expect(lintCode(USER_STORAGE_FOLDER_POLICY, { virtualStorageRules: USER_STORAGE_FOLDER_RULES })).toEqual([]);
  });

  it('flags maxFileSizeMismatch when the policy cap exceeds the rules cap', () => {
    const code = avatarPolicy('32 * 1024 * 1024', "['image/jpeg', 'image/png']");
    const messages = lintCode(code, { virtualStorageRules: AVATAR_RULES });
    expect(messages).toHaveLength(2);
    for (const msg of messages) {
      expect(msg.messageId).toBe('maxFileSizeMismatch');
      expect(msg.message).toContain('33554432');
      expect(msg.message).toContain('16777216');
      expect(msg.message).toContain('uploads/u/{*}/avatar.img');
    }
  });

  it('does not flag when the policy cap is below the rules cap (policy is stricter)', () => {
    const code = avatarPolicy('4 * 1024 * 1024', "['image/jpeg', 'image/png']");
    expect(lintCode(code, { virtualStorageRules: AVATAR_RULES })).toEqual([]);
  });

  it('flags mimeTypeNotAllowed when a policy MIME has no satisfying rule branch', () => {
    const code = avatarPolicy('16 * 1024 * 1024', "['image/jpeg', 'application/zip']");
    const messages = lintCode(code, { virtualStorageRules: AVATAR_RULES });
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('mimeTypeNotAllowed');
    expect(messages[0].message).toContain('application/zip');
  });

  it('flags noMatchingRuleBlock when the folded path is absent from storage.rules', () => {
    const code = avatarPolicy('16 * 1024 * 1024', "['image/jpeg']");
    const messages = lintCode(code, { virtualStorageRules: JOB_REQUIREMENT_RULES });
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('noMatchingRuleBlock');
    expect(messages[0].message).toContain('uploads/u/{*}/avatar.img');
  });

  it('flags unsupportedRuleShape when the paired block has no resource constraint', () => {
    const code = avatarPolicy('16 * 1024 * 1024', "['image/jpeg']");
    const messages = lintCode(code, { virtualStorageRules: AUTH_ONLY_AVATAR_RULES });
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('unsupportedRuleShape');
  });

  it('flags unresolvablePolicyPath when the builder cannot be folded', () => {
    const code = `${PREAMBLE}
declare function stringFromTimeFactory(n: number): (d: Date) => string;
export const TS_PURPOSE: StorageFilePurpose = 'ts';
export const TS_POLICY: StorageFilePurposeUploadPolicy = {
  purpose: TS_PURPOSE,
  allowedMimeTypes: ['image/jpeg'],
  maxFileSizeBytes: 1024,
  buildUploadPath: ({ uid }) => \`uploads/u/\${uid}/\${stringFromTimeFactory(6)(new Date())}\`,
  requiresFilenameInput: false
};
`;
    const messages = lintCode(code, { virtualStorageRules: AVATAR_RULES });
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('unresolvablePolicyPath');
    expect(messages[0].message).toContain('TS_PURPOSE');
  });

  it('honors allowUnresolvablePolicies (by purpose key) for genuinely dynamic builders', () => {
    const code = `${PREAMBLE}
declare function stringFromTimeFactory(n: number): (d: Date) => string;
export const TS_PURPOSE: StorageFilePurpose = 'ts';
export const TS_POLICY: StorageFilePurposeUploadPolicy = {
  purpose: TS_PURPOSE,
  allowedMimeTypes: ['image/jpeg'],
  maxFileSizeBytes: 1024,
  buildUploadPath: ({ uid }) => \`uploads/u/\${uid}/\${stringFromTimeFactory(6)(new Date())}\`,
  requiresFilenameInput: false
};
`;
    expect(lintCode(code, { virtualStorageRules: AVATAR_RULES, allowUnresolvablePolicies: ['TS_PURPOSE'] })).toEqual([]);
  });

  it('honors allowUnresolvablePolicies (by declarator name)', () => {
    const code = `${PREAMBLE}
declare function stringFromTimeFactory(n: number): (d: Date) => string;
export const TS_PURPOSE: StorageFilePurpose = 'ts';
export const TS_POLICY: StorageFilePurposeUploadPolicy = {
  purpose: TS_PURPOSE,
  allowedMimeTypes: ['image/jpeg'],
  maxFileSizeBytes: 1024,
  buildUploadPath: ({ uid }) => \`uploads/u/\${uid}/\${stringFromTimeFactory(6)(new Date())}\`,
  requiresFilenameInput: false
};
`;
    expect(lintCode(code, { virtualStorageRules: AVATAR_RULES, allowUnresolvablePolicies: ['TS_POLICY'] })).toEqual([]);
  });

  it('flags unresolvedPolicyField when maxFileSizeBytes cannot be folded', () => {
    const code = `${PREAMBLE}
declare function dynamicSize(): number;
export const USER_AVATAR_PURPOSE: StorageFilePurpose = 'avatar';
export const USER_AVATAR_UPLOAD_POLICY: StorageFilePurposeUploadPolicy = {
  purpose: USER_AVATAR_PURPOSE,
  allowedMimeTypes: ['image/jpeg'],
  maxFileSizeBytes: dynamicSize(),
  buildUploadPath: ({ uid }) => userAvatarUploadsFilePath(uid),
  requiresFilenameInput: false
};
`;
    const messages = lintCode(code, { virtualStorageRules: AVATAR_RULES });
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('unresolvedPolicyField');
    expect(messages[0].message).toContain('maxFileSizeBytes');
  });

  it('flags rulesFileMissing when neither virtual rules nor a readable file is provided', () => {
    const code = avatarPolicy('16 * 1024 * 1024', "['image/jpeg']");
    const messages = lintCode(code, { storageRulesPath: '/nonexistent/storage.rules' });
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('rulesFileMissing');
  });

  it('no-ops on TS files that do not declare any StorageFilePurposeUploadPolicy', () => {
    expect(lintCode(`export const FOO = 1;`, { virtualStorageRules: AVATAR_RULES })).toEqual([]);
  });

  it('respects a custom policyTypeName option', () => {
    const code = `${PREAMBLE}
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
    expect(lintCode(code, { virtualStorageRules: AVATAR_RULES, policyTypeName: 'AppUploadPolicy' })).toEqual([]);
  });
});

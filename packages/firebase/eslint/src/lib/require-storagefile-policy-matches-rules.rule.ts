import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import type { Maybe } from '@dereekb/util';
import { type AstNode } from './util';
import { parseStorageRules, type ParsedRuleBranch, type ParsedStorageRulesBlock } from './storage-rules-parser';

/**
 * Default registry identifier inspected by the rule. Variables exported with this name
 * (or whose declarator binds to it) trigger the cross-check against `storage.rules`.
 */
export const DEFAULT_STORAGE_FILE_UPLOAD_POLICIES_REGISTRY_NAME: string = 'STORAGE_FILE_PURPOSE_UPLOAD_POLICIES';

/**
 * Default file name searched relative to the lint root when `storageRulesPath` is omitted.
 */
export const DEFAULT_STORAGE_RULES_FILENAME: string = 'storage.rules';

/**
 * Options for the require-storagefile-policy-matches-rules rule.
 */
export interface FirebaseRequireStorageFilePolicyMatchesRulesRuleOptions {
  /**
   * Path to the `storage.rules` file. Resolved against the ESLint `cwd` when relative.
   * Defaults to `<cwd>/storage.rules`.
   */
  readonly storageRulesPath?: string;
  /**
   * Inline `storage.rules` source used in tests; bypasses filesystem reads when set.
   */
  readonly virtualStorageRules?: string;
  /**
   * Identifier name of the upload-policy registry. Defaults to
   * {@link DEFAULT_STORAGE_FILE_UPLOAD_POLICIES_REGISTRY_NAME}.
   */
  readonly registryName?: string;
}

/**
 * ESLint rule definition for require-storagefile-policy-matches-rules.
 */
export interface FirebaseRequireStorageFilePolicyMatchesRulesRuleDefinition {
  readonly meta: {
    readonly type: 'problem';
    readonly fixable: undefined;
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: RuleContext): Record<string, (node: AstNode) => void>;
}

interface RuleContext {
  readonly options: FirebaseRequireStorageFilePolicyMatchesRulesRuleOptions[];
  readonly cwd?: string;
  readonly report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void;
}

interface ResolvedPolicy {
  readonly policyKey: string;
  readonly policyDeclaratorNode: AstNode;
  readonly maxFileSizeBytes: Maybe<number>;
  readonly allowedMimeTypes: Maybe<readonly string[]>;
}

interface ProgramConstants {
  readonly numericConstants: ReadonlyMap<string, number>;
  readonly stringArrayConstants: ReadonlyMap<string, readonly string[]>;
  readonly policyDeclarators: ReadonlyMap<string, AstNode>;
}

const rulesFileCache: Map<string, ParsedStorageRulesBlock[]> = new Map();

/**
 * Reads and parses a `storage.rules` file, caching by absolute path so repeated rule
 * activations across files in the same lint pass don't re-read disk.
 *
 * @param absolutePath - Absolute path to the rules file.
 * @returns The parsed blocks, or null when the file cannot be read.
 */
function loadParsedRulesFromPath(absolutePath: string): Maybe<ParsedStorageRulesBlock[]> {
  let result: Maybe<ParsedStorageRulesBlock[]> = null;
  const cached: Maybe<ParsedStorageRulesBlock[]> = rulesFileCache.get(absolutePath);
  if (cached) {
    result = cached;
  } else {
    try {
      const source: string = readFileSync(absolutePath, 'utf8');
      const parsed: ParsedStorageRulesBlock[] = parseStorageRules(source);
      rulesFileCache.set(absolutePath, parsed);
      result = parsed;
    } catch {
      result = null;
    }
  }
  return result;
}

/**
 * Folds a numeric expression node to a number using literals, binary `*`/`+`/`-`/`/`,
 * unary `-`/`+`, parenthesized expressions, and identifier lookups in `constants`.
 *
 * @param node - The expression node.
 * @param constants - Numeric constants resolvable by identifier name.
 * @returns The folded number, or null when any operand is unresolvable.
 */
function evaluateNumericNode(node: AstNode, constants: ReadonlyMap<string, number>): Maybe<number> {
  let result: Maybe<number> = null;
  if (node) {
    if (node.type === 'Literal' && typeof node.value === 'number') {
      result = node.value;
    } else if (node.type === 'UnaryExpression' && (node.operator === '-' || node.operator === '+')) {
      const arg: Maybe<number> = evaluateNumericNode(node.argument, constants);
      if (typeof arg === 'number') {
        result = node.operator === '-' ? -arg : arg;
      }
    } else if (node.type === 'BinaryExpression') {
      const left: Maybe<number> = evaluateNumericNode(node.left, constants);
      const right: Maybe<number> = evaluateNumericNode(node.right, constants);
      if (typeof left === 'number' && typeof right === 'number') {
        result = applyBinaryOperator(node.operator, left, right);
      }
    } else if (node.type === 'Identifier') {
      const value: Maybe<number> = constants.get(node.name);
      if (typeof value === 'number') {
        result = value;
      }
    } else if (node.type === 'TSAsExpression' && node.expression) {
      result = evaluateNumericNode(node.expression, constants);
    }
  }
  return result;
}

/**
 * Applies a binary operator to two folded operands, returning null for unsupported operators.
 *
 * @param operator - The binary operator (`+`, `-`, `*`, `/`).
 * @param left - Left operand.
 * @param right - Right operand.
 * @returns The result, or null when the operator is unsupported.
 */
function applyBinaryOperator(operator: string, left: number, right: number): Maybe<number> {
  let result: Maybe<number> = null;
  if (operator === '*') {
    result = left * right;
  } else if (operator === '+') {
    result = left + right;
  } else if (operator === '-') {
    result = left - right;
  } else if (operator === '/' && right !== 0) {
    result = left / right;
  }
  return result;
}

/**
 * Folds a string-array expression node to a list of strings using array literals of string
 * literals and identifier lookups in `constants`.
 *
 * @param node - The expression node.
 * @param constants - String-array constants resolvable by identifier name.
 * @returns The resolved string array, or null when any element is unresolvable.
 */
function evaluateStringArrayNode(node: AstNode, constants: ReadonlyMap<string, readonly string[]>): Maybe<readonly string[]> {
  let result: Maybe<readonly string[]> = null;
  if (node) {
    if (node.type === 'ArrayExpression') {
      const items: string[] = [];
      let allLiterals: boolean = true;
      for (const element of node.elements ?? []) {
        if (element && element.type === 'Literal' && typeof element.value === 'string') {
          items.push(element.value);
        } else {
          allLiterals = false;
          break;
        }
      }
      if (allLiterals) {
        result = items;
      }
    } else if (node.type === 'Identifier') {
      const value: Maybe<readonly string[]> = constants.get(node.name);
      if (value) {
        result = value;
      }
    } else if (node.type === 'TSAsExpression' && node.expression) {
      result = evaluateStringArrayNode(node.expression, constants);
    }
  }
  return result;
}

/**
 * Walks the Program body to index every top-level numeric / string-array `const` and every
 * declarator whose initializer is an object literal — the latter feeds the policy lookup.
 *
 * @param programNode - The Program AST node.
 * @returns The constants index for the file.
 */
function indexProgramConstants(programNode: AstNode): ProgramConstants {
  const numericConstants: Map<string, number> = new Map();
  const stringArrayConstants: Map<string, readonly string[]> = new Map();
  const policyDeclarators: Map<string, AstNode> = new Map();

  const declarators: AstNode[] = collectTopLevelDeclarators(programNode);

  for (const declarator of declarators) {
    if (declarator.id?.type === 'Identifier' && declarator.init) {
      const name: string = declarator.id.name;
      const init: AstNode = declarator.init.type === 'TSAsExpression' ? declarator.init.expression : declarator.init;
      const numeric: Maybe<number> = evaluateNumericNode(init, numericConstants);
      if (typeof numeric === 'number') {
        numericConstants.set(name, numeric);
      }
      const stringArray: Maybe<readonly string[]> = evaluateStringArrayNode(init, stringArrayConstants);
      if (stringArray) {
        stringArrayConstants.set(name, stringArray);
      }
      if (init.type === 'ObjectExpression') {
        policyDeclarators.set(name, declarator);
      }
    }
  }

  return { numericConstants, stringArrayConstants, policyDeclarators };
}

/**
 * Collects every `VariableDeclarator` directly under the Program body, looking through
 * `ExportNamedDeclaration` wrappers.
 *
 * @param programNode - The Program AST node.
 * @returns The list of top-level declarators.
 */
function collectTopLevelDeclarators(programNode: AstNode): AstNode[] {
  const declarators: AstNode[] = [];
  for (const statement of programNode.body ?? []) {
    const declaration: Maybe<AstNode> = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement.type === 'VariableDeclaration' ? statement : null;
    if (declaration?.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations ?? []) {
        declarators.push(declarator);
      }
    }
  }
  return declarators;
}

/**
 * Finds the registry declarator (e.g. `STORAGE_FILE_PURPOSE_UPLOAD_POLICIES = { ... }`) in
 * the Program body, looking through `ExportNamedDeclaration` and `TSAsExpression` wrappers.
 *
 * @param programNode - The Program AST node.
 * @param registryName - The expected registry identifier name.
 * @returns The registry declarator, or null when absent.
 */
function findRegistryDeclarator(programNode: AstNode, registryName: string): Maybe<AstNode> {
  let result: Maybe<AstNode> = null;
  const declarators: AstNode[] = collectTopLevelDeclarators(programNode);
  for (const declarator of declarators) {
    if (declarator.id?.type === 'Identifier' && declarator.id.name === registryName) {
      result = declarator;
      break;
    }
  }
  return result;
}

/**
 * Resolves the inner ObjectExpression from a registry declarator's initializer, looking
 * through `TSAsExpression` casts.
 *
 * @param declarator - The registry declarator.
 * @returns The ObjectExpression, or null when the initializer is not an object literal.
 */
function registryObjectExpression(declarator: AstNode): Maybe<AstNode> {
  let result: Maybe<AstNode> = null;
  let init: Maybe<AstNode> = declarator.init;
  while (init && init.type === 'TSAsExpression') {
    init = init.expression;
  }
  if (init?.type === 'ObjectExpression') {
    result = init;
  }
  return result;
}

/**
 * Walks each property of the registry object literal and produces a `ResolvedPolicy` per
 * entry by following the value identifier to its declarator and folding the policy
 * object's `maxFileSizeBytes` / `allowedMimeTypes` fields.
 *
 * @param registryObject - The registry ObjectExpression.
 * @param constants - The Program constants index.
 * @returns Per-entry resolved policy view, plus the set of policy keys present.
 */
function resolveRegistryPolicies(registryObject: AstNode, constants: ProgramConstants): ResolvedPolicy[] {
  const resolved: ResolvedPolicy[] = [];
  for (const property of registryObject.properties ?? []) {
    if (property.type === 'Property' && property.computed && property.key?.type === 'Identifier' && property.value?.type === 'Identifier') {
      const policyKey: string = property.key.name;
      const policyDeclName: string = property.value.name;
      const policyDeclarator: Maybe<AstNode> = constants.policyDeclarators.get(policyDeclName);
      if (policyDeclarator) {
        const policyView: ResolvedPolicy = buildResolvedPolicy(policyKey, policyDeclarator, constants);
        resolved.push(policyView);
      } else {
        resolved.push({ policyKey, policyDeclaratorNode: property, maxFileSizeBytes: null, allowedMimeTypes: null });
      }
    }
  }
  return resolved;
}

/**
 * Pulls `maxFileSizeBytes` and `allowedMimeTypes` from a policy declarator's object literal,
 * folding numeric expressions and string-array references via `constants`.
 *
 * @param policyKey - The policy key from the registry computed key.
 * @param declarator - The policy declarator (e.g. `USER_AVATAR_UPLOAD_POLICY = {...}`).
 * @param constants - The Program constants index.
 * @returns The resolved policy with folded numeric/string-array values.
 */
function buildResolvedPolicy(policyKey: string, declarator: AstNode, constants: ProgramConstants): ResolvedPolicy {
  let init: Maybe<AstNode> = declarator.init;
  while (init && init.type === 'TSAsExpression') {
    init = init.expression;
  }
  let maxFileSizeBytes: Maybe<number> = null;
  let allowedMimeTypes: Maybe<readonly string[]> = null;
  if (init?.type === 'ObjectExpression') {
    for (const property of init.properties ?? []) {
      if (property.type === 'Property' && property.key?.type === 'Identifier' && !property.computed) {
        if (property.key.name === 'maxFileSizeBytes') {
          maxFileSizeBytes = evaluateNumericNode(property.value, constants.numericConstants);
        } else if (property.key.name === 'allowedMimeTypes') {
          allowedMimeTypes = evaluateStringArrayNode(property.value, constants.stringArrayConstants);
        }
      }
    }
  }
  return { policyKey, policyDeclaratorNode: declarator, maxFileSizeBytes, allowedMimeTypes };
}

/**
 * Returns the set of rule branches that accept the given MIME type, treating regex entries
 * as anchored full-string regular expressions.
 *
 * @param branches - The parsed branches for a `Mirrors ...` block.
 * @param mimeType - The MIME literal from the TS policy.
 * @returns The matching branches (possibly empty).
 */
function branchesAcceptingMimeType(branches: readonly ParsedRuleBranch[], mimeType: string): ParsedRuleBranch[] {
  const matches: ParsedRuleBranch[] = [];
  for (const branch of branches) {
    if (branch.allowedMimeLiterals.includes(mimeType)) {
      matches.push(branch);
    } else if (branchRegexAcceptsMime(branch, mimeType)) {
      matches.push(branch);
    }
  }
  return matches;
}

/**
 * Returns true when any of the branch's regex MIME patterns matches the given MIME.
 * Patterns are anchored to the full string.
 *
 * @param branch - One parsed rule branch.
 * @param mimeType - The MIME literal.
 * @returns True when at least one regex matches.
 */
function branchRegexAcceptsMime(branch: ParsedRuleBranch, mimeType: string): boolean {
  let result: boolean = false;
  for (const pattern of branch.allowedMimeRegexes) {
    try {
      const regex: RegExp = new RegExp(`^${pattern}$`);
      if (regex.test(mimeType)) {
        result = true;
        break;
      }
    } catch {
      // Invalid regex (rules file syntax we don't yet handle) — skip silently.
    }
  }
  return result;
}

/**
 * Resolves the absolute path to the rules file from the rule options and ESLint cwd.
 *
 * @param options - Rule options.
 * @param cwd - ESLint working directory (defaults to `process.cwd()`).
 * @returns The absolute rules file path.
 */
function resolveStorageRulesPath(options: FirebaseRequireStorageFilePolicyMatchesRulesRuleOptions, cwd: string): string {
  let result: string;
  if (options.storageRulesPath) {
    result = isAbsolute(options.storageRulesPath) ? options.storageRulesPath : resolve(cwd, options.storageRulesPath);
  } else {
    result = resolve(cwd, DEFAULT_STORAGE_RULES_FILENAME);
  }
  return result;
}

/**
 * ESLint rule that cross-checks every entry of `STORAGE_FILE_PURPOSE_UPLOAD_POLICIES` in
 * a `*-firebase` component against the workspace's `storage.rules`. Each policy must have
 * a paired `// Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[<KEY>]` match block whose
 * `request.resource.size` cap and `request.resource.contentType` predicate are at least
 * as permissive as the TypeScript policy's `maxFileSizeBytes` and `allowedMimeTypes`.
 *
 * Reports on the TS side so drift surfaces in the normal lint pipeline; mismatches almost
 * always originate from editing one side and forgetting the other.
 *
 * @example
 * ```ts
 * // OK — storage.rules has `Mirrors ...[USER_AVATAR_PURPOSE]` block with matching constraints
 * export const USER_AVATAR_UPLOAD_POLICY: StorageFilePurposeUploadPolicy = {
 *   purpose: USER_AVATAR_PURPOSE,
 *   allowedMimeTypes: ['image/jpeg', 'image/png'],
 *   maxFileSizeBytes: 16 * 1024 * 1024,
 *   buildUploadPath: ({ uid }) => userAvatarUploadsFilePath(uid),
 *   requiresFilenameInput: false
 * };
 * ```
 */
export const FIREBASE_REQUIRE_STORAGEFILE_POLICY_MATCHES_RULES_RULE: FirebaseRequireStorageFilePolicyMatchesRulesRuleDefinition = {
  meta: {
    type: 'problem',
    fixable: undefined,
    docs: {
      description: 'Cross-check STORAGE_FILE_PURPOSE_UPLOAD_POLICIES entries against the workspace storage.rules so the TS-side upload policy (maxFileSizeBytes + allowedMimeTypes) stays in sync with the Firebase Storage security rule that gates the same path.',
      recommended: true
    },
    messages: {
      maxFileSizeMismatch: "Upload policy '{{policy}}' has maxFileSizeBytes {{tsValue}} but storage.rules allows < {{rulesValue}} for MIME type '{{mime}}'. Update either side so the rules cap matches or exceeds the policy cap.",
      mimeTypeNotAllowed: "Upload policy '{{policy}}' allows MIME type '{{mime}}' but no storage.rules branch under 'Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[{{policy}}]' accepts it.",
      missingRuleBlock: "Upload policy '{{policy}}' has no matching '// Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[{{policy}}]' block in storage.rules at {{path}}.",
      orphanRuleBlock: "storage.rules block 'Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[{{policy}}]' (line {{line}}) has no matching policy in the registry.",
      unsupportedRuleShape: "storage.rules block for '{{policy}}' (line {{line}}) could not be parsed: {{reason}}. Refactor the rule or extend the validator.",
      rulesFileMissing: 'Could not read storage.rules at {{path}}. Set the rule option `storageRulesPath` or place the file at the workspace root.',
      unresolvedPolicyField: "Upload policy '{{policy}}' has unresolvable {{field}}; the rule cannot statically fold the value to compare against storage.rules."
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          storageRulesPath: { type: 'string' as const },
          virtualStorageRules: { type: 'string' as const },
          registryName: { type: 'string' as const }
        }
      }
    ]
  },
  create(context) {
    const options: FirebaseRequireStorageFilePolicyMatchesRulesRuleOptions = context.options[0] ?? {};
    const registryName: string = options.registryName ?? DEFAULT_STORAGE_FILE_UPLOAD_POLICIES_REGISTRY_NAME;
    const cwd: string = context.cwd ?? process.cwd();

    return {
      Program: (programNode: AstNode) => {
        const registryDeclarator: Maybe<AstNode> = findRegistryDeclarator(programNode, registryName);
        if (!registryDeclarator) return;

        const registryObject: Maybe<AstNode> = registryObjectExpression(registryDeclarator);
        if (!registryObject) return;

        const rulesResolution = loadParsedRules(options, cwd);
        if (rulesResolution.error) {
          context.report({ node: registryDeclarator, messageId: 'rulesFileMissing', data: { path: rulesResolution.absolutePath ?? DEFAULT_STORAGE_RULES_FILENAME } });
          return;
        }

        const parsedBlocks: readonly ParsedStorageRulesBlock[] = rulesResolution.blocks ?? [];
        const constants: ProgramConstants = indexProgramConstants(programNode);
        const resolvedPolicies: readonly ResolvedPolicy[] = resolveRegistryPolicies(registryObject, constants);

        compareResolvedPolicies(resolvedPolicies, parsedBlocks, rulesResolution.absolutePath ?? DEFAULT_STORAGE_RULES_FILENAME, context);
        reportOrphanRuleBlocks(parsedBlocks, resolvedPolicies, registryDeclarator, context);
      }
    };
  }
};

interface RulesResolution {
  readonly blocks?: readonly ParsedStorageRulesBlock[];
  readonly absolutePath?: string;
  readonly error?: boolean;
}

/**
 * Loads parsed `storage.rules` blocks from either the inline `virtualStorageRules` option
 * (used by specs) or the resolved rules-file path.
 *
 * @param options - Rule options.
 * @param cwd - ESLint working directory.
 * @returns A resolution record carrying blocks, an absolute path, or an error flag.
 */
function loadParsedRules(options: FirebaseRequireStorageFilePolicyMatchesRulesRuleOptions, cwd: string): RulesResolution {
  let result: RulesResolution;
  if (typeof options.virtualStorageRules === 'string') {
    result = { blocks: parseStorageRules(options.virtualStorageRules) };
  } else {
    const absolutePath: string = resolveStorageRulesPath(options, cwd);
    const blocks: Maybe<readonly ParsedStorageRulesBlock[]> = loadParsedRulesFromPath(absolutePath);
    if (blocks) {
      result = { blocks, absolutePath };
    } else {
      result = { absolutePath, error: true };
    }
  }
  return result;
}

/**
 * Reports each resolved policy that mismatches the parsed `storage.rules` blocks.
 *
 * @param resolvedPolicies - Per-entry view of registry policies with folded values.
 * @param parsedBlocks - Mirrored blocks parsed from `storage.rules`.
 * @param rulesPath - Absolute path to the rules file (for error messages).
 * @param context - ESLint rule context.
 */
function compareResolvedPolicies(resolvedPolicies: readonly ResolvedPolicy[], parsedBlocks: readonly ParsedStorageRulesBlock[], rulesPath: string, context: RuleContext): void {
  const blocksByKey: Map<string, ParsedStorageRulesBlock> = new Map();
  for (const block of parsedBlocks) {
    blocksByKey.set(block.mirrorsPolicyKey, block);
  }

  for (const policy of resolvedPolicies) {
    const block: Maybe<ParsedStorageRulesBlock> = blocksByKey.get(policy.policyKey);
    if (!block) {
      context.report({ node: policy.policyDeclaratorNode, messageId: 'missingRuleBlock', data: { policy: policy.policyKey, path: rulesPath } });
      continue;
    }
    if (block.unsupported) {
      context.report({ node: policy.policyDeclaratorNode, messageId: 'unsupportedRuleShape', data: { policy: policy.policyKey, line: String(block.sourceLine), reason: block.unsupported } });
      continue;
    }
    if (typeof policy.maxFileSizeBytes !== 'number') {
      context.report({ node: policy.policyDeclaratorNode, messageId: 'unresolvedPolicyField', data: { policy: policy.policyKey, field: 'maxFileSizeBytes' } });
      continue;
    }
    if (!policy.allowedMimeTypes) {
      context.report({ node: policy.policyDeclaratorNode, messageId: 'unresolvedPolicyField', data: { policy: policy.policyKey, field: 'allowedMimeTypes' } });
      continue;
    }
    comparePolicyToBlock(policy, block, context);
  }
}

/**
 * Validates that each MIME the policy permits is accepted by at least one branch and that
 * the branch's size cap is ≥ the policy cap. Emits ESLint reports for any mismatch.
 *
 * @param policy - The resolved policy.
 * @param block - The parsed rules block paired by `mirrorsPolicyKey`.
 * @param context - ESLint rule context.
 */
function comparePolicyToBlock(policy: ResolvedPolicy, block: ParsedStorageRulesBlock, context: RuleContext): void {
  const tsCap: number = policy.maxFileSizeBytes as number;
  const mimes: readonly string[] = policy.allowedMimeTypes as readonly string[];
  for (const mime of mimes) {
    const accepting: ParsedRuleBranch[] = branchesAcceptingMimeType(block.branches, mime);
    if (accepting.length === 0) {
      context.report({ node: policy.policyDeclaratorNode, messageId: 'mimeTypeNotAllowed', data: { policy: policy.policyKey, mime } });
    } else {
      let largest: number = Number.NEGATIVE_INFINITY;
      for (const branch of accepting) {
        if (branch.maxFileSizeBytes > largest) {
          largest = branch.maxFileSizeBytes;
        }
      }
      if (tsCap > largest) {
        context.report({ node: policy.policyDeclaratorNode, messageId: 'maxFileSizeMismatch', data: { policy: policy.policyKey, tsValue: String(tsCap), rulesValue: String(largest), mime } });
      }
    }
  }
}

/**
 * Reports each parsed rules block whose `mirrorsPolicyKey` has no corresponding entry in
 * the registry — signals stale `Mirrors ...` markers left over after a policy was removed.
 *
 * @param parsedBlocks - Mirrored blocks parsed from `storage.rules`.
 * @param resolvedPolicies - Per-entry view of registry policies.
 * @param registryDeclarator - Reported on the registry declarator since the block lives in a separate file.
 * @param context - ESLint rule context.
 */
function reportOrphanRuleBlocks(parsedBlocks: readonly ParsedStorageRulesBlock[], resolvedPolicies: readonly ResolvedPolicy[], registryDeclarator: AstNode, context: RuleContext): void {
  const knownKeys: Set<string> = new Set();
  for (const policy of resolvedPolicies) {
    knownKeys.add(policy.policyKey);
  }
  for (const block of parsedBlocks) {
    if (!knownKeys.has(block.mirrorsPolicyKey)) {
      context.report({ node: registryDeclarator, messageId: 'orphanRuleBlock', data: { policy: block.mirrorsPolicyKey, line: String(block.sourceLine) } });
    }
  }
}

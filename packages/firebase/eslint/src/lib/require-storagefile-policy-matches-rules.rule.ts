import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import type { Maybe } from '@dereekb/util';
import { type AstNode } from './util';
import { parseStorageRules, type ParsedRuleBranch, type ParsedStorageRulesBlock } from './storage-rules-parser';

/**
 * Default type name the rule looks for on top-level declarators. Variables whose type
 * annotation resolves to this identifier are treated as upload policies and validated
 * against `storage.rules`.
 */
export const DEFAULT_STORAGE_FILE_UPLOAD_POLICY_TYPE_NAME: string = 'StorageFilePurposeUploadPolicy';

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
   * Type-annotation identifier the rule treats as the upload-policy marker. Defaults to
   * {@link DEFAULT_STORAGE_FILE_UPLOAD_POLICY_TYPE_NAME}.
   */
  readonly policyTypeName?: string;
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
  readonly policyKey: Maybe<string>;
  readonly policyDeclaratorNode: AstNode;
  readonly maxFileSizeBytes: Maybe<number>;
  readonly allowedMimeTypes: Maybe<readonly string[]>;
}

interface ProgramConstants {
  readonly numericConstants: ReadonlyMap<string, number>;
  readonly stringArrayConstants: ReadonlyMap<string, readonly string[]>;
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
 * Extracts the cross-reference key used to pair a policy with its `storage.rules` `Mirrors`
 * block.
 *
 * - When `purpose` is an `Identifier`, the constant name (e.g. `USER_AVATAR_PURPOSE`) is the
 *   key — this is what `// Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[USER_AVATAR_PURPOSE]`
 *   comments reference.
 * - When `purpose` is a string literal, the literal value is used so a policy that inlines
 *   `purpose: 'avatar'` can still pair with `Mirrors ...[avatar]`.
 * - `TSAsExpression` is unwrapped transparently.
 * - Anything else (computed expression, member access, function call) returns null and
 *   triggers `unresolvedPolicyField`.
 *
 * @param node - The expression node for the policy's `purpose` field.
 * @returns The mirror-cross-reference key, or null when unresolvable.
 */
function extractPolicyKey(node: AstNode): Maybe<string> {
  let result: Maybe<string> = null;
  if (node) {
    if (node.type === 'Identifier') {
      result = node.name;
    } else if (node.type === 'Literal' && typeof node.value === 'string') {
      result = node.value;
    } else if (node.type === 'TSAsExpression' && node.expression) {
      result = extractPolicyKey(node.expression);
    }
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
 * Walks the Program body to index every top-level numeric / string / string-array `const` so
 * later folding can resolve identifier references inside policy literals.
 *
 * @param programNode - The Program AST node.
 * @returns The constants index for the file.
 */
function indexProgramConstants(programNode: AstNode): ProgramConstants {
  const numericConstants: Map<string, number> = new Map();
  const stringArrayConstants: Map<string, readonly string[]> = new Map();

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
    }
  }

  return { numericConstants, stringArrayConstants };
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
 * Collects every top-level declarator whose type annotation is the given identifier (e.g.
 * `const X: StorageFilePurposeUploadPolicy = { ... }`). Both bare object initializers and
 * `TSAsExpression`-wrapped initializers are accepted.
 *
 * @param programNode - The Program AST node.
 * @param typeName - The expected type-reference identifier name.
 * @returns The declarators that look like typed policy declarations.
 */
function collectTypedPolicyDeclarators(programNode: AstNode, typeName: string): AstNode[] {
  const matched: AstNode[] = [];
  const declarators: AstNode[] = collectTopLevelDeclarators(programNode);

  for (const declarator of declarators) {
    if (declarator.id?.type !== 'Identifier' || !declarator.init) {
      continue;
    }

    const typeAnnotation: Maybe<AstNode> = declarator.id?.typeAnnotation?.typeAnnotation;
    const isTargetType: boolean = typeAnnotation?.type === 'TSTypeReference' && typeAnnotation.typeName?.type === 'Identifier' && typeAnnotation.typeName.name === typeName;
    if (!isTargetType) {
      continue;
    }

    let init: Maybe<AstNode> = declarator.init;
    while (init && init.type === 'TSAsExpression') {
      init = init.expression;
    }
    if (init?.type === 'ObjectExpression') {
      matched.push(declarator);
    }
  }

  return matched;
}

/**
 * Pulls `purpose`, `maxFileSizeBytes`, and `allowedMimeTypes` from a policy declarator's
 * object literal, folding numeric / string / string-array references via `constants`.
 *
 * @param declarator - The policy declarator (e.g. `USER_AVATAR_UPLOAD_POLICY = {...}`).
 * @param constants - The Program constants index.
 * @returns The resolved policy with folded values.
 */
function buildResolvedPolicy(declarator: AstNode, constants: ProgramConstants): ResolvedPolicy {
  let init: Maybe<AstNode> = declarator.init;
  while (init && init.type === 'TSAsExpression') {
    init = init.expression;
  }
  let policyKey: Maybe<string> = null;
  let maxFileSizeBytes: Maybe<number> = null;
  let allowedMimeTypes: Maybe<readonly string[]> = null;
  if (init?.type === 'ObjectExpression') {
    for (const property of init.properties ?? []) {
      if (property.type === 'Property' && property.key?.type === 'Identifier' && !property.computed) {
        if (property.key.name === 'purpose') {
          policyKey = extractPolicyKey(property.value);
        } else if (property.key.name === 'maxFileSizeBytes') {
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
 * ESLint rule that cross-checks every `StorageFilePurposeUploadPolicy`-typed declaration in
 * a `*-firebase` component against the workspace's `storage.rules`. Each policy must have a
 * paired `// Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[<KEY>]` match block whose
 * `request.resource.size` cap and `request.resource.contentType` predicate are at least as
 * permissive as the TypeScript policy's `maxFileSizeBytes` and `allowedMimeTypes`.
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
      description: 'Cross-check every StorageFilePurposeUploadPolicy declaration against the workspace storage.rules so the TS-side upload policy (maxFileSizeBytes + allowedMimeTypes) stays in sync with the Firebase Storage security rule that gates the same path.',
      recommended: true
    },
    messages: {
      maxFileSizeMismatch: "Upload policy '{{policy}}' has maxFileSizeBytes {{tsValue}} but storage.rules allows < {{rulesValue}} for MIME type '{{mime}}'. Update either side so the rules cap matches or exceeds the policy cap.",
      mimeTypeNotAllowed: "Upload policy '{{policy}}' allows MIME type '{{mime}}' but no storage.rules branch under 'Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[{{policy}}]' accepts it.",
      missingRuleBlock: "Upload policy '{{policy}}' has no matching '// Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[{{policy}}]' block in storage.rules at {{path}}.",
      orphanRuleBlock: "storage.rules block 'Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[{{policy}}]' (line {{line}}) has no matching StorageFilePurposeUploadPolicy declaration in this file.",
      unsupportedRuleShape: "storage.rules block for '{{policy}}' (line {{line}}) could not be parsed: {{reason}}. Refactor the rule or extend the validator.",
      rulesFileMissing: 'Could not read storage.rules at {{path}}. Set the rule option `storageRulesPath` or place the file at the workspace root.',
      unresolvedPolicyField: 'Upload policy{{policyLabel}} has unresolvable {{field}}; the rule cannot statically fold the value to compare against storage.rules.'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          storageRulesPath: { type: 'string' as const },
          virtualStorageRules: { type: 'string' as const },
          policyTypeName: { type: 'string' as const }
        }
      }
    ]
  },
  create(context) {
    const options: FirebaseRequireStorageFilePolicyMatchesRulesRuleOptions = context.options[0] ?? {};
    const policyTypeName: string = options.policyTypeName ?? DEFAULT_STORAGE_FILE_UPLOAD_POLICY_TYPE_NAME;
    const cwd: string = context.cwd ?? process.cwd();

    return {
      Program: (programNode: AstNode) => {
        const typedDeclarators: readonly AstNode[] = collectTypedPolicyDeclarators(programNode, policyTypeName);
        if (typedDeclarators.length === 0) return;

        const rulesResolution = loadParsedRules(options, cwd);
        if (rulesResolution.error) {
          context.report({ node: typedDeclarators[0], messageId: 'rulesFileMissing', data: { path: rulesResolution.absolutePath ?? DEFAULT_STORAGE_RULES_FILENAME } });
          return;
        }

        const parsedBlocks: readonly ParsedStorageRulesBlock[] = rulesResolution.blocks ?? [];
        const constants: ProgramConstants = indexProgramConstants(programNode);
        const resolvedPolicies: readonly ResolvedPolicy[] = typedDeclarators.map((declarator) => buildResolvedPolicy(declarator, constants));

        compareResolvedPolicies(resolvedPolicies, parsedBlocks, rulesResolution.absolutePath ?? DEFAULT_STORAGE_RULES_FILENAME, context);
        reportOrphanRuleBlocks(parsedBlocks, resolvedPolicies, programNode, context);
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
 * @param resolvedPolicies - Per-declaration view of typed policies with folded values.
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
    if (typeof policy.policyKey !== 'string') {
      context.report({ node: policy.policyDeclaratorNode, messageId: 'unresolvedPolicyField', data: { policyLabel: '', field: 'purpose' } });
      continue;
    }
    const policyKey: string = policy.policyKey;
    const block: Maybe<ParsedStorageRulesBlock> = blocksByKey.get(policyKey);
    if (!block) {
      context.report({ node: policy.policyDeclaratorNode, messageId: 'missingRuleBlock', data: { policy: policyKey, path: rulesPath } });
      continue;
    }
    if (block.unsupported) {
      context.report({ node: policy.policyDeclaratorNode, messageId: 'unsupportedRuleShape', data: { policy: policyKey, line: String(block.sourceLine), reason: block.unsupported } });
      continue;
    }
    if (typeof policy.maxFileSizeBytes !== 'number') {
      context.report({ node: policy.policyDeclaratorNode, messageId: 'unresolvedPolicyField', data: { policyLabel: ` '${policyKey}'`, field: 'maxFileSizeBytes' } });
      continue;
    }
    if (!policy.allowedMimeTypes) {
      context.report({ node: policy.policyDeclaratorNode, messageId: 'unresolvedPolicyField', data: { policyLabel: ` '${policyKey}'`, field: 'allowedMimeTypes' } });
      continue;
    }
    comparePolicyToBlock(policyKey, policy, block, context);
  }
}

/**
 * Validates that each MIME the policy permits is accepted by at least one branch and that
 * the branch's size cap is ≥ the policy cap. Emits ESLint reports for any mismatch.
 *
 * @param policyKey - The resolved purpose key.
 * @param policy - The resolved policy.
 * @param block - The parsed rules block paired by `mirrorsPolicyKey`.
 * @param context - ESLint rule context.
 */
function comparePolicyToBlock(policyKey: string, policy: ResolvedPolicy, block: ParsedStorageRulesBlock, context: RuleContext): void {
  const tsCap: number = policy.maxFileSizeBytes as number;
  const mimes: readonly string[] = policy.allowedMimeTypes as readonly string[];
  for (const mime of mimes) {
    const accepting: ParsedRuleBranch[] = branchesAcceptingMimeType(block.branches, mime);
    if (accepting.length === 0) {
      context.report({ node: policy.policyDeclaratorNode, messageId: 'mimeTypeNotAllowed', data: { policy: policyKey, mime } });
    } else {
      let largest: number = Number.NEGATIVE_INFINITY;
      for (const branch of accepting) {
        if (branch.maxFileSizeBytes > largest) {
          largest = branch.maxFileSizeBytes;
        }
      }
      if (tsCap > largest) {
        context.report({ node: policy.policyDeclaratorNode, messageId: 'maxFileSizeMismatch', data: { policy: policyKey, tsValue: String(tsCap), rulesValue: String(largest), mime } });
      }
    }
  }
}

/**
 * Reports each parsed rules block whose `mirrorsPolicyKey` has no corresponding typed
 * declaration in this file — signals stale `Mirrors ...` markers left over after a policy
 * was removed.
 *
 * @param parsedBlocks - Mirrored blocks parsed from `storage.rules`.
 * @param resolvedPolicies - Per-declaration view of typed policies.
 * @param programNode - Reported on the Program node since the block lives in a separate file.
 * @param context - ESLint rule context.
 */
function reportOrphanRuleBlocks(parsedBlocks: readonly ParsedStorageRulesBlock[], resolvedPolicies: readonly ResolvedPolicy[], programNode: AstNode, context: RuleContext): void {
  const knownKeys: Set<string> = new Set();
  for (const policy of resolvedPolicies) {
    if (typeof policy.policyKey === 'string') {
      knownKeys.add(policy.policyKey);
    }
  }
  for (const block of parsedBlocks) {
    if (!knownKeys.has(block.mirrorsPolicyKey)) {
      context.report({ node: programNode, messageId: 'orphanRuleBlock', data: { policy: block.mirrorsPolicyKey, line: String(block.sourceLine) } });
    }
  }
}

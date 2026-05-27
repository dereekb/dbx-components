import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import type { Maybe } from '@dereekb/util';
import { type AstNode, type ImportRegistry, createImportRegistry, trackImportDeclaration } from './util';
import { parseStorageRules, rulesMatchPathToSegments, type ParsedRuleBranch, type ParsedStorageRulesBlock } from './storage-rules-parser';
import { type FoldScope, type FoldedUploadPath, describeFoldedPath, foldUploadPath, foldedPathMatchesRuleSegments, foldNumericExpression, foldStringArrayExpression, type FoldUploadPathResult } from './storagefile-path-fold';
import { createImportedBindingResolver, type ParserServicesLike } from './storagefile-import-resolver';

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
  /**
   * Policies whose `buildUploadPath` is legitimately dynamic (e.g. injects a runtime timestamp)
   * and cannot be statically folded. Each entry matches a policy's `purpose` key or its
   * declarator name; matching policies are skipped instead of reporting `unresolvablePolicyPath`.
   */
  readonly allowUnresolvablePolicies?: readonly string[];
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
  readonly sourceCode?: { readonly parserServices?: Maybe<ParserServicesLike> };
  readonly parserServices?: Maybe<ParserServicesLike>;
  readonly report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void;
}

interface ResolvedPolicy {
  readonly policyKey: Maybe<string>;
  readonly declaratorName: Maybe<string>;
  readonly policyDeclaratorNode: AstNode;
  readonly buildUploadPathNode: Maybe<AstNode>;
  readonly maxFileSizeBytes: Maybe<number>;
  readonly allowedMimeTypes: Maybe<readonly string[]>;
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
 * Collects every `VariableDeclarator` directly under the Program body, looking through
 * `ExportNamedDeclaration` wrappers.
 *
 * @param programNode - The Program AST node.
 * @returns The list of top-level declarators.
 */
function collectTopLevelDeclarators(programNode: AstNode): AstNode[] {
  const declarators: AstNode[] = [];
  for (const statement of programNode.body ?? []) {
    const declaration: Maybe<AstNode> = unwrapVariableDeclaration(statement);
    if (declaration?.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations ?? []) {
        declarators.push(declarator);
      }
    }
  }
  return declarators;
}

function unwrapVariableDeclaration(statement: AstNode): Maybe<AstNode> {
  let result: Maybe<AstNode> = null;
  if (statement.type === 'ExportNamedDeclaration') {
    result = statement.declaration;
  } else if (statement.type === 'VariableDeclaration') {
    result = statement;
  }
  return result;
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
    while (init?.type === 'TSAsExpression') {
      init = init.expression;
    }
    if (init?.type === 'ObjectExpression') {
      matched.push(declarator);
    }
  }

  return matched;
}

/**
 * Pulls `purpose`, `maxFileSizeBytes`, and `allowedMimeTypes` from a policy declarator's object
 * literal. `maxFileSizeBytes` and `allowedMimeTypes` are folded with the same scope-based scalar
 * folders the path evaluator uses, so an imported / annotated-widened const (e.g. a branded MIME
 * constant from `@dereekb/util`) resolves to its literal value via the AST initializer rather than
 * bailing on the checker's widened type.
 *
 * @param declarator - The policy declarator (e.g. `USER_AVATAR_UPLOAD_POLICY = {...}`).
 * @param scope - The fold scope (import registry + cross-module resolver) for the linted file.
 * @returns The resolved policy with folded values.
 */
function buildResolvedPolicy(declarator: AstNode, scope: FoldScope): ResolvedPolicy {
  let init: Maybe<AstNode> = declarator.init;
  while (init?.type === 'TSAsExpression') {
    init = init.expression;
  }
  const declaratorName: Maybe<string> = declarator.id?.type === 'Identifier' ? declarator.id.name : null;
  let policyKey: Maybe<string> = null;
  let buildUploadPathNode: Maybe<AstNode> = null;
  let maxFileSizeBytes: Maybe<number> = null;
  let allowedMimeTypes: Maybe<readonly string[]> = null;
  if (init?.type === 'ObjectExpression') {
    for (const property of init.properties ?? []) {
      if (property.type === 'Property' && property.key?.type === 'Identifier' && !property.computed) {
        if (property.key.name === 'purpose') {
          policyKey = extractPolicyKey(property.value);
        } else if (property.key.name === 'buildUploadPath') {
          buildUploadPathNode = property.value;
        } else if (property.key.name === 'maxFileSizeBytes') {
          maxFileSizeBytes = foldNumericExpression(property.value, scope);
        } else if (property.key.name === 'allowedMimeTypes') {
          allowedMimeTypes = foldStringArrayExpression(property.value, scope);
        }
      }
    }
  }
  return { policyKey, declaratorName, policyDeclaratorNode: declarator, buildUploadPathNode, maxFileSizeBytes, allowedMimeTypes };
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
    if (branch.allowedMimeLiterals.includes(mimeType) || branchRegexAcceptsMime(branch, mimeType)) {
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
 * a `*-firebase` component against the workspace's `storage.rules`. The policy's
 * `buildUploadPath` builder is statically folded to a concrete path template (an ordered list
 * of literal / wildcard segments) and paired with the `storage.rules` `allow write` match
 * block at the same path. On the paired block the `request.resource.size` cap and
 * `request.resource.contentType` predicate must be at least as permissive as the policy's
 * `maxFileSizeBytes` and `allowedMimeTypes`.
 *
 * Pairing is derived from the resolved path — not a marker comment — so the linker proves the
 * policy's actual upload path lands in the rules block rather than trusting an unchecked
 * assertion. When the builder cannot be folded (unknown const, unmodeled call, runtime value)
 * the rule reports `unresolvablePolicyPath` and never guesses; genuinely dynamic builders opt
 * out via `allowUnresolvablePolicies`.
 *
 * Reports on the TS side so drift surfaces in the normal lint pipeline; mismatches almost
 * always originate from editing one side and forgetting the other.
 *
 * @example
 * ```ts
 * // OK — storage.rules has `match /uploads/u/{uid}/avatar.img` with matching constraints
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
      maxFileSizeMismatch: "Upload policy '{{policy}}' has maxFileSizeBytes {{tsValue}} but storage.rules allows < {{rulesValue}} for MIME type '{{mime}}' at path '{{path}}'. Update either side so the rules cap matches or exceeds the policy cap.",
      mimeTypeNotAllowed: "Upload policy '{{policy}}' allows MIME type '{{mime}}' but no storage.rules branch at path '{{path}}' accepts it.",
      noMatchingRuleBlock: "Upload policy '{{policy}}' resolves to upload path '{{path}}' but storage.rules has no matching `allow write` match block. Add a match block for that path or fix the path builder.",
      unsupportedRuleShape: "storage.rules block at path '{{path}}' (line {{line}}) could not be parsed: {{reason}}. Refactor the rule or extend the validator.",
      rulesFileMissing: 'Could not read storage.rules at {{path}}. Set the rule option `storageRulesPath` or place the file at the workspace root.',
      unresolvedPolicyField: 'Upload policy{{policyLabel}} has unresolvable {{field}}; the rule cannot statically fold the value to compare against storage.rules.',
      unresolvablePolicyPath: "Upload policy '{{policy}}' has a buildUploadPath that cannot be statically folded to a concrete path: {{reason}}. Make the builder a composition of literals, consts, and @dereekb/util path combinators, or add the purpose/declarator name to the `allowUnresolvablePolicies` option."
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          storageRulesPath: { type: 'string' as const },
          virtualStorageRules: { type: 'string' as const },
          policyTypeName: { type: 'string' as const },
          allowUnresolvablePolicies: { type: 'array' as const, items: { type: 'string' as const } }
        }
      }
    ]
  },
  create(context) {
    const options: FirebaseRequireStorageFilePolicyMatchesRulesRuleOptions = context.options[0] ?? {};
    const policyTypeName: string = options.policyTypeName ?? DEFAULT_STORAGE_FILE_UPLOAD_POLICY_TYPE_NAME;
    const cwd: string = context.cwd ?? process.cwd();
    const allowUnresolvable: ReadonlySet<string> = new Set(options.allowUnresolvablePolicies ?? []);

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
        const scope: FoldScope = buildFoldScope(programNode, context);
        const resolvedPolicies: readonly ResolvedPolicy[] = typedDeclarators.map((declarator) => buildResolvedPolicy(declarator, scope));

        for (const policy of resolvedPolicies) {
          evaluatePolicy({ policy, parsedBlocks, scope, allowUnresolvable, context });
        }
      }
    };
  }
};

/**
 * Builds the {@link FoldScope} for the linted file: the module's import registry plus a
 * type-checker-backed cross-module resolver when parser services are available (a no-op
 * resolver otherwise, so pure-AST folding still works).
 *
 * @param programNode - The Program AST node.
 * @param context - The ESLint rule context.
 * @returns The fold scope.
 */
function buildFoldScope(programNode: AstNode, context: RuleContext): FoldScope {
  const importRegistry: ImportRegistry = createImportRegistry();
  for (const statement of programNode.body ?? []) {
    if (statement?.type === 'ImportDeclaration') {
      trackImportDeclaration(importRegistry, statement);
    }
  }
  const services: Maybe<ParserServicesLike> = context.sourceCode?.parserServices ?? context.parserServices ?? null;
  return { program: programNode, importRegistry, resolver: createImportedBindingResolver(services) };
}

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

interface EvaluatePolicyInput {
  readonly policy: ResolvedPolicy;
  readonly parsedBlocks: readonly ParsedStorageRulesBlock[];
  readonly scope: FoldScope;
  readonly allowUnresolvable: ReadonlySet<string>;
  readonly context: RuleContext;
}

interface ComparePolicyToBlockInput {
  readonly policyLabel: string;
  readonly pathDisplay: string;
  readonly policy: ResolvedPolicy;
  readonly block: ParsedStorageRulesBlock;
  readonly context: RuleContext;
}

/**
 * Returns the human-readable label for a policy in diagnostics: its `purpose` key, else its
 * declarator name, else a placeholder.
 *
 * @param policy - The resolved policy.
 * @returns The display label.
 */
function policyLabelOf(policy: ResolvedPolicy): string {
  return policy.policyKey ?? policy.declaratorName ?? '(anonymous policy)';
}

/**
 * Returns true when a policy is opted out of path folding via `allowUnresolvablePolicies`
 * (matched by `purpose` key or declarator name).
 *
 * @param policy - The resolved policy.
 * @param allowUnresolvable - The opt-out set.
 * @returns True when the policy is exempt from `unresolvablePolicyPath`.
 */
function isPolicyOptedOut(policy: ResolvedPolicy, allowUnresolvable: ReadonlySet<string>): boolean {
  return (typeof policy.policyKey === 'string' && allowUnresolvable.has(policy.policyKey)) || (typeof policy.declaratorName === 'string' && allowUnresolvable.has(policy.declaratorName));
}

/**
 * Folds one policy's `buildUploadPath`, pairs it with the matching `storage.rules` leaf block
 * by path, then cross-checks the block's size + MIME constraints. Reports the first failure on
 * the policy declarator; an unfoldable builder reports `unresolvablePolicyPath` unless opted out.
 *
 * @param input - The policy, parsed blocks, fold scope, opt-out set, and ESLint context.
 */
function evaluatePolicy(input: EvaluatePolicyInput): void {
  const { policy, parsedBlocks, scope, allowUnresolvable, context } = input;
  const label: string = policyLabelOf(policy);

  const fold: FoldUploadPathResult = policy.buildUploadPathNode ? foldUploadPath(policy.buildUploadPathNode, scope) : { ok: false, reason: 'policy has no buildUploadPath property' };
  if (!fold.ok) {
    if (!isPolicyOptedOut(policy, allowUnresolvable)) {
      context.report({ node: policy.policyDeclaratorNode, messageId: 'unresolvablePolicyPath', data: { policy: label, reason: fold.reason } });
    }
    return;
  }

  const folded: FoldedUploadPath = fold.path;
  const pathDisplay: string = describeFoldedPath(folded);
  const block: Maybe<ParsedStorageRulesBlock> = findMatchingBlock(parsedBlocks, folded);
  if (!block) {
    context.report({ node: policy.policyDeclaratorNode, messageId: 'noMatchingRuleBlock', data: { policy: label, path: pathDisplay } });
    return;
  }
  if (block.unsupported) {
    context.report({ node: policy.policyDeclaratorNode, messageId: 'unsupportedRuleShape', data: { path: pathDisplay, line: String(block.sourceLine), reason: block.unsupported } });
    return;
  }
  if (typeof policy.maxFileSizeBytes !== 'number') {
    context.report({ node: policy.policyDeclaratorNode, messageId: 'unresolvedPolicyField', data: { policyLabel: ` '${label}'`, field: 'maxFileSizeBytes' } });
    return;
  }
  if (!policy.allowedMimeTypes) {
    context.report({ node: policy.policyDeclaratorNode, messageId: 'unresolvedPolicyField', data: { policyLabel: ` '${label}'`, field: 'allowedMimeTypes' } });
    return;
  }
  comparePolicyToBlock({ policyLabel: label, pathDisplay, policy, block, context });
}

/**
 * Finds the first parsed leaf block whose match path structurally matches the folded upload
 * path (literal==literal, wildcard=={var}).
 *
 * @param parsedBlocks - The parsed leaf blocks.
 * @param folded - The folded upload path.
 * @returns The matching block, or null.
 */
function findMatchingBlock(parsedBlocks: readonly ParsedStorageRulesBlock[], folded: FoldedUploadPath): Maybe<ParsedStorageRulesBlock> {
  let result: Maybe<ParsedStorageRulesBlock> = null;
  for (const block of parsedBlocks) {
    if (!result && foldedPathMatchesRuleSegments(folded, rulesMatchPathToSegments(block.matchPath))) {
      result = block;
    }
  }
  return result;
}

/**
 * Validates that each MIME the policy permits is accepted by at least one branch and that
 * the branch's size cap is ≥ the policy cap. Emits ESLint reports for any mismatch.
 *
 * @param input - Policy/block pair, the display path, and the ESLint context.
 */
function comparePolicyToBlock(input: ComparePolicyToBlockInput): void {
  const { policyLabel, pathDisplay, policy, block, context } = input;
  const tsCap: number = policy.maxFileSizeBytes as number;
  const mimes: readonly string[] = policy.allowedMimeTypes as readonly string[];
  for (const mime of mimes) {
    const accepting: ParsedRuleBranch[] = branchesAcceptingMimeType(block.branches, mime);
    if (accepting.length === 0) {
      context.report({ node: policy.policyDeclaratorNode, messageId: 'mimeTypeNotAllowed', data: { policy: policyLabel, mime, path: pathDisplay } });
    } else {
      let largest: number = Number.NEGATIVE_INFINITY;
      for (const branch of accepting) {
        if (branch.maxFileSizeBytes > largest) {
          largest = branch.maxFileSizeBytes;
        }
      }
      if (tsCap > largest) {
        context.report({ node: policy.policyDeclaratorNode, messageId: 'maxFileSizeMismatch', data: { policy: policyLabel, tsValue: String(tsCap), rulesValue: String(largest), mime, path: pathDisplay } });
      }
    }
  }
}

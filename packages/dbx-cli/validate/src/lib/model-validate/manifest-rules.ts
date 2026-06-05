/**
 * Manifest-level validation rules. Where {@link runRules} works on a
 * single extracted source file, these rules operate on the merged
 * model manifest — every `firestoreModelIdentity(...)` declaration
 * the discovery layer can see across `@dereekb/firebase` upstream and
 * every discovered `*-firebase` component package.
 *
 * The merged manifest is the only place where cross-app uniqueness
 * can be verified, which is what the duplicate checks defined here
 * require: a collision between two identities in two different
 * components silently misroutes CollectionGroup queries and the model
 * registry's identity decoder, but is invisible to per-file rules.
 */

import { attachRemediation } from '../_core/rule-catalog/index.js';
import type { FirebaseModel } from '@dereekb/dbx-cli';
import type { Violation, ViolationCode } from './types.js';

// MARK: Entry
/**
 * Detects duplicate identities across the merged manifest. Emits one
 * violation per duplicate occurrence after the first (the first-seen
 * model is treated as the incumbent), separately for `collectionName`
 * collisions and `modelType` collisions. A pair that collides on both
 * attributes produces two violations — one per code — so each
 * dimension can be fixed independently.
 *
 * Root vs. subcollection variants are not distinguished: two
 * subcollections sitting under different parents but sharing a
 * `collectionName` still collide because Firestore CollectionGroup
 * queries match on the leaf segment regardless of parent.
 *
 * @param models - Every model from the merged manifest (upstream + downstream)
 * @returns The duplicate-identity violations, in stable iteration order.
 */
export function checkManifestIdentityDuplicates(models: readonly FirebaseModel[]): readonly Violation[] {
  const violations: Violation[] = [];
  flagDuplicates({ models, key: 'collectionPrefix', code: 'MODEL_IDENTITY_COLLECTION_NAME_DUPLICATE', violations });
  flagDuplicates({ models, key: 'modelType', code: 'MODEL_IDENTITY_MODEL_TYPE_DUPLICATE', violations });
  return violations;
}

/**
 * Manifest-level resolution of `@dbxModelCompositeKey from=...` entries. For
 * each model carrying a well-formed composite-key tag with a concrete `from`
 * list (wildcard `'*'` is skipped — open by design), every entry must match
 * a model in the merged manifest by interface name, identity const (with the
 * `Identity` suffix dropped), or `modelType`. Case-insensitive. Per-file
 * issues (missing `from`, invalid encoding, wildcard mixed with concrete
 * entries) are handled by the per-file rule pass in `rules.ts`; this rule is
 * the cross-package resolver.
 *
 * Emits one `MODEL_COMPOSITE_KEY_UNKNOWN_MODEL` violation per unresolved
 * entry, anchored at the declaring model's source file with no line (the
 * line lives on the source's per-file rule pass, not the manifest entry).
 *
 * @param models - Every model from the merged manifest (upstream + downstream)
 * @returns One violation per unresolved `from=` entry.
 */
export function checkManifestCompositeKeyFrom(models: readonly FirebaseModel[]): readonly Violation[] {
  const violations: Violation[] = [];
  const resolver = buildManifestNameResolver(models);
  for (const model of models) {
    const tag = model.compositeKey;
    if (tag === undefined || tag.from === '*') continue;
    for (const entry of tag.from) {
      if (!resolver(entry)) {
        violations.push({
          code: 'MODEL_COMPOSITE_KEY_UNKNOWN_MODEL',
          severity: 'error',
          message: `Composite-key source \`${entry}\` (declared on \`${model.name}\` in ${model.sourcePackage} — ${model.sourceFile}) does not resolve to any model in the merged manifest. Names match interface, identity const (with \`Identity\` suffix dropped), or \`modelType\` — fix the typo or add the missing model to a discovered component.`,
          file: model.sourceFile,
          line: undefined,
          model: model.name,
          remediation: attachRemediation('MODEL_COMPOSITE_KEY_UNKNOWN_MODEL')
        });
      }
    }
  }
  return violations;
}

function buildManifestNameResolver(models: readonly FirebaseModel[]): (name: string) => boolean {
  const index = new Set<string>();
  for (const m of models) {
    index.add(m.name.toLowerCase());
    index.add(m.modelType.toLowerCase());
    index.add(m.identityConst.toLowerCase());
    if (m.identityConst.endsWith('Identity')) {
      index.add(m.identityConst.slice(0, -'Identity'.length).toLowerCase());
    }
  }
  return (name: string) => index.has(name.toLowerCase());
}

// MARK: Helpers
type DuplicateKey = 'collectionPrefix' | 'modelType';

interface FlagDuplicatesInput {
  readonly models: readonly FirebaseModel[];
  readonly key: DuplicateKey;
  readonly code: ViolationCode;
  readonly violations: Violation[];
}

function flagDuplicates(input: FlagDuplicatesInput): void {
  const { models, key, code, violations } = input;
  const seen = new Map<string, FirebaseModel>();
  for (const model of models) {
    const value = model[key];
    if (!value) continue;
    const previous = seen.get(value);
    if (previous) {
      violations.push(buildDuplicateViolation({ code, key, value, incumbent: previous, duplicate: model }));
    } else {
      seen.set(value, model);
    }
  }
}

interface BuildDuplicateViolationInput {
  readonly code: ViolationCode;
  readonly key: DuplicateKey;
  readonly value: string;
  readonly incumbent: FirebaseModel;
  readonly duplicate: FirebaseModel;
}

function buildDuplicateViolation(input: BuildDuplicateViolationInput): Violation {
  const { code, key, value, incumbent, duplicate } = input;
  const label = key === 'collectionPrefix' ? 'Collection name' : 'Model type';
  const message = `${label} \`'${value}'\` is declared by both \`${incumbent.identityConst}\` (${incumbent.sourcePackage} — ${incumbent.sourceFile}) and \`${duplicate.identityConst}\` (${duplicate.sourcePackage} — ${duplicate.sourceFile}). ${label}s must be globally unique across the merged model manifest — rename one of the conflicting \`firestoreModelIdentity(...)\` arguments.`;
  return {
    code,
    severity: 'error',
    message,
    file: duplicate.sourceFile,
    line: undefined,
    model: duplicate.name,
    remediation: attachRemediation(code)
  };
}

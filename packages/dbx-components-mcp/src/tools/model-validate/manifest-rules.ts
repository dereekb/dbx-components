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

import { attachRemediation } from '../rule-catalog/index.js';
import type { FirebaseModel } from '../../registry/firebase-models.js';
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
 * @param models - every model from the merged manifest (upstream + downstream)
 * @returns the duplicate-identity violations, in stable iteration order
 */
export function checkManifestIdentityDuplicates(models: readonly FirebaseModel[]): readonly Violation[] {
  const violations: Violation[] = [];
  flagDuplicates({ models, key: 'collectionPrefix', code: 'MODEL_IDENTITY_COLLECTION_NAME_DUPLICATE', violations });
  flagDuplicates({ models, key: 'modelType', code: 'MODEL_IDENTITY_MODEL_TYPE_DUPLICATE', violations });
  return violations;
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

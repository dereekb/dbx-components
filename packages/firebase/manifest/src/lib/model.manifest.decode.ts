import { type CodedError, type Maybe } from '@dereekb/util';
import { flatFirestoreModelKey, inferKeyFromTwoWayFlatFirestoreModelKey, twoWayFlatFirestoreModelKey } from '@dereekb/firebase';
import { BaseError } from 'make-error';
import { findCompositeKeyModelsDerivedFrom, findModelManifestEntry, type ModelManifest, type ModelManifestCompositeKeyEncoding, type ModelManifestEntry } from './model.manifest';

// MARK: Types
/**
 * One segment of a decoded Firestore key. `model*` fields are absent when the segment's `prefix`
 * isn't in the manifest.
 */
export interface DecodedKeySegment {
  readonly prefix: string;
  readonly id: string;
  readonly modelType?: string;
  readonly modelName?: string;
  readonly modelGroup?: string;
  readonly identityConst?: string;
  readonly parentIdentityConst?: string;
  readonly sourcePackage?: string;
  readonly sourceFile?: string;
}

/**
 * Code of a {@link DecodedKeyIssue}.
 *
 * - `NESTED_ROOT_COLLECTION` — a root model's prefix sits under another collection.
 * - `MISSING_PARENT` — a subcollection model's prefix starts the key, with no parent path.
 * - `WRONG_PARENT` — a subcollection model sits under a model that is not its declared parent.
 */
export type DecodedKeyIssueCode = 'NESTED_ROOT_COLLECTION' | 'MISSING_PARENT' | 'WRONG_PARENT';

/**
 * A structural problem with a decoded key, found by checking each resolved segment against its
 * declared parent.
 */
export interface DecodedKeyIssue {
  /**
   * The prefix of the segment with the problem.
   */
  readonly prefix: string;
  readonly code: DecodedKeyIssueCode;
  readonly message: string;
}

/**
 * Segments of a decoded Firestore key — the leaf, its ancestor chain, any prefixes the manifest
 * could not resolve, and whether the key is structurally valid.
 */
export interface DecodedKeySegments {
  readonly key: string;
  /**
   * True when every prefix resolved and each segment sits under its declared parent.
   */
  readonly valid: boolean;
  readonly leaf: DecodedKeySegment;
  readonly ancestors: readonly DecodedKeySegment[];
  readonly unresolvedPrefixes: readonly string[];
  /**
   * Structural problems with the resolved segments. Empty for a valid key.
   */
  readonly issues: readonly DecodedKeyIssue[];
}

/**
 * A composite-key model whose document id is derived from the decoded key, with that document's
 * ready-to-use key. Published so a caller never has to hand-build a flattened id (e.g. decoding a
 * `Profile` key `pr/abc` also yields the `NotificationBox` key `nb/pr_abc`).
 */
export interface DerivedCompositeKey {
  /**
   * The derived document's full key (`<collectionPrefix>/<flattened source key>`).
   */
  readonly key: string;
  readonly modelType: string;
  readonly modelName: string;
  readonly collectionPrefix: string;
  readonly encoding: ModelManifestCompositeKeyEncoding;
}

/**
 * Result of decoding a Firestore model key into its model + id components, plus the composite-key
 * relationships the manifest declares for it.
 */
export interface DecodedModelManifestKey extends DecodedKeySegments {
  /**
   * Composite-key models derived from this key (see {@link DerivedCompositeKey}). Empty when the key
   * is not valid or no model declares this leaf as a composite-key source.
   */
  readonly derivedKeys: readonly DerivedCompositeKey[];
  /**
   * When the leaf is itself a `two-way` composite-key model, the source key recovered from its id
   * (`inferKeyFromTwoWayFlatFirestoreModelKey`), decoded. Absent for `one-way` models (the source is
   * not recoverable), when the id does not parse as a flattened key, and when the key is not valid.
   */
  readonly compositeSource?: DecodedKeySegments;
}

// MARK: Errors
/**
 * Error code carried by {@link ModelManifestKeyDecodeError}.
 */
export const MODEL_MANIFEST_KEY_DECODE_ERROR_CODE = 'MODEL_DECODE_INVALID_KEY';

/**
 * Why a key could not be decoded: it was blank, or it did not split into `prefix/id` pairs.
 */
export type ModelManifestKeyDecodeErrorReason = 'empty' | 'uneven_segments';

/**
 * Input to the {@link ModelManifestKeyDecodeError} constructor.
 */
export interface ModelManifestKeyDecodeErrorInput {
  readonly reason: ModelManifestKeyDecodeErrorReason;
  /**
   * The trimmed key that failed to decode.
   */
  readonly key: string;
  readonly segmentCount: number;
}

/**
 * Thrown by {@link decodeModelManifestKey} / {@link decodeModelManifestKeySegments} when the key is
 * empty or does not parse into an even number of `prefix/id` segments. Each surface (CLI, MCP)
 * rethrows it in its own error shape.
 */
export class ModelManifestKeyDecodeError extends BaseError implements CodedError {
  readonly code = MODEL_MANIFEST_KEY_DECODE_ERROR_CODE;
  readonly reason: ModelManifestKeyDecodeErrorReason;
  readonly key: string;
  readonly segmentCount: number;
  readonly suggestion?: string;

  constructor(input: ModelManifestKeyDecodeErrorInput) {
    const isEmpty = input.reason === 'empty';
    super(isEmpty ? 'Key is empty. Provide a Firestore key like `prefix/id`.' : `Invalid Firestore key '${input.key}'. Expected an even number of segments (\`prefix/id\` pairs). Got ${input.segmentCount} segment(s).`);
    this.reason = input.reason;
    this.key = input.key;
    this.segmentCount = input.segmentCount;
    this.suggestion = isEmpty ? undefined : 'Use the format `prefix/id` (or `parentPrefix/parentId/childPrefix/childId` for subcollections).';
  }
}

// MARK: Decode
/**
 * Splits `rawKey` on `/`, resolves each `[prefix, id]` pair against the manifest, and returns the
 * leaf segment + ancestor chain and its structural validity, plus — for a valid key — the
 * composite-key relationships declared on the manifest: the keys of models derived from this key
 * (`derivedKeys`) and, for a two-way composite-key leaf, the recovered source key (`compositeSource`).
 *
 * @param rawKey - The Firestore key string.
 * @param manifest - The model manifest.
 * @returns The decoded key with leaf, ancestors, unresolved prefixes, and composite-key relationships.
 * @throws {ModelManifestKeyDecodeError} When `rawKey` is empty or does not parse into an even number of `prefix/id` segments.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function decodeModelManifestKey(rawKey: string, manifest: ModelManifest): DecodedModelManifestKey {
  const segments = decodeModelManifestKeySegments(rawKey, manifest);
  const leafEntry = !segments.valid || segments.leaf.modelType == null ? undefined : findModelManifestEntry(segments.leaf.prefix, manifest);
  const derivedKeys = leafEntry == null ? [] : findCompositeKeyModelsDerivedFrom(leafEntry, manifest).map((entry) => toDerivedCompositeKey(segments.key, entry));
  const compositeSource = leafEntry?.compositeKey?.encoding === 'two-way' ? decodeTwoWayCompositeSource(segments.leaf.id, manifest) : undefined;

  return {
    ...segments,
    derivedKeys,
    ...(compositeSource == null ? {} : { compositeSource })
  };
}

/**
 * Splits `rawKey` on `/` and resolves each `[prefix, id]` pair against the manifest — the segment
 * walk shared by {@link decodeModelManifestKey} and the two-way composite-source decode.
 *
 * @param rawKey - The Firestore key string.
 * @param manifest - The model manifest.
 * @returns The decoded key with leaf, ancestors, and any unresolved prefixes.
 * @throws {ModelManifestKeyDecodeError} When `rawKey` is empty or does not parse into an even number of `prefix/id` segments.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function decodeModelManifestKeySegments(rawKey: string, manifest: ModelManifest): DecodedKeySegments {
  const trimmed = rawKey.trim();

  if (trimmed.length === 0) {
    throw new ModelManifestKeyDecodeError({ reason: 'empty', key: trimmed, segmentCount: 0 });
  }

  const segments = trimmed.split('/').filter((s) => s.length > 0);

  if (segments.length < 2 || segments.length % 2 !== 0) {
    throw new ModelManifestKeyDecodeError({ reason: 'uneven_segments', key: trimmed, segmentCount: segments.length });
  }

  const decoded: DecodedKeySegment[] = [];
  const unresolved: string[] = [];
  const issues: DecodedKeyIssue[] = [];
  let previousEntry: Maybe<ModelManifestEntry>;

  for (let i = 0; i < segments.length; i += 2) {
    const prefix = segments[i];
    const id = segments[i + 1];
    const entry = findModelManifestEntry(prefix, manifest);

    if (entry == null) {
      unresolved.push(prefix);
    } else {
      const issue = findDecodedKeySegmentIssue({ entry, prefix, index: i, segments, previousEntry, manifest });

      if (issue != null) {
        issues.push(issue);
      }
    }

    decoded.push(toSegment(prefix, id, entry));
    previousEntry = entry;
  }

  const leaf = decoded.at(-1) as DecodedKeySegment;
  const ancestors = decoded.slice(0, -1);
  const valid = unresolved.length === 0 && issues.length === 0;

  return { key: trimmed, valid, leaf, ancestors, unresolvedPrefixes: unresolved, issues };
}

// MARK: Internal
function toDerivedCompositeKey(sourceKey: string, entry: ModelManifestEntry): DerivedCompositeKey {
  const encoding = entry.compositeKey?.encoding ?? 'one-way';
  const flatId = encoding === 'two-way' ? twoWayFlatFirestoreModelKey(sourceKey) : flatFirestoreModelKey(sourceKey);

  return {
    key: `${entry.collectionPrefix}/${flatId}`,
    modelType: entry.modelType,
    modelName: entry.modelName,
    collectionPrefix: entry.collectionPrefix,
    encoding
  };
}

/**
 * Recovers and decodes the source key behind a two-way flattened id.
 *
 * @param flatId - The leaf document id of a two-way composite-key model.
 * @param manifest - The model manifest.
 * @returns The decoded source key, or `undefined` when the id does not contain a separator or does
 *   not recover to an even number of segments — it was not produced by `twoWayFlatFirestoreModelKey`.
 */
function decodeTwoWayCompositeSource(flatId: string, manifest: ModelManifest): DecodedKeySegments | undefined {
  let result: DecodedKeySegments | undefined;

  if (flatId.includes('_')) {
    const sourceKey = inferKeyFromTwoWayFlatFirestoreModelKey(flatId);
    const segmentCount = sourceKey.split('/').filter((s) => s.length > 0).length;

    if (segmentCount >= 2 && segmentCount % 2 === 0) {
      result = decodeModelManifestKeySegments(sourceKey, manifest);
    }
  }

  return result;
}

interface FindDecodedKeySegmentIssueInput {
  readonly entry: ModelManifestEntry;
  readonly prefix: string;
  /**
   * Index of the segment's prefix within `segments`.
   */
  readonly index: number;
  readonly segments: readonly string[];
  /**
   * The previous segment's entry, when it resolved.
   */
  readonly previousEntry: Maybe<ModelManifestEntry>;
  readonly manifest: ModelManifest;
}

/**
 * Checks one resolved segment against its declared parent. A segment under an unresolved prefix is
 * only checked for being a nested root collection, since the unresolved prefix already invalidates
 * the key.
 *
 * @param input - The segment's entry, position, previous entry, and the manifest.
 * @returns The issue, or undefined when the segment is placed correctly.
 */
function findDecodedKeySegmentIssue(input: FindDecodedKeySegmentIssueInput): Maybe<DecodedKeyIssue> {
  const { entry, prefix, index, segments, previousEntry, manifest } = input;
  const parentIdentityConst = entry.parentIdentityConst;
  let issue: Maybe<DecodedKeyIssue>;

  if (index === 0) {
    if (parentIdentityConst != null) {
      const parentEntry = manifest.find((x) => x.identityConst === parentIdentityConst);
      const example = entry.exampleKey ?? (parentEntry == null ? undefined : `${parentEntry.collectionPrefix}/<parentId>/${prefix}/<id>`);
      issue = { prefix, code: 'MISSING_PARENT', message: `"${prefix}" (${entry.modelName}) is a subcollection${parentEntry == null ? '' : ` of ${parentEntry.modelName}`}; its key needs the parent path${example ? `, e.g. "${example}"` : ''}.` };
    }
  } else if (parentIdentityConst == null) {
    const parentPath = segments.slice(0, index).join('/');
    issue = { prefix, code: 'NESTED_ROOT_COLLECTION', message: `"${prefix}" (${entry.modelName}) is a root collection; it cannot sit under "${parentPath}". Its keys look like "${prefix}/<id>".` };
  } else if (previousEntry != null && parentIdentityConst !== previousEntry.identityConst) {
    const parentEntry = manifest.find((x) => x.identityConst === parentIdentityConst);
    issue = { prefix, code: 'WRONG_PARENT', message: `"${prefix}" (${entry.modelName}) belongs under ${parentEntry == null ? parentIdentityConst : `"${parentEntry.collectionPrefix}" (${parentEntry.modelName})`}, not "${previousEntry.collectionPrefix}" (${previousEntry.modelName}).` };
  }

  return issue;
}

function toSegment(prefix: string, id: string, entry: Maybe<ModelManifestEntry>): DecodedKeySegment {
  const segment: DecodedKeySegment = entry
    ? {
        prefix,
        id,
        modelType: entry.modelType,
        modelName: entry.modelName,
        identityConst: entry.identityConst,
        sourcePackage: entry.sourcePackage,
        sourceFile: entry.sourceFile,
        ...(entry.modelGroup == null ? {} : { modelGroup: entry.modelGroup }),
        ...(entry.parentIdentityConst == null ? {} : { parentIdentityConst: entry.parentIdentityConst })
      }
    : { prefix, id };
  return segment;
}

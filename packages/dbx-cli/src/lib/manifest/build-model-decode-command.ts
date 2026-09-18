import { flatFirestoreModelKey, inferKeyFromTwoWayFlatFirestoreModelKey, twoWayFlatFirestoreModelKey } from '@dereekb/firebase';
import type { Argv, CommandModule } from 'yargs';
import { findCliModelManifestEntry } from '../api/expand-keys';
import { CliError, outputResult } from '../util/output';
import { wrapSyncCommandHandler } from '../util/handler';
import type { CliModelCompositeKeyEncoding, CliModelManifest, CliModelManifestEntry } from './types';

/**
 * Default command name for the model-decode command. Top-level so it stays
 * out of the API-call namespace owned by `model <model> <action>`.
 */
export const DEFAULT_MODEL_DECODE_COMMAND_NAME = 'model-decode';

/**
 * Options accepted by {@link buildModelDecodeCommand}.
 */
export interface BuildModelDecodeCommandOptions {
  /**
   * Override the parent command name. Defaults to
   * {@link DEFAULT_MODEL_DECODE_COMMAND_NAME}.
   */
  readonly commandName?: string;
}

/**
 * One segment of a decoded Firestore key. `model*` fields are absent when the
 * segment's `prefix` isn't in the manifest.
 */
export interface DecodedKeySegment {
  readonly prefix: string;
  readonly id: string;
  readonly modelName?: string;
  readonly modelType?: string;
  readonly modelGroup?: string;
  readonly identityConst?: string;
  readonly parentIdentityConst?: string;
  readonly sourcePackage?: string;
  readonly sourceFile?: string;
}

/**
 * Segments of a decoded Firestore key — the leaf, its ancestor chain, and any prefixes the manifest
 * could not resolve.
 */
export interface DecodedKeySegments {
  readonly key: string;
  readonly leaf: DecodedKeySegment;
  readonly ancestors: readonly DecodedKeySegment[];
  readonly unresolvedPrefixes: readonly string[];
}

/**
 * A composite-key model whose document id is derived from the decoded key, with that document's
 * ready-to-use key (e.g. decoding a `District` key also yields the `jobDistrict` key
 * `jd/<flattened district key>`).
 */
export interface DerivedCompositeKey {
  /**
   * The derived document's full key (`<collectionPrefix>/<flattened source key>`).
   */
  readonly key: string;
  readonly modelType: string;
  readonly modelName: string;
  readonly collectionPrefix: string;
  readonly encoding: CliModelCompositeKeyEncoding;
}

/**
 * Result of decoding a Firestore model key into its model + id components.
 */
export interface DecodedKey extends DecodedKeySegments {
  /**
   * Composite-key models derived from this key. Empty when the leaf prefix is unresolved or no
   * model declares this leaf as a composite-key source.
   */
  readonly derivedKeys: readonly DerivedCompositeKey[];
  /**
   * When the leaf is itself a `two-way` composite-key model, the source key recovered from its id,
   * decoded. Absent for `one-way` models and when the id does not parse as a flattened key.
   */
  readonly compositeSource?: DecodedKeySegments;
}

/**
 * Builds the top-level `model-decode <key>` command.
 *
 * Splits the supplied Firestore key on `/`, walks `[prefix, id]` pairs, and
 * resolves each prefix against the manifest. Supports subcollection paths
 * (`nb/abc/nbn/def` → leaf `Notification` + parent `NotificationBox`).
 *
 * Flags:
 *   - `--json` emits a structured `{ ok, data }` envelope instead of the
 *     human-readable block (useful for scripting or LLM agents).
 *
 * @param manifest - The generated model manifest (e.g. `DEMO_CLI_MODEL_MANIFEST`).
 * @param options - Optional overrides; see {@link BuildModelDecodeCommandOptions}.
 * @returns A yargs `CommandModule` ready to be passed to `runCli({ configCommands })`.
 * @__NO_SIDE_EFFECTS__
 */
export function buildModelDecodeCommand(manifest: CliModelManifest, options?: BuildModelDecodeCommandOptions): CommandModule {
  const commandName = options?.commandName ?? DEFAULT_MODEL_DECODE_COMMAND_NAME;
  return {
    command: `${commandName} <key>`,
    describe: `Decode a Firestore model key (e.g. "jwr/abc123") into model + id info using the registered manifest (${manifest.length} model${manifest.length === 1 ? '' : 's'}).`,
    builder: (yargs: Argv) => {
      return yargs
        .positional('key', {
          type: 'string',
          describe: 'Firestore model key — prefix/id, supports subcollection paths like `parentPrefix/parentId/childPrefix/childId`.'
        })
        .option('json', {
          type: 'boolean',
          default: false,
          describe: 'Emit a structured JSON envelope instead of the human-readable block.'
        });
    },
    handler: wrapSyncCommandHandler((argv: any) => {
      runHandler(manifest, argv);
    })
  };
}

interface ModelDecodeArgv {
  readonly key?: string;
  readonly json?: boolean;
}

function runHandler(manifest: CliModelManifest, argv: ModelDecodeArgv): void {
  const rawKey = typeof argv.key === 'string' ? argv.key : '';
  const decoded = decodeFirestoreModelKey(rawKey, manifest);

  if (argv.json) {
    outputResult(decoded);
    return;
  }

  process.stdout.write(renderDecodedKey(decoded));
}

/**
 * Splits `rawKey` on `/`, resolves each `[prefix, id]` pair against the
 * manifest, and returns the leaf segment + ancestor chain, plus the
 * composite-key relationships declared on the manifest: the keys of models
 * derived from this key (`derivedKeys`) and, for a two-way composite-key
 * leaf, the recovered source key (`compositeSource`). Throws
 * {@link CliError} for malformed inputs.
 *
 * Mirrors the `@dereekb/firebase-server/mcp` `model-decode` tool; both
 * implementations must stay in lockstep on segment count, resolution order,
 * and composite-key output.
 *
 * @param rawKey - The Firestore key string.
 * @param manifest - The generated model manifest.
 * @returns The decoded key with leaf, ancestors, unresolved prefixes, and composite-key relationships.
 * @throws {CliError} When `rawKey` is empty or does not parse into an even number of `prefix/id` segments.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function decodeFirestoreModelKey(rawKey: string, manifest: CliModelManifest): DecodedKey {
  const segments = decodeFirestoreModelKeySegments(rawKey, manifest);
  const leafEntry = segments.leaf.modelType == null ? undefined : findCliModelManifestEntry(segments.leaf.prefix, manifest);
  const derivedKeys = leafEntry == null ? [] : findCompositeKeyModelsDerivedFrom(leafEntry, manifest).map((entry) => toDerivedCompositeKey(segments.key, entry));
  const compositeSource = leafEntry?.compositeKey?.encoding === 'two-way' ? decodeTwoWayCompositeSource(segments.leaf.id, manifest) : undefined;

  return {
    ...segments,
    derivedKeys,
    ...(compositeSource == null ? {} : { compositeSource })
  };
}

/**
 * Resolves the manifest entries whose `compositeKey.from` names `source` — the models whose document
 * id is derived from a `source` document's key. A wildcard `from=*` matches every model except
 * `source` itself.
 *
 * @param source - The manifest entry of the decoded key's leaf model.
 * @param manifest - The generated model manifest.
 * @returns The composite-key entries derived from `source`, in manifest order.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findCompositeKeyModelsDerivedFrom(source: CliModelManifestEntry, manifest: CliModelManifest): CliModelManifestEntry[] {
  return manifest.filter((entry) => entry.compositeKey != null && entry.modelType !== source.modelType && (entry.compositeKey.from === '*' || entry.compositeKey.from.some((name) => name === source.modelName || name === source.identityConst || name === source.modelType)));
}

function toDerivedCompositeKey(sourceKey: string, entry: CliModelManifestEntry): DerivedCompositeKey {
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

function decodeTwoWayCompositeSource(flatId: string, manifest: CliModelManifest): DecodedKeySegments | undefined {
  let result: DecodedKeySegments | undefined;

  if (flatId.includes('_')) {
    const sourceKey = inferKeyFromTwoWayFlatFirestoreModelKey(flatId);
    const segmentCount = sourceKey.split('/').filter((s) => s.length > 0).length;

    if (segmentCount >= 2 && segmentCount % 2 === 0) {
      result = decodeFirestoreModelKeySegments(sourceKey, manifest);
    }
  }

  return result;
}

/**
 * Splits `rawKey` on `/` and resolves each `[prefix, id]` pair against the
 * manifest — the segment walk shared by {@link decodeFirestoreModelKey} and
 * the two-way composite-source decode.
 *
 * @param rawKey - The Firestore key string.
 * @param manifest - The generated model manifest.
 * @returns The decoded key with leaf, ancestors, and any unresolved prefixes.
 * @throws {CliError} When `rawKey` is empty or does not parse into an even number of `prefix/id` segments.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function decodeFirestoreModelKeySegments(rawKey: string, manifest: CliModelManifest): DecodedKeySegments {
  const trimmed = rawKey.trim();
  if (trimmed.length === 0) {
    throw new CliError({
      message: 'Key is empty. Provide a Firestore key like `sf/abc123`.',
      code: 'MODEL_DECODE_INVALID_KEY'
    });
  }

  const segments = trimmed.split('/').filter((s) => s.length > 0);
  if (segments.length < 2 || segments.length % 2 !== 0) {
    throw new CliError({
      message: `Invalid Firestore key '${trimmed}'. Expected an even number of segments (\`prefix/id\` pairs). Got ${segments.length} segment(s).`,
      code: 'MODEL_DECODE_INVALID_KEY',
      suggestion: 'Use the format `prefix/id` (or `parentPrefix/parentId/childPrefix/childId` for subcollections).'
    });
  }

  const decoded: DecodedKeySegment[] = [];
  const unresolved: string[] = [];
  for (let i = 0; i < segments.length; i += 2) {
    const prefix = segments[i];
    const id = segments[i + 1];
    const entry = findCliModelManifestEntry(prefix, manifest);
    if (!entry) {
      unresolved.push(prefix);
    }
    decoded.push(toSegment(prefix, id, entry));
  }

  const leaf = decoded.at(-1) as DecodedKeySegment;
  const ancestors = decoded.slice(0, -1);
  return { key: trimmed, leaf, ancestors, unresolvedPrefixes: unresolved };
}

function toSegment(prefix: string, id: string, entry: CliModelManifestEntry | undefined): DecodedKeySegment {
  const result: DecodedKeySegment = entry
    ? {
        prefix,
        id,
        modelName: entry.modelName,
        modelType: entry.modelType,
        modelGroup: entry.modelGroup,
        identityConst: entry.identityConst,
        parentIdentityConst: entry.parentIdentityConst,
        sourcePackage: entry.sourcePackage,
        sourceFile: entry.sourceFile
      }
    : { prefix, id };
  return result;
}

/**
 * Renders a {@link DecodedKey} as a human-readable text block. Mirrors the
 * MCP `dbx_model_decode` key-mode output for consistency between agent and
 * shell consumers.
 *
 * @param decoded - The decoded key returned by {@link decodeFirestoreModelKey}.
 * @returns The formatted block with a trailing newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderDecodedKey(decoded: DecodedKey): string {
  const lines: string[] = [...renderLeafLines(decoded.leaf)];

  if (decoded.ancestors.length > 0) {
    lines.push('', 'Parent chain:', ...decoded.ancestors.map(renderAncestorLine));
  }

  if (decoded.unresolvedPrefixes.length > 0) {
    const suffix = decoded.unresolvedPrefixes.length === 1 ? '' : 'es';
    lines.push('', `Unresolved prefix${suffix}: ${decoded.unresolvedPrefixes.join(', ')}. Run \`model-info\` to list known models.`);
  }

  if (decoded.compositeSource != null) {
    const source = decoded.compositeSource;
    const sourceModel = source.leaf.modelName ?? `<unknown — prefix '${source.leaf.prefix}' not in manifest>`;
    lines.push('', `Composite source (two-way): ${source.key} → ${sourceModel}`);
  }

  if (decoded.derivedKeys.length > 0) {
    lines.push('', 'Derived keys:', ...decoded.derivedKeys.map((derived) => `- ${derived.modelName} (${derived.encoding}) — ${derived.key}`));
  }

  return lines.join('\n') + '\n';
}

function renderLeafLines(leaf: DecodedKeySegment): string[] {
  let lines: string[];
  if (leaf.modelName) {
    lines = [`Model: ${leaf.modelName}`];
    if (leaf.identityConst) lines.push(`identityConst: ${leaf.identityConst}`);
    if (leaf.modelType) lines.push(`modelType: ${leaf.modelType}`);
    lines.push(`prefix: ${leaf.prefix}`, `id: ${leaf.id}`);
    if (leaf.modelGroup) lines.push(`modelGroup: ${leaf.modelGroup}`);
    if (leaf.parentIdentityConst) lines.push(`parentIdentityConst: ${leaf.parentIdentityConst}`);
    if (leaf.sourcePackage) {
      const sourceSuffix = leaf.sourceFile ? ` (${leaf.sourceFile})` : '';
      lines.push(`source: ${leaf.sourcePackage}${sourceSuffix}`);
    }
  } else {
    lines = [`Model: <unknown — prefix '${leaf.prefix}' not in manifest>`, `prefix: ${leaf.prefix}`, `id: ${leaf.id}`];
  }
  return lines;
}

function renderAncestorLine(ancestor: DecodedKeySegment): string {
  return ancestor.modelName ? `- ${ancestor.modelName} — prefix ${ancestor.prefix}, id ${ancestor.id}` : `- <unknown> — prefix ${ancestor.prefix}, id ${ancestor.id}`;
}

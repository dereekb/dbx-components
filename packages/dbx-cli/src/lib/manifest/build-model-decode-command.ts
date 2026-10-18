import { decodeModelManifestKey, decodeModelManifestKeySegments, ModelManifestKeyDecodeError, type DecodedKeySegment, type DecodedKeySegments, type DecodedModelManifestKey } from '@dereekb/firebase/manifest';
import type { Argv, CommandModule } from 'yargs';
import { CliError, outputResult } from '../util/output';
import { wrapSyncCommandHandler } from '../util/handler';
import type { CliModelManifest } from './types';

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

// The decoded-key shapes are shared with the firebase-server MCP `model-decode` tool.
export type { DecodedKeyIssue, DecodedKeyIssueCode, DecodedKeySegment, DecodedKeySegments, DerivedCompositeKey } from '@dereekb/firebase/manifest';
export { findCompositeKeyModelsDerivedFrom } from '@dereekb/firebase/manifest';

/**
 * Result of decoding a Firestore model key into its model + id components. Alias of the shared
 * `@dereekb/firebase/manifest` {@link DecodedModelManifestKey}.
 */
export type DecodedKey = DecodedModelManifestKey;

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
  // drawn from this CLI's own manifest so the example is a key the command actually decodes — a
  // plain root collection, since a subcollection, singleton, or composite prefix alone is not a full key
  const examplePrefix = manifest.find((entry) => entry.parentIdentityConst == null && entry.singleton !== true && entry.compositeKey == null)?.collectionPrefix ?? 'prefix';

  return {
    command: `${commandName} <key>`,
    describe: `Decode a Firestore model key (e.g. "${examplePrefix}/abc123") into model + id info using the registered manifest (${manifest.length} model${manifest.length === 1 ? '' : 's'}).`,
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
 * Wraps the shared `@dereekb/firebase/manifest` {@link decodeModelManifestKey}, which the
 * `@dereekb/firebase-server/mcp` `model-decode` tool also uses.
 *
 * @param rawKey - The Firestore key string.
 * @param manifest - The generated model manifest.
 * @returns The decoded key with leaf, ancestors, unresolved prefixes, and composite-key relationships.
 * @throws {CliError} When `rawKey` is empty or does not parse into an even number of `prefix/id` segments.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function decodeFirestoreModelKey(rawKey: string, manifest: CliModelManifest): DecodedKey {
  return rethrowAsCliError(() => decodeModelManifestKey(rawKey, manifest));
}

/**
 * Splits `rawKey` on `/` and resolves each `[prefix, id]` pair against the
 * manifest — the segment walk behind {@link decodeFirestoreModelKey}.
 *
 * @param rawKey - The Firestore key string.
 * @param manifest - The generated model manifest.
 * @returns The decoded key with leaf, ancestors, and any unresolved prefixes.
 * @throws {CliError} When `rawKey` is empty or does not parse into an even number of `prefix/id` segments.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function decodeFirestoreModelKeySegments(rawKey: string, manifest: CliModelManifest): DecodedKeySegments {
  return rethrowAsCliError(() => decodeModelManifestKeySegments(rawKey, manifest));
}

function rethrowAsCliError<T>(decode: () => T): T {
  try {
    return decode();
  } catch (error) {
    if (error instanceof ModelManifestKeyDecodeError) {
      throw new CliError({ message: error.message, code: error.code, suggestion: error.suggestion });
    }

    throw error;
  }
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

  if (decoded.issues.length > 0) {
    lines.push('', 'Invalid key:', ...decoded.issues.map((issue) => `- ${issue.message}`));
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

import type { Argv, CommandModule } from 'yargs';
import { findCliModelManifestEntry } from '../api/expand-keys';
import { CliError, outputError, outputResult } from '../util/output';
import type { CliModelManifest, CliModelManifestEntry } from './types';

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
 * Result of decoding a Firestore model key into its model + id components.
 */
export interface DecodedKey {
  readonly key: string;
  readonly leaf: DecodedKeySegment;
  readonly ancestors: readonly DecodedKeySegment[];
  readonly unresolvedPrefixes: readonly string[];
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
    handler: (argv: any) => {
      try {
        runHandler(manifest, argv);
      } catch (e) {
        outputError(e);
        process.exit(1);
      }
    }
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
 * manifest, and returns the leaf segment + ancestor chain. Throws
 * {@link CliError} for malformed inputs.
 *
 * @param rawKey - The Firestore key string.
 * @param manifest - The generated model manifest.
 * @returns The decoded key with leaf, ancestors, and any unresolved prefixes.
 * @__NO_SIDE_EFFECTS__
 */
export function decodeFirestoreModelKey(rawKey: string, manifest: CliModelManifest): DecodedKey {
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
  if (!entry) {
    return { prefix, id };
  }
  return {
    prefix,
    id,
    modelName: entry.modelName,
    modelType: entry.modelType,
    modelGroup: entry.modelGroup,
    identityConst: entry.identityConst,
    parentIdentityConst: entry.parentIdentityConst,
    sourcePackage: entry.sourcePackage,
    sourceFile: entry.sourceFile
  };
}

/**
 * Renders a {@link DecodedKey} as a human-readable text block. Mirrors the
 * MCP `dbx_model_decode` key-mode output for consistency between agent and
 * shell consumers.
 *
 * @param decoded - the decoded key returned by {@link decodeFirestoreModelKey}.
 * @returns the formatted block with a trailing newline.
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

  return lines.join('\n') + '\n';
}

function renderLeafLines(leaf: DecodedKeySegment): string[] {
  if (!leaf.modelName) {
    return [`Model: <unknown — prefix '${leaf.prefix}' not in manifest>`, `prefix: ${leaf.prefix}`, `id: ${leaf.id}`];
  }

  const lines: string[] = [`Model: ${leaf.modelName}`];
  if (leaf.identityConst) lines.push(`identityConst: ${leaf.identityConst}`);
  if (leaf.modelType) lines.push(`modelType: ${leaf.modelType}`);
  lines.push(`prefix: ${leaf.prefix}`, `id: ${leaf.id}`);
  if (leaf.modelGroup) lines.push(`modelGroup: ${leaf.modelGroup}`);
  if (leaf.parentIdentityConst) lines.push(`parentIdentityConst: ${leaf.parentIdentityConst}`);
  if (leaf.sourcePackage) {
    const sourceSuffix = leaf.sourceFile ? ` (${leaf.sourceFile})` : '';
    lines.push(`source: ${leaf.sourcePackage}${sourceSuffix}`);
  }
  return lines;
}

function renderAncestorLine(ancestor: DecodedKeySegment): string {
  if (ancestor.modelName) {
    return `- ${ancestor.modelName} — prefix ${ancestor.prefix}, id ${ancestor.id}`;
  }
  return `- <unknown> — prefix ${ancestor.prefix}, id ${ancestor.id}`;
}

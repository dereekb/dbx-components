import { decodeFirestoreModelKey } from '../manifest/build-model-decode-command';
import { type CliModelManifest } from '../manifest/types';
import { CliError } from '../util/output';

/**
 * Parsed `get` command arguments — the resolved `modelType` + the original key string.
 */
export interface ParsedGetArgs {
  readonly modelType: string;
  readonly key: string;
}

/**
 * Parsed `get-many` command arguments — the resolved `modelType` + the list of keys.
 */
export interface ParsedGetManyArgs {
  readonly modelType: string;
  readonly keys: ReadonlyArray<string>;
}

/**
 * Parses the positionals for the top-level `get <modelOrKey> [key]` command into a
 * `{ modelType, key }` pair, using the supplied {@link CliModelManifest} to resolve
 * collection-name prefixes when the explicit-model form is not used.
 *
 * Rules:
 * 1. Two positionals (`modelOrKey` + `key`) — `modelOrKey` is treated as the explicit
 *    `modelType` and `key` is passed through verbatim. No manifest lookup performed.
 * 2. One positional (`modelOrKey` only) — treated as a full Firestore key (`prefix/id`).
 *    {@link decodeFirestoreModelKey} resolves the prefix against the manifest. Throws
 *    {@link CliError} if the manifest is missing, the prefix is unresolved, or the leaf
 *    has no `modelType`.
 *
 * @param input.modelOrKey - The first positional from yargs.
 * @param input.key - The optional second positional from yargs.
 * @param input.manifest - The generated model manifest (for prefix lookup).
 * @returns The parsed `{ modelType, key }` pair.
 * @__NO_SIDE_EFFECTS__
 */
export function parseGetArgs(input: { readonly modelOrKey: string | undefined; readonly key: string | undefined; readonly manifest?: CliModelManifest }): ParsedGetArgs {
  const modelOrKey = (input.modelOrKey ?? '').trim();

  if (modelOrKey.length === 0) {
    throw new CliError({
      message: 'get: missing required positional. Usage: `get <key>` or `get <model> <key>`.',
      code: 'INVALID_ARGUMENT'
    });
  }

  const explicitKey = input.key?.trim();

  if (explicitKey != null && explicitKey.length > 0) {
    return { modelType: modelOrKey, key: explicitKey };
  }

  if (!modelOrKey.includes('/')) {
    throw new CliError({
      message: `get: '${modelOrKey}' looks like a bare doc id. Provide a full key (e.g. 'jws/abc123') or use 'get <model> <key>'.`,
      code: 'INVALID_ARGUMENT'
    });
  }

  const manifest = input.manifest;

  if (!manifest || manifest.length === 0) {
    throw new CliError({
      message: 'get: cannot infer modelType — no model manifest is wired into the CLI. Pass `modelManifest` to `runCli`, or use `get <model> <key>` explicitly.',
      code: 'INVALID_ARGUMENT'
    });
  }

  const decoded = decodeFirestoreModelKey(modelOrKey, manifest);

  if (decoded.unresolvedPrefixes.length > 0 || !decoded.leaf.modelType) {
    throw new CliError({
      message: `get: unable to resolve modelType for key '${modelOrKey}'. Unknown prefix: ${decoded.unresolvedPrefixes.join(', ') || decoded.leaf.prefix}. Known prefixes: ${manifestPrefixList(manifest)}.`,
      code: 'INVALID_ARGUMENT',
      suggestion: "Run `<cli> model-decode '<key>'` to inspect a key, or use `get <model> <key>` explicitly."
    });
  }

  return { modelType: decoded.leaf.modelType, key: modelOrKey };
}

/**
 * Parses the positionals for the top-level `get-many <firstArg> [rest..]` command.
 *
 * Rules:
 * 1. If `firstArg` contains `/` it is treated as a key — all positionals (`firstArg` + `rest`)
 *    are decoded via {@link decodeFirestoreModelKey}. All keys must resolve to the same
 *    `modelType` or a {@link CliError} is thrown (the backend route is single-modelType per call).
 * 2. Otherwise `firstArg` is treated as the explicit `modelType` and `rest` are the keys.
 *
 * Always rejects empty key lists and lists exceeding 50 keys.
 *
 * @param input.firstArg - The first positional from yargs.
 * @param input.rest - The remaining positionals from yargs.
 * @param input.manifest - The generated model manifest (used only in the inferred-key branch).
 * @returns The parsed `{ modelType, keys }` pair.
 * @__NO_SIDE_EFFECTS__
 */
export function parseGetManyArgs(input: { readonly firstArg: string | undefined; readonly rest: ReadonlyArray<string>; readonly manifest?: CliModelManifest }): ParsedGetManyArgs {
  const firstArg = (input.firstArg ?? '').trim();
  const rest = (input.rest ?? []).map((s) => s.trim()).filter((s) => s.length > 0);

  if (firstArg.length === 0) {
    throw new CliError({
      message: 'get-many: missing required positionals. Usage: `get-many <key...>` or `get-many <model> <key...>`.',
      code: 'INVALID_ARGUMENT'
    });
  }

  if (firstArg.includes('/')) {
    const keys = [firstArg, ...rest];
    return inferModelTypeFromKeys(keys, input.manifest);
  }

  if (rest.length === 0) {
    throw new CliError({
      message: `get-many: '${firstArg}' has no '/' so it was treated as a model name, but no keys were supplied. Usage: 'get-many <model> <key...>'.`,
      code: 'INVALID_ARGUMENT'
    });
  }

  return { modelType: firstArg, keys: rest };
}

function inferModelTypeFromKeys(keys: ReadonlyArray<string>, manifest: CliModelManifest | undefined): ParsedGetManyArgs {
  if (!manifest || manifest.length === 0) {
    throw new CliError({
      message: 'get-many: cannot infer modelType — no model manifest is wired into the CLI. Pass `modelManifest` to `runCli`, or use `get-many <model> <key...>` explicitly.',
      code: 'INVALID_ARGUMENT'
    });
  }

  const decodedTypes = new Set<string>();
  const unresolved: string[] = [];

  for (const key of keys) {
    const decoded = decodeFirestoreModelKey(key, manifest);

    if (decoded.unresolvedPrefixes.length > 0 || !decoded.leaf.modelType) {
      unresolved.push(key);
    } else {
      decodedTypes.add(decoded.leaf.modelType);
    }
  }

  if (unresolved.length > 0) {
    throw new CliError({
      message: `get-many: unable to resolve modelType for key(s): ${unresolved.join(', ')}. Known prefixes: ${manifestPrefixList(manifest)}.`,
      code: 'INVALID_ARGUMENT'
    });
  }

  if (decodedTypes.size > 1) {
    throw new CliError({
      message: `get-many: all keys must belong to the same modelType. Got: ${[...decodedTypes].join(', ')}. Split into separate calls.`,
      code: 'INVALID_ARGUMENT'
    });
  }

  const [modelType] = decodedTypes;
  return { modelType, keys };
}

function manifestPrefixList(manifest: CliModelManifest): string {
  const prefixes = manifest.map((e) => e.collectionPrefix).sort((a, b) => a.localeCompare(b));
  return prefixes.join(', ');
}

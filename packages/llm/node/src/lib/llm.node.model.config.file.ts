/**
 * The **filesystem half** of the model config: which `models.json` to read, the read itself, the overlay onto a host's
 * built-ins, and the atomic write.
 *
 * The schema, the fail-loud parse and the precedence live in the root entry, pure and shared; this module only resolves
 * WHICH file to read and reads or writes it. Lookup order: an explicit path from the environment (fail-loud when it
 * points at a missing file) > the host's `defaultPath`. There is no working-directory lookup: a profile is a MACHINE
 * posture ("this box has no credit on the paid gateway today"), not a property of a checkout.
 *
 * A missing file is a clean no-op for what a run BILLS — the host runs on its built-ins. It is not a no-op for what a
 * run can NAME: every read layers the operator's file over the host's built-ins, so a per-run override may select a
 * built-in profile on a machine that has never had a file. Built-ins carry no `active`, so availability is not
 * selection.
 *
 * The read seam ({@link loadEffectiveLlmModelConfigFile}) and the WRITE seam ({@link loadLlmModelConfigFile} +
 * {@link writeLlmModelConfigFile}) are deliberately different reads: what lands on disk stays the operator's own
 * declaration, so a built-in corrected in a later release reaches them instead of being shadowed by a frozen copy of
 * itself.
 *
 * File IO is synchronous: hosts read the file once, at boot, from synchronous config resolvers.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { errorMessageOf, type Maybe } from '@dereekb/util';
import { flattenLlmModelProfile, type LlmModelConfigBaseTypes, type LlmModelConfigFile, type LlmModelConfigSchema, type LlmModelConfigTypes, overlayLlmModelConfigFile, parseLlmModelConfigFile, resolveLlmModelProfile } from '@dereekb/llm';
import { DEFAULT_LLM_ENV_NAMES, firstLlmEnvEntry, type LlmEnvNames, type LlmEnvView } from './llm.node.env';

// MARK: Location
/**
 * Where a host's model config file lives.
 */
export interface LlmModelConfigFileLocationConfig {
  /**
   * The environment to read. Default `process.env`.
   */
  readonly env?: Maybe<LlmEnvView>;
  /**
   * The env names; {@link LlmEnvNames.modelsFile} names the explicit path. Default {@link DEFAULT_LLM_ENV_NAMES}.
   */
  readonly names?: Maybe<LlmEnvNames>;
  /**
   * The path read when the environment names none — typically under the user's home directory.
   */
  readonly defaultPath: string;
}

/**
 * The path the model config file lives at, WHETHER OR NOT it exists — the explicit env path, else `defaultPath`. The
 * write target, and the "where the operator should have put it" label a read names when a selection resolves against
 * no file.
 *
 * Deliberately does NOT throw on a missing explicit path the way {@link loadLlmModelConfigFile} does: a READ that
 * silently ignores a typo'd path is the billed surprise that throw exists to stop, while the first write on a machine
 * that has never had a file must be able to create one.
 *
 * @param config - The environment, the env names and the default path.
 * @returns The file path.
 */
export function resolveLlmModelConfigFilePath(config: LlmModelConfigFileLocationConfig): string {
  const names = config.names ?? DEFAULT_LLM_ENV_NAMES;
  return firstLlmEnvEntry({ env: config.env, names: names.modelsFile })?.value ?? config.defaultPath;
}

// MARK: Load
/**
 * Config for {@link loadLlmModelConfigFile}.
 */
export interface LoadLlmModelConfigFileConfig<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> extends LlmModelConfigFileLocationConfig {
  /**
   * The schema to parse against (its label prefixes every error).
   */
  readonly schema: LlmModelConfigSchema<X>;
}

/**
 * A loaded model config file plus WHERE it was loaded from (named in errors and startup lines).
 */
export interface LlmLoadedModelConfigFile<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * The parsed, validated file — the operator's own declaration, not overlaid.
   */
  readonly file: LlmModelConfigFile<X>;
  /**
   * The path it was read from.
   */
  readonly filePath: string;
}

/**
 * Load the operator's model config file, or `undefined` when none exists — the explicit env path (fail-loud when
 * missing) > `defaultPath`. A malformed file FAILS LOUD naming its path.
 *
 * @param config - The environment, the env names, the default path and the schema.
 * @returns The parsed file and its path, or `undefined` when no file exists.
 * @throws {Error} When the explicit env path does not exist, or the file is not valid JSON or does not match the
 *   schema.
 */
export function loadLlmModelConfigFile<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(config: LoadLlmModelConfigFileConfig<X>): Maybe<LlmLoadedModelConfigFile<X>> {
  const { schema, defaultPath } = config;
  const names = config.names ?? DEFAULT_LLM_ENV_NAMES;
  const explicit = firstLlmEnvEntry({ env: config.env, names: names.modelsFile });
  let filePath: Maybe<string>;
  let loaded: Maybe<LlmLoadedModelConfigFile<X>>;

  if (explicit == null) {
    filePath = existsSync(defaultPath) ? defaultPath : undefined;
  } else {
    if (!existsSync(explicit.value)) {
      throw new Error(`${schema.label}: ${explicit.name} points at a missing file: ${explicit.value}`);
    }

    filePath = explicit.value;
  }

  if (filePath != null) {
    let raw: unknown;

    try {
      raw = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (e) {
      throw new Error(`${schema.label}: failed to parse ${filePath}: ${errorMessageOf(e)}`, { cause: e });
    }

    loaded = { file: parseLlmModelConfigFile({ raw, source: filePath, schema }), filePath };
  }

  return loaded;
}

/**
 * Config for {@link loadEffectiveLlmModelConfigFile}.
 */
export interface LoadEffectiveLlmModelConfigFileConfig<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> extends LoadLlmModelConfigFileConfig<X> {
  /**
   * The host's built-in model config, the floor the operator's file is laid over. It should carry no `active`.
   * Default `{}`.
   */
  readonly base?: Maybe<LlmModelConfigFile<X>>;
}

/**
 * The EFFECTIVE model config — the operator's file over the host's built-ins — plus what a caller needs to keep
 * straight afterwards.
 */
export interface LlmEffectiveModelConfigFile<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * What every READ resolves against: the built-ins with {@link userFile} shadowing them by key.
   */
  readonly file: LlmModelConfigFile<X>;
  /**
   * The operator's own declaration, or `undefined` when the machine has no file. What every WRITE transforms —
   * persisting {@link file} would freeze a copy of the built-ins onto the machine, so a built-in corrected in a later
   * release would never reach it.
   */
  readonly userFile?: LlmModelConfigFile<X>;
  /**
   * Where the operator's file lives, whether or not it exists yet (where a write lands).
   */
  readonly filePath: string;
  /**
   * Whether {@link filePath} exists — the honest answer to "does this machine have a file", which is not the same
   * question as "are there profiles".
   */
  readonly fileExists: boolean;
}

/**
 * Load the EFFECTIVE model config — the one read a host makes before resolving anything.
 *
 * Always returns: a machine with no file still has the host's built-in profiles and per-slug facts, so a per-run
 * override may name a built-in profile there. Nothing is SELECTED by that — built-ins carry no `active`.
 *
 * @param config - The environment, the env names, the default path, the schema and the built-ins.
 * @returns The effective file, the operator's own file (when it exists), and where it lives.
 * @throws {Error} When the explicit env path is missing, the file is malformed (see {@link loadLlmModelConfigFile}),
 *   a patch names no built-in provider, or a slug binds a provider nothing declares.
 */
export function loadEffectiveLlmModelConfigFile<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(config: LoadEffectiveLlmModelConfigFileConfig<X>): LlmEffectiveModelConfigFile<X> {
  const { schema } = config;
  const loaded = loadLlmModelConfigFile(config);
  const filePath = loaded?.filePath ?? resolveLlmModelConfigFilePath(config);
  const file = overlayLlmModelConfigFile({ base: config.base ?? {}, file: loaded?.file, source: filePath, schema });
  return { file, ...(loaded == null ? {} : { userFile: loaded.file }), filePath, fileExists: loaded != null };
}

// MARK: Write
/**
 * Config for {@link writeLlmModelConfigFile}.
 */
export interface WriteLlmModelConfigFileConfig<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * The whole file to persist. There is no partial write: a caller reads {@link LlmEffectiveModelConfigFile.userFile},
   * transforms the one key it means to change, and hands the result back, so the bytes on disk are always a shape the
   * parse accepts.
   */
  readonly file: LlmModelConfigFile<X>;
  /**
   * The path to write (typically {@link resolveLlmModelConfigFilePath}).
   */
  readonly filePath: string;
  /**
   * The schema the bytes are validated against.
   */
  readonly schema: LlmModelConfigSchema<X>;
  /**
   * The host's built-ins — what the written `active` is checked against, so it may name a built-in profile.
   * Default `{}`.
   */
  readonly base?: Maybe<LlmModelConfigFile<X>>;
}

/**
 * Persist a model config file. Three properties the read side's fail-loud posture demands of anything that edits it:.
 *
 * 1. **Validated before it lands.** The serialized BYTES are parsed back (not the in-memory object — the bytes are
 *    what the next host reads) and the file's own `active` is resolved with no override against the EFFECTIVE file
 *    (built-ins ⊕ this payload), so an `active` naming a profile nothing defines is refused here instead of reddening
 *    the next boot of every host on the machine. A per-run override in the writing process neither satisfies nor
 *    vetoes it: the next reader will not have that variable. An `active` naming a built-in profile is legal.
 * 2. **Atomic.** Written to a sibling temp file and renamed, so an interrupted write cannot leave a truncated file —
 *    exactly the malformed file the read side fails loud on, for every host, until someone repairs it by hand. A failed
 *    write or rename removes the temp file.
 * 3. **Formatted for the hand-editor.** 2-space JSON, a trailing newline, and keys in a fixed order (`$schema`, `notes`,
 *    `active`, `providers`, `profiles`, `models` — the prose before the data, the endpoints before the maps that use
 *    them, the per-slug appendix last). The order is an ALLOWLIST: a top-level key missing from it is dropped.
 *
 * Profiles are flattened back to their on-disk shape, and the parsed-side `providerPatches` fold back into
 * `providers` after the full entries — no `providerPatches` key ever reaches disk.
 *
 * @param config - The file, its path, the schema and the built-ins.
 * @returns The re-parsed file exactly as it now exists on disk.
 * @throws {Error} When the payload does not satisfy the schema, its `active` names an undefined profile, or the write
 *   or rename fails.
 */
export function writeLlmModelConfigFile<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(config: WriteLlmModelConfigFileConfig<X>): LlmModelConfigFile<X> {
  const { file, filePath, schema } = config;
  // `providers` and `models` are already their on-disk shape but both need CARRYING: dropping either would delete every
  // declared provider / per-slug fact the next time any command wrote the file.
  const providers = file.providers == null && file.providerPatches == null ? undefined : { ...file.providers, ...file.providerPatches };
  const profiles = file.profiles == null ? undefined : Object.fromEntries(Object.entries(file.profiles).map(([name, profile]) => [name, flattenLlmModelProfile(profile)]));
  const ordered = {
    ...(file.$schema === undefined ? {} : { $schema: file.$schema }),
    ...(file.notes === undefined ? {} : { notes: file.notes }),
    ...(file.active == null ? {} : { active: file.active }),
    ...(providers == null ? {} : { providers }),
    ...(profiles == null ? {} : { profiles }),
    ...(file.models == null ? {} : { models: file.models })
  };
  const body = `${JSON.stringify(ordered, null, 2)}\n`;
  const parsed = parseLlmModelConfigFile({ raw: JSON.parse(body), source: filePath, schema });
  resolveLlmModelProfile({ file: overlayLlmModelConfigFile({ base: config.base ?? {}, file: parsed, source: filePath, schema }), source: filePath, schema });

  mkdirSync(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.writing`;

  try {
    writeFileSync(tempPath, body, 'utf8');
    renameSync(tempPath, filePath);
  } catch (e) {
    rmSync(tempPath, { force: true });
    throw e;
  }

  return parsed;
}

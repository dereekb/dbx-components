/**
 * The model config **merge**: lays a host's parsed file over its built-ins, and cross-checks every per-slug provider
 * binding against the merged result — the first point at which the set of reachable provider names is complete.
 */

import { filterUndefinedValues, type Maybe } from '@dereekb/util';
import { DEFAULT_LLM_MODEL_CONFIG_SOURCE, type LlmCompletionProviderEntryOf, type LlmModelConfigBaseTypes, type LlmModelConfigFile, type LlmModelConfigFileFields, type LlmModelConfigSchema, type LlmModelConfigTypes, type LlmModelProfile, type LlmModelSettingsOf } from './llm.model.config.schema';

/**
 * A copy of `record` without the entries named in `names`, in its own order.
 *
 * @param record - The record (absent ⇒ none).
 * @param names - The names to drop.
 * @returns The filtered copy.
 */
function omitLlmModelConfigNames<T>(record: Maybe<Readonly<Record<string, T>>>, names: Maybe<Readonly<Record<string, unknown>>>): Record<string, T> {
  return Object.fromEntries(Object.entries(record ?? {}).filter(([name]) => names == null || !Object.hasOwn(names, name)));
}

/**
 * `record` when it has entries, else `undefined`.
 *
 * @param record - The record.
 * @returns The record, or `undefined` when empty.
 */
function nonEmptyLlmModelConfigMap<T extends object>(record: T): T | undefined {
  return Object.keys(record).length === 0 ? undefined : record;
}

/**
 * Config for {@link mergeLlmModelConfigFiles}.
 */
export interface MergeLlmModelConfigFilesConfig<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * The file underneath (a host's built-ins, or an already-merged file). Its own patches are ignored.
   */
  readonly base?: Maybe<LlmModelConfigFile<X>>;
  /**
   * The file on top.
   */
  readonly overlay?: Maybe<LlmModelConfigFile<X>>;
  /**
   * The schema (names the patch keys in the error).
   */
  readonly schema: LlmModelConfigSchema<X>;
}

/**
 * Layer one parsed file OVER another — the merge that lets a host's built-ins sit under its file without either one
 * having to know about the other.
 *
 * `providers` (with `extensionProviders`), `profiles` and `models` merge BY KEY, and an overlay entry replaces the base
 * entry WHOLESALE rather than merging into it — across BOTH provider maps: an overlay name in either one removes the
 * base entry of that name from the other, so a name never lives in both. That is the important half: a profile whose `fast` came from the overlay and whose `strong` was
 * inherited from the base is the half-swapped map ("`fast` moved, `strong` kept billing the paid slug") this layer
 * exists to prevent, and a provider whose `apiKeyEnv` came from the overlay and whose `baseUrl` was inherited bills one
 * account at another's endpoint. Naming a provider or a profile therefore means "this, entirely".
 *
 * The ONE exception is `overlay.providerPatches`: a patch lays its extension fields over the merged entry of the same
 * name (a field the patch sets replaces the base's; one it does not mention is kept), so a corrected gateway URL or key
 * var on a built-in still reaches every host that only ever patched it. Patch fields never change which account bills,
 * which is why they alone may merge. The merged file carries no `providerPatches`.
 *
 * The scalar keys (`active`, `notes`, `$schema`) are the overlay's when it declares them, else the base's. The result's
 * keys follow `LLM_MODEL_CONFIG_FILE_KEYS`, with `extensionProviders` after `providers`.
 *
 * @param config - The base, the overlay and the schema.
 * @returns The merged file.
 * @throws {Error} When an overlay patch names a provider neither file declares.
 */
export function mergeLlmModelConfigFiles<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(config: MergeLlmModelConfigFilesConfig<X>): LlmModelConfigFile<X> {
  const { base, overlay, schema } = config;
  const providers: Record<string, LlmCompletionProviderEntryOf<X>> = { ...omitLlmModelConfigNames(base?.providers, overlay?.extensionProviders), ...overlay?.providers };
  const extensionProviders: Record<string, X['extensionProviderEntry']> = { ...omitLlmModelConfigNames(base?.extensionProviders, overlay?.providers), ...overlay?.extensionProviders };

  for (const [name, patch] of Object.entries(overlay?.providerPatches ?? {})) {
    if (Object.hasOwn(providers, name)) {
      providers[name] = { ...providers[name], ...patch };
    } else if (Object.hasOwn(extensionProviders, name)) {
      extensionProviders[name] = { ...extensionProviders[name], ...patch };
    } else {
      throw new Error(`${schema.label}: providers['${name}'] carries only ${schema.patchKeysNoun} keys, which extends an existing provider, but none is named '${name}'.`);
    }
  }

  const profiles: Record<string, LlmModelProfile> = { ...base?.profiles, ...overlay?.profiles };
  const models: Partial<Record<string, LlmModelSettingsOf<X>>> = { ...base?.models, ...overlay?.models };
  const fields: LlmModelConfigFileFields<X> = {
    $schema: overlay?.$schema === undefined ? base?.$schema : overlay.$schema,
    notes: overlay?.notes === undefined ? base?.notes : overlay.notes,
    active: overlay?.active ?? base?.active ?? undefined,
    providers: nonEmptyLlmModelConfigMap(providers),
    extensionProviders: nonEmptyLlmModelConfigMap(extensionProviders),
    providerPatches: undefined,
    profiles: nonEmptyLlmModelConfigMap(profiles),
    models: nonEmptyLlmModelConfigMap(models)
  };

  return filterUndefinedValues(fields);
}

/**
 * Config for {@link assertLlmModelProviderBindings}.
 */
export interface AssertLlmModelProviderBindingsConfig<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * The MERGED file to check.
   */
  readonly file: Maybe<LlmModelConfigFile<X>>;
  /**
   * The file path / label errors name. Default {@link DEFAULT_LLM_MODEL_CONFIG_SOURCE}.
   */
  readonly source?: Maybe<string>;
  /**
   * The schema (owned transports, implicit providers, the bindable predicate).
   */
  readonly schema: LlmModelConfigSchema<X>;
}

/**
 * Assert every per-slug PROVIDER binding names a provider that serves the slug — the cross-reference the per-file parse
 * deliberately does not make, because it cannot see the built-in providers a slug may legitimately bind to. Run it over
 * the MERGED file ({@link overlayLlmModelConfigFile} does).
 *
 * FAILS LOUD, listing the declared names. A typo'd binding is always an operator error, and the alternative — silently
 * serving the slug from the default provider — is the "billed the wrong account" surprise the providers block exists to
 * end. A binding to a provider of a transport the extension owns (`extensionProviders`) fails too, unless the
 * extension says that entry is bindable.
 *
 * @param config - The merged file, its source label and the schema.
 * @throws {Error} When a slug binds a provider that serves no completions, or a name nothing declares.
 */
export function assertLlmModelProviderBindings<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(config: AssertLlmModelProviderBindingsConfig<X>): void {
  const { file, schema } = config;
  const source = config.source ?? DEFAULT_LLM_MODEL_CONFIG_SOURCE;
  const providers = file?.providers ?? {};
  const extensionProviders = file?.extensionProviders ?? {};
  const declared = [...Object.keys(providers), ...Object.keys(extensionProviders)];
  const implicit = schema.implicitProviders;
  // The host's default instances are reachable by name even though no `providers` entry declares them: they are
  // minted from the host's own environment, and naming one is how a slug says "the ordinary one".
  const known = new Set([...declared, ...implicit]);

  for (const [model, settings] of Object.entries(file?.models ?? {})) {
    const provider = settings?.provider;
    const extensionEntry = provider != null && !Object.hasOwn(providers, provider) && Object.hasOwn(extensionProviders, provider) ? extensionProviders[provider] : undefined;

    if (extensionEntry != null && schema.extension?.isProviderBindable?.(extensionEntry) !== true) {
      throw new Error(`${schema.label}: ${source} models['${model}'].provider names provider '${provider}', which serves no completions (transport '${extensionEntry.transport}').`);
    }

    if (provider != null && !known.has(provider)) {
      const plusImplicit = implicit.length > 0 ? `, plus the built-in ${implicit.join(' / ')}` : '';
      throw new Error(`${schema.label}: ${source} models['${model}'].provider names provider '${provider}', which ${source} does not declare (have: ${declared.length === 0 ? '(none)' : declared.join(', ')}${plusImplicit}).`);
    }
  }
}

/**
 * Config for {@link overlayLlmModelConfigFile}.
 */
export interface OverlayLlmModelConfigFileConfig<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * The host's built-in model config. It should carry no `active`: availability is not adoption.
   */
  readonly base: LlmModelConfigFile<X>;
  /**
   * The host's parsed file, or absent when there is none.
   */
  readonly file?: Maybe<LlmModelConfigFile<X>>;
  /**
   * The file path / label errors name. Default {@link DEFAULT_LLM_MODEL_CONFIG_SOURCE}.
   */
  readonly source?: Maybe<string>;
  /**
   * The schema.
   */
  readonly schema: LlmModelConfigSchema<X>;
}

/**
 * Lay a host's parsed file over its built-ins — the ONE call a host makes between reading the file and resolving
 * anything from it, so it can never resolve against a file that is missing the built-ins.
 *
 * Checks that every patch extends a BUILT-IN provider, merges ({@link mergeLlmModelConfigFiles}), then asserts the
 * per-slug provider bindings over the merged file ({@link assertLlmModelProviderBindings}). A base selects nothing by
 * itself. The WRITE side should keep the host file separate, so a corrected built-in reaches every machine.
 *
 * @param config - The built-ins, the host file, its source label and the schema.
 * @returns The effective file: the built-ins with the host's declaration shadowing them by key.
 * @throws {Error} When a patch names no built-in provider, or a slug binds a provider nothing declares.
 */
export function overlayLlmModelConfigFile<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(config: OverlayLlmModelConfigFileConfig<X>): LlmModelConfigFile<X> {
  const { base, file, schema } = config;
  const source = config.source ?? DEFAULT_LLM_MODEL_CONFIG_SOURCE;
  const builtIns = [...Object.keys(base.providers ?? {}), ...Object.keys(base.extensionProviders ?? {})];

  for (const name of Object.keys(file?.providerPatches ?? {})) {
    if (!builtIns.includes(name)) {
      const names = builtIns;
      throw new Error(`${schema.label}: ${source} providers['${name}'] carries only ${schema.patchKeysNoun} keys, which extends a BUILT-IN provider, but no built-in is named '${name}' (built-ins: ${names.length === 0 ? '(none)' : names.join(', ')}). Declare it in full (transport / baseUrl / apiKeyEnv).`);
    }
  }

  const merged = mergeLlmModelConfigFiles({ base, overlay: file, schema });
  assertLlmModelProviderBindings({ file: merged, source, schema });
  return merged;
}

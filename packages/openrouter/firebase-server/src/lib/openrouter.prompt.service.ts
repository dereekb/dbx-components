import { type Getter, type Maybe, type Milliseconds, MS_IN_MINUTE, arrayToMap, expiringCachedGetter } from '@dereekb/util';
import { type OpenRouterPromptDefinition, type OpenRouterPromptKey, type OpenRouterPromptVersionNumber, type OpenRouterResolvedPrompt, validateOpenRouterModelConfig } from '@dereekb/openrouter';
import { type OpenRouterPrompt, type OpenRouterPromptDocument, type OpenRouterPromptFirestoreCollections, type OpenRouterPromptVersion, OpenRouterPromptState, openRouterPromptVersionId, openRouterResolvedPromptForVersion } from '@dereekb/openrouter/firebase';

/**
 * Error thrown when a prompt cannot be resolved.
 */
export class OpenRouterPromptResolutionError extends Error {
  readonly promptKey: OpenRouterPromptKey;
  readonly version: Maybe<OpenRouterPromptVersionNumber>;

  constructor(promptKey: OpenRouterPromptKey, message: string, version?: Maybe<OpenRouterPromptVersionNumber>) {
    super(`OpenRouter prompt "${promptKey}"${version == null ? '' : ` version ${version}`}: ${message}`);
    this.promptKey = promptKey;
    this.version = version;
  }
}

/**
 * Params for resolving a prompt version.
 */
export interface OpenRouterResolvePromptParams {
  /**
   * The prompt to resolve.
   */
  readonly promptKey: OpenRouterPromptKey;
  /**
   * The version to pin to. When omitted the prompt's `activeVersion` is used.
   */
  readonly version?: Maybe<OpenRouterPromptVersionNumber>;
}

/**
 * Default time a resolved prompt is cached for.
 *
 * What can go stale is which version is active, and what the latest — still editable — version says.
 * Neither is critical to serve to the second: a run that used the previous text for a few minutes is a
 * run against a prompt that was live a few minutes ago, not a wrong run. Bounded rather than permanent
 * is the requirement, so the change lands on its own rather than at the next cold start.
 */
export const OPENROUTER_PROMPT_CACHE_DURATION: Milliseconds = MS_IN_MINUTE * 5;

/**
 * Loads prompts and resolves their versions.
 */
export abstract class OpenRouterPromptService {
  /**
   * Loads the prompt definitions this service resolves against, de-duplicated by key.
   *
   * Exposed so a seeder publishes the exact values the resolver would otherwise stand in with, rather
   * than a second registry wired in parallel that can drift from this one. De-duplicated because
   * `definitionsByKey` is what resolution actually reads: `arrayToMap` is last-wins, so iterating the
   * raw config array would let a seeder publish a definition that never resolves.
   *
   * Async even though the configured implementation answers from memory: a later one may read its
   * registry from somewhere the process does not already hold it — a manifest in storage, another
   * service — and a getter is the one shape that cannot be widened to cover that without breaking
   * every caller.
   */
  abstract loadPromptDefinitions(): Promise<OpenRouterPromptDefinition[]>;
  /**
   * Loads a prompt document by key.
   *
   * Reads the STORE only — a prompt that exists solely as a code definition has no document, so this
   * returns undefined for it while {@link resolvePrompt} still serves it.
   */
  abstract loadPrompt(promptKey: OpenRouterPromptKey): Promise<Maybe<OpenRouterPrompt>>;
  /**
   * Resolves the version to serve for a prompt, pinned or active.
   *
   * Resolves from the store, falling back to a configured {@link OpenRouterPromptDefinition} when the
   * store cannot serve or is behind it.
   *
   * @throws {OpenRouterPromptResolutionError} when the prompt, or the requested version, is not servable.
   */
  abstract resolvePrompt(params: OpenRouterResolvePromptParams): Promise<OpenRouterResolvedPrompt>;
  /**
   * Drops any cached resolution for a prompt. Called after a publish/promote so the change is visible
   * immediately rather than after the cache expires.
   */
  abstract clearCachedPrompt(promptKey: OpenRouterPromptKey): void;
}

/**
 * Config for {@link openRouterPromptService}.
 */
export interface OpenRouterPromptServiceConfig {
  /**
   * The prompt collections.
   */
  readonly collections: OpenRouterPromptFirestoreCollections;
  /**
   * Prompts defined in code, served when the stored prompt cannot serve or is behind them.
   *
   * See {@link OpenRouterPromptDefinition} for the precedence rules. Omit to resolve from Firestore
   * only, which is the behaviour of a service configured without definitions.
   */
  readonly definitions?: Maybe<OpenRouterPromptDefinition[]>;
  /**
   * How long a resolution is cached for. Defaults to {@link OPENROUTER_PROMPT_CACHE_DURATION}.
   */
  readonly cacheDuration?: Maybe<Milliseconds>;
  /**
   * Whether a resolved config that fails validation is rejected instead of returned.
   *
   * Defaults to false: a warning-level problem (an unpinned PDF engine, say) should not take a
   * production path down, and an error-level one will fail the request anyway with a clearer message
   * from OpenRouter. Turn it on in tests and in prompt-authoring tooling, where failing early is the
   * point.
   */
  readonly rejectInvalidConfig?: Maybe<boolean>;
}

/**
 * Creates an {@link OpenRouterPromptService}.
 *
 * @param config - The collections and cache configuration.
 * @returns The service.
 */
export function openRouterPromptService(config: OpenRouterPromptServiceConfig): OpenRouterPromptService {
  const { collections, definitions, cacheDuration, rejectInvalidConfig } = config;
  const { openRouterPromptCollection, openRouterPromptVersionCollectionFactory } = collections;
  const duration = cacheDuration ?? OPENROUTER_PROMPT_CACHE_DURATION;

  const definitionsByKey = arrayToMap(definitions ?? [], (definition) => definition.promptKey);
  const cache = new Map<string, Getter<Promise<OpenRouterResolvedPrompt>>>();

  async function loadPromptDefinitions(): Promise<OpenRouterPromptDefinition[]> {
    // A fresh array each call rather than one built at construction: the returned type is mutable, and
    // handing every caller the same array would let a seeder's own filtering reach the registry
    // resolution reads.
    return Array.from(definitionsByKey.values());
  }

  function loadPromptDocument(promptKey: OpenRouterPromptKey): OpenRouterPromptDocument {
    return openRouterPromptCollection.documentAccessor().loadDocumentForId(promptKey);
  }

  async function loadPrompt(promptKey: OpenRouterPromptKey): Promise<Maybe<OpenRouterPrompt>> {
    return loadPromptDocument(promptKey).snapshotData();
  }

  /**
   * Reads one published version.
   *
   * @param promptDocument - The parent prompt document.
   * @param promptKey - The prompt's key, recorded on the resolution.
   * @param version - The version to read.
   * @returns The resolved version, or undefined when that version was never published.
   */
  async function readStoredVersion(promptDocument: OpenRouterPromptDocument, promptKey: OpenRouterPromptKey, version: OpenRouterPromptVersionNumber): Promise<Maybe<OpenRouterResolvedPrompt>> {
    const versionDocument = openRouterPromptVersionCollectionFactory(promptDocument).documentAccessor().loadDocumentForId(openRouterPromptVersionId(version));
    const versionData: Maybe<OpenRouterPromptVersion> = await versionDocument.snapshotData();
    return versionData == null ? undefined : openRouterResolvedPromptForVersion(promptKey, versionData);
  }

  async function resolveVersion(promptKey: OpenRouterPromptKey, inputVersion: Maybe<OpenRouterPromptVersionNumber>): Promise<OpenRouterResolvedPrompt> {
    const definition = definitionsByKey.get(promptKey);
    const promptDocument = loadPromptDocument(promptKey);
    const prompt = await promptDocument.snapshotData();

    // The version the store would serve an unpinned caller. A prompt that is missing, not ACTIVE, or has
    // never had a version promoted cannot serve one — which is precisely when a code definition stands in.
    // A pinned caller is still allowed to read a draft/archived prompt: that is how a version is tested
    // before promotion, and how a historical run is replayed after retirement.
    const storedActiveVersion = prompt?.s === OpenRouterPromptState.ACTIVE ? prompt.av : undefined;

    let resolved: Maybe<OpenRouterResolvedPrompt>;

    if (inputVersion != null) {
      // Pinned. The store wins whenever it actually holds that version, so a version published under the
      // same number after a run was queued is picked up on the run's next attempt. The definition covers
      // the rest, which is what lets a run enqueued against a definition still dispatch.
      resolved = prompt == null ? undefined : await readStoredVersion(promptDocument, promptKey, inputVersion);

      if (resolved == null && definition?.version === inputVersion) {
        resolved = definition;
      }
    } else if (definition != null && (storedActiveVersion == null || definition.version > storedActiveVersion)) {
      // Unpinned, and code is either standing in for the store or ahead of it.
      resolved = definition;
    } else if (storedActiveVersion != null) {
      resolved = await readStoredVersion(promptDocument, promptKey, storedActiveVersion);
    }

    if (resolved == null) {
      // Reported against what was actually missing, since "no prompt", "nothing promoted", and "that one
      // version is gone" need different fixes.
      if (prompt == null) {
        throw new OpenRouterPromptResolutionError(promptKey, 'does not exist.', inputVersion);
      } else if (inputVersion != null) {
        throw new OpenRouterPromptResolutionError(promptKey, 'version does not exist.', inputVersion);
      } else if (prompt.s === OpenRouterPromptState.ACTIVE) {
        throw new OpenRouterPromptResolutionError(promptKey, 'has no activeVersion, and no version was pinned.');
      } else {
        throw new OpenRouterPromptResolutionError(promptKey, `is not ACTIVE (state ${prompt.s}), and no version was pinned.`);
      }
    }

    if (rejectInvalidConfig) {
      const validation = validateOpenRouterModelConfig(resolved.config);

      if (!validation.valid) {
        throw new OpenRouterPromptResolutionError(promptKey, `has an invalid config: ${validation.errors.join(' ')}`, resolved.version);
      }
    }

    return resolved;
  }

  function cacheKey(promptKey: OpenRouterPromptKey, version: Maybe<OpenRouterPromptVersionNumber>): string {
    return `${promptKey}:${version ?? '_'}`;
  }

  async function resolvePrompt(params: OpenRouterResolvePromptParams): Promise<OpenRouterResolvedPrompt> {
    const { promptKey, version } = params;
    const key = cacheKey(promptKey, version);
    let getter: Maybe<Getter<Promise<OpenRouterResolvedPrompt>>> = cache.get(key);

    if (getter == null) {
      const load = () => resolveVersion(promptKey, version);
      // Everything expires, pinned resolutions included. A version is only immutable once it LOCKS, which
      // happens when the next version is created — until then the head version is editable in place, and
      // a permanently cached pin of it would serve the pre-edit text forever on every instance except the
      // one that handled the edit. Telling the two apart would cost a read of the lock, which is the same
      // read the expiry already pays for.
      getter = expiringCachedGetter({ getter: load, ttl: duration });
      cache.set(key, getter);
    }

    let result: OpenRouterResolvedPrompt;

    try {
      result = await getter();
    } catch (e) {
      // Never cache a rejected promise: a prompt created moments after a failed lookup would keep
      // failing for the whole cache window.
      cache.delete(key);
      throw e;
    }

    return result;
  }

  function clearCachedPrompt(promptKey: OpenRouterPromptKey): void {
    // Every version of the prompt goes, pinned entries included: a publish or promote can change what any
    // of them resolve to. Deleting the current entry mid-iteration is well-defined for a Map iterator, so
    // no snapshot copy is needed.
    for (const key of cache.keys()) {
      if (key.startsWith(`${promptKey}:`)) {
        cache.delete(key);
      }
    }
  }

  return { loadPromptDefinitions, loadPrompt, resolvePrompt, clearCachedPrompt };
}

import { type Getter, type Maybe, type Milliseconds, MS_IN_MINUTE, cachedGetter, expiringCachedGetter } from '@dereekb/util';
import { type OpenRouterPromptKey, type OpenRouterPromptVersionNumber, type OpenRouterResolvedPrompt, validateOpenRouterModelConfig } from '@dereekb/openrouter';
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
 * Short on purpose. Published versions are immutable, so the only thing that can go stale is which
 * version is active — and a promotion should take effect within a minute or two, not on the next cold
 * start.
 */
export const OPENROUTER_PROMPT_CACHE_DURATION: Milliseconds = MS_IN_MINUTE * 2;

/**
 * Loads prompts and resolves their versions.
 */
export abstract class OpenRouterPromptService {
  /**
   * Loads a prompt document by key.
   */
  abstract loadPrompt(promptKey: OpenRouterPromptKey): Promise<Maybe<OpenRouterPrompt>>;
  /**
   * Resolves the version to serve for a prompt, pinned or active.
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
  const { collections, cacheDuration, rejectInvalidConfig } = config;
  const { openRouterPromptCollection, openRouterPromptVersionCollectionFactory } = collections;
  const duration = cacheDuration ?? OPENROUTER_PROMPT_CACHE_DURATION;

  const cache = new Map<string, Getter<Promise<OpenRouterResolvedPrompt>>>();

  function loadPromptDocument(promptKey: OpenRouterPromptKey): OpenRouterPromptDocument {
    return openRouterPromptCollection.documentAccessor().loadDocumentForId(promptKey);
  }

  async function loadPrompt(promptKey: OpenRouterPromptKey): Promise<Maybe<OpenRouterPrompt>> {
    return loadPromptDocument(promptKey).snapshotData();
  }

  async function resolveVersion(promptKey: OpenRouterPromptKey, inputVersion: Maybe<OpenRouterPromptVersionNumber>): Promise<OpenRouterResolvedPrompt> {
    const promptDocument = loadPromptDocument(promptKey);
    const prompt = await promptDocument.snapshotData();

    if (prompt == null) {
      throw new OpenRouterPromptResolutionError(promptKey, 'does not exist.', inputVersion);
    }

    if (inputVersion == null && prompt.s !== OpenRouterPromptState.ACTIVE) {
      // A pinned caller is allowed to read a draft/archived prompt — that is how a version is tested
      // before promotion, and how a historical run is replayed after retirement. An unpinned caller is
      // not, since "whatever is active" is undefined for a prompt that is not.
      throw new OpenRouterPromptResolutionError(promptKey, `is not ACTIVE (state ${prompt.s}), and no version was pinned.`);
    }

    const version = inputVersion ?? prompt.av;

    if (version == null) {
      throw new OpenRouterPromptResolutionError(promptKey, 'has no activeVersion, and no version was pinned.');
    }

    const versionDocument = openRouterPromptVersionCollectionFactory(promptDocument).documentAccessor().loadDocumentForId(openRouterPromptVersionId(version));
    const versionData: Maybe<OpenRouterPromptVersion> = await versionDocument.snapshotData();

    if (versionData == null) {
      throw new OpenRouterPromptResolutionError(promptKey, 'version does not exist.', version);
    }

    const resolved = openRouterResolvedPromptForVersion(promptKey, versionData);

    if (rejectInvalidConfig) {
      const validation = validateOpenRouterModelConfig(resolved.config);

      if (!validation.valid) {
        throw new OpenRouterPromptResolutionError(promptKey, `has an invalid config: ${validation.errors.join(' ')}`, version);
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
      // A pinned version is immutable, so it never needs re-reading; only the active pointer can move,
      // which is the one thing that has to expire.
      getter = version == null ? expiringCachedGetter({ getter: load, ttl: duration }) : cachedGetter(load);
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
    Array.from(cache.keys())
      .filter((key) => key.startsWith(`${promptKey}:`))
      .forEach((key) => cache.delete(key));
  }

  return { loadPrompt, resolvePrompt, clearCachedPrompt };
}

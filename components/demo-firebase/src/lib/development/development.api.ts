import { type DevelopmentFirebaseFunctionConfigMap, type DevelopmentFirebaseFunctionMap, developmentFirebaseFunctionMapFactory, FirebaseDevelopmentFunctions, type FirebaseDevelopmentFunctionTypeMap, type FirebaseFunctionMapFunction } from '@dereekb/firebase';
import { type, type Type } from 'arktype';

export const DEMO_DEVELOPMENT_EXAMPLE_MAX_MESSAGE_LENGTH = 200;

export interface DemoDevelopmentExampleParams {
  readonly message: string;
}

export const demoDevelopmentExampleParamsType = type({
  message: `string > 0 & string <= ${DEMO_DEVELOPMENT_EXAMPLE_MAX_MESSAGE_LENGTH}`
}) as Type<DemoDevelopmentExampleParams>;

export interface DemoDevelopmentExampleResult {
  message: string;
}

export const DEMO_APP_EXAMPLE_DEVELOPMENT_FUNCTION_SPECIFIER = 'example';

/**
 * Seeds the app's OpenRouter prompts. Idempotent.
 *
 * A prompt lives in Firestore rather than in a vendor dashboard, so a fresh environment (or a fresh
 * emulator run) has none until something writes them.
 */
export const DEMO_APP_SEED_OPENROUTER_PROMPTS_DEVELOPMENT_FUNCTION_SPECIFIER = 'seedOpenRouterPrompts';

export interface DemoDevelopmentSeedOpenRouterPromptsParams {}

export const demoDevelopmentSeedOpenRouterPromptsParamsType = type({}) as Type<DemoDevelopmentSeedOpenRouterPromptsParams>;

export interface DemoDevelopmentSeedOpenRouterPromptsResult {
  /**
   * Number of prompts whose declared version this call published to the store.
   *
   * A single count rather than the richer server-side result: this component is shared with the browser
   * build, so it cannot alias `SeedOpenRouterPromptsResult` from `@dereekb/openrouter/firebase-server`.
   * The full counts stay available server-side, for schedules and tests.
   */
  readonly promptsSynced: number;
}

/**
 * Recomputes every UserExternalConnection's derived `ec` array.
 *
 * Load-bearing rather than cosmetic: `ec` is what the uniqueness policy and the sign-in lookup both
 * query, and a document written before the field existed — or before login links contributed to it —
 * carries a stale value. Until this has run, a returning user can look like a stranger.
 */
export const DEMO_APP_BACKFILL_USER_EXTERNAL_CONNECTION_KEYS_DEVELOPMENT_FUNCTION_SPECIFIER = 'backfillUserExternalConnectionExternalAccountKeys';

/**
 * Creates a login link for every pre-existing connection whose provider is enabled for sign-in.
 *
 * Connections established before login links existed keep working, but show as NOT linked in the
 * settings page's login-provider list until this runs.
 */
export const DEMO_APP_BACKFILL_USER_EXTERNAL_CONNECTION_LOGINS_DEVELOPMENT_FUNCTION_SPECIFIER = 'backfillUserExternalConnectionLogins';

/**
 * Parameters shared by both UserExternalConnection backfills.
 */
export interface DemoDevelopmentBackfillUserExternalConnectionParams {
  /**
   * How many documents to load per checkpoint. Defaults to 100.
   */
  readonly limitPerCheckpoint?: number;
  /**
   * When true, report what would change without writing anything. Defaults to false.
   */
  readonly dryRun?: boolean;
}

export const demoDevelopmentBackfillUserExternalConnectionParamsType = type({
  'limitPerCheckpoint?': 'number > 0',
  'dryRun?': 'boolean'
}) as Type<DemoDevelopmentBackfillUserExternalConnectionParams>;

/**
 * The outcome of a UserExternalConnection backfill.
 */
export interface DemoDevelopmentBackfillUserExternalConnectionResult {
  readonly visited: number;
  readonly updated: number;
}

export type DemoDevelopmentFunctionTypeMap = FirebaseDevelopmentFunctionTypeMap & {
  [DEMO_APP_EXAMPLE_DEVELOPMENT_FUNCTION_SPECIFIER]: [DemoDevelopmentExampleParams, DemoDevelopmentExampleResult];
  [DEMO_APP_SEED_OPENROUTER_PROMPTS_DEVELOPMENT_FUNCTION_SPECIFIER]: [DemoDevelopmentSeedOpenRouterPromptsParams, DemoDevelopmentSeedOpenRouterPromptsResult];
  [DEMO_APP_BACKFILL_USER_EXTERNAL_CONNECTION_KEYS_DEVELOPMENT_FUNCTION_SPECIFIER]: [DemoDevelopmentBackfillUserExternalConnectionParams, DemoDevelopmentBackfillUserExternalConnectionResult];
  [DEMO_APP_BACKFILL_USER_EXTERNAL_CONNECTION_LOGINS_DEVELOPMENT_FUNCTION_SPECIFIER]: [DemoDevelopmentBackfillUserExternalConnectionParams, DemoDevelopmentBackfillUserExternalConnectionResult];
};

export const demoDevelopmentFunctionsConfig: DevelopmentFirebaseFunctionConfigMap<DemoDevelopmentFunctionTypeMap> = {
  scheduledFunction: null,
  example: null,
  seedOpenRouterPrompts: null,
  backfillUserExternalConnectionExternalAccountKeys: null,
  backfillUserExternalConnectionLogins: null
};

/**
 * Used to generate our ProfileFunctionMap for a Functions instance.
 */
export const demoDevelopmentFunctionMap = developmentFirebaseFunctionMapFactory<DemoDevelopmentFunctionTypeMap>(demoDevelopmentFunctionsConfig);

/**
 * Declared as an abstract class so we can inject it into our Angular app using this token.
 */
export abstract class DemoDevelopmentFunctions extends FirebaseDevelopmentFunctions implements DevelopmentFirebaseFunctionMap<DemoDevelopmentFunctionTypeMap> {
  abstract example: FirebaseFunctionMapFunction<DemoDevelopmentFunctionTypeMap, 'example'>;
  abstract seedOpenRouterPrompts: FirebaseFunctionMapFunction<DemoDevelopmentFunctionTypeMap, 'seedOpenRouterPrompts'>;
  abstract backfillUserExternalConnectionExternalAccountKeys: FirebaseFunctionMapFunction<DemoDevelopmentFunctionTypeMap, 'backfillUserExternalConnectionExternalAccountKeys'>;
  abstract backfillUserExternalConnectionLogins: FirebaseFunctionMapFunction<DemoDevelopmentFunctionTypeMap, 'backfillUserExternalConnectionLogins'>;
}

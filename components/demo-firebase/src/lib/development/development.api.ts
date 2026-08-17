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

export type DemoDevelopmentFunctionTypeMap = FirebaseDevelopmentFunctionTypeMap & {
  [DEMO_APP_EXAMPLE_DEVELOPMENT_FUNCTION_SPECIFIER]: [DemoDevelopmentExampleParams, DemoDevelopmentExampleResult];
  [DEMO_APP_SEED_OPENROUTER_PROMPTS_DEVELOPMENT_FUNCTION_SPECIFIER]: [DemoDevelopmentSeedOpenRouterPromptsParams, DemoDevelopmentSeedOpenRouterPromptsResult];
};

export const demoDevelopmentFunctionsConfig: DevelopmentFirebaseFunctionConfigMap<DemoDevelopmentFunctionTypeMap> = {
  scheduledFunction: null,
  example: null,
  seedOpenRouterPrompts: null
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
}

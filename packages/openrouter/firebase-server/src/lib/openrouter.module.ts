import { type DynamicModule, type ModuleMetadata, type Provider } from '@nestjs/common';
import { type OpenRouterPromptService } from './openrouter.prompt.service';
import { type OpenRouterRunTaskService } from './openrouter.runtask.service';
import { OpenRouterPromptServerActions } from './openrouter.action.server';

/**
 * Config for {@link appOpenRouterModuleMetadata}.
 */
export interface AppOpenRouterModuleMetadataConfig {
  /**
   * Module providing the concrete {@link OpenRouterPromptService},
   * {@link OpenRouterRunTaskService}, and the actions context.
   *
   * Kept as a caller-supplied dependency module rather than constructed here: the run-task service needs
   * the app's Firestore collections, its storage context, its OpenRouter client, and its
   * terminal-state handler — every one of which is app-specific.
   */
  readonly dependencyModule: Required<ModuleMetadata>['imports'][0];
  /**
   * Provider for {@link OpenRouterPromptServerActions}.
   */
  readonly serverActionsProvider: Provider;
  /**
   * Additional providers to expose.
   */
  readonly providers?: Provider[];
  /**
   * Additional exports.
   */
  readonly exports?: Required<ModuleMetadata>['exports'];
}

/**
 * Builds the module metadata for an app's OpenRouter module.
 *
 * @param config - The dependency module and server-actions provider.
 * @returns The module metadata.
 */
export function appOpenRouterModuleMetadata(config: AppOpenRouterModuleMetadataConfig): ModuleMetadata {
  const { dependencyModule, serverActionsProvider, providers, exports } = config;

  return {
    imports: [dependencyModule],
    providers: [serverActionsProvider, ...(providers ?? [])],
    exports: [OpenRouterPromptServerActions, ...(exports ?? [])]
  };
}

/**
 * Base class an app's OpenRouter module extends.
 */
export abstract class AbstractAppOpenRouterModule {}

/**
 * A reference to an {@link OpenRouterPromptService}, for an actions context to extend.
 */
export interface OpenRouterPromptServiceRef {
  readonly openRouterPromptService: OpenRouterPromptService;
}

/**
 * A reference to an {@link OpenRouterRunTaskService}, for an actions context to extend.
 */
export interface OpenRouterRunTaskServiceRef {
  readonly openRouterRunTaskService: OpenRouterRunTaskService;
}

/**
 * Injection token for the {@link OpenRouterPromptService}.
 */
export const OPENROUTER_PROMPT_SERVICE_TOKEN = 'OPENROUTER_PROMPT_SERVICE_TOKEN';

/**
 * Injection token for the {@link OpenRouterRunTaskService}.
 */
export const OPENROUTER_RUN_TASK_SERVICE_TOKEN = 'OPENROUTER_RUN_TASK_SERVICE_TOKEN';

/**
 * Type of a dynamic module produced for the OpenRouter services.
 */
export type OpenRouterDynamicModule = DynamicModule;

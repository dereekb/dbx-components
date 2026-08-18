import { Module } from '@nestjs/common';
import { FirebaseServerEnvService, FirebaseServerStorageService } from '@dereekb/firebase-server';
import { OpenRouterApi, OpenRouterModule } from '@dereekb/nestjs/openrouter';
import { OPENROUTER_PROMPT_SERVICE_TOKEN, OPENROUTER_RUN_TASK_SERVICE_TOKEN, OpenRouterPromptServerActions, type OpenRouterPromptService, type OpenRouterRunTaskService, appOpenRouterModuleMetadata, openRouterPromptServerActions, openRouterPromptService, openRouterRunTaskService } from '@dereekb/openrouter/firebase-server';
import { DemoFirebaseServerActionsContext } from '../../common/firebase/action.context';
import { DemoApiActionModule } from '../../common/firebase/action.module';
import { DemoApiStorageModule } from '../../common/firebase/storage.module';
import { demoOpenRouterPromptDefinitions } from '../../common/model/openrouter/openrouter.definitions';

/**
 * Builds the {@link OpenRouterPromptService} for the demo app.
 *
 * The code definitions are what let the resume check run against an environment that was never seeded —
 * a fresh emulator, or a test — instead of failing to resolve the prompt. A seeded version at or above
 * the definition's version still wins.
 *
 * @param context - Server actions context supplying the prompt collections.
 * @returns The prompt service.
 */
export function demoOpenRouterPromptServiceFactory(context: DemoFirebaseServerActionsContext): OpenRouterPromptService {
  return openRouterPromptService({ collections: context, definitions: demoOpenRouterPromptDefinitions() });
}

/**
 * Builds the {@link OpenRouterRunTaskService} for the demo app.
 *
 * `envService` is the whole file-transport gate: against the emulator `isProduction` is false, so the
 * runner attaches a file as inline base64 instead of a signed url OpenRouter could never reach — the
 * emulator does not support signing, so the accessor falls back to a `publicUrl()` on localhost and
 * OpenRouter rejects it with "Localhost URLs are not allowed". Nothing else in the app has to know
 * which mode is in play.
 *
 * @param context - Server actions context supplying the run task collections.
 * @param promptService - Resolves a run's prompt version.
 * @param openRouterApi - Supplies the OpenRouter client.
 * @param storageService - Supplies the storage context files are read/signed through.
 * @param envService - Selects the file attachment mode.
 * @returns The run task service.
 */
export function demoOpenRouterRunTaskServiceFactory(context: DemoFirebaseServerActionsContext, promptService: OpenRouterPromptService, openRouterApi: OpenRouterApi, storageService: FirebaseServerStorageService, envService: FirebaseServerEnvService): OpenRouterRunTaskService {
  return openRouterRunTaskService({
    collections: context,
    promptService,
    client: openRouterApi.openRouterClient,
    storageContext: storageService.storageContext,
    envService
  });
}

/**
 * Builds the {@link OpenRouterPromptServerActions} for the demo app.
 *
 * @param context - Server actions context.
 * @param promptService - The prompt service, so a publish drops its cached resolution immediately.
 * @returns The server actions.
 */
export function demoOpenRouterPromptServerActionsFactory(context: DemoFirebaseServerActionsContext, promptService: OpenRouterPromptService): OpenRouterPromptServerActions {
  return openRouterPromptServerActions({ ...context, openRouterPromptService: promptService });
}

/**
 * Supplies the concrete OpenRouter services.
 *
 * Kept separate from the model module for the same reason the framework asks for it: every one of
 * these is app-specific (the app's collections, its storage context, its client, its environment), so
 * the framework module cannot construct them.
 */
@Module({
  imports: [DemoApiActionModule, DemoApiStorageModule, OpenRouterModule],
  providers: [
    {
      provide: OPENROUTER_PROMPT_SERVICE_TOKEN,
      useFactory: demoOpenRouterPromptServiceFactory,
      inject: [DemoFirebaseServerActionsContext]
    },
    {
      provide: OPENROUTER_RUN_TASK_SERVICE_TOKEN,
      useFactory: demoOpenRouterRunTaskServiceFactory,
      inject: [DemoFirebaseServerActionsContext, OPENROUTER_PROMPT_SERVICE_TOKEN, OpenRouterApi, FirebaseServerStorageService, FirebaseServerEnvService]
    }
  ],
  exports: [DemoApiActionModule, OPENROUTER_PROMPT_SERVICE_TOKEN, OPENROUTER_RUN_TASK_SERVICE_TOKEN]
})
export class DemoApiOpenRouterDependencyModule {}

/**
 * The demo's OpenRouter model module — mounts the prompt CRUD server actions.
 */
@Module(
  appOpenRouterModuleMetadata({
    dependencyModule: DemoApiOpenRouterDependencyModule,
    serverActionsProvider: {
      provide: OpenRouterPromptServerActions,
      useFactory: demoOpenRouterPromptServerActionsFactory,
      inject: [DemoFirebaseServerActionsContext, OPENROUTER_PROMPT_SERVICE_TOKEN]
    },
    // The dependency MODULE is re-exported, not its tokens: Nest only lets a module export a provider
    // it declares itself, and these are declared next door.
    exports: [DemoApiOpenRouterDependencyModule]
  })
)
export class DemoOpenRouterModule {}

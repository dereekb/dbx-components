import { type ModuleMetadata, type INestApplicationContext } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { type ClassType } from '@dereekb/util';
import { ModelApiController } from './model.api.controller';
import { ModelApiDispatchService, MODEL_API_NEST_APPLICATION_CONTEXT } from './model.api.dispatch';

// MARK: Config
/**
 * Configuration for {@link modelApiModuleMetadata}.
 */
export interface ModelApiModuleMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Module that exports the required dependencies.
   *
   * Must provide {@link ModelApiDispatchConfig} so the dispatch service
   * can access the callModel function and nest context factory.
   */
  readonly dependencyModule: ClassType;
}

// MARK: Module Metadata
/**
 * Generates NestJS module metadata for the Model API controller.
 *
 * Follows the same pattern as {@link oidcModuleMetadata} — takes a dependency module
 * that provides the required tokens, and returns a complete module metadata object.
 *
 * @param metadataConfig - Configuration including the dependency module.
 * @returns NestJS module metadata with the Model API controller, dispatch service, and app context provider.
 *
 * @example
 * ```typescript
 * @Module(modelApiModuleMetadata({
 *   dependencyModule: DemoModelApiDependencyModule
 * }))
 * export class DemoModelApiModule {}
 * ```
 */
export function modelApiModuleMetadata(metadataConfig: ModelApiModuleMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = metadataConfig;

  return {
    imports: [dependencyModule, ...(imports ?? [])],
    controllers: [ModelApiController],
    exports: [ModelApiDispatchService, ...(exports ?? [])],
    providers: [
      ModelApiDispatchService,
      {
        provide: MODEL_API_NEST_APPLICATION_CONTEXT,
        useFactory: (moduleRef: ModuleRef) => {
          // ModuleRef implements INestApplicationContext — use it directly
          // as the application context for dispatch.
          return moduleRef as unknown as INestApplicationContext;
        },
        inject: [ModuleRef]
      },
      ...(providers ?? [])
    ]
  };
}

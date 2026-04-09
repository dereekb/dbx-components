import { Module } from '@nestjs/common';
import { ModelApiDispatchConfig, modelApiModuleMetadata } from '@dereekb/firebase-server';
import { demoCallModelFn } from '../../function/model/crud.functions';
import { mapDemoApiNestContext } from '../../function/function.context';

// MARK: Dependency Module
/**
 * Provides {@link ModelApiDispatchConfig} for the demo app.
 *
 * Wires the demo's callModel dispatch function and nest context factory
 * into the shared Model API infrastructure.
 */
@Module({
  providers: [
    {
      provide: ModelApiDispatchConfig,
      useValue: {
        callModelFn: demoCallModelFn,
        makeNestContext: mapDemoApiNestContext
      }
    }
  ],
  exports: [ModelApiDispatchConfig]
})
export class DemoModelApiDependencyModule {}

// MARK: Model API Module
/**
 * Registers the Model API REST controller for the demo app.
 *
 * Routes: `/api/model/*` (protected by OIDC bearer token middleware).
 */
@Module(
  modelApiModuleMetadata({
    dependencyModule: DemoModelApiDependencyModule
  })
)
export class DemoModelApiModule {}

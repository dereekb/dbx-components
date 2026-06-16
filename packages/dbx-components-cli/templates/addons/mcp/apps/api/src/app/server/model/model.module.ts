import { Module } from '@nestjs/common';
import { ModelApiDispatchConfig, modelApiModuleMetadata } from '@dereekb/firebase-server';
import { APP_CODE_PREFIX_CAMELCallModelFn } from '../../function/model/crud.functions';
import { mapAPP_CODE_PREFIXApiNestContext } from '../../function/function';

// MARK: Dependency Module
/**
 * Provides {@link ModelApiDispatchConfig}: the callModel dispatch function and
 * nest context factory wired into the shared Model API infrastructure.
 */
@Module({
  providers: [
    {
      provide: ModelApiDispatchConfig,
      useValue: {
        callModelFn: APP_CODE_PREFIX_CAMELCallModelFn,
        makeNestContext: mapAPP_CODE_PREFIXApiNestContext
      }
    }
  ],
  exports: [ModelApiDispatchConfig]
})
export class APP_CODE_PREFIXModelApiDependencyModule {}

// MARK: Model API Module
/**
 * Registers the Model API REST controller. Routes: `/api/model/*` (protected by
 * OIDC bearer token middleware).
 */
@Module(
  modelApiModuleMetadata({
    dependencyModule: APP_CODE_PREFIXModelApiDependencyModule
  })
)
export class APP_CODE_PREFIXModelApiModule {}

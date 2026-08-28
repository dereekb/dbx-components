import { type EnvironmentProviders, makeEnvironmentProviders, provideAppInitializer, type Provider } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxMapboxConfig, DbxMapboxService } from './mapbox.service';
import { type DbxMapboxWorkerConfig, configureDbxMapboxWorker } from './mapbox.worker';
import { provideMapboxGL } from 'ngx-mapbox-gl';

/**
 * Configuration for provideDbxMapbox().
 */
export interface ProvideDbxMapboxConfig {
  readonly dbxMapboxConfig: DbxMapboxConfig;
  readonly ngxMapboxGLModuleConfig: Parameters<typeof provideMapboxGL>[0];
  /**
   * Configuration for the self-hosted mapbox-gl web worker.
   *
   * Enabled by default. See {@link configureDbxMapboxWorker} for why it is needed and
   * which build asset the app must copy.
   */
  readonly worker?: Maybe<DbxMapboxWorkerConfig>;
}

/**
 * Creates EnvironmentProviders for providing DbxMapboxConfig and configuring the NgxMapboxGLModule.
 *
 * Also registers an app initializer that points mapbox-gl at the self-hosted CSP web worker
 * asset before any map is created.
 *
 * @param config - Configuration.
 * @returns EnvironmentProviders.
 */
export function provideDbxMapbox(config: ProvideDbxMapboxConfig): EnvironmentProviders {
  const { dbxMapboxConfig, ngxMapboxGLModuleConfig, worker } = config;

  const providers: (Provider | EnvironmentProviders)[] = [
    // config
    {
      provide: DbxMapboxConfig,
      useValue: dbxMapboxConfig
    },
    // service
    DbxMapboxService,
    // worker: must be configured before the first Map is constructed
    provideAppInitializer(() => configureDbxMapboxWorker(worker)),
    // ngxMapboxGL
    provideMapboxGL(ngxMapboxGLModuleConfig)
  ];

  return makeEnvironmentProviders(providers);
}

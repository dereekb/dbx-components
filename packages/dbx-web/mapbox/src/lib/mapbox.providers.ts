import { EnvironmentProviders, importProvidersFrom, makeEnvironmentProviders, Provider } from '@angular/core';
import { DbxMapboxConfig, DbxMapboxService } from './mapbox.service';
import { provideMapboxGL } from 'ngx-mapbox-gl';

/**
 * Configuration for provideDbxMapbox().
 */
export interface ProvideDbxMapboxConfig {
  readonly dbxMapboxConfig: DbxMapboxConfig;
  readonly ngxMapboxGLModuleConfig: Parameters<typeof provideMapboxGL>[0];
}

/**
 * Creates EnvironmentProviders for providing DbxMapboxConfig and configuring the NgxMapboxGLModule.
 *
 * @param config Configuration
 * @returns EnvironmentProviders
 */
export function provideDbxMapbox(config: ProvideDbxMapboxConfig): EnvironmentProviders {
  const { dbxMapboxConfig, ngxMapboxGLModuleConfig } = config;

  const providers: (Provider | EnvironmentProviders)[] = [
    // config
    {
      provide: DbxMapboxConfig,
      useValue: dbxMapboxConfig
    },
    // service
    DbxMapboxService,
    // ngxMapboxGL
    provideMapboxGL(ngxMapboxGLModuleConfig)
  ];

  return makeEnvironmentProviders(providers);
}

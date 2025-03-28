import { EnvironmentProviders, importProvidersFrom, makeEnvironmentProviders, Provider } from '@angular/core';
import { DbxMapboxConfig } from './mapbox.service';
import { NgxMapboxGLModule } from 'ngx-mapbox-gl';

/**
 * Configuration for provideDbxMapbox().
 */
export interface ProvideDbxMapboxConfig {
  readonly dbxMapboxConfig: DbxMapboxConfig;
  readonly ngxMapboxGLModuleConfig: Parameters<typeof NgxMapboxGLModule['withConfig']>[0];
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
    // DbxMapboxConfig
    {
      provide: DbxMapboxConfig,
      useValue: dbxMapboxConfig
    },
    // ngxMapboxGL
    importProvidersFrom(NgxMapboxGLModule.withConfig(ngxMapboxGLModuleConfig))
  ];

  return makeEnvironmentProviders(providers);
}

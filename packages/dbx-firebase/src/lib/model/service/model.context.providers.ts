import { type EnvironmentProviders, Injector, makeEnvironmentProviders, type Provider } from '@angular/core';
import { DbxFirebaseModelContextService } from './model.context.service';
import { type ClassType } from '@dereekb/util';

/**
 * Factory function for creating a DbxFirebaseModelContextService instance.
 */
export type DbxFirebaseModelContextServiceFactory<T extends DbxFirebaseModelContextService> = (injector: Injector) => T;

export interface ProvideDbxFirebaseModelContextServiceConfig<T extends DbxFirebaseModelContextService> {
  readonly dbxFirebaseModelContextServiceClass: ClassType<T>;
  readonly dbxFirebaseModelContextServiceFactory?: DbxFirebaseModelContextServiceFactory<T>;
}

/**
 * Creates EnvironmentProviders that provides a DbxFirebaseModelContextService and the configured class instance.
 *
 * @param config Configuration
 * @returns EnvironmentProviders
 */
export function provideDbxFirebaseModelContextService<T extends DbxFirebaseModelContextService>(config: ProvideDbxFirebaseModelContextServiceConfig<T>): EnvironmentProviders {
  const { dbxFirebaseModelContextServiceClass, dbxFirebaseModelContextServiceFactory } = config;

  const providers: Provider[] = [
    {
      provide: DbxFirebaseModelContextService,
      useExisting: dbxFirebaseModelContextServiceClass
    }
  ];

  if (dbxFirebaseModelContextServiceFactory) {
    providers.push({
      provide: dbxFirebaseModelContextServiceClass,
      useFactory: dbxFirebaseModelContextServiceFactory,
      deps: [Injector]
    });
  } else {
    providers.push({
      provide: DbxFirebaseModelContextService,
      useClass: dbxFirebaseModelContextServiceClass
    });
  }

  return makeEnvironmentProviders(providers);
}

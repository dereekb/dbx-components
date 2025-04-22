import { makeEnvironmentProviders, EnvironmentProviders, Provider } from '@angular/core';
import { DbxFirebaseEmulatorConfig, DbxFirebaseEmulatorsConfig, DbxFirebaseParsedEmulatorsConfig } from './emulators';
import { type Maybe } from '@dereekb/util';
import { DbxFirebaseEmulatorService } from './firebase.emulator.service';

/**
 * Config for provideDbxFirebaseEmulator().
 */
export type ProvideDbxFirebaseEmulatorsConfig = DbxFirebaseEmulatorsConfig;

/**
 * Creates EnvironmentProviders for the DbxFirebaseEmulatorService.
 *
 * @param config
 * @returns
 */
export function provideDbxFirebaseEmulator(config: ProvideDbxFirebaseEmulatorsConfig): EnvironmentProviders {
  const defaultHost = config.host ?? 'localhost';

  function emulatorConfig(emulator: Maybe<DbxFirebaseEmulatorConfig>): Required<DbxFirebaseEmulatorConfig> | undefined {
    return emulator ? { host: emulator.host ?? defaultHost, port: emulator.port } : undefined;
  }

  const finalConfig: DbxFirebaseParsedEmulatorsConfig = {
    useEmulators: config.useEmulators !== false,
    ui: emulatorConfig(config.ui),
    auth: emulatorConfig(config.auth),
    firestore: emulatorConfig(config.firestore),
    storage: emulatorConfig(config.storage),
    functions: emulatorConfig(config.functions),
    database: emulatorConfig(config.database)
  };

  const providers: Provider[] = [
    {
      provide: DbxFirebaseParsedEmulatorsConfig,
      useValue: finalConfig
    },
    DbxFirebaseEmulatorService
  ];

  return makeEnvironmentProviders(providers);
}

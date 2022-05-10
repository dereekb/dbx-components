import * as admin from 'firebase-admin';
import { FactoryProvider, InjectionToken, Module, ModuleMetadata, Provider } from "@nestjs/common";
import { FIREBASE_APP_TOKEN } from '../firebase/firebase.nest';
import { FirebaseServerAuthService } from './auth.service';

// MARK: Tokens
/**
 * Token to access the Auth for the app.
 */
export const FIREBASE_AUTH_TOKEN: InjectionToken = 'FIREBASE_AUTH_TOKEN';

/**
 * Nest provider module for Firebase that provides a firestore, etc. from the firestore token.
 */
@Module({
  providers: [{
    provide: FIREBASE_AUTH_TOKEN,
    useFactory: (app: admin.app.App) => app.auth(),
    inject: [FIREBASE_APP_TOKEN]
  }],
  exports: [FIREBASE_AUTH_TOKEN]
})
export class FirebaseServerAuthModule { }

// MARK: AppAuthCollections
export type ProvideFirestoreServerAuthServiceSimple<T extends FirebaseServerAuthService> = Pick<FactoryProvider<T>, 'provide'> & {
  useFactory: (auth: admin.auth.Auth) => T;
};

export type ProvideFirestoreServerAuthService<T extends FirebaseServerAuthService> = FactoryProvider<T> | ProvideFirestoreServerAuthServiceSimple<T>;

export function provideFirestoreServerAuthService<T extends FirebaseServerAuthService>(provider: ProvideFirestoreServerAuthService<T>): [ProvideFirestoreServerAuthService<T>, Provider<T>] {
  return [
    {
      ...provider,
      inject: (provider as any).inject ?? [FIREBASE_AUTH_TOKEN]
    },
    {
      provide: FirebaseServerAuthService,
      useExisting: provider.provide
    }
  ];
}

// MARK: app firestore module
export interface ProvideAppAuthModuleMetadataConfig<T extends FirebaseServerAuthService> extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  readonly serviceProvider: ProvideFirestoreServerAuthService<T>;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's Auth related modules and FirebaseServerAuthService provider.
 * 
 * @param provide 
 * @param useFactory 
 * @returns 
 */
export function appAuthModuleMetadata<T extends FirebaseServerAuthService>(config: ProvideAppAuthModuleMetadataConfig<T>): ModuleMetadata {
  return {
    imports: [FirebaseServerAuthModule, ...(config.imports ?? [])],
    exports: [FirebaseServerAuthModule, config.serviceProvider.provide, ...(config.exports ?? [])],
    providers: [...provideFirestoreServerAuthService(config.serviceProvider), ...(config.providers ?? [])]
  };
}

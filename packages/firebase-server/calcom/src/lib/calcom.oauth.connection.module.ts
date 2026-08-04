import { type ModuleMetadata, type Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { type CalcomOAuthScope } from '@dereekb/calcom';
import { CalcomApi } from '@dereekb/calcom/nestjs';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import { UserExternalConnectionAccessor, UserExternalConnectionServerActions } from '@dereekb/firebase-server/model';
import { type Maybe } from '@dereekb/util';
import { CalcomUserExternalConnectionOAuthServiceConfig, calcomUserExternalConnectionOAuthServiceConfigFactory } from './calcom.oauth.connection.config';
import { UserExternalConnectionCalcomUserContextService, userExternalConnectionCalcomUserContextService } from './calcom.oauth.connection.context';
import { CalcomUserExternalConnectionOAuthController } from './calcom.oauth.connection.controller';
import { CalcomUserExternalConnectionOAuthService } from './calcom.oauth.connection.service';

// MARK: App Calcom UserExternalConnection OAuth Module
export interface ProvideAppCalcomUserExternalConnectionOAuthMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * This module requires the following dependencies in order to initialize properly:
   * - CalcomOAuthApi
   *
   * This module declaration makes it easier to import a module that exports that dependency.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
  /**
   * Path on the app URL the user is returned to after connecting, e.g. `/app/settings`.
   */
  readonly successPath: string;
  /**
   * Path on the app URL the user is returned to after a failed connect. Defaults to `successPath`.
   */
  readonly failurePath?: Maybe<string>;
  /**
   * The scopes to request. Defaults to `DEFAULT_CALCOM_OAUTH_SCOPES`.
   */
  readonly scopes?: Maybe<readonly CalcomOAuthScope[]>;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's Cal.com external-connection
 * OAuth module.
 *
 * Opt-in, like the webhook module: importing the Cal.com OAuth module alone never mounts HTTP
 * routes, so an app that only makes outbound Cal.com calls exposes no endpoints.
 *
 * The importing module must also supply `UserExternalConnectionServerActions` and
 * `UserExternalConnectionStateCoder` — both exported by `appUserExternalConnectionModuleMetadata`,
 * so pass that module in `imports`.
 *
 * @param config - The module metadata configuration.
 * @returns NestJS ModuleMetadata mounting the Cal.com connect endpoints.
 */
export function appCalcomUserExternalConnectionOAuthModuleMetadata(config: ProvideAppCalcomUserExternalConnectionOAuthMetadataConfig): ModuleMetadata {
  const { dependencyModule, successPath, failurePath, scopes, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    controllers: [CalcomUserExternalConnectionOAuthController],
    exports: [CalcomUserExternalConnectionOAuthService, ...(exports ?? [])],
    providers: [
      {
        provide: CalcomUserExternalConnectionOAuthServiceConfig,
        inject: [FirebaseServerEnvService],
        useFactory: (envService: FirebaseServerEnvService) => calcomUserExternalConnectionOAuthServiceConfigFactory({ envService, successPath, failurePath, scopes })
      },
      CalcomUserExternalConnectionOAuthService,
      ...(providers ?? [])
    ]
  };
}

// MARK: Calcom User Context Service
/**
 * Creates the NestJS provider for the {@link UserExternalConnectionCalcomUserContextService}.
 *
 * A provider rather than a module, because the three tokens it needs are never declared together:
 * `CalcomApi` comes from the app's Cal.com module and the accessor and actions from its
 * UserExternalConnection module. Declare this in a module that imports both.
 *
 * Separate from {@link appCalcomUserExternalConnectionOAuthModuleMetadata} on purpose — that module
 * needs only `CalcomOAuthApi`, and folding this in would force every app running the connect flow to
 * also provide `CalcomApi` whether it makes outbound Cal.com calls or not.
 *
 * @returns The NestJS provider.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionCalcomUserContextServiceProvider(): Provider {
  return {
    provide: UserExternalConnectionCalcomUserContextService,
    useFactory: (calcomApi: CalcomApi, accessor: UserExternalConnectionAccessor, actions: UserExternalConnectionServerActions) => userExternalConnectionCalcomUserContextService({ calcomApi, accessor, actions }),
    inject: [CalcomApi, UserExternalConnectionAccessor, UserExternalConnectionServerActions]
  };
}

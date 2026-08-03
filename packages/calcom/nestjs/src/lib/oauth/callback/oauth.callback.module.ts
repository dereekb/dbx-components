import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { type Maybe } from '@dereekb/util';
import { CalcomOAuthCallbackController } from './oauth.callback.controller';
import { CalcomOAuthCallbackService } from './oauth.callback.service';
import { CALCOM_OAUTH_CALLBACK_CONTROLLER_PATH, calcomOAuthCallbackServiceConfigFactory, CalcomOAuthCallbackServiceConfig } from './oauth.callback.config';

export type CalcomOAuthCallbackServiceConfigFactory = (configService: ConfigService) => CalcomOAuthCallbackServiceConfig;

/**
 * Routes to exclude from an app's global API route prefix, so the callback controller stays mounted
 * at `/oauth/calcom/*`.
 *
 * Spread this into the `exclude` list of the app's `globalApiRoutePrefix` config, alongside
 * `FIREBASE_SERVER_OIDC_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE`. Without it a `/api` prefix moves the
 * routes to `/api/oauth/calcom/*`, which breaks the redirect URI registered with Cal.com — and the
 * redirect URI must match byte-for-byte, so this is not something the provider tolerates.
 */
export const CALCOM_OAUTH_CALLBACK_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE: string[] = [`${CALCOM_OAUTH_CALLBACK_CONTROLLER_PATH}/{*path}`];

// MARK: App Calcom OAuth Callback Module
export interface ProvideAppCalcomOAuthCallbackMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * The CalcomOAuthCallbackModule requires the following dependencies in order to initialize properly:
   * - CalcomOAuthApi
   * - CalcomOAuthServiceConfig
   *
   * This module declaration makes it easier to import a module that exports those dependencies.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
  /**
   * Optional override for the CalcomOAuthCallbackServiceConfigFactory.
   *
   * @default calcomOAuthCallbackServiceConfigFactory
   */
  readonly calcomOAuthCallbackServiceConfigFactory?: CalcomOAuthCallbackServiceConfigFactory;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's CalcomOAuthCallbackModule.
 *
 * Opt-in, like the webhook module: importing the OAuth module alone never mounts HTTP routes, so an
 * app that only makes outbound Cal.com calls exposes no endpoints.
 *
 * @param config - The module metadata configuration including optional dependency module and config factory.
 * @returns NestJS ModuleMetadata for registering the CalcomOAuthCallbackModule.
 */
export function appCalcomOAuthCallbackModuleMetadata(config: ProvideAppCalcomOAuthCallbackMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    controllers: [CalcomOAuthCallbackController],
    exports: [CalcomOAuthCallbackService, ...(exports ?? [])],
    providers: [
      {
        provide: CalcomOAuthCallbackServiceConfig,
        inject: [ConfigService],
        useFactory: config.calcomOAuthCallbackServiceConfigFactory ?? calcomOAuthCallbackServiceConfigFactory
      },
      CalcomOAuthCallbackService,
      ...(providers ?? [])
    ]
  };
}

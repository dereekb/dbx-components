import { Module, type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { type Maybe } from '@dereekb/util';
import { TwilioModule } from '../twilio.module';
import { type TwilioVerifyServiceSid } from '../twilio.type';
import { TwilioVerifyApi } from './verify.api';
import { TWILIO_VERIFY_SERVICE_SID_ENV_VAR, TwilioVerifyServiceConfig } from './verify.config';
import { TwilioVerifyService } from './verify.service';

/**
 * Factory that creates a {@link TwilioVerifyServiceConfig} from environment variables.
 *
 * @param configService - NestJS config service for reading environment variables.
 * @returns A validated {@link TwilioVerifyServiceConfig}.
 */
export function twilioVerifyServiceConfigFactory(configService: ConfigService): TwilioVerifyServiceConfig {
  const config: TwilioVerifyServiceConfig = {
    twilioVerify: {
      verifyServiceSid: configService.get<TwilioVerifyServiceSid>(TWILIO_VERIFY_SERVICE_SID_ENV_VAR) as TwilioVerifyServiceSid
    }
  };

  TwilioVerifyServiceConfig.assertValidConfig(config);
  return config;
}

// MARK: App Twilio Verify Module
export interface ProvideAppTwilioVerifyMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Module that exports the `TwilioApi`, typically the app's module built by `appTwilioModuleMetadata()`.
   *
   * Defaults to {@link TwilioModule}.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's Twilio Verify (OTP / 2FA) module.
 *
 * @param config - The module metadata configuration including the dependency module.
 * @returns NestJS ModuleMetadata for registering the Twilio Verify module.
 */
export function appTwilioVerifyModuleMetadata(config?: Maybe<ProvideAppTwilioVerifyMetadataConfig>): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config ?? {};

  return {
    imports: [ConfigModule, dependencyModule ?? TwilioModule, ...(imports ?? [])],
    exports: [TwilioVerifyApi, TwilioVerifyService, ...(exports ?? [])],
    providers: [
      {
        provide: TwilioVerifyServiceConfig,
        inject: [ConfigService],
        useFactory: twilioVerifyServiceConfigFactory
      },
      TwilioVerifyApi,
      TwilioVerifyService,
      ...(providers ?? [])
    ]
  };
}

/**
 * NestJS module that exposes Twilio Verify (OTP / 2FA) for starting verifications and
 * checking submitted codes.
 *
 * Imports {@link TwilioModule} for the underlying Twilio client. Use {@link appTwilioVerifyModuleMetadata}
 * to use the app's own Twilio module instead.
 */
@Module(appTwilioVerifyModuleMetadata())
export class TwilioVerifyModule {}

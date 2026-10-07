import { Module, type ModuleMetadata } from '@nestjs/common';
import { type Maybe } from '@dereekb/util';
import { TwilioModule } from '../twilio.module';
import { TwilioLookupApi } from './lookup.api';
import { TwilioLookupService } from './lookup.service';

// MARK: App Twilio Lookup Module
export interface ProvideAppTwilioLookupMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Module that exports the `TwilioApi`, typically the app's module built by `appTwilioModuleMetadata()`.
   *
   * Defaults to {@link TwilioModule}.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's Twilio Lookup v2 (phone validation, carrier info) module.
 *
 * @param config - The module metadata configuration including the dependency module.
 * @returns NestJS ModuleMetadata for registering the Twilio Lookup module.
 */
export function appTwilioLookupModuleMetadata(config?: Maybe<ProvideAppTwilioLookupMetadataConfig>): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config ?? {};

  return {
    imports: [dependencyModule ?? TwilioModule, ...(imports ?? [])],
    exports: [TwilioLookupApi, TwilioLookupService, ...(exports ?? [])],
    providers: [TwilioLookupApi, TwilioLookupService, ...(providers ?? [])]
  };
}

/**
 * NestJS module that exposes Twilio Lookup v2 (phone validation, carrier info).
 *
 * Imports {@link TwilioModule} for the underlying Twilio client. Use {@link appTwilioLookupModuleMetadata}
 * to use the app's own Twilio module instead.
 */
@Module(appTwilioLookupModuleMetadata())
export class TwilioLookupModule {}

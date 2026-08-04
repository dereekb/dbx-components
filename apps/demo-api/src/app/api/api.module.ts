import { Module } from '@nestjs/common';
import { CalcomUserExternalConnectionOAuthService } from '@dereekb/firebase-server/calcom';
import { DiscordUserExternalConnectionOAuthService } from '@dereekb/firebase-server/discord';
import { ZohoUserExternalConnectionOAuthService } from '@dereekb/firebase-server/zoho';
import { UserExternalConnectionOAuthProviderRegistry, UserExternalConnectionReader, userExternalConnectionOAuthProviderRegistryProvider, userExternalConnectionReaderProvider } from '@dereekb/firebase-server/model';
import { UserExternalConnectionModule } from '../common/model/userexternalconnection';
import { DemoApiStripeModule } from './stripe/stripe.module';
import { DemoApiZoomModule } from './zoom/zoom.module';
import { DemoApiVapiAiModule } from './vapiai';
import { DemoApiOpenAIModule } from './openai';
import { DemoApiTypeformModule } from './typeform';
import { DemoApiDiscordModule, DemoDiscordOAuthConnectionModule } from './discord';
import { DemoApiCalcomModule } from './calcom';
import { DemoApiZohoModule } from './zoho';

/**
 * Every external-connection OAuth service this app has mounted endpoints for.
 *
 * The registry is built FROM these, so `read:authorizeState` cannot offer a provider whose module
 * was never imported. Registering a provider is one module import above plus one token here.
 */
export const DEMO_API_EXTERNAL_CONNECTION_OAUTH_SERVICES = [CalcomUserExternalConnectionOAuthService, DiscordUserExternalConnectionOAuthService, ZohoUserExternalConnectionOAuthService];

@Module({
  // UserExternalConnectionModule is imported for the accessor and actions the reader is built from.
  // This is also the only module that can see the registry, which is why the reader is provided here
  // rather than alongside them.
  imports: [UserExternalConnectionModule, DemoApiStripeModule, DemoApiZoomModule, DemoApiVapiAiModule, DemoApiOpenAIModule, DemoApiTypeformModule, DemoApiDiscordModule, DemoDiscordOAuthConnectionModule, DemoApiCalcomModule, DemoApiZohoModule],
  providers: [userExternalConnectionOAuthProviderRegistryProvider(DEMO_API_EXTERNAL_CONNECTION_OAUTH_SERVICES), userExternalConnectionReaderProvider()],
  exports: [UserExternalConnectionOAuthProviderRegistry, UserExternalConnectionReader]
})
export class DemoApiApiModule {}

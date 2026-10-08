import { Module } from '@nestjs/common';
import { CalcomUserExternalConnectionOAuthService } from '@dereekb/firebase-server/calcom';
import { DiscordUserExternalConnectionOAuthService } from '@dereekb/firebase-server/discord';
import { ZohoUserExternalConnectionOAuthService, zohoUserExternalConnectionOAuthServiceToken } from '@dereekb/firebase-server/zoho';
import { UserExternalConnectionOAuthProviderRegistry, UserExternalConnectionReader, userExternalConnectionOAuthProviderRegistryProvider, userExternalConnectionReaderProvider } from '@dereekb/firebase-server/model';
import { DEMO_ZOHO_ADMIN_EXTERNAL_CONNECTION_PROVIDER_TYPE } from 'demo-firebase';
import { UserExternalConnectionModule } from '../common/model/userexternalconnection';
import { DemoApiStripeModule } from './stripe/stripe.module';
import { DemoApiZoomModule } from './zoom/zoom.module';
import { DemoApiVapiAiModule } from './vapiai';
import { DemoApiOpenAIModule } from './openai';
import { DemoOpenRouterModule } from './openrouter';
import { DemoApiTypeformModule } from './typeform';
import { DemoApiTwilioWebhookModule } from './twilio';
import { DemoApiDiscordModule, DemoDiscordOAuthConnectionModule } from './discord';
import { DemoApiCalcomModule } from './calcom';
import { DemoApiZohoModule } from './zoho';

/**
 * Every external-connection OAuth service this app has mounted endpoints for.
 *
 * The registry is built FROM these, so `read:authorizeState` cannot offer a provider whose module
 * was never imported. Registering a provider is one module import above plus one token here.
 *
 * The second Zoho connection (`zoho_admin`) is listed by its own token: both Zoho modules provide the
 * same service class, so the extra one is exported under a provider-type-specific alias instead.
 */
export const DEMO_API_EXTERNAL_CONNECTION_OAUTH_SERVICES = [CalcomUserExternalConnectionOAuthService, DiscordUserExternalConnectionOAuthService, ZohoUserExternalConnectionOAuthService, zohoUserExternalConnectionOAuthServiceToken(DEMO_ZOHO_ADMIN_EXTERNAL_CONNECTION_PROVIDER_TYPE)];

@Module({
  // UserExternalConnectionModule is imported for the accessor and actions the reader is built from.
  // This is also the only module that can see the registry, which is why the reader is provided here
  // rather than alongside them.
  imports: [UserExternalConnectionModule, DemoApiStripeModule, DemoApiZoomModule, DemoApiVapiAiModule, DemoApiOpenAIModule, DemoOpenRouterModule, DemoApiTypeformModule, DemoApiTwilioWebhookModule, DemoApiDiscordModule, DemoDiscordOAuthConnectionModule, DemoApiCalcomModule, DemoApiZohoModule],
  providers: [userExternalConnectionOAuthProviderRegistryProvider(DEMO_API_EXTERNAL_CONNECTION_OAUTH_SERVICES), userExternalConnectionReaderProvider()],
  exports: [UserExternalConnectionOAuthProviderRegistry, UserExternalConnectionReader]
})
export class DemoApiApiModule {}

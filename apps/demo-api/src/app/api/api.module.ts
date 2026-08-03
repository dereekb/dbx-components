import { Module } from '@nestjs/common';
import { CalcomUserExternalConnectionOAuthService } from '@dereekb/firebase-server/calcom';
import { DiscordUserExternalConnectionOAuthService } from '@dereekb/firebase-server/discord';
import { UserExternalConnectionOAuthProviderRegistry, userExternalConnectionOAuthProviderRegistryProvider } from '@dereekb/firebase-server/model';
import { DemoApiStripeModule } from './stripe/stripe.module';
import { DemoApiZoomModule } from './zoom/zoom.module';
import { DemoApiVapiAiModule } from './vapiai';
import { DemoApiOpenAIModule } from './openai';
import { DemoApiTypeformModule } from './typeform';
import { DemoApiDiscordModule, DemoDiscordOAuthConnectionModule } from './discord';
import { DemoApiCalcomModule } from './calcom';

/**
 * Every external-connection OAuth service this app has mounted endpoints for.
 *
 * The registry is built FROM these, so `read:authorizeState` cannot offer a provider whose module
 * was never imported. Registering a provider is one module import above plus one token here.
 */
export const DEMO_API_EXTERNAL_CONNECTION_OAUTH_SERVICES = [CalcomUserExternalConnectionOAuthService, DiscordUserExternalConnectionOAuthService];

@Module({
  imports: [DemoApiStripeModule, DemoApiZoomModule, DemoApiVapiAiModule, DemoApiOpenAIModule, DemoApiTypeformModule, DemoApiDiscordModule, DemoDiscordOAuthConnectionModule, DemoApiCalcomModule],
  providers: [userExternalConnectionOAuthProviderRegistryProvider(DEMO_API_EXTERNAL_CONNECTION_OAUTH_SERVICES)],
  exports: [UserExternalConnectionOAuthProviderRegistry]
})
export class DemoApiApiModule {}

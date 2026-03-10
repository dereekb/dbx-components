import { type DynamicModule, type InjectionToken, Logger, Module, type OnModuleInit } from '@nestjs/common';
import { type Firestore } from 'firebase-admin/firestore';
import { type OAuthModuleConfig, OAUTH_MODULE_CONFIG_TOKEN, DEFAULT_TOKEN_LIFETIMES } from './oauth.config';
import { createFirestoreOidcAdapterFactory } from '../adapter/firestore.adapter';
import { OidcAccountService, OidcAccountServiceDelegate, OIDC_ACCOUNT_SERVICE_TOKEN } from '../account/account.service';
import { JwksService, JWKS_SERVICE_CONFIG_TOKEN } from '../jwks/jwks.service';
import { OAuthController } from './oauth.controller';
import { InteractionController } from './interaction.controller';
import { OIDC_PROVIDER_TOKEN } from './oauth.token';
import { FIREBASE_FIRESTORE_TOKEN, FirebaseServerAuthService, FirebaseServerFirestoreModule, resolveEncryptionKey } from '@dereekb/firebase-server';

// MARK: Async Config
export interface OAuthModuleAsyncConfig {
  /**
   * Additional modules to import for injection.
   *
   * Note: `FirebaseServerFirestoreModule` is automatically imported to provide `FIREBASE_FIRESTORE_TOKEN`.
   */
  readonly imports?: any[];
  /**
   * Additional providers to register in the module context.
   *
   * Use this to provide an {@link OidcAccountServiceDelegate} implementation.
   */
  readonly providers?: any[];
  /**
   * Factory function that returns the OAuthModuleConfig.
   */
  readonly useFactory: (...args: any[]) => OAuthModuleConfig | Promise<OAuthModuleConfig>;
  /**
   * Injection tokens for the factory function.
   */
  readonly inject?: InjectionToken[];
}

// MARK: Module
/**
 * Builds the oidc-provider instance from config, injected Firestore, and JWKS service.
 */
async function buildOidcProvider(config: OAuthModuleConfig, firestore: Firestore, jwksService: JwksService, accountService: OidcAccountService) {
  const lifetimes = { ...DEFAULT_TOKEN_LIFETIMES, ...config.tokenLifetimes };
  const adapterFactory = createFirestoreOidcAdapterFactory({
    firestore,
    collectionPrefix: config.collectionPrefix
  });
  const findAccount: (ctx: unknown, id: string) => Promise<any> = (_ctx, id) => accountService.userContext(id).findAccount();

  let signingKey = await jwksService.getActiveSigningKey();

  if (!signingKey) {
    await jwksService.generateKeyPair();
    signingKey = await jwksService.getActiveSigningKey();
  }

  const jwks = await jwksService.getPublicJwks();

  // Derive cookie signing key from the resolved encryption secret.
  const encryptionKeyBuffer = resolveEncryptionKey(config.jwksEncryptionSecret);
  const cookieKey = encryptionKeyBuffer.toString('base64').slice(0, 32);

  const { default: Provider } = await import('oidc-provider');

  return new Provider(config.issuer, {
    adapter: adapterFactory as any,
    findAccount: findAccount as any,
    jwks: { keys: jwks.keys as any[] },
    features: {
      devInteractions: { enabled: false },
      registration: { enabled: true },
      registrationManagement: { enabled: true }
    },
    pkce: {
      methods: ['S256'],
      required: () => true
    },
    responseTypes: ['code'],
    grantTypes: ['authorization_code', 'refresh_token'],
    ttl: {
      AccessToken: lifetimes.accessToken,
      AuthorizationCode: lifetimes.authorizationCode,
      RefreshToken: lifetimes.refreshToken,
      Session: 14 * 24 * 60 * 60,
      Grant: 14 * 24 * 60 * 60,
      Interaction: 60 * 60,
      DeviceCode: 10 * 60
    },
    interactions: {
      url: (_ctx: any, interaction: any) => {
        if (interaction.prompt.name === 'login') {
          return `${config.loginUrl}?uid=${interaction.uid}`;
        }
        return `${config.consentUrl}?uid=${interaction.uid}`;
      }
    },
    claims: {
      openid: ['sub'],
      profile: ['name', 'picture'],
      email: ['email', 'email_verified']
    },
    cookies: {
      keys: [cookieKey]
    }
  });
}

@Module({})
export class OAuthModule implements OnModuleInit {
  private readonly logger = new Logger('OAuthModule');

  /**
   * Configure the OAuth module with a static config object.
   *
   * Requires `FirebaseServerFirestoreModule` to be available in the application
   * (automatically imported) to provide `FIREBASE_FIRESTORE_TOKEN`.
   */
  static forRoot(config: OAuthModuleConfig): DynamicModule {
    return {
      module: OAuthModule,
      imports: [FirebaseServerFirestoreModule],
      controllers: [OAuthController, InteractionController],
      providers: [
        { provide: OAUTH_MODULE_CONFIG_TOKEN, useValue: config },
        {
          provide: JWKS_SERVICE_CONFIG_TOKEN,
          useValue: {
            encryptionSecret: config.jwksEncryptionSecret,
            collectionName: `${config.collectionPrefix ?? 'oidc_'}jwks`
          }
        },
        JwksService,
        {
          provide: OIDC_ACCOUNT_SERVICE_TOKEN,
          useFactory: (authService: FirebaseServerAuthService, delegate: OidcAccountServiceDelegate) => new OidcAccountService(authService, delegate),
          inject: [FirebaseServerAuthService, OidcAccountServiceDelegate]
        },
        {
          provide: OIDC_PROVIDER_TOKEN,
          useFactory: (firestore: Firestore, jwksService: JwksService, accountService: OidcAccountService) => buildOidcProvider(config, firestore, jwksService, accountService),
          inject: [FIREBASE_FIRESTORE_TOKEN, JwksService, OIDC_ACCOUNT_SERVICE_TOKEN]
        }
      ],
      exports: [OIDC_PROVIDER_TOKEN, JwksService, OIDC_ACCOUNT_SERVICE_TOKEN, OAUTH_MODULE_CONFIG_TOKEN]
    };
  }

  /**
   * Configure the OAuth module with an async factory.
   *
   * Useful when config depends on injected services (e.g., Auth from Firebase app).
   * `FirebaseServerFirestoreModule` is automatically imported.
   */
  static forRootAsync(asyncConfig: OAuthModuleAsyncConfig): DynamicModule {
    return {
      module: OAuthModule,
      imports: [FirebaseServerFirestoreModule, ...(asyncConfig.imports ?? [])],
      controllers: [OAuthController, InteractionController],
      providers: [
        ...(asyncConfig.providers ?? []),
        {
          provide: OAUTH_MODULE_CONFIG_TOKEN,
          useFactory: asyncConfig.useFactory,
          inject: asyncConfig.inject ?? []
        },
        {
          provide: JWKS_SERVICE_CONFIG_TOKEN,
          useFactory: (config: OAuthModuleConfig) => ({
            encryptionSecret: config.jwksEncryptionSecret,
            collectionName: `${config.collectionPrefix ?? 'oidc_'}jwks`
          }),
          inject: [OAUTH_MODULE_CONFIG_TOKEN]
        },
        JwksService,
        {
          provide: OIDC_ACCOUNT_SERVICE_TOKEN,
          useFactory: (authService: FirebaseServerAuthService, delegate: OidcAccountServiceDelegate) => new OidcAccountService(authService, delegate),
          inject: [FirebaseServerAuthService, OidcAccountServiceDelegate]
        },
        {
          provide: OIDC_PROVIDER_TOKEN,
          useFactory: async (config: OAuthModuleConfig, firestore: Firestore, jwksService: JwksService, accountService: OidcAccountService) => buildOidcProvider(config, firestore, jwksService, accountService),
          inject: [OAUTH_MODULE_CONFIG_TOKEN, FIREBASE_FIRESTORE_TOKEN, JwksService, OIDC_ACCOUNT_SERVICE_TOKEN]
        }
      ],
      exports: [OIDC_PROVIDER_TOKEN, JwksService, OIDC_ACCOUNT_SERVICE_TOKEN, OAUTH_MODULE_CONFIG_TOKEN]
    };
  }

  async onModuleInit() {
    this.logger.log('OAuthModule initialized.');
  }
}

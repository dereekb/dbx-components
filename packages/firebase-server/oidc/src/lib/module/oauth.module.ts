import { type DynamicModule, type InjectionToken, Logger, Module, type OnModuleInit } from '@nestjs/common';
import { type OAuthModuleConfig, OAUTH_MODULE_CONFIG_TOKEN, DEFAULT_TOKEN_LIFETIMES } from './oauth.config';
import { createFirestoreOidcAdapterFactory } from '../adapter/firestore.adapter';
import { createFindAccount } from '../account/find-account';
import { JwksService, JWKS_SERVICE_CONFIG_TOKEN } from '../jwks/jwks.service';
import { OAuthController } from './oauth.controller';
import { InteractionController } from './interaction.controller';

// MARK: Tokens
/**
 * Injection token for the oidc-provider instance.
 */
export const OIDC_PROVIDER_TOKEN = 'OIDC_PROVIDER_TOKEN';

// MARK: Async Config
export interface OAuthModuleAsyncConfig {
  /**
   * Modules to import for injection.
   */
  readonly imports?: any[];
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
function buildOidcProviderFactory(config: OAuthModuleConfig) {
  const lifetimes = { ...DEFAULT_TOKEN_LIFETIMES, ...config.tokenLifetimes };
  const adapterFactory = createFirestoreOidcAdapterFactory({
    firestore: config.firestore,
    collectionPrefix: config.collectionPrefix
  });
  const findAccount = createFindAccount(config.auth);

  return async (jwksService: JwksService) => {
    let signingKey = await jwksService.getActiveSigningKey();

    if (!signingKey) {
      await jwksService.generateKeyPair();
      signingKey = await jwksService.getActiveSigningKey();
    }

    const jwks = await jwksService.getPublicJwks();
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
        keys: [config.jwksEncryptionSecret.slice(0, 32)]
      }
    });
  };
}

@Module({})
export class OAuthModule implements OnModuleInit {
  private readonly logger = new Logger('OAuthModule');

  /**
   * Configure the OAuth module with a static config object.
   */
  static forRoot(config: OAuthModuleConfig): DynamicModule {
    return {
      module: OAuthModule,
      controllers: [OAuthController, InteractionController],
      providers: [
        { provide: OAUTH_MODULE_CONFIG_TOKEN, useValue: config },
        {
          provide: JWKS_SERVICE_CONFIG_TOKEN,
          useValue: {
            firestore: config.firestore,
            encryptionSecret: config.jwksEncryptionSecret,
            collectionName: `${config.collectionPrefix ?? 'oidc_'}jwks_keys`
          }
        },
        JwksService,
        {
          provide: OIDC_PROVIDER_TOKEN,
          useFactory: buildOidcProviderFactory(config),
          inject: [JwksService]
        }
      ],
      exports: [OIDC_PROVIDER_TOKEN, JwksService, OAUTH_MODULE_CONFIG_TOKEN]
    };
  }

  /**
   * Configure the OAuth module with an async factory.
   * Useful when config depends on injected services (e.g., Firestore, Auth from Firebase app).
   */
  static forRootAsync(asyncConfig: OAuthModuleAsyncConfig): DynamicModule {
    return {
      module: OAuthModule,
      imports: asyncConfig.imports ?? [],
      controllers: [OAuthController, InteractionController],
      providers: [
        {
          provide: OAUTH_MODULE_CONFIG_TOKEN,
          useFactory: asyncConfig.useFactory,
          inject: asyncConfig.inject ?? []
        },
        {
          provide: JWKS_SERVICE_CONFIG_TOKEN,
          useFactory: (config: OAuthModuleConfig) => ({
            firestore: config.firestore,
            encryptionSecret: config.jwksEncryptionSecret,
            collectionName: `${config.collectionPrefix ?? 'oidc_'}jwks_keys`
          }),
          inject: [OAUTH_MODULE_CONFIG_TOKEN]
        },
        JwksService,
        {
          provide: OIDC_PROVIDER_TOKEN,
          useFactory: async (config: OAuthModuleConfig, jwksService: JwksService) => {
            const factory = buildOidcProviderFactory(config);
            return factory(jwksService);
          },
          inject: [OAUTH_MODULE_CONFIG_TOKEN, JwksService]
        }
      ],
      exports: [OIDC_PROVIDER_TOKEN, JwksService, OAUTH_MODULE_CONFIG_TOKEN]
    };
  }

  async onModuleInit() {
    this.logger.log('OAuthModule initialized.');
  }
}

import { describe, expect, it } from 'vitest';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { UserExternalConnectionOAuthServiceConfig, userExternalConnectionOAuthControllerPath, userExternalConnectionOAuthRedirectUri, userExternalConnectionOAuthRoutesForGlobalRouteExclude, userExternalConnectionOAuthServiceConfigFactory } from './userexternalconnection.oauth.config';

const CALCOM = 'calcom';
const SETTINGS_PATH = '/demo/app/settings';

function makeEnvService(overrides: Partial<FirebaseServerEnvService> = {}): FirebaseServerEnvService {
  return {
    isProduction: true,
    isStaging: false,
    isTestingEnv: false,
    appUrl: 'https://app.example.com',
    appApiUrl: 'https://app.example.com/api',
    appOAuthUrl: undefined,
    ...overrides
  } as unknown as FirebaseServerEnvService;
}

describe('userExternalConnectionOAuthControllerPath()', () => {
  it('matches the angular registry default authorize path', () => {
    // DEFAULT_EXTERNAL_CONNECTION_AUTHORIZE_PATH_FACTORY builds `/oauth/<providerType>/authorize`
    expect(`/${userExternalConnectionOAuthControllerPath(CALCOM)}/authorize`).toBe(`/oauth/${CALCOM}/authorize`);
  });
});

describe('userExternalConnectionOAuthRoutesForGlobalRouteExclude()', () => {
  it('excludes every route under the mounted controller path', () => {
    expect(userExternalConnectionOAuthRoutesForGlobalRouteExclude(CALCOM)).toEqual([`${userExternalConnectionOAuthControllerPath(CALCOM)}/{*path}`]);
  });
});

describe('userExternalConnectionOAuthRedirectUri()', () => {
  it('joins the origin to the mounted callback route', () => {
    expect(userExternalConnectionOAuthRedirectUri({ origin: 'https://app.example.com', providerType: CALCOM })).toBe('https://app.example.com/oauth/calcom/callback');
  });

  it('does not double the slash when the origin has a trailing one', () => {
    expect(userExternalConnectionOAuthRedirectUri({ origin: 'https://app.example.com/', providerType: CALCOM })).toBe('https://app.example.com/oauth/calcom/callback');
  });
});

describe('userExternalConnectionOAuthServiceConfigFactory()', () => {
  it('derives the redirect uri from the app url when no oauth url is configured', () => {
    const { userExternalConnectionOAuth } = userExternalConnectionOAuthServiceConfigFactory({ envService: makeEnvService(), providerType: CALCOM, successPath: SETTINGS_PATH });
    expect(userExternalConnectionOAuth.redirectUri).toBe('https://app.example.com/oauth/calcom/callback');
  });

  it('derives the redirect uri from the oauth url when one is configured', () => {
    // local dev: appUrl is the angular dev server, but /oauth/** is served by the hosting emulator
    const { userExternalConnectionOAuth } = userExternalConnectionOAuthServiceConfigFactory({
      envService: makeEnvService({ appUrl: 'http://localhost:9010', appOAuthUrl: 'http://localhost:9901' }),
      providerType: CALCOM,
      successPath: SETTINGS_PATH
    });

    expect(userExternalConnectionOAuth.redirectUri).toBe('http://localhost:9901/oauth/calcom/callback');
  });

  it('returns the user to the app url, not the oauth url', () => {
    const { userExternalConnectionOAuth } = userExternalConnectionOAuthServiceConfigFactory({
      envService: makeEnvService({ appUrl: 'http://localhost:9010', appOAuthUrl: 'http://localhost:9901' }),
      providerType: CALCOM,
      successPath: SETTINGS_PATH
    });

    expect(userExternalConnectionOAuth.successUrl).toBe(`http://localhost:9010${SETTINGS_PATH}`);
  });

  it('defaults the failure url to the success url', () => {
    const { userExternalConnectionOAuth } = userExternalConnectionOAuthServiceConfigFactory({ envService: makeEnvService(), providerType: CALCOM, successPath: SETTINGS_PATH });
    expect(userExternalConnectionOAuth.failureUrl).toBe(userExternalConnectionOAuth.successUrl);
  });

  it('uses the failure path when one is declared', () => {
    const { userExternalConnectionOAuth } = userExternalConnectionOAuthServiceConfigFactory({ envService: makeEnvService(), providerType: CALCOM, successPath: SETTINGS_PATH, failurePath: '/demo/app/settings?connect=failed' });
    expect(userExternalConnectionOAuth.failureUrl).toBe('https://app.example.com/demo/app/settings?connect=failed');
  });

  it('throws when no app url is configured', () => {
    expect(() => userExternalConnectionOAuthServiceConfigFactory({ envService: makeEnvService({ appUrl: undefined }), providerType: CALCOM, successPath: SETTINGS_PATH })).toThrow();
  });
});

describe('UserExternalConnectionOAuthServiceConfig.assertValidConfig()', () => {
  it('rejects a redirect uri that does not resolve to the mounted callback route', () => {
    // the drift a global `/api` route prefix causes: the provider then rejects the exchange, which
    // is only visible on a live round trip unless it is caught here
    expect(() =>
      UserExternalConnectionOAuthServiceConfig.assertValidConfig({
        userExternalConnectionOAuth: {
          providerType: CALCOM,
          redirectUri: 'https://app.example.com/api/oauth/calcom/callback',
          successUrl: 'https://app.example.com/demo/app/settings'
        }
      })
    ).toThrow();
  });

  it('accepts a redirect uri on the mounted callback route', () => {
    expect(() =>
      UserExternalConnectionOAuthServiceConfig.assertValidConfig({
        userExternalConnectionOAuth: {
          providerType: CALCOM,
          redirectUri: 'https://app.example.com/oauth/calcom/callback',
          successUrl: 'https://app.example.com/demo/app/settings'
        }
      })
    ).not.toThrow();
  });

  it('rejects a config with no redirect uri', () => {
    expect(() =>
      UserExternalConnectionOAuthServiceConfig.assertValidConfig({
        userExternalConnectionOAuth: {
          providerType: CALCOM,
          redirectUri: '',
          successUrl: 'https://app.example.com/demo/app/settings'
        }
      })
    ).toThrow();
  });
});

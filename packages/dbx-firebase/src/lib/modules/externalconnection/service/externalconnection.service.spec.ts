import { afterEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { type Maybe, waitForMs } from '@dereekb/util';
import { CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, UserExternalConnectionFunctions, type UserExternalConnectionProviderType, ZOOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE } from '@dereekb/firebase';
import { type DbxFirebaseExternalConnectionAuthorizeState, type DbxFirebaseExternalConnectionNavigateFunction, type DbxFirebaseExternalConnectionProvider, type DbxFirebaseExternalConnectionProviderEntry, DbxFirebaseExternalConnectionsConfig } from './externalconnection';
import { DbxFirebaseExternalConnectionService, navigateAndWaitForPageToLeave } from './externalconnection.service';

const TEST_PROVIDER_TYPE: UserExternalConnectionProviderType = CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE;
const TEST_AUTHORIZE_ORIGIN = 'https://components.dereekb.com';
const TEST_AUTHORIZE_URL = `${TEST_AUTHORIZE_ORIGIN}/oauth/${CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE}/authorize`;
const TEST_STATE: DbxFirebaseExternalConnectionAuthorizeState = 'test-signed-state';

const testProvider: DbxFirebaseExternalConnectionProvider = {
  providerType: TEST_PROVIDER_TYPE,
  assets: { providerName: 'Cal.com' }
};

/**
 * A promise plus the ability to settle it, standing in for a navigation that has been requested but
 * has not opened the new page yet.
 */
function pendingNavigation() {
  let openPage!: () => void;
  let blockPage!: (error: Error) => void;

  const navigating = new Promise<void>((resolve, reject) => {
    openPage = resolve;
    blockPage = reject;
  });

  return { navigating, openPage, blockPage };
}

/**
 * Input for {@link testService}.
 */
interface TestServiceInput {
  /**
   * The navigation seam. Defaults to one that records the url and resolves immediately.
   */
  readonly navigate?: Maybe<DbxFirebaseExternalConnectionNavigateFunction>;
  /**
   * The providers to register. Defaults to a single provider with no connect handler.
   */
  readonly providers?: Maybe<DbxFirebaseExternalConnectionProviderEntry[]>;
  readonly mintAuthorizeState?: Maybe<boolean>;
  /**
   * Overrides what the authorizeState callable does, for the cases where minting fails.
   */
  readonly mintState?: Maybe<(providerType: UserExternalConnectionProviderType) => Promise<DbxFirebaseExternalConnectionAuthorizeState>>;
  /**
   * Leaves UserExternalConnectionFunctions unprovided, as in an app that never wired the callables.
   */
  readonly withoutFunctions?: Maybe<boolean>;
}

/**
 * A service plus what its seams recorded.
 */
interface TestService {
  readonly service: DbxFirebaseExternalConnectionService;
  /**
   * Every url the navigation seam was handed, in order.
   */
  readonly navigatedTo: string[];
  /**
   * Every provider type the authorizeState callable was asked to mint for, in order.
   */
  readonly mintedFor: UserExternalConnectionProviderType[];
}

/**
 * Builds a service around recording test seams.
 *
 * @param input - How to configure the service.
 * @returns The service plus the navigations and mints it made.
 */
function testService(input: TestServiceInput = {}): TestService {
  const { navigate, providers, mintAuthorizeState, mintState, withoutFunctions } = input;
  const navigatedTo: string[] = [];
  const mintedFor: UserExternalConnectionProviderType[] = [];

  const config: DbxFirebaseExternalConnectionsConfig = {
    providers: providers ?? [testProvider],
    authorizeOrigin: TEST_AUTHORIZE_ORIGIN,
    mintAuthorizeState,
    navigate:
      navigate ??
      ((url: string) => {
        navigatedTo.push(url);
      })
  };

  const userExternalConnectionFunctions = {
    userExternalConnection: {
      readUserExternalConnection: {
        authorizeState: async ({ providerType }: { providerType: UserExternalConnectionProviderType }) => {
          mintedFor.push(providerType);
          return { state: mintState ? await mintState(providerType) : TEST_STATE };
        }
      }
    }
  } as unknown as UserExternalConnectionFunctions;

  TestBed.configureTestingModule({
    providers: [
      DbxFirebaseExternalConnectionService,
      { provide: DbxFirebaseExternalConnectionsConfig, useValue: config },
      // omitted entirely for the case an app has not wired the callables, since the service injects
      // them optionally and only state minting needs them
      ...(withoutFunctions ? [] : [{ provide: UserExternalConnectionFunctions, useValue: userExternalConnectionFunctions }])
    ]
  });

  return { service: TestBed.inject(DbxFirebaseExternalConnectionService), navigatedTo, mintedFor };
}

afterEach(() => {
  TestBed.resetTestingModule();
});

describe('navigateAndWaitForPageToLeave()', () => {
  it('should resolve once the browser leaves the page', async () => {
    const promise = navigateAndWaitForPageToLeave(() => window.dispatchEvent(new Event('pagehide')), 5000);

    await expect(promise).resolves.toBeUndefined();
  });

  it('should not resolve on the navigation merely having been started', async () => {
    let complete = false;
    const promise = navigateAndWaitForPageToLeave(() => undefined, 5000).then(() => {
      complete = true;
    });

    await waitForMs(0);
    expect(complete).toBe(false);

    window.dispatchEvent(new Event('pagehide'));
    await promise;

    expect(complete).toBe(true);
  });

  it('should reject when the page never leaves', async () => {
    await expect(navigateAndWaitForPageToLeave(() => undefined, 10)).rejects.toThrow('The page did not open.');
  });

  it('should reject when the navigation is refused outright', async () => {
    await expect(
      navigateAndWaitForPageToLeave(() => {
        throw new Error('refused');
      }, 5000)
    ).rejects.toThrow('refused');
  });
});

describe('DbxFirebaseExternalConnectionService', () => {
  describe('registration', () => {
    it('should register a known provider type with the library defaults', () => {
      const { service } = testService({ providers: [DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE] });

      expect(service.getProvider(DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE)?.assets.providerName).toBe('Discord');
      expect(service.getEnabledTypes()).toEqual([DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE]);
    });

    it('should register a declared provider alongside a known one', () => {
      const { service } = testService({ providers: [DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, testProvider] });

      expect(service.getRegisteredTypes()).toEqual([DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, TEST_PROVIDER_TYPE]);
      expect(service.getProvider(TEST_PROVIDER_TYPE)?.assets.description).toBeUndefined();
    });
  });

  describe('authorizeUrlWithStateForProvider()', () => {
    it('should carry the minted state on the authorize url', async () => {
      const { service, mintedFor } = testService();

      await expect(service.authorizeUrlWithStateForProvider(TEST_PROVIDER_TYPE)).resolves.toBe(`${TEST_AUTHORIZE_URL}?state=${TEST_STATE}`);
      expect(mintedFor).toEqual([TEST_PROVIDER_TYPE]);
    });

    it('should append the state to an authorize url that already carries a query', async () => {
      const { service } = testService({ providers: [{ ...testProvider, authorizePath: '/oauth/calcom/authorize?flow=settings' }] });

      await expect(service.authorizeUrlWithStateForProvider(TEST_PROVIDER_TYPE)).resolves.toBe(`${TEST_AUTHORIZE_ORIGIN}/oauth/calcom/authorize?flow=settings&state=${TEST_STATE}`);
    });

    it('should not mint a state when minting is disabled', async () => {
      const { service, mintedFor } = testService({ mintAuthorizeState: false });

      await expect(service.authorizeUrlWithStateForProvider(TEST_PROVIDER_TYPE)).resolves.toBe(TEST_AUTHORIZE_URL);
      expect(mintedFor).toEqual([]);
    });

    it('should resolve null for a provider that is not registered', async () => {
      const { service } = testService();

      await expect(service.authorizeUrlWithStateForProvider(ZOOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE)).resolves.toBeNull();
    });
  });

  describe('connectToProvider()', () => {
    it('should mint the state and navigate to the authorize url carrying it', async () => {
      const { service, navigatedTo, mintedFor } = testService();

      await service.connectToProvider(TEST_PROVIDER_TYPE);

      expect(mintedFor).toEqual([TEST_PROVIDER_TYPE]);
      expect(navigatedTo).toEqual([`${TEST_AUTHORIZE_URL}?state=${TEST_STATE}`]);
    });

    it('should not navigate when the state could not be minted', async () => {
      const { service, navigatedTo } = testService({ mintState: () => Promise.reject(new Error('unauthenticated')) });

      await expect(service.connectToProvider(TEST_PROVIDER_TYPE)).rejects.toThrow('unauthenticated');
      expect(navigatedTo).toEqual([]);
    });

    it('should name the missing callables when there is no way to mint a state', async () => {
      const { service, navigatedTo } = testService({ withoutFunctions: true });

      await expect(service.connectToProvider(TEST_PROVIDER_TYPE)).rejects.toThrow('UserExternalConnectionFunctions');
      expect(navigatedTo).toEqual([]);
    });

    it('should navigate without a state when minting is disabled', async () => {
      const { service, navigatedTo, mintedFor } = testService({ mintAuthorizeState: false, withoutFunctions: true });

      await service.connectToProvider(TEST_PROVIDER_TYPE);

      expect(mintedFor).toEqual([]);
      expect(navigatedTo).toEqual([TEST_AUTHORIZE_URL]);
    });

    it('should not resolve until the navigation has actually opened the page', async () => {
      const { navigating, openPage } = pendingNavigation();
      const { service } = testService({ navigate: () => navigating });

      let complete = false;
      const connecting = service.connectToProvider(TEST_PROVIDER_TYPE).then(() => {
        complete = true;
      });

      await waitForMs(0);
      expect(complete).toBe(false);

      openPage();
      await connecting;

      expect(complete).toBe(true);
    });

    it('should reject when the page never opened', async () => {
      const { service } = testService({ navigate: () => Promise.reject(new Error('blocked by the browser')) });

      await expect(service.connectToProvider(TEST_PROVIDER_TYPE)).rejects.toThrow('blocked by the browser');
    });

    it("should hand a provider's own connect handler a bare authorize url and a way to mint a state", async () => {
      const { navigating, openPage } = pendingNavigation();
      const navigatedTo: string[] = [];

      const connectProvider: DbxFirebaseExternalConnectionProvider = {
        ...testProvider,
        connect: async ({ navigate, authorizeUrl, mintAuthorizeState }) => {
          const state = await mintAuthorizeState();
          await navigate(`${authorizeUrl}?state=${state}`);
        }
      };

      const { service, mintedFor } = testService({
        providers: [connectProvider],
        navigate: (url) => {
          navigatedTo.push(url);
          return navigating;
        }
      });

      let complete = false;
      const connecting = service.connectToProvider(TEST_PROVIDER_TYPE).then(() => {
        complete = true;
      });

      await waitForMs(0);
      expect(complete).toBe(false);
      expect(mintedFor).toEqual([TEST_PROVIDER_TYPE]);
      expect(navigatedTo).toEqual([`${TEST_AUTHORIZE_URL}?state=${TEST_STATE}`]);

      openPage();
      await connecting;

      expect(complete).toBe(true);
    });

    it('should not mint a state for a connect handler that never asks for one', async () => {
      const connectProvider: DbxFirebaseExternalConnectionProvider = {
        ...testProvider,
        connect: async ({ navigate }) => {
          await navigate('https://example.com/custom');
        }
      };

      const { service, navigatedTo, mintedFor } = testService({ providers: [connectProvider] });

      await service.connectToProvider(TEST_PROVIDER_TYPE);

      expect(mintedFor).toEqual([]);
      expect(navigatedTo).toEqual(['https://example.com/custom']);
    });
  });
});

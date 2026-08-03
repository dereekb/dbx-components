import { afterEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { waitForMs } from '@dereekb/util';
import { CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { type DbxFirebaseExternalConnectionNavigateFunction, type DbxFirebaseExternalConnectionProvider, DbxFirebaseExternalConnectionsConfig } from './externalconnection';
import { DbxFirebaseExternalConnectionService, navigateAndWaitForPageToLeave } from './externalconnection.service';

const TEST_PROVIDER_TYPE: UserExternalConnectionProviderType = CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE;

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
 * Builds a service whose only configured navigation is the input seam.
 *
 * @param navigate - The navigation seam to configure.
 * @param providers - The providers to register. Defaults to a single provider with no connect handler.
 * @returns The service.
 */
function serviceWithNavigate(navigate: DbxFirebaseExternalConnectionNavigateFunction, providers: DbxFirebaseExternalConnectionProvider[] = [testProvider]): DbxFirebaseExternalConnectionService {
  TestBed.configureTestingModule({
    providers: [
      DbxFirebaseExternalConnectionService,
      {
        provide: DbxFirebaseExternalConnectionsConfig,
        useValue: { providers, authorizeOrigin: 'https://components.dereekb.com', navigate } satisfies DbxFirebaseExternalConnectionsConfig
      }
    ]
  });

  return TestBed.inject(DbxFirebaseExternalConnectionService);
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
  describe('connectToProvider()', () => {
    it('should not resolve until the navigation has actually opened the page', async () => {
      const { navigating, openPage } = pendingNavigation();
      const service = serviceWithNavigate(() => navigating);

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
      const service = serviceWithNavigate(() => Promise.reject(new Error('blocked by the browser')));

      await expect(service.connectToProvider(TEST_PROVIDER_TYPE)).rejects.toThrow('blocked by the browser');
    });

    it("should not resolve until the navigation made by a provider's own connect handler has opened the page", async () => {
      const { navigating, openPage } = pendingNavigation();
      const connectProvider: DbxFirebaseExternalConnectionProvider = {
        ...testProvider,
        connect: async ({ navigate, authorizeUrl }) => {
          await navigate(`${authorizeUrl}?state=abc`);
        }
      };

      const service = serviceWithNavigate(() => navigating, [connectProvider]);

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
  });
});

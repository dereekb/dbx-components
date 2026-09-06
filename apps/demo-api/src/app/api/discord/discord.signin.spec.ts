import { type DiscordAccessToken, type DiscordOAuthCurrentUser } from '@dereekb/discord';
import { DiscordOAuthApi } from '@dereekb/discord/nestjs';
import { DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as DISCORD, type FirebaseAuthUserId, USER_EXTERNAL_CONNECTION_SIGN_IN_DENIED_ERROR_CODE, USER_EXTERNAL_CONNECTION_SIGN_IN_EMAIL_CONFLICT_ERROR_CODE, userExternalConnectionsWithExternalAccountQuery } from '@dereekb/firebase';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import { CalcomUserExternalConnectionOAuthService } from '@dereekb/firebase-server/calcom';
import { DiscordUserExternalConnectionOAuthService } from '@dereekb/firebase-server/discord';
import { USER_EXTERNAL_CONNECTION_SIGN_IN_ERROR_PARAM, type UserExternalConnectionStateCoder } from '@dereekb/firebase-server/model';
import { generatePkceCodeChallenge, generatePkceCodeVerifier, type Maybe } from '@dereekb/util';
import { DEMO_EXTERNAL_CONNECTION_SIGN_IN_FAILURE_PATH, DEMO_EXTERNAL_CONNECTION_SIGN_IN_RETURN_PATH } from '../../common/model/userexternalconnection';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';

const TEST_DISCORD_ID = '80351110224678912';

function discordAccessToken(): DiscordAccessToken {
  return {
    accessToken: 'discord-access-token',
    refreshToken: 'discord-refresh-token',
    scope: 'identify email',
    expiresIn: 604800,
    expiresAt: new Date(Date.now() + 604800 * 1000)
  };
}

function discordUser(overrides: Partial<DiscordOAuthCurrentUser> = {}): DiscordOAuthCurrentUser {
  return { id: TEST_DISCORD_ID, username: 'nelly', global_name: 'Nelly', ...overrides };
}

/**
 * Discord SIGN-IN end to end against the app the demo actually mounts.
 *
 * Everything but Discord itself is real: the app's policy registry says Discord may sign in, its
 * delegate decides whether to provision, its sign-in service resolves the uid against Firebase Auth,
 * and the resulting connection lands in the same `uec`/`uecp` pair a connect writes. Only the two
 * Discord HTTP calls are stubbed on the app's own `DiscordOAuthApi` singleton — the same seam the
 * Cal.com connect spec uses.
 *
 * The rule this file exists to pin: a Discord email that already belongs to a Firebase user REJECTS
 * the sign-in. The demo must not adopt or merge that account.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describe('Discord UserExternalConnection sign-in', () => {
    let service: DiscordUserExternalConnectionOAuthService;
    let calcomService: CalcomUserExternalConnectionOAuthService;
    let oauthApi: DiscordOAuthApi;
    let stateCoder: UserExternalConnectionStateCoder;

    /**
     * Shadows one of the api's members with a stub for the duration of a test.
     *
     * An OWN data property rather than an assignment: `readCurrentUser` is a prototype GETTER
     * (`get readCurrentUser() { return readCurrentUser(this.oauthContext); }`), which has no setter,
     * so assigning to it throws. Shadowing works for a plain method like
     * `exchangeAuthorizationCodeToAccessToken` too, so both stubs go through one door.
     *
     * @param key - The api member to stub.
     * @param value - The stub to install.
     */
    function stubDiscordApi<K extends keyof DiscordOAuthApi>(key: K, value: DiscordOAuthApi[K]) {
      Object.defineProperty(oauthApi, key, { configurable: true, writable: true, value });
    }

    /**
     * Drops a stub, so the prototype's own member (a method or its getter) shows through again.
     *
     * @param key - The api member to restore.
     */
    function restoreDiscordApi(key: keyof DiscordOAuthApi) {
      Reflect.deleteProperty(oauthApi, key);
    }

    let expectedSignInSuccessUrl: string;
    let expectedSignInFailureUrl: string;

    /**
     * Every uid a test provisioned, so the emulator's auth state does not leak into the next one.
     */
    let provisionedUids: FirebaseAuthUserId[];

    beforeEach(() => {
      const { nestApplication, userExternalConnectionStateCoder } = f.instance.apiNestContext;

      service = nestApplication.get(DiscordUserExternalConnectionOAuthService);
      calcomService = nestApplication.get(CalcomUserExternalConnectionOAuthService);
      oauthApi = nestApplication.get(DiscordOAuthApi);
      stateCoder = userExternalConnectionStateCoder;
      provisionedUids = [];

      stubDiscordApi('exchangeAuthorizationCodeToAccessToken', async () => discordAccessToken());
      setDiscordUser(discordUser({ email: `discord-${Date.now()}@example.com`, verified: true }));

      const { appUrl } = nestApplication.get(FirebaseServerEnvService);

      if (!appUrl) {
        throw new Error('the demo test environment must declare an appUrl');
      }

      expectedSignInSuccessUrl = `${appUrl}${DEMO_EXTERNAL_CONNECTION_SIGN_IN_RETURN_PATH}`;
      expectedSignInFailureUrl = `${appUrl}${DEMO_EXTERNAL_CONNECTION_SIGN_IN_FAILURE_PATH}`;
    });

    afterEach(async () => {
      restoreDiscordApi('exchangeAuthorizationCodeToAccessToken');
      restoreDiscordApi('readCurrentUser');

      await Promise.all(
        provisionedUids.map(async (uid) => {
          await f.userExternalConnectionServerActions.deleteAllUserExternalConnectionsForUser({ uid });
          await f.authService.auth.deleteUser(uid).catch(() => undefined);
        })
      );
    });

    function setDiscordUser(currentUser: DiscordOAuthCurrentUser) {
      stubDiscordApi('readCurrentUser', async () => currentUser);
    }

    /**
     * Mints the sign-in state the app's own `/signin` route would, sealing a PKCE pair into it.
     *
     * @returns The state plus the verifier the browser would have kept.
     */
    async function signInState(returnPath?: Maybe<string>) {
      const verifier = generatePkceCodeVerifier();
      const challenge = await generatePkceCodeChallenge(verifier);
      const state = stateCoder.mintState({ mode: 'signin', providerType: DISCORD, challenge, returnPath, codeVerifier: 'discord-code-verifier' });

      return { state, verifier };
    }

    /**
     * Runs one whole sign-in handoff and records the uid it landed on, if any.
     *
     * @returns The callback result plus the uid now holding the Discord account.
     */
    async function signIn(returnPath?: Maybe<string>) {
      const { state, verifier } = await signInState(returnPath);
      const result = await service.handleCallback({ code: 'a-code', state });
      const uid = await uidHoldingDiscordAccount();

      if (uid != null && !provisionedUids.includes(uid)) {
        provisionedUids.push(uid);
      }

      return { ...result, verifier, uid };
    }

    /**
     * The uid whose connection document carries the test Discord account, read through the same `ec`
     * array-contains query the sign-in service uses.
     *
     * @returns The holder's uid, when there is one.
     */
    async function uidHoldingDiscordAccount(): Promise<Maybe<FirebaseAuthUserId>> {
      const docs = await f.demoFirestoreCollections.userExternalConnectionCollection.queryDocument(userExternalConnectionsWithExternalAccountQuery({ providerType: DISCORD, externalAccountId: TEST_DISCORD_ID })).getDocs();
      // the document id IS the uid, the same thing the sign-in service reads
      return docs[0]?.id;
    }

    it('should be provided by the app with sign-in ENABLED', () => {
      // both halves are required: the provider policy AND a registered sign-in service
      expect(service).toBeDefined();
      expect(service.signInEnabled).toBe(true);
    });

    it('should request the email scope, without which no email is reported at all', () => {
      // the default `['identify']` reports none, which silently skips the collision check below
      expect([...service.config.scopes]).toEqual(['identify', 'email']);
    });

    it('should return a sign-in to the app home, and a failed one to the login page', () => {
      expect(service.signInSuccessUrl).toBe(expectedSignInSuccessUrl);
      expect(service.signInFailureUrl).toBe(expectedSignInFailureUrl);
    });

    it('should leave a provider the app did NOT opt in refusing sign-in', async () => {
      // sign-in is per-provider opt-in precisely so registering a connect provider cannot hand the
      // app an unauthenticated account-creation surface
      expect(calcomService.providerType).toBe('calcom');
      expect(calcomService.signInEnabled).toBe(false);
      await expect(calcomService.signInUrlForRequest({ query: { challenge: 'a-challenge' }, ip: '127.0.0.1' } as never)).resolves.toBeUndefined();
    });

    it('should build an authorize url for a sign-in request carrying a challenge', async () => {
      const url = await service.signInUrlForRequest({ query: { challenge: await generatePkceCodeChallenge(generatePkceCodeVerifier()) }, ip: '127.0.0.1' } as never);

      expect(url).toBeDefined();
      expect(new URL(url as string).searchParams.get('scope')).toBe('identify email');
    });

    describe('a NEW discord account', () => {
      it('should create a firebase user, write the connection pair, and return a ticket', async () => {
        setDiscordUser(discordUser({ email: 'brand-new@example.com', verified: true }));

        const { success, redirectUrl, uid } = await signIn();

        expect(success).toBe(true);
        expect(uid).toBeDefined();

        const url = new URL(redirectUrl);
        expect(url.pathname).toBe(DEMO_EXTERNAL_CONNECTION_SIGN_IN_RETURN_PATH);
        expect(url.searchParams.get('ticket')).toBeTruthy();

        const userRecord = await f.authService.auth.getUser(uid as string);
        expect(userRecord.email).toBe('brand-new@example.com');

        const { entry, credentials } = await f.userExternalConnectionAccessor
          .accessorForUser({ uid: uid as string })(DISCORD)
          .readUserExternalConnectionForProvider();

        expect(entry?.st).toBe('connected');
        // the snowflake is the identity, and the derived `ec` key is what the NEXT sign-in looks up
        expect(entry?.ea).toBe(TEST_DISCORD_ID);
        expect(credentials?.accessToken).toBe('discord-access-token');
      });

      it('should redeem the ticket for a custom token, only with the matching verifier', async () => {
        setDiscordUser(discordUser({ email: 'ticket-holder@example.com', verified: true }));

        const { redirectUrl, verifier } = await signIn();
        const ticket = new URL(redirectUrl).searchParams.get('ticket') as string;

        await expect(service.exchangeSignInTicket({ ticket, verifier: generatePkceCodeVerifier() })).resolves.toBeUndefined();
        await expect(service.exchangeSignInTicket({ ticket, verifier }).then((x) => Boolean(x?.customToken))).resolves.toBe(true);
      });

      it('should have NO profile yet, since the admin sdk create skips the blocking function', async () => {
        // `initUserOnCreate` is a `beforeUserCreated` blocking function and the sign-in service
        // provisions through `auth.createUser()`. Asserted rather than assumed — the demo's
        // onboarding gate is what eventually creates the profile.
        setDiscordUser(discordUser({ email: 'no-profile-yet@example.com', verified: true }));

        const { uid } = await signIn();
        const profile = await f.demoFirestoreCollections.profileCollection
          .documentAccessor()
          .loadDocumentForId(uid as string)
          .snapshotData();

        expect(profile).not.toBeTruthy();
      });
    });

    describe('a RETURNING discord account', () => {
      it('should resolve to the same uid and create no second user', async () => {
        setDiscordUser(discordUser({ email: 'returning@example.com', verified: true }));

        const first = await signIn();
        const second = await signIn();

        expect(first.success).toBe(true);
        expect(second.success).toBe(true);
        expect(second.uid).toBe(first.uid);
        expect(provisionedUids).toHaveLength(1);
      });

      it('should honor an allowlisted return path', async () => {
        setDiscordUser(discordUser({ email: 'return-path@example.com', verified: true }));

        const { redirectUrl } = await signIn(DEMO_EXTERNAL_CONNECTION_SIGN_IN_RETURN_PATH);

        expect(new URL(redirectUrl).pathname).toBe(DEMO_EXTERNAL_CONNECTION_SIGN_IN_RETURN_PATH);
      });
    });

    describe('an UNVERIFIED discord email', () => {
      it('should be DENIED, creating nothing', async () => {
        // provisioning off an unverified third-party email is the takeover vector the delegate's
        // default requirement exists to close
        setDiscordUser(discordUser({ email: 'unverified@example.com', verified: false }));

        const { success, redirectUrl, uid } = await signIn();

        expect(success).toBe(false);
        expect(uid).toBeUndefined();

        const url = new URL(redirectUrl);
        expect(url.pathname).toBe('/demo/auth/login');
        expect(url.searchParams.get(USER_EXTERNAL_CONNECTION_SIGN_IN_ERROR_PARAM)).toBe(USER_EXTERNAL_CONNECTION_SIGN_IN_DENIED_ERROR_CODE);
      });

      it('should be DENIED when discord reports no email at all', async () => {
        setDiscordUser(discordUser());

        const { success, uid } = await signIn();

        expect(success).toBe(false);
        expect(uid).toBeUndefined();
      });
    });

    // addContactInfo: true so the user actually HOLDS an email for Discord's to collide with
    demoAuthorizedUserContext({ f, addContactInfo: true }, (u) => {
      describe('a discord email that already belongs to a firebase user', () => {
        it('should REJECT the sign-in, adopting nothing and writing nothing', async () => {
          // the account-safety rule. The remedy is to recover that email, sign in with it, and then
          // connect Discord from settings — which is the connect flow.
          const existing = await u.loadUserRecord();

          // the whole point of the case — a test user with no email would silently pass by denying
          expect(existing.email).toBeTruthy();
          setDiscordUser(discordUser({ email: existing.email, verified: true }));

          const { success, redirectUrl, uid } = await signIn();

          expect(success).toBe(false);
          // NOT adopted: the pre-existing user holds no Discord connection
          expect(uid).toBeUndefined();

          const { entry } = await f.userExternalConnectionAccessor.accessorForUser({ uid: u.uid })(DISCORD).readUserExternalConnectionForProvider();
          expect(entry).not.toBeTruthy();

          // and the refusal reaches the LOGIN page, where a signed-out user can read it
          const url = new URL(redirectUrl);
          expect(url.pathname).toBe('/demo/auth/login');
          expect(url.searchParams.get('signin')).toBe('failed');
          expect(url.searchParams.get(USER_EXTERNAL_CONNECTION_SIGN_IN_ERROR_PARAM)).toBe(USER_EXTERNAL_CONNECTION_SIGN_IN_EMAIL_CONFLICT_ERROR_CODE);
        });
      });
    });
  });
});

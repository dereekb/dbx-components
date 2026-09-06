import { type DiscordAccessToken, type DiscordOAuthCurrentUser } from '@dereekb/discord';
import { DiscordOAuthApi } from '@dereekb/discord/nestjs';
import {
  DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as DISCORD,
  type FirebaseAuthUserId,
  USER_EXTERNAL_CONNECTION_SIGN_IN_DENIED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_SIGN_IN_EMAIL_CONFLICT_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_UNLINK_LAST_LOGIN_METHOD_ERROR_CODE,
  type UserExternalConnection,
  userExternalConnectionsWithExternalAccountQuery
} from '@dereekb/firebase';
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
 *
 * It also pins the login-link / data-connection split: a sign-in writes the LOGIN LINK only (the demo
 * leaves `signInConnects` off), a `link` handoff writes it for an already-signed-in user, and an
 * unlink removes the link, the entry, and the credentials together — refusing when that would leave the
 * account with no way back in.
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
     * Reads a user's whole connection document, so a test can assert on BOTH maps at once.
     *
     * @param uid - The user whose document to read.
     * @returns The document, when the user has one.
     */
    async function loadConnection(uid: FirebaseAuthUserId): Promise<Maybe<UserExternalConnection>> {
      return f.demoFirestoreCollections.userExternalConnectionCollection.documentAccessor().loadDocumentForId(uid).snapshotData();
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

    it('should request the email scope for IDENTITY only, and the data scopes for a connect', () => {
      // the payoff of the split: a data connect no longer demands the user's email, and a sign-in no
      // longer demands the data scopes. Without `email` on the identity side no email is reported at
      // all, which silently skips the collision check below
      expect([...service.config.signInScopes]).toEqual(['identify', 'email']);
      expect([...service.config.scopes]).toEqual(['identify']);
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
      it('should create a firebase user, write the LOGIN LINK, and return a ticket', async () => {
        setDiscordUser(discordUser({ email: 'brand-new@example.com', verified: true }));

        const { success, redirectUrl, uid } = await signIn();

        expect(success).toBe(true);
        expect(uid).toBeDefined();

        const url = new URL(redirectUrl);
        expect(url.pathname).toBe(DEMO_EXTERNAL_CONNECTION_SIGN_IN_RETURN_PATH);
        expect(url.searchParams.get('ticket')).toBeTruthy();

        const userRecord = await f.authService.auth.getUser(uid as string);
        expect(userRecord.email).toBe('brand-new@example.com');

        const connection = await loadConnection(uid as string);

        // the snowflake is the identity, and the derived `ec` key is what the NEXT sign-in looks up
        expect(connection?.li?.[DISCORD]?.ea).toBe(TEST_DISCORD_ID);
        expect(connection?.li?.[DISCORD]?.em).toBe('brand-new@example.com');
        expect(connection?.ec).toContain(`${DISCORD}:${TEST_DISCORD_ID}`);
      });

      it('should NOT establish the data connection, since the demo leaves signInConnects off', async () => {
        // the sign-in grant carries the IDENTITY scopes. Storing it as the data connection would
        // replace whatever broad grant a connect had obtained, on every login
        setDiscordUser(discordUser({ email: 'link-only@example.com', verified: true }));

        const { uid } = await signIn();
        const { entry, credentials } = await f.userExternalConnectionAccessor
          .accessorForUser({ uid: uid as string })(DISCORD)
          .readUserExternalConnectionForProvider();

        expect(entry).not.toBeTruthy();
        expect(credentials).not.toBeTruthy();
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

    describe('the LINK direction', () => {
      /**
       * Mints the `link` state the app's own `read:authorizeState` callable would for a signed-in user.
       *
       * @param uid - The user linking Discord.
       * @returns The state.
       */
      function linkState(uid: FirebaseAuthUserId) {
        return stateCoder.mintState({ mode: 'link', uid, providerType: DISCORD, codeVerifier: 'discord-code-verifier' });
      }

      // a user who signed in with email/password, i.e. one that HAS a native provider to fall back on
      demoAuthorizedUserContext({ f, addContactInfo: true }, (u) => {
        // the auth user is torn down per test but its connection document is not, and discord is
        // `unique` — a left-behind claim on the test snowflake would block the next test's link
        afterEach(async () => {
          await f.userExternalConnectionServerActions.deleteAllUserExternalConnectionsForUser({ uid: u.uid });
        });

        it('should request the SIGN-IN scopes on the authorize url', async () => {
          const url = service.authorizeUrlForRequest({ query: { state: linkState(u.uid) } } as never);

          expect(url).toBeDefined();
          expect(new URL(url as string).searchParams.get('scope')).toBe('identify email');
        });

        it('should write ONLY the login link, leaving the entry and the credentials untouched', async () => {
          setDiscordUser(discordUser({ email: 'linker@example.com', verified: true }));

          const result = await service.handleCallback({ code: 'a-code', state: linkState(u.uid) });

          expect(result.success).toBe(true);
          // back to the settings page the link was started from, not the sign-in landing page
          expect(new URL(result.redirectUrl).pathname).toBe('/demo/app/settings');

          const connection = await loadConnection(u.uid);
          expect(connection?.li?.[DISCORD]?.ea).toBe(TEST_DISCORD_ID);
          expect(connection?.ec).toContain(`${DISCORD}:${TEST_DISCORD_ID}`);

          const { entry, credentials } = await f.userExternalConnectionAccessor.accessorForUser({ uid: u.uid })(DISCORD).readUserExternalConnectionForProvider();
          expect(entry).not.toBeTruthy();
          expect(credentials).not.toBeTruthy();
        });

        it('should unlink the link, the entry, and the credentials together', async () => {
          setDiscordUser(discordUser({ email: 'unlinker@example.com', verified: true }));

          await service.handleCallback({ code: 'a-code', state: linkState(u.uid) });
          // and a data connection alongside it, so the unlink has all three to remove
          await f.userExternalConnectionServerActions.connectUserExternalConnection({ uid: u.uid, providerType: DISCORD, credentials: { accessToken: 'discord-access-token', issuedAt: new Date().toISOString(), externalAccountId: TEST_DISCORD_ID } });

          await f.userExternalConnectionServerActions.unlinkUserExternalConnectionLogin({ uid: u.uid, providerType: DISCORD });

          const connection = await loadConnection(u.uid);
          expect(connection?.li?.[DISCORD]).toBeUndefined();
          expect(connection?.e?.[DISCORD]).toBeUndefined();
          expect(connection?.ec).toEqual([]);

          const { credentials } = await f.userExternalConnectionAccessor.accessorForUser({ uid: u.uid })(DISCORD).readUserExternalConnectionForProvider();
          expect(credentials).not.toBeTruthy();
        });

        it('should KEEP the login link when only the data connection is disconnected', async () => {
          // the correctness bug the split closes: a disconnect used to destroy the sign-in binding, and
          // the next sign-in minted a second Firebase user for the same person
          setDiscordUser(discordUser({ email: 'disconnector@example.com', verified: true }));

          await service.handleCallback({ code: 'a-code', state: linkState(u.uid) });
          await f.userExternalConnectionServerActions.connectUserExternalConnection({ uid: u.uid, providerType: DISCORD, credentials: { accessToken: 'discord-access-token', issuedAt: new Date().toISOString(), externalAccountId: TEST_DISCORD_ID } });
          await f.userExternalConnectionServerActions.disconnectUserExternalConnection({ uid: u.uid, providerType: DISCORD });

          const connection = await loadConnection(u.uid);
          expect(connection?.e?.[DISCORD]).toBeUndefined();
          expect(connection?.li?.[DISCORD]?.ea).toBe(TEST_DISCORD_ID);
          // still resolvable, so a returning sign-in lands on the SAME uid
          expect(await uidHoldingDiscordAccount()).toBe(u.uid);
        });
      });

      it('should give a sign-in-created user a PASSWORD provider, so unlinking is not a lockout', async () => {
        // the assumption the guard rests on: an email/password credential shows up in the admin sdk's
        // providerData, which is what `providerData.length > 0` is actually asking about
        setDiscordUser(discordUser({ email: 'has-password@example.com', verified: true }));

        const { uid } = await signIn();
        const record = await f.authService.auth.getUser(uid as string);

        expect(record.providerData.map((x) => x.providerId)).toContain('password');
      });

      it('should ALLOW unlinking the only link once the account carries a password credential', async () => {
        setDiscordUser(discordUser({ email: 'can-unlink@example.com', verified: true }));

        const { uid } = await signIn();
        await f.userExternalConnectionServerActions.unlinkUserExternalConnectionLogin({ uid: uid as string, providerType: DISCORD });

        const connection = await loadConnection(uid as string);
        expect(connection?.li?.[DISCORD]).toBeUndefined();
        expect(connection?.ec).toEqual([]);

        // and the user can still get back in: "forgot password" against their own verified email
        const record = await f.authService.auth.getUser(uid as string);
        expect(record.email).toBe('can-unlink@example.com');
        expect(record.providerData.map((x) => x.providerId)).toContain('password');
      });

      it('should still REFUSE when the account has no native provider to fall back on', async () => {
        // the backstop for a user created before the password credential existed, or by an app that
        // turned the option off — a custom-token-only account has an EMPTY providerData and no way back
        // in. Built directly rather than through signIn(), which now always provisions a password
        const emaillessUid = (await f.authService.auth.createUser({})).uid;
        // a DIFFERENT snowflake: discord is `unique`, and the test account may be held by a sibling test
        const otherDiscordId = '80351110224678913';

        try {
          await f.userExternalConnectionServerActions.linkUserExternalConnectionLogin({ uid: emaillessUid, providerType: DISCORD, identity: { externalAccountId: otherDiscordId } });

          const record = await f.authService.auth.getUser(emaillessUid);
          // the precondition the guard keys on — asserted, so a firebase change here fails loudly
          expect(record.providerData).toHaveLength(0);

          const error = (await f.userExternalConnectionServerActions.unlinkUserExternalConnectionLogin({ uid: emaillessUid, providerType: DISCORD }).catch((e: unknown) => e)) as { readonly details: { readonly code: string } };

          expect(error?.details?.code).toBe(USER_EXTERNAL_CONNECTION_UNLINK_LAST_LOGIN_METHOD_ERROR_CODE);

          const connection = await loadConnection(emaillessUid);
          expect(connection?.li?.[DISCORD]?.ea).toBe(otherDiscordId);
        } finally {
          await f.userExternalConnectionServerActions.deleteAllUserExternalConnectionsForUser({ uid: emaillessUid });
          await f.authService.auth.deleteUser(emaillessUid).catch(() => undefined);
        }
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

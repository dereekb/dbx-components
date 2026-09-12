import type { Argv, CommandModule } from 'yargs';
import { MS_IN_SECOND, type Maybe, noop, type OidcSessionInfo, generateOAuthState, generatePkceMaterial } from '@dereekb/util';
import { durationDataToMilliseconds, parseDurationString } from '@dereekb/date';
import { loadCliConfig, maskEnv, maskSecret, mergeCliConfig } from '../config/cli.config';
import { type CliEnvConfig, type CliEnvDefault, type OidcCliTokenEndpointAuthMethod, DEFAULT_CLI_REDIRECT_URI, filterReadOnlyModelScopes, findCliEnvDefault, mergeCliEnvWithDefault, withServiceTokenScopes } from '../config/env';
import { resolveCliEnvOrThrow } from '../config/env.resolve';
import { buildCliPaths } from '../config/paths';
import { createCliFirestoreSessionCacheStore } from '../config/firestore-session.cache';
import { type CliTokenEntry, createCliTokenCacheStore, isTokenExpired } from '../config/token.cache';
import { discoverOidcMetadata, exchangeAuthorizationCode, fetchSessionInfo, fetchUserInfo, refreshAccessToken, revokeToken } from './oidc.client';
import { buildAuthorizationUrl, parsePastedRedirect } from './oidc.flow';
import { type LoopbackRedirectCapture, SUGGESTED_CLI_LOOPBACK_REDIRECT_PORT, parseLoopbackRedirectUri, startLoopbackRedirectCapture } from './oidc.loopback';
import { CliError, outputResult } from '../util/output';
import { wrapCommandHandler } from '../util/handler';
import { openUrlInBrowser } from '../util/browser';
import { promptLine } from '../util/interactive';
import { withEnv } from '../util/args';

/**
 * Default time `auth login` waits for the browser redirect to reach the loopback listener before
 * falling back to the paste prompt.
 *
 * Long enough to cover a first-time sign-in (account picker, password manager, MFA, consent screen),
 * since the fallback costs the user the whole flow again.
 */
const DEFAULT_AUTH_LOGIN_LISTEN_FOR = '5m';

export interface CreateAuthCommandInput {
  readonly cliName: string;
  /**
   * The env var name used to resolve the active env when no flag is provided.
   *
   * Conventionally `<CLINAME>_ENV` (e.g. `DEMO_CLI_ENV`).
   */
  readonly envVarName?: string;
  /**
   * Built-in env presets. Merged underneath the user's stored env when the env name matches.
   */
  readonly defaultEnvs?: readonly CliEnvDefault[];
}

interface ResolveAuthSetupPromptInput {
  readonly argvValue: string | undefined;
  readonly existingValue: string | undefined;
  readonly prompt: string;
  readonly mask?: boolean;
}

async function resolveAuthSetupPrompt(input: ResolveAuthSetupPromptInput): Promise<string | undefined> {
  const { argvValue, existingValue, prompt, mask } = input;
  let result: string | undefined;

  if (argvValue) {
    result = argvValue;
  } else if (argvValue === '') {
    // An EXPLICIT empty flag clears the stored value. Distinguished from an absent flag — which is
    // `undefined` and falls through to the existing value — because the two mean opposite things:
    // `--client-secret ''` is how a confidential client is converted to a public one, and treating
    // it as "not supplied" silently keeps the old secret, which the provider then rejects.
    result = undefined;
  } else if (existingValue) {
    result = existingValue;
  } else {
    const answer = (await promptLine({ question: prompt, mask })).trim();
    result = answer.length > 0 ? answer : existingValue;
  }

  return result;
}

/**
 * Builds the `GET /oidc/session` endpoint URL from the env's OIDC issuer (`<oidcIssuer>/session`).
 *
 * @param oidcIssuer - The env's OIDC issuer URL.
 * @returns The session endpoint URL.
 */
function buildSessionEndpoint(oidcIssuer: string): string {
  return `${oidcIssuer.replace(/\/+$/, '')}/session`;
}

/**
 * Best-effort fetch of the session lifetime metadata for an access token. Returns `undefined` when
 * the route is unavailable or errors, so callers can treat the session info as supplemental.
 *
 * @param input - The lookup inputs.
 * @param input.oidcIssuer - The env's OIDC issuer URL (used to derive the session endpoint).
 * @param input.accessToken - The Bearer access token.
 * @returns The {@link OidcSessionInfo}, or `undefined` on any failure.
 */
async function loadSessionInfoSafely(input: { readonly oidcIssuer: string; readonly accessToken: string }): Promise<OidcSessionInfo | undefined> {
  let result: OidcSessionInfo | undefined;

  try {
    result = await fetchSessionInfo({ sessionEndpoint: buildSessionEndpoint(input.oidcIssuer), accessToken: input.accessToken });
  } catch {
    // Supplemental — older servers without the /oidc/session route, or transient errors, are non-fatal.
    result = undefined;
  }

  return result;
}

/**
 * Best-effort fetch of the userinfo claims for an access token. Returns `undefined` when the token
 * is rejected or the endpoint errors, so a diagnostic command can still report everything it knows
 * locally instead of failing outright.
 *
 * @param input - The lookup inputs.
 * @param input.userinfoEndpoint - The discovered OIDC `userinfo` endpoint.
 * @param input.accessToken - The Bearer access token.
 * @returns The parsed claims, or `undefined` on any failure.
 */
async function loadUserInfoSafely(input: { readonly userinfoEndpoint: string; readonly accessToken: string }): Promise<Record<string, unknown> | undefined> {
  let result: Record<string, unknown> | undefined;

  try {
    result = await fetchUserInfo({ userinfoEndpoint: input.userinfoEndpoint, accessToken: input.accessToken });
  } catch {
    // Supplemental — a rejected access token must not mask the locally-known session state.
    result = undefined;
  }

  return result;
}

/**
 * Renders a human-readable session-lifetime summary, e.g. `valid until 2027-06-01T00:00:00.000Z (~365 days), rotation: disabled`.
 *
 * @param input - The session lifetime fields.
 * @param input.sessionExpiresAt - Grant expiry as unix epoch seconds.
 * @param input.rotationDisabled - Whether refresh-token rotation is disabled.
 * @param input.nowMs - Current time in unix epoch milliseconds. Defaults to `Date.now()`.
 * @returns The summary line, or `undefined` when no `sessionExpiresAt` is available.
 */
function describeSessionLifetime(input: { readonly sessionExpiresAt?: number; readonly rotationDisabled?: boolean; readonly nowMs?: number }): string | undefined {
  let result: string | undefined;

  if (input.sessionExpiresAt != null) {
    const expiresMs = input.sessionExpiresAt * MS_IN_SECOND;
    const days = Math.max(0, Math.round((expiresMs - (input.nowMs ?? Date.now())) / MS_IN_SECOND / 86400));
    const rotation = input.rotationDisabled ? 'disabled' : 'enabled';
    result = `valid until ${new Date(expiresMs).toISOString()} (~${days} days), rotation: ${rotation}`;
  }

  return result;
}

/**
 * Factory for the built-in `auth` command tree.
 *
 * Wires `setup`, `login`, `logout`, `status`, `show`, and `check` subcommands that drive the OIDC
 * PKCE flow against the active env, persist tokens via the per-CLI token cache, and print a
 * structured envelope.
 *
 * @param input - Factory configuration.
 * @param input.cliName - The CLI's binary name. Used for the per-user config dir, env-var prefix, and error messages.
 * @param input.envVarName - Override for the env-name env var. Defaults to `<CLINAME>_ENV` (e.g. `DEMO_CLI_ENV`).
 * @param input.defaultEnvs - Built-in env presets merged underneath the user's stored env when names match.
 * @returns A yargs `CommandModule` exposing the full `auth` subcommand surface.
 * @__NO_SIDE_EFFECTS__
 */
export function createAuthCommand(input: CreateAuthCommandInput): CommandModule {
  const cliName = input.cliName;
  const envVarName = input.envVarName;
  const paths = buildCliPaths({ cliName });
  const tokens = createCliTokenCacheStore({ tokenCachePath: paths.tokenCachePath });
  const firestoreSessions = createCliFirestoreSessionCacheStore({ firestoreSessionCachePath: paths.firestoreSessionCachePath });
  const defaultEnvs = input.defaultEnvs;

  // MARK: setup
  const setupCommand: CommandModule = {
    command: 'setup',
    describe: 'Persist OIDC client + API config for an env (interactive when flags are omitted)',
    builder: (yargs: Argv) =>
      withEnv(yargs)
        .option('api-base-url', { type: 'string', describe: 'API base URL (e.g. http://localhost:9902/.../api)' })
        .option('oidc-issuer', { type: 'string', describe: 'OIDC issuer URL (e.g. <api-base-url>/oidc)' })
        .option('app-client-url', { type: 'string', describe: 'Frontend client base URL to rebase the auth URL onto (e.g. http://localhost:9010)' })
        .option('client-id', { type: 'string', describe: 'OAuth client ID registered with the target app' })
        .option('client-secret', { type: 'string', describe: "OAuth client secret; omit for a public (PKCE) client, or pass '' to clear a stored one" })
        .option('token-endpoint-auth-method', { type: 'string', choices: ['none', 'client_secret_post', 'client_secret_basic'], describe: "The OAuth client's registered token_endpoint_auth_method; 'none' marks a public (PKCE) client and skips the client-secret prompt" })
        .option('redirect-uri', { type: 'string', describe: 'OAuth redirect URI registered with the OAuth client' })
        .option('scopes', { type: 'string', describe: 'Space-separated OAuth scopes (default: openid profile email)' })
        .option('set-active', { type: 'boolean', default: false, describe: 'Also set the env as the active env after saving' }),
    handler: wrapCommandHandler(async (argv: any) => {
      // `setup` is special: the env may not exist yet, so the throwing helper would refuse.
      // Resolve only the name (flag → env var → activeEnv) and bail with a tailored message
      // when none can be found.
      const config = (await loadCliConfig({ configFilePath: paths.configFilePath })) ?? {};
      const envName = (argv.env as string | undefined) ?? process.env[envVarName ?? `${cliName.replaceAll('-', '_').toUpperCase()}_ENV`] ?? config.activeEnv;

      if (!envName) {
        throw new CliError({ message: 'Provide --env <name> on first setup.', code: 'NO_ACTIVE_ENV' });
      }

      const stored = config.envs?.[envName];
      const defaultEnv = findCliEnvDefault({ name: envName, defaults: defaultEnvs })?.env;
      const existing = mergeCliEnvWithDefault({ env: stored, defaultEnv });

      const apiBaseUrl = await resolveAuthSetupPrompt({ argvValue: argv.apiBaseUrl as string | undefined, existingValue: existing?.apiBaseUrl, prompt: `API base URL [${existing?.apiBaseUrl ?? ''}]: ` });
      const oidcIssuer = await resolveAuthSetupPrompt({ argvValue: argv.oidcIssuer as string | undefined, existingValue: existing?.oidcIssuer, prompt: `OIDC issuer [${existing?.oidcIssuer ?? ''}]: ` });
      const appClientUrl = (argv.appClientUrl as string | undefined) ?? existing?.appClientUrl;
      const clientId = await resolveAuthSetupPrompt({ argvValue: argv.clientId as string | undefined, existingValue: existing?.clientId, prompt: 'Client ID: ' });
      const tokenEndpointAuthMethod = ((argv.tokenEndpointAuthMethod as OidcCliTokenEndpointAuthMethod | undefined) ?? existing?.tokenEndpointAuthMethod) as OidcCliTokenEndpointAuthMethod | undefined;
      // A public client has no secret to ask for, so a KNOWN `none` skips the prompt entirely rather
      // than asking and accepting an empty answer. Any other value — including an unknown one — keeps
      // the prompt, since "no secret configured yet" and "never has a secret" are indistinguishable
      // without this field.
      const publicClient = tokenEndpointAuthMethod === 'none';
      const clientSecret = publicClient ? undefined : await resolveAuthSetupPrompt({ argvValue: argv.clientSecret as string | undefined, existingValue: existing?.clientSecret, prompt: 'Client secret: ', mask: true });
      const redirectUri = (await resolveAuthSetupPrompt({ argvValue: argv.redirectUri as string | undefined, existingValue: existing?.redirectUri, prompt: `Redirect URI [${existing?.redirectUri ?? DEFAULT_CLI_REDIRECT_URI}]: ` })) ?? DEFAULT_CLI_REDIRECT_URI;
      const scopes = (argv.scopes as string | undefined) ?? existing?.scopes;

      // `clientSecret` is deliberately NOT required: a CLI is a public client in the usual case
      // (`token_endpoint_auth_method: 'none'`), authenticating with PKCE instead of a secret. The
      // protocol layer already omits an absent secret from the token request, so requiring one here
      // was the only thing making a public client unconfigurable.
      if (!apiBaseUrl || !oidcIssuer || !clientId) {
        throw new CliError({ message: 'apiBaseUrl, oidcIssuer, and clientId are all required.', code: 'AUTH_SETUP_INCOMPLETE' });
      }

      const nextEnv: CliEnvConfig = { apiBaseUrl, oidcIssuer, clientId, redirectUri, ...(clientSecret ? { clientSecret } : {}), ...(tokenEndpointAuthMethod ? { tokenEndpointAuthMethod } : {}), ...(appClientUrl ? { appClientUrl } : {}), ...(scopes ? { scopes } : {}) };

      const merged = await mergeCliConfig({
        configFilePath: paths.configFilePath,
        configDir: paths.configDir,
        updates: {
          envs: { [envName]: nextEnv },
          ...(argv.setActive ? { activeEnv: envName } : {})
        }
      });

      outputResult({
        saved: true,
        env: envName,
        activeEnv: merged.activeEnv,
        config: maskEnv(nextEnv)
      });
    })
  };

  // MARK: login
  const loginCommand: CommandModule = {
    command: 'login',
    describe: 'Run OIDC PKCE flow and persist tokens for the active env',
    builder: (yargs: Argv) =>
      withEnv(yargs)
        .option('open', { type: 'boolean', default: true, describe: 'Open the authorization URL in the default browser. Use --no-open to print it only.' })
        .option('listen', { type: 'boolean', default: true, describe: 'Bind the loopback redirect URI and read the authorization code straight out of the browser redirect. Use --no-listen to always paste it back by hand.' })
        .option('listen-for', { type: 'string', default: DEFAULT_AUTH_LOGIN_LISTEN_FOR, describe: `How long to wait for the browser redirect before falling back to the paste prompt (e.g. 5m, 90s). Defaults to ${DEFAULT_AUTH_LOGIN_LISTEN_FOR}.` })
        .option('redirect-port', { type: 'number', describe: 'Bind the loopback listener on this port instead of the one in the configured redirect URI. The resulting redirect URI must also be registered with the OAuth client.' })
        .option('code', { type: 'string', describe: 'Skip the prompt and pass the redirect URL or bare code directly' })
        .option('read-only-scopes', { type: 'boolean', default: false, describe: 'Drop model.create/model.update/model.delete from the requested scopes (keeps model.read and model.query)' })
        .option('service-token', { type: 'boolean', default: false, alias: 'long-lived', describe: 'Request a long-lived, non-rotating admin service token (adds token.service + offline_access). Combine with --login-for.' })
        .option('login-for', { type: 'string', describe: 'Requested login duration with a unit (e.g. 30d, 12h, 3600s). Mixed units are allowed (e.g. "1h30m", "2d 12h"). Subject to server/client caps. Applied to Session, Grant, and RefreshToken.' }),
    handler: wrapCommandHandler(async (argv: any) => {
      const { envName, env } = await resolveCliEnvOrThrow({ cliName, paths, flagEnv: argv.env, envVarName, defaultEnvs, requireComplete: true });

      const meta = await discoverOidcMetadata({ issuer: env.oidcIssuer, fallbackBaseUrl: env.apiBaseUrl });
      const { codeVerifier, codeChallenge } = await generatePkceMaterial();
      const state = generateOAuthState();
      let requestedScopes = argv.readOnlyScopes ? filterReadOnlyModelScopes(env.scopes) : env.scopes;

      if (argv.serviceToken) {
        // Adds token.service + offline_access (de-duped); applied after the read-only filter so a
        // service token can still be read-only. The provider hard-rejects a non-admin and clamps
        // the duration to the service-token tier (up to 1 year).
        requestedScopes = withServiceTokenScopes(requestedScopes);
      }

      let requestedSessionTtlSeconds: number | undefined;

      if (argv.loginFor) {
        const ms = durationDataToMilliseconds(parseDurationString(argv.loginFor as string));

        if (ms <= 0) {
          throw new CliError({
            message: `--login-for: invalid duration "${argv.loginFor}". Use formats like "30d", "12h", "3600s", or mixed units like "1h30m" or "2d 12h".`,
            code: 'AUTH_LOGIN_FOR_INVALID'
          });
        }

        requestedSessionTtlSeconds = Math.floor(ms / MS_IN_SECOND);
      }

      const listenForMs = durationDataToMilliseconds(parseDurationString((argv.listenFor as string | undefined) ?? DEFAULT_AUTH_LOGIN_LISTEN_FOR));

      if (listenForMs <= 0) {
        throw new CliError({
          message: `--listen-for: invalid duration "${argv.listenFor}". Use formats like "5m", "90s", or mixed units like "1h30m".`,
          code: 'AUTH_LISTEN_FOR_INVALID'
        });
      }

      // The loopback listener is started BEFORE the authorization URL is built: the port it binds is
      // part of the `redirect_uri` the provider echoes back, so it has to be settled first.
      const suppliedCode = argv.code as string | undefined;
      const shouldListen = suppliedCode == null && argv.listen !== false;
      const loopbackTarget = shouldListen ? parseLoopbackRedirectUri({ redirectUri: env.redirectUri, port: argv.redirectPort as number | undefined }) : undefined;
      let capture: Maybe<LoopbackRedirectCapture>;

      if (loopbackTarget) {
        try {
          capture = await startLoopbackRedirectCapture({ target: loopbackTarget });
        } catch (e) {
          // A port that is already in use is not worth failing the whole login over — the paste
          // flow is still there, and it is what the CLI did unconditionally before.
          process.stderr.write(`${(e as Error).message} Falling back to pasting the redirect URL.\n`);
        }
      } else if (shouldListen) {
        const suggestedRedirectUri = `http://127.0.0.1:${SUGGESTED_CLI_LOOPBACK_REDIRECT_PORT}/callback`;
        process.stderr.write(`Redirect capture is unavailable: "${env.redirectUri}" has no loopback port to bind.\n  To capture the redirect automatically, register ${suggestedRedirectUri} with the OAuth client, then run:\n    ${cliName} auth setup --env ${envName} --redirect-uri ${suggestedRedirectUri}\n`);
      }

      // Identical to the configured redirect URI unless `--redirect-port` moved it, and it is what
      // the token exchange must echo back — a mismatch there is rejected as `invalid_grant`.
      const redirectUri = capture?.redirectUri ?? env.redirectUri;

      const url = buildAuthorizationUrl({
        authorizationEndpoint: meta.authorization_endpoint,
        oidcIssuer: env.oidcIssuer,
        apiBaseUrl: env.apiBaseUrl,
        appClientUrl: env.appClientUrl,
        clientId: env.clientId,
        redirectUri,
        scopes: requestedScopes,
        state,
        codeChallenge,
        requestedSessionTtlSeconds
      });

      // Printed even when the browser opens: it is the fallback whenever the launch fails, and the
      // record of what was opened. Emitted on stderr so JSON stdout stays parseable.
      process.stderr.write(`Authorization URL:\n  ${url}\n`);

      if (suppliedCode == null && argv.open !== false && !(await openUrlInBrowser({ url }))) {
        process.stderr.write('Could not open a browser automatically — open the URL above by hand.\n');
      }

      let pasted: string;

      try {
        if (suppliedCode != null) {
          pasted = suppliedCode;
        } else if (capture) {
          // The hint goes to stderr and the prompt itself is rendered empty, so the readline prompt
          // never lands on stdout alongside the JSON envelope.
          process.stderr.write(`Waiting for the redirect to ${capture.redirectUri} ... (or paste the redirect URL here)\n`);

          // Both sources run at once. The listener is the happy path, and the prompt is the way out
          // when the browser cannot reach this process's loopback interface at all (an SSH session,
          // a container) — without it that case would just sit here until the listener timed out.
          const controller = new AbortController();
          const prompt = promptLine({ question: '', signal: controller.signal });
          const redirected = capture.waitForRedirect(listenForMs);

          // Whichever source loses is abandoned mid-flight; its rejection is expected, not unhandled.
          prompt.catch(noop);
          redirected.catch(noop);

          try {
            pasted = await Promise.race([redirected, prompt]);
          } catch (e) {
            // Only the listener's timeout reaches here — the prompt is still open, so keep waiting on it.
            process.stderr.write(`${(e as Error).message}\n`);
            pasted = await prompt;
          } finally {
            // Released only once a winner is settled. Aborting from inside the redirect's own `then`
            // instead would reject the prompt a microtask BEFORE the redirect resolved, and the race
            // would hand back that rejection rather than the code it just captured.
            controller.abort();
          }
        } else {
          pasted = await promptLine({ question: 'Paste redirect URL or code: ' });
        }
      } finally {
        // Unconditional: a listener left bound keeps the process alive well past the command.
        await capture?.close();
      }

      const { code } = parsePastedRedirect({ pasted, expectedState: state });

      const tokenResponse = await exchangeAuthorizationCode({
        tokenEndpoint: meta.token_endpoint,
        clientId: env.clientId,
        clientSecret: env.clientSecret,
        redirectUri,
        code,
        codeVerifier
      });

      const expiresAt = Date.now() + (tokenResponse.expires_in ?? 0) * 1000;

      // Surface the resolved session lifetime + rotation status (e.g. for a --service-token login).
      const sessionInfo = await loadSessionInfoSafely({ oidcIssuer: env.oidcIssuer, accessToken: tokenResponse.access_token });
      const sessionExpiresAt = sessionInfo?.expiresAt ?? undefined;
      const rotationDisabled = sessionInfo?.rotationDisabled;

      const entry: CliTokenEntry = {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        idToken: tokenResponse.id_token,
        tokenType: tokenResponse.token_type,
        scope: tokenResponse.scope,
        expiresAt,
        ...(sessionExpiresAt == null ? {} : { sessionExpiresAt }),
        ...(rotationDisabled == null ? {} : { rotationDisabled })
      };

      await tokens.set(envName, entry);

      const sessionSummary = describeSessionLifetime({ sessionExpiresAt, rotationDisabled });

      if (sessionSummary) {
        // Emit through stderr so JSON stdout stays parseable.
        process.stderr.write(`Session: ${sessionSummary}\n`);
      }

      outputResult({
        loggedIn: true,
        env: envName,
        accessToken: maskSecret(entry.accessToken),
        refreshToken: entry.refreshToken ? maskSecret(entry.refreshToken) : undefined,
        tokenType: entry.tokenType,
        scope: entry.scope,
        expiresAt,
        sessionExpiresAt,
        rotationDisabled
      });
    })
  };

  // MARK: logout
  const logoutCommand: CommandModule = {
    command: 'logout',
    describe: 'Clear cached tokens and the cached direct-Firestore session for the active env, optionally revoking on the server',
    builder: (yargs: Argv) => withEnv(yargs).option('revoke', { type: 'boolean', default: false, describe: 'Call the OIDC revocation endpoint before clearing local tokens' }),
    handler: wrapCommandHandler(async (argv: any) => {
      const { envName, env } = await resolveCliEnvOrThrow({ cliName, paths, flagEnv: argv.env, envVarName, defaultEnvs });
      const entry = await tokens.get(envName);

      // No `clientSecret` in the guard: a public client has none, and gating on it would silently
      // skip the server-side revoke for exactly the clients that most need it.
      if (argv.revoke && entry?.refreshToken && env.clientId) {
        try {
          const meta = await discoverOidcMetadata({ issuer: env.oidcIssuer, fallbackBaseUrl: env.apiBaseUrl });

          if (meta.revocation_endpoint) {
            await revokeToken({
              revocationEndpoint: meta.revocation_endpoint,
              clientId: env.clientId,
              clientSecret: env.clientSecret,
              token: entry.refreshToken,
              tokenTypeHint: 'refresh_token'
            });
          }
        } catch {
          // Best-effort revocation; clear local cache regardless.
        }
      }

      await tokens.remove(envName);
      // the cached direct-Firestore session is a bearer credential minted for the user who just
      // logged out, so it goes with the tokens
      await firestoreSessions.remove(envName);
      outputResult({ loggedOut: true, env: envName });
    })
  };

  // MARK: status
  const statusCommand: CommandModule = {
    command: 'status',
    describe: 'Show whoami via /userinfo plus active env and token expiry',
    builder: (yargs: Argv) => withEnv(yargs),
    handler: wrapCommandHandler(async (argv: any) => {
      const { envName, env } = await resolveCliEnvOrThrow({ cliName, paths, flagEnv: argv.env, envVarName, defaultEnvs });
      const entry = await tokens.get(envName);

      if (entry) {
        const expired = isTokenExpired(entry);
        const sessionInfo = await loadSessionInfoSafely({ oidcIssuer: env.oidcIssuer, accessToken: entry.accessToken });
        const sessionExpiresAt = sessionInfo?.expiresAt ?? entry.sessionExpiresAt;
        const rotationDisabled = sessionInfo?.rotationDisabled ?? entry.rotationDisabled;
        const session = describeSessionLifetime({ sessionExpiresAt: sessionExpiresAt ?? undefined, rotationDisabled });
        const meta = await discoverOidcMetadata({ issuer: env.oidcIssuer, fallbackBaseUrl: env.apiBaseUrl });
        const userinfoEndpoint = meta.userinfo_endpoint;
        // An expired access token is certain to be rejected by userinfo, so calling it only trades the
        // locally-known state (which is the useful answer) for a predictable 401. Access tokens are
        // short-lived by design and every non-`auth` command refreshes them transparently via
        // `createAuthMiddleware` — an expired one means "needs a refresh", NOT "logged out". The
        // session lifetime reported below is what says whether re-authentication is actually required.
        const claims = userinfoEndpoint != null && !expired ? await loadUserInfoSafely({ userinfoEndpoint, accessToken: entry.accessToken }) : undefined;

        outputResult({
          env: envName,
          authenticated: !expired,
          expiresAt: entry.expiresAt,
          expired,
          scope: entry.scope,
          sessionExpiresAt,
          rotationDisabled,
          session,
          sub: claims?.['sub'],
          claims,
          suggestion: expired ? `Access token expired — it refreshes automatically on the next non-auth command. Run \`${cliName} auth login --env ${envName}\` only if the session itself has ended.` : undefined
        });
      } else {
        outputResult({ env: envName, authenticated: false, suggestion: `Run: ${cliName} auth login --env ${envName}` });
      }
    })
  };

  // MARK: show
  const showCommand: CommandModule = {
    command: 'show',
    describe: 'Print env config and cached token metadata (secrets masked)',
    builder: (yargs: Argv) => withEnv(yargs),
    handler: wrapCommandHandler(async (argv: any) => {
      const { envName, env } = await resolveCliEnvOrThrow({ cliName, paths, flagEnv: argv.env, envVarName, defaultEnvs });
      const entry = await tokens.get(envName);

      outputResult({
        env: envName,
        config: maskEnv(env),
        token: entry
          ? {
              accessToken: maskSecret(entry.accessToken),
              refreshToken: entry.refreshToken ? maskSecret(entry.refreshToken) : undefined,
              tokenType: entry.tokenType,
              scope: entry.scope,
              expiresAt: entry.expiresAt,
              expired: isTokenExpired(entry),
              sessionExpiresAt: entry.sessionExpiresAt,
              rotationDisabled: entry.rotationDisabled,
              session: describeSessionLifetime({ sessionExpiresAt: entry.sessionExpiresAt, rotationDisabled: entry.rotationDisabled })
            }
          : null
      });
    })
  };

  // MARK: check
  const checkCommand: CommandModule = {
    command: 'check',
    describe: 'Verify the cached refresh token is still valid by performing a refresh round-trip',
    builder: (yargs: Argv) => withEnv(yargs),
    handler: wrapCommandHandler(async (argv: any) => {
      const { envName, env } = await resolveCliEnvOrThrow({ cliName, paths, flagEnv: argv.env, envVarName, defaultEnvs, requireComplete: true });
      const entry = await tokens.get(envName);

      if (!entry?.refreshToken) {
        throw new CliError({
          message: `No refresh token for env "${envName}". Run \`${cliName} auth login --env ${envName}\`.`,
          code: 'NO_REFRESH_TOKEN'
        });
      }

      const meta = await discoverOidcMetadata({ issuer: env.oidcIssuer, fallbackBaseUrl: env.apiBaseUrl });
      const refreshed = await refreshAccessToken({
        tokenEndpoint: meta.token_endpoint,
        clientId: env.clientId,
        clientSecret: env.clientSecret,
        refreshToken: entry.refreshToken
      });

      const expiresAt = Date.now() + (refreshed.expires_in ?? 0) * 1000;
      await tokens.set(envName, {
        ...entry,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? entry.refreshToken,
        tokenType: refreshed.token_type ?? entry.tokenType,
        scope: refreshed.scope ?? entry.scope,
        expiresAt
      });

      outputResult({ env: envName, refreshed: true, expiresAt });
    })
  };

  return {
    command: 'auth',
    describe: 'Manage OIDC authentication for the active env',
    builder: (yargs: Argv) => yargs.command(setupCommand).command(loginCommand).command(logoutCommand).command(statusCommand).command(showCommand).command(checkCommand).demandCommand(1, 'Specify an auth subcommand.'),
    handler: noop
  };
}

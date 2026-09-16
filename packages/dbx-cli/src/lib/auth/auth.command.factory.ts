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
import { claimCliHandoff } from './cli-handoff.client';
import { buildAuthorizationUrl, parsePastedRedirect } from './oidc.flow';
import { type LoopbackRedirectCapture, SUGGESTED_CLI_LOOPBACK_REDIRECT_PORT, parseLoopbackRedirectUri, startLoopbackRedirectCapture } from './oidc.loopback';
import { CliError, outputResult } from '../util/output';
import { wrapCommandHandler } from '../util/handler';
import { openUrlInBrowser } from '../util/browser';
import { promptLine } from '../util/interactive';
import { isStdinPositionalSentinel, readAllStdin } from '../util/stdin';
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
 * Renders a human-readable session-lifetime summary, e.g. `valid until 2027-06-01T00:00:00.000Z (~365 days), rotation: enabled`.
 *
 * The unit scales with what is left. A `--service-token` session is measured in months and a handoff
 * credential (`auth handoff`) in minutes — reporting the latter as "~0 days" hid exactly the fact
 * the caller most needs to see.
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
    const remaining = describeRemainingDuration(expiresMs - (input.nowMs ?? Date.now()));
    const rotation = input.rotationDisabled ? 'disabled' : 'enabled';
    result = `valid until ${new Date(expiresMs).toISOString()} (${remaining}), rotation: ${rotation}`;
  }

  return result;
}

/**
 * Renders a remaining-duration phrase at the coarsest unit that still reads as a number: days, then
 * hours, then minutes, with `expired` for anything already past.
 *
 * @param remainingMs - Milliseconds remaining (may be negative).
 * @returns The phrase, e.g. `~365 days`, `~2 hours`, `~48 min`, or `expired`.
 * @__NO_SIDE_EFFECTS__
 */
function describeRemainingDuration(remainingMs: number): string {
  const seconds = Math.floor(remainingMs / MS_IN_SECOND);
  let result: string;

  if (seconds <= 0) {
    result = 'expired';
  } else if (seconds >= 86400) {
    result = `~${Math.round(seconds / 86400)} days`;
  } else if (seconds >= 3600) {
    result = `~${Math.round(seconds / 3600)} hours`;
  } else {
    result = `~${Math.max(1, Math.round(seconds / 60))} min`;
  }

  return result;
}

/**
 * Env name a handoff falls back to when nothing else names one — no `--env`, no `envName` from the
 * minting deployment, no active env, and no single built-in default to borrow a name from.
 *
 * Only reachable on an unconfigured machine redeeming against a server that declares no
 * `CliTokenApiModuleConfig.envName`. A neutral name is better than refusing: the credential is
 * already spent by this point, so failing here would burn a one-time code.
 */
export const DEFAULT_HANDOFF_ENV_NAME = 'default';

/**
 * Whether two OIDC issuer URLs name the same provider, ignoring the differences that carry no
 * meaning — a trailing slash, case in the scheme/host, and a default port for the scheme.
 *
 * Used to decide whether redeeming a claim would REPOINT an existing env at a different deployment.
 * Anything unparseable falls back to a trimmed string compare rather than reporting a match, so a
 * malformed value fails closed into the guard.
 *
 * @param a - The env's currently configured issuer.
 * @param b - The issuer the claimed bundle came from.
 * @returns True when both resolve to the same origin and path.
 */
export function cliIssuersMatch(a: string, b: string): boolean {
  let result: boolean;

  try {
    const urlA = new URL(a);
    const urlB = new URL(b);
    const normalize = (url: URL) => `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`.toLowerCase();

    result = normalize(urlA) === normalize(urlB);
  } catch {
    result = a.trim().replace(/\/+$/, '') === b.trim().replace(/\/+$/, '');
  }

  return result;
}

interface ResolveHandoffCodeInput {
  readonly argvCode: unknown;
  readonly envVarName: string;
}

/**
 * Resolves the handoff claim code from the positional, stdin (`-`), or the env var — in that order.
 *
 * The env-var and stdin paths exist so a live credential pointer never has to appear in argv, which
 * is world-readable in the process list on a shared machine.
 *
 * @param input - The parsed positional and the env var name to fall back to.
 * @returns The trimmed claim code.
 * @throws {CliError} `AUTH_HANDOFF_NO_CODE` when no code was supplied by any route.
 */
async function resolveHandoffCode(input: ResolveHandoffCodeInput): Promise<string> {
  const argvCode = input.argvCode;
  let result: string;

  if (isStdinPositionalSentinel(argvCode)) {
    result = (await readAllStdin()).trim();
  } else if (typeof argvCode === 'string' && argvCode.length > 0) {
    result = argvCode.trim();
  } else {
    result = (process.env[input.envVarName] ?? '').trim();
  }

  if (result.length === 0) {
    throw new CliError({
      message: `No claim code supplied. Pass it as an argument, pipe it in with '-', or set ${input.envVarName}.`,
      code: 'AUTH_HANDOFF_NO_CODE'
    });
  }

  return result;
}

/**
 * Factory for the built-in `auth` command tree.
 *
 * Wires `setup`, `login`, `handoff`, `logout`, `status`, `show`, and `check` subcommands that drive
 * the OIDC PKCE flow against the active env, persist tokens via the per-CLI token cache, and print a
 * structured envelope.
 *
 * `handoff` is the non-interactive counterpart to `login`: it redeems a one-time claim code minted by
 * an already-authenticated MCP session, so an agent can bring a CLI up on a bare machine with no
 * browser and no prior `auth setup`.
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
  const envVarPrefix = cliName.replaceAll('-', '_').toUpperCase();
  const defaultEnvVarName = `${envVarPrefix}_ENV`;
  /**
   * Env var a handoff claim code may be passed through, so a code never has to appear in argv (and
   * therefore in the process list) on a shared machine.
   */
  const handoffEnvVarName = `${envVarPrefix}_CLI_HANDOFF`;
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
      const envName = (argv.env as string | undefined) ?? process.env[envVarName ?? defaultEnvVarName] ?? config.activeEnv;

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

  // MARK: handoff
  const handoffCommand: CommandModule = {
    command: 'handoff [code]',
    describe: 'Redeem a one-time CLI handoff claim code (from an MCP session) and log in without a browser',
    builder: (yargs: Argv) =>
      withEnv(yargs)
        .positional('code', { type: 'string', describe: `The claim code. Pass '-' to read it from stdin, or set ${handoffEnvVarName}.` })
        .option('oidc-issuer', { type: 'string', describe: "OIDC issuer to redeem against. Defaults to the env's configured (or built-in default) issuer — required only when neither exists." })
        .option('set-active', { type: 'boolean', default: true, describe: 'Set the env as the active env after redeeming. Pass --no-set-active to provision it without switching.' })
        .option('force', { type: 'boolean', default: false, describe: 'Allow the redeem to repoint an existing env at a different OIDC issuer' }),
    handler: wrapCommandHandler(async (argv: any) => {
      // `handoff` is the bootstrap path: the env may not exist yet (that is the whole point), so the
      // throwing resolver — which demands a complete env — cannot be used. Resolve only the NAME the
      // way `setup` does, then merge whatever is already known underneath it.
      const config = (await loadCliConfig({ configFilePath: paths.configFilePath })) ?? {};

      // The env NAME is resolved in TWO phases, because the authoritative name arrives WITH the
      // credential. Only an explicit `--env` (or the env var) can be known before the claim; the
      // minting deployment's own `envName` comes back in the bundle. A bare machine — the case this
      // command exists for — has no active env to fall back on, so demanding the name up front is
      // what used to make the rendered one-line handoff command fail with NO_ACTIVE_ENV.
      const requestedEnvName = (argv.env as string | undefined) ?? process.env[envVarName ?? defaultEnvVarName];

      // The ISSUER, by contrast, is needed before the claim — it is where the code is redeemed. Look
      // it up under whichever name we already have, falling back to the sole built-in default when
      // the CLI ships exactly one (an unambiguous target on an unconfigured machine).
      const issuerLookupEnvName = requestedEnvName ?? config.activeEnv;
      const issuerLookupEnv = issuerLookupEnvName ? mergeCliEnvWithDefault({ env: config.envs?.[issuerLookupEnvName], defaultEnv: findCliEnvDefault({ name: issuerLookupEnvName, defaults: defaultEnvs })?.env }) : undefined;
      const soleDefaultEnv = defaultEnvs?.length === 1 ? defaultEnvs[0] : undefined;
      const oidcIssuer = (argv.oidcIssuer as string | undefined) ?? issuerLookupEnv?.oidcIssuer ?? soleDefaultEnv?.env?.oidcIssuer;

      if (!oidcIssuer) {
        throw new CliError({
          message: `No OIDC issuer known${issuerLookupEnvName ? ` for env "${issuerLookupEnvName}"` : ''}. Pass --oidc-issuer <url> (or --env <name> for a configured env).`,
          code: 'AUTH_HANDOFF_NO_ISSUER'
        });
      }

      const code = await resolveHandoffCode({ argvCode: argv.code, envVarName: handoffEnvVarName });
      const bundle = await claimCliHandoff({ oidcIssuer, code });

      // Phase two. An explicit name always wins; otherwise the minting deployment names itself, and
      // only then do we fall back to local state.
      const envName = requestedEnvName ?? bundle.envName ?? config.activeEnv ?? soleDefaultEnv?.names[0] ?? DEFAULT_HANDOFF_ENV_NAME;
      const existing = mergeCliEnvWithDefault({ env: config.envs?.[envName], defaultEnv: findCliEnvDefault({ name: envName, defaults: defaultEnvs })?.env });

      // A bundle rewrites the env's issuer/apiBaseUrl/clientId wholesale, so redeeming a code from
      // deployment B into an env named for deployment A would leave the NAME pointing somewhere else
      // entirely — a far quieter failure than a bad credential. Refuse unless asked explicitly.
      if (existing?.oidcIssuer && bundle.issuer && !cliIssuersMatch(existing.oidcIssuer, bundle.issuer) && !argv.force) {
        throw new CliError({
          message: `Env "${envName}" points at ${existing.oidcIssuer}, but this claim was minted by ${bundle.issuer}.`,
          code: 'AUTH_HANDOFF_ISSUER_MISMATCH',
          suggestion: `Redeem into its own env with --env <name>, or pass --force to repoint "${envName}".`
        });
      }

      // The bundle carries everything a machine with no prior `auth setup` needs, so the env is
      // created/updated from it rather than requiring a separate setup pass.
      const nextEnv: CliEnvConfig = {
        apiBaseUrl: bundle.apiBaseUrl ?? existing?.apiBaseUrl ?? '',
        oidcIssuer: bundle.issuer || oidcIssuer,
        clientId: bundle.clientId,
        redirectUri: existing?.redirectUri ?? DEFAULT_CLI_REDIRECT_URI,
        scopes: bundle.scope,
        ...(existing?.appClientUrl ? { appClientUrl: existing.appClientUrl } : {}),
        ...(existing?.tokenEndpointAuthMethod ? { tokenEndpointAuthMethod: existing.tokenEndpointAuthMethod } : {}),
        ...(existing?.firebase ? { firebase: existing.firebase } : {})
      };

      if (!nextEnv.apiBaseUrl) {
        throw new CliError({
          message: `The handoff bundle carried no apiBaseUrl and env "${envName}" has none configured.`,
          code: 'AUTH_HANDOFF_NO_API_BASE_URL',
          suggestion: `Run: ${cliName} auth setup --env ${envName} --api-base-url <url>`
        });
      }

      const merged = await mergeCliConfig({
        configFilePath: paths.configFilePath,
        configDir: paths.configDir,
        updates: {
          envs: { [envName]: nextEnv },
          ...(argv.setActive ? { activeEnv: envName } : {})
        }
      });

      const sessionExpiresAt = Math.floor(new Date(bundle.expiresAt).getTime() / MS_IN_SECOND);
      const entry: CliTokenEntry = {
        // No access token is handed over — only the refresh token. `expiresAt: 0` marks it expired so
        // the FIRST non-auth command refreshes, which is also the `readEnvTokenEntry` convention.
        accessToken: '',
        refreshToken: bundle.refreshToken,
        scope: bundle.scope,
        expiresAt: 0,
        sessionExpiresAt
      };

      // PERSISTED, deliberately not `fromEnv`: the CLI client is a public PKCE client, so the server
      // rotates the refresh token on every exchange and a rotation that is not written back would
      // trip oidc-provider's reuse detection and kill the whole grant.
      await tokens.set(envName, entry);

      const remainingMinutes = Math.max(0, Math.round((sessionExpiresAt * MS_IN_SECOND - Date.now()) / MS_IN_SECOND / 60));
      process.stderr.write(`Handoff credential accepted for ${bundle.uid}. SHORT-LIVED: expires ${bundle.expiresAt} (~${remainingMinutes} min). Run \`${cliName} auth login\` for a durable session.\n`);

      outputResult({
        handoff: true,
        env: envName,
        activeEnv: merged.activeEnv,
        uid: bundle.uid,
        clientId: bundle.clientId,
        scope: bundle.scope,
        refreshToken: maskSecret(bundle.refreshToken),
        expiresAt: bundle.expiresAt,
        sessionExpiresAt,
        config: maskEnv(nextEnv)
      });
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
    builder: (yargs: Argv) => yargs.command(setupCommand).command(loginCommand).command(handoffCommand).command(logoutCommand).command(statusCommand).command(showCommand).command(checkCommand).demandCommand(1, 'Specify an auth subcommand.'),
    handler: noop
  };
}

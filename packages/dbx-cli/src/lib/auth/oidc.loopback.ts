import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { type Maybe, type PortNumber, type WebsiteUrl, noop } from '@dereekb/util';
import { CliError } from '../util/output';

/**
 * Hostnames RFC 8252 §7.3 treats as the loopback interface, and the exact set `oidc-provider`
 * recognizes as a loopback redirect host.
 *
 * `[::1]` carries its brackets because that is what `URL.hostname` returns for an IPv6 literal —
 * the brackets are stripped again before the address is handed to `server.listen`.
 */
export const LOOPBACK_REDIRECT_HOSTNAMES: readonly string[] = ['127.0.0.1', 'localhost', '[::1]'];

/**
 * The loopback port the CLI suggests when the configured redirect URI has no bindable port.
 *
 * Deliberately outside the 9900-9910 block the Firebase emulators occupy, so a suggested redirect
 * URI never collides with a running emulator.
 */
export const SUGGESTED_CLI_LOOPBACK_REDIRECT_PORT: PortNumber = 8976;

/**
 * Error code raised when the loopback listener cannot bind the redirect URI's port (e.g. the port
 * is already in use, or is privileged).
 */
export const LOOPBACK_REDIRECT_LISTEN_FAILED_ERROR_CODE = 'AUTH_REDIRECT_LISTEN_FAILED';

/**
 * Error code raised when no redirect reached the loopback listener within the allotted time.
 */
export const LOOPBACK_REDIRECT_TIMEOUT_ERROR_CODE = 'AUTH_REDIRECT_TIMEOUT';

/**
 * A redirect URI the CLI can bind a local HTTP listener to, decomposed into its parts.
 */
export interface LoopbackRedirectTarget {
  /**
   * The normalized redirect URI to send as `redirect_uri`. Identical to the configured URI unless a
   * port override was applied.
   */
  readonly redirectUri: WebsiteUrl;
  /**
   * The loopback hostname, as `URL.hostname` reports it (so `[::1]` keeps its brackets).
   */
  readonly hostname: string;
  /**
   * The port to bind. Always a positive integer — a `0`/absent port is not a capturable target.
   */
  readonly port: PortNumber;
  /**
   * The path the provider redirects to. Requests to any other path are answered `404` so a stray
   * `/favicon.ico` cannot be mistaken for the authorization redirect.
   */
  readonly pathname: string;
}

export interface ParseLoopbackRedirectUriInput {
  /**
   * The configured redirect URI.
   */
  readonly redirectUri: Maybe<string>;
  /**
   * Optional port override, replacing whatever port the redirect URI carries.
   *
   * The resulting URI is what gets sent as `redirect_uri`, so it must be registered with the OAuth
   * client just like the configured one.
   */
  readonly port?: Maybe<PortNumber>;
}

/**
 * Decomposes a redirect URI into a {@link LoopbackRedirectTarget} when the CLI can bind a local
 * listener for it.
 *
 * A target is only produced for an `http:` loopback URI carrying a concrete, non-zero port. The
 * conventional `http://127.0.0.1:0/callback` placeholder is deliberately NOT capturable: binding an
 * ephemeral port would mean sending a `redirect_uri` that differs from the registered one, which
 * every OAuth provider rejects unless the client is registered as a native app (where loopback
 * ports are compared port-insensitively).
 *
 * @param input - The parse inputs.
 * @param input.redirectUri - The configured redirect URI.
 * @param input.port - Optional port override applied to the parsed URI.
 * @returns The bindable target, or `undefined` when the URI cannot be captured locally.
 * @__NO_SIDE_EFFECTS__
 */
export function parseLoopbackRedirectUri(input: ParseLoopbackRedirectUriInput): Maybe<LoopbackRedirectTarget> {
  let result: Maybe<LoopbackRedirectTarget>;

  if (input.redirectUri) {
    let parsed: Maybe<URL>;

    try {
      parsed = new URL(input.redirectUri);
    } catch {
      // A non-URL redirect (e.g. the `urn:ietf:wg:oauth:2.0:oob` out-of-band URN) is a valid
      // configuration — it just has nothing to bind.
      parsed = undefined;
    }

    if (parsed?.protocol === 'http:' && LOOPBACK_REDIRECT_HOSTNAMES.includes(parsed.hostname)) {
      const port = input.port ?? Number(parsed.port);

      if (Number.isInteger(port) && port > 0) {
        parsed.port = String(port);
        result = { redirectUri: parsed.toString(), hostname: parsed.hostname, port, pathname: parsed.pathname };
      }
    }
  }

  return result;
}

export interface StartLoopbackRedirectCaptureInput {
  /**
   * The bindable target, from {@link parseLoopbackRedirectUri}.
   */
  readonly target: LoopbackRedirectTarget;
  /**
   * Text shown in the browser tab once the redirect is captured.
   */
  readonly successMessage?: Maybe<string>;
}

export interface LoopbackRedirectCapture {
  /**
   * The `redirect_uri` the listener is bound to. Send this value in the authorization request.
   */
  readonly redirectUri: WebsiteUrl;
  /**
   * The bound port.
   */
  readonly port: PortNumber;
  /**
   * Resolves with the full redirect URL (query string included) the browser was sent to.
   *
   * A provider error redirect resolves rather than rejects — the returned URL carries the `error`
   * params, which the shared redirect parser already turns into an `AUTH_PROVIDER_ERROR`.
   *
   * @param timeoutMs - Optional milliseconds to wait before rejecting with
   *   {@link LOOPBACK_REDIRECT_TIMEOUT_ERROR_CODE}. Waits indefinitely when omitted.
   */
  readonly waitForRedirect: (timeoutMs?: Maybe<number>) => Promise<WebsiteUrl>;
  /**
   * Closes the listener and destroys any open sockets, so the CLI's event loop can drain.
   */
  readonly close: () => Promise<void>;
}

/**
 * Renders the single page the browser lands on after the provider redirects back.
 *
 * @param input - The page inputs.
 * @param input.title - The heading + document title.
 * @param input.message - The body line under the heading.
 * @returns A self-contained HTML document.
 * @__NO_SIDE_EFFECTS__
 */
function renderLoopbackRedirectPage(input: { readonly title: string; readonly message: string }): string {
  // Both values are CLI-authored or provider-supplied error text, so they are escaped rather than
  // interpolated raw — an `error_description` is attacker-influenceable in the general case.
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const title = escape(input.title);
  const message = escape(input.message);

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#101418;color:#e8eaed}main{text-align:center;padding:2rem}h1{font-size:1.25rem;font-weight:600;margin:0 0 .5rem}p{margin:0;opacity:.75}</style></head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`;
}

/**
 * Binds a local HTTP listener to a loopback redirect URI so the authorization code can be read
 * straight out of the browser redirect instead of being pasted back by hand.
 *
 * The listener answers exactly one path — the redirect URI's own — and serves a short "you can close
 * this tab" page. Everything else is answered `404`, which is what keeps the browser's automatic
 * `/favicon.ico` request from being mistaken for the redirect.
 *
 * @param input - The capture inputs.
 * @param input.target - The bindable target, from {@link parseLoopbackRedirectUri}.
 * @param input.successMessage - Optional override for the browser success page's body line.
 * @returns The started {@link LoopbackRedirectCapture}.
 * @throws {CliError} `AUTH_REDIRECT_LISTEN_FAILED` when the port cannot be bound.
 */
export async function startLoopbackRedirectCapture(input: StartLoopbackRedirectCaptureInput): Promise<LoopbackRedirectCapture> {
  const { target } = input;
  const sockets = new Set<Socket>();

  let resolveRedirect: (url: WebsiteUrl) => void = noop;
  const redirect = new Promise<WebsiteUrl>((resolve) => {
    resolveRedirect = resolve;
  });

  const handleRequest = (req: IncomingMessage, res: ServerResponse) => {
    let requestUrl: Maybe<URL>;

    try {
      requestUrl = new URL(req.url ?? '/', target.redirectUri);
    } catch {
      requestUrl = undefined;
    }

    if (requestUrl?.pathname === target.pathname) {
      const error = requestUrl.searchParams.get('error');
      const page = error ? renderLoopbackRedirectPage({ title: 'Sign-in failed', message: requestUrl.searchParams.get('error_description') ?? error }) : renderLoopbackRedirectPage({ title: 'Signed in', message: input.successMessage ?? 'You can close this tab and return to your terminal.' });

      res.writeHead(error ? 400 : 200, { 'content-type': 'text/html; charset=utf-8', connection: 'close' });
      res.end(page);
      resolveRedirect(requestUrl.toString());
    } else {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', connection: 'close' });
      res.end('Not found.');
    }
  };

  // `localhost` is bound on BOTH loopback families rather than on whatever the resolver happens to
  // return first. Node binds a single address, and browsers pick their own — a listener that landed
  // only on `::1` refuses the connection whenever the browser reaches for `127.0.0.1`.
  // An explicit literal is bound as written; `URL.hostname` brackets an IPv6 literal, and
  // `server.listen` wants the bare address.
  const hostnames = target.hostname === 'localhost' ? ['::1', '127.0.0.1'] : [target.hostname.replaceAll(/^\[|\]$/g, '')];

  const bindings = await Promise.all(
    hostnames.map(
      (hostname) =>
        new Promise<Server | CliError>((resolveBinding) => {
          const server = createServer(handleRequest);

          const onListenError = (e: Error) => {
            resolveBinding(
              new CliError({
                message: `Could not bind the loopback redirect listener on ${hostname}:${target.port} (${e.message}).`,
                code: LOOPBACK_REDIRECT_LISTEN_FAILED_ERROR_CODE
              })
            );
          };

          server.once('error', onListenError);
          server.on('connection', (socket) => {
            sockets.add(socket);
            socket.once('close', () => sockets.delete(socket));
          });

          server.listen(target.port, hostname, () => {
            server.removeListener('error', onListenError);
            // Past bind, a socket-level error (a browser hanging up mid-response) must not take the
            // CLI down — the flow either already has its code or falls through to the paste prompt.
            server.on('error', noop);
            resolveBinding(server);
          });
        })
    )
  );

  const servers = bindings.filter((x): x is Server => !(x instanceof CliError));

  if (servers.length === 0) {
    // Both families failing is one failure to report; the first is the representative one.
    throw bindings[0];
  }

  const close = () =>
    new Promise<void>((resolveClose) => {
      sockets.forEach((socket) => socket.destroy());
      sockets.clear();
      void Promise.all(servers.map((server) => new Promise<void>((resolveServer) => server.close(() => resolveServer())))).then(() => resolveClose());
    });

  return {
    redirectUri: target.redirectUri,
    port: target.port,
    waitForRedirect: (timeoutMs) => {
      let result: Promise<WebsiteUrl>;

      if (timeoutMs != null && timeoutMs > 0) {
        result = new Promise<WebsiteUrl>((resolveWait, rejectWait) => {
          const timer = setTimeout(() => {
            rejectWait(
              new CliError({
                message: `Timed out after ${timeoutMs}ms waiting for the browser redirect to ${target.redirectUri}.`,
                code: LOOPBACK_REDIRECT_TIMEOUT_ERROR_CODE
              })
            );
          }, timeoutMs);

          // A caller that races this against another source (the paste prompt) abandons the loser
          // mid-flight — a still-ref'd timer would then hold the CLI open for the rest of the
          // timeout after the command was otherwise done.
          timer.unref?.();

          redirect.then((url) => {
            clearTimeout(timer);
            resolveWait(url);
          }, rejectWait);
        });
      } else {
        result = redirect;
      }

      return result;
    },
    close
  };
}

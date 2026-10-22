/**
 * Live spike for Trello's OAuth 2.0 (3LO) against Atlassian's real authorization server.
 *
 * `@dereekb/trello`'s OAuth client and `@dereekb/firebase-server/trello` were built from Trello's
 * documentation alone. Every value the documentation left unverified is one constant, and this script
 * checks each of them with a real confidential client before anything downstream connects Trello:
 *
 *   S1  `state` round-trip — was `state` echoed unchanged on the callback, and which query keys came back.
 *   S2  Token path — exchange at `/oauth/token`, falling back to `/authorize/oauth/token` on a 404/405.
 *       Records which path worked and the token response's KEY SET (is there a `refresh_expires_in`?).
 *   S5  Bearer host — `GET /1/members/me` with `Authorization: Bearer` on BOTH `api.trello.com` and
 *       `trello.com`: the status, and whether `email` came back.
 *   S7  Rate limits — every `x-rate-limit-*` header on those Bearer responses (per key or per client?).
 *   S4  Refresh rotation and reuse — was the refresh token rotated; what happens when the OLD one is
 *       re-presented immediately (inside Atlassian's 10-minute reuse leeway) and, with
 *       `--reuse-after-leeway`, again after 11 minutes; and does the NEWEST one still work afterwards
 *       (was the whole family revoked?).
 *   S12 Concurrent grants — run the consent a second time and test whether the FIRST grant's refresh
 *       token still works.
 *   S9  (optional, `--check-revoke`) Does `DELETE /1/tokens/{token}` accept an OAuth 2.0 access token?
 *
 * Stop rules (from the implementation plan's Phase 0) — escalate instead of building around:
 *   - S1: `state` is not echoed unchanged.
 *   - S5: Bearer is rejected on both hosts.
 *   - S8: the code exchange fails for a confidential client even with `client_secret` + `code_verifier`.
 *
 * Setup: create a CONFIDENTIAL OAuth 2.0 client at https://trello.com/apps/admin ("OAuth 2.0" tab) and
 * register the redirect URI this script prints (`http://localhost:<port>/callback`).
 *
 * Usage:
 *   TRELLO_OAUTH_CLIENT_ID=… TRELLO_OAUTH_CLIENT_SECRET=… node tools/scripts/trello-oauth2-spike.mjs [--port 8976] [--reuse-after-leeway] [--skip-second-consent] [--check-revoke]
 *
 * It NEVER prints or records a token or the client secret: only statuses, key sets, header names and
 * booleans. The findings are written to `trello-oauth2-spike.<date>.json` in the current directory.
 */

import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const AUTHORIZE_URL = 'https://auth.atlassian.com/authorize';
const TOKEN_URLS = ['https://auth.atlassian.com/oauth/token', 'https://auth.atlassian.com/authorize/oauth/token'];
const BEARER_HOSTS = ['https://api.trello.com/1', 'https://trello.com/1'];
const SCOPES = ['read:board:trello', 'write:board:trello', 'read:member:trello', 'offline_access'];
const MEMBER_FIELDS = 'id,username,fullName,email';
const REUSE_LEEWAY_WAIT_MS = 11 * 60 * 1000;

// MARK: Args
function parseArgs(argv) {
  const args = { port: 8976, reuseAfterLeeway: false, secondConsent: true, checkRevoke: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--port') {
      args.port = Number(argv[(i += 1)]);
    } else if (arg === '--reuse-after-leeway') {
      args.reuseAfterLeeway = true;
    } else if (arg === '--skip-second-consent') {
      args.secondConsent = false;
    } else if (arg === '--check-revoke') {
      args.checkRevoke = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(args.port) || args.port <= 0) {
    throw new Error('--port must be a positive integer');
  }

  return args;
}

// MARK: PKCE
function base64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pkcePair() {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

// MARK: HTTP
/**
 * Serves the loopback callback once and resolves with its query parameters.
 *
 * @param port - The port to listen on.
 * @returns The callback's query parameters.
 */
function awaitCallback(port) {
  return new Promise((resolvePromise, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);

      if (url.pathname !== '/callback') {
        res.writeHead(404).end();
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' }).end('<p>Trello OAuth 2.0 spike: callback received. You can close this tab.</p>');
      server.close();
      resolvePromise(Object.fromEntries(url.searchParams.entries()));
    });

    server.on('error', reject);
    server.listen(port, '127.0.0.1');
  });
}

async function postJson(url, body) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await response.json().catch(() => undefined);
  return { status: response.status, json };
}

/**
 * Describes a token response without any of its values: the key set, plus the OAuth error code when
 * there is one.
 *
 * @param result - The status and parsed body.
 * @returns A secret-free description.
 */
function describeTokenResult(result) {
  const { status, json } = result;
  return { status, ok: status >= 200 && status < 300, keys: json ? Object.keys(json).sort() : [], error: json?.error, errorDescription: json?.error_description };
}

function rateLimitHeaders(headers) {
  const result = {};

  headers.forEach((value, name) => {
    if (name.toLowerCase().startsWith('x-rate-limit')) {
      // limits and remaining counts, never credentials
      result[name] = value;
    }
  });

  return result;
}

// MARK: Steps
async function consent(config, label) {
  const { clientId, port } = config;
  const redirectUri = `http://localhost:${port}/callback`;
  const { verifier, challenge } = pkcePair();
  const state = base64Url(randomBytes(24));

  const authorizeUrl = new URL(AUTHORIZE_URL);
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('prompt', 'consent');
  authorizeUrl.searchParams.set('scope', SCOPES.join(' '));
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', challenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  console.log(`\n[${label}] Open this URL, consent, and pick the Trello workspace the loop's board lives in:\n\n${authorizeUrl.toString()}\n`);

  const query = await awaitCallback(port);

  const s1 = {
    stateEchoed: query.state === state,
    stateReturned: query.state != null,
    queryKeys: Object.keys(query).sort(),
    error: query.error,
    errorDescription: query.error_description
  };

  return { query, verifier, redirectUri, s1 };
}

async function exchange(config, consentResult) {
  const { clientId, clientSecret } = config;
  const { query, verifier, redirectUri } = consentResult;
  const attempts = [];
  let tokens;
  let workingTokenUrl;

  for (const tokenUrl of TOKEN_URLS) {
    const result = await postJson(tokenUrl, { grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, code: query.code, redirect_uri: redirectUri, code_verifier: verifier });
    attempts.push({ tokenUrl, ...describeTokenResult(result) });

    if (result.status >= 200 && result.status < 300) {
      tokens = result.json;
      workingTokenUrl = tokenUrl;
      break;
    } else if (result.status !== 404 && result.status !== 405) {
      // a real refusal at the documented path: the alternate path would not change the answer
      break;
    }
  }

  return { tokens, s2: { workingTokenUrl, attempts } };
}

async function bearerChecks(accessToken) {
  const results = [];

  for (const host of BEARER_HOSTS) {
    const response = await fetch(`${host}/members/me?fields=${MEMBER_FIELDS}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const json = await response.json().catch(() => undefined);

    results.push({
      host,
      status: response.status,
      ok: response.ok,
      emailPresent: json?.email != null,
      idPresent: json?.id != null,
      rateLimitHeaders: rateLimitHeaders(response.headers)
    });
  }

  return results;
}

async function refresh(config, tokenUrl, refreshToken) {
  const { clientId, clientSecret } = config;
  const result = await postJson(tokenUrl, { grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken });
  return { result: describeTokenResult(result), tokens: result.status >= 200 && result.status < 300 ? result.json : undefined };
}

async function refreshChecks(config, tokenUrl, initialRefreshToken, args) {
  const s4 = { rotated: undefined, reuseImmediately: undefined, reuseAfterLeeway: undefined, newestAfterReuse: undefined };
  let latestRefreshToken = initialRefreshToken;

  const first = await refresh(config, tokenUrl, initialRefreshToken);
  s4.firstRefresh = first.result;

  if (first.tokens) {
    s4.rotated = first.tokens.refresh_token != null && first.tokens.refresh_token !== initialRefreshToken;
    latestRefreshToken = first.tokens.refresh_token ?? latestRefreshToken;

    const reuse = await refresh(config, tokenUrl, initialRefreshToken);
    s4.reuseImmediately = reuse.result;
    latestRefreshToken = reuse.tokens?.refresh_token ?? latestRefreshToken;

    if (args.reuseAfterLeeway) {
      console.log(`Waiting ${REUSE_LEEWAY_WAIT_MS / 60000} minutes to re-present the spent refresh token outside the reuse leeway…`);
      await new Promise((r) => setTimeout(r, REUSE_LEEWAY_WAIT_MS));

      const late = await refresh(config, tokenUrl, initialRefreshToken);
      s4.reuseAfterLeeway = late.result;
      latestRefreshToken = late.tokens?.refresh_token ?? latestRefreshToken;
    }

    const newest = await refresh(config, tokenUrl, latestRefreshToken);
    s4.newestAfterReuse = newest.result;
    latestRefreshToken = newest.tokens?.refresh_token ?? latestRefreshToken;
  }

  return { s4, latestRefreshToken };
}

async function revokeCheck(accessToken) {
  const response = await fetch(`${BEARER_HOSTS[0]}/tokens/${encodeURIComponent(accessToken)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
  const after = await fetch(`${BEARER_HOSTS[0]}/members/me?fields=id`, { headers: { Authorization: `Bearer ${accessToken}` } });
  return { deleteStatus: response.status, memberReadAfterDeleteStatus: after.status, revoked: after.status === 401 };
}

// MARK: Main
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const clientId = process.env.TRELLO_OAUTH_CLIENT_ID;
  const clientSecret = process.env.TRELLO_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Set TRELLO_OAUTH_CLIENT_ID and TRELLO_OAUTH_CLIENT_SECRET (a CONFIDENTIAL client from https://trello.com/apps/admin).');
    process.exit(1);
  }

  const config = { clientId, clientSecret, port: args.port };
  const findings = { ranAt: new Date().toISOString(), args, scopes: SCOPES };

  console.log(`Register this redirect URI on the client before continuing: http://localhost:${args.port}/callback`);

  // S1 + S2 + S8
  const firstConsent = await consent(config, 'consent 1');
  findings.s1 = firstConsent.s1;

  if (firstConsent.query.code) {
    const { tokens, s2 } = await exchange(config, firstConsent);
    findings.s2 = s2;
    findings.s8 = { exchangeSucceeded: tokens != null };

    if (tokens) {
      // S5 + S7
      findings.s5 = await bearerChecks(tokens.access_token);

      // S4
      if (tokens.refresh_token) {
        const { s4, latestRefreshToken } = await refreshChecks(config, s2.workingTokenUrl, tokens.refresh_token, args);
        findings.s4 = s4;

        // S12
        if (args.secondConsent) {
          const secondConsent = await consent(config, 'consent 2 (concurrent grant check)');
          const second = secondConsent.query.code ? await exchange(config, secondConsent) : undefined;
          const firstGrantAfter = await refresh(config, s2.workingTokenUrl, latestRefreshToken);
          findings.s12 = { secondExchangeSucceeded: second?.tokens != null, firstGrantRefreshAfterSecondConsent: firstGrantAfter.result };
        }
      } else {
        findings.s4 = { skipped: 'no refresh_token was returned (was offline_access granted?)' };
      }

      // S9
      if (args.checkRevoke) {
        findings.s9 = await revokeCheck(tokens.access_token);
      }
    }
  } else {
    findings.s8 = { exchangeSucceeded: false, reason: 'the callback carried no code' };
  }

  // Phase 0 stop rules
  const bearerOk = (findings.s5 ?? []).some((x) => x.ok);
  findings.stopRules = {
    s1StateNotEchoed: findings.s1?.stateEchoed !== true,
    s5BearerRejectedOnBothHosts: findings.s5 != null && !bearerOk,
    s8ExchangeFailed: findings.s8?.exchangeSucceeded !== true
  };
  findings.escalate = Object.values(findings.stopRules).some((x) => x);

  const outputPath = resolve(process.cwd(), `trello-oauth2-spike.${findings.ranAt.slice(0, 10)}.json`);
  writeFileSync(outputPath, `${JSON.stringify(findings, null, 2)}\n`);

  console.log(`\nFindings written to ${outputPath}`);
  console.log(findings.escalate ? 'A STOP RULE TRIPPED — escalate before connecting Trello (see stopRules).' : 'No stop rule tripped.');
}

main().catch((e) => {
  console.error('Spike failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});

import { describe, it, expect } from 'vitest';
import { LOOPBACK_REDIRECT_TIMEOUT_ERROR_CODE, type LoopbackRedirectCapture, parseLoopbackRedirectUri, startLoopbackRedirectCapture } from './oidc.loopback';

describe('parseLoopbackRedirectUri', () => {
  it('should parse an http loopback redirect uri with a concrete port', () => {
    const result = parseLoopbackRedirectUri({ redirectUri: 'http://127.0.0.1:8976/callback' });
    expect(result).toEqual({ redirectUri: 'http://127.0.0.1:8976/callback', hostname: '127.0.0.1', port: 8976, pathname: '/callback' });
  });

  it('should parse a localhost redirect uri', () => {
    expect(parseLoopbackRedirectUri({ redirectUri: 'http://localhost:8976/cb' })?.hostname).toBe('localhost');
  });

  it('should keep the brackets on an ipv6 loopback host', () => {
    expect(parseLoopbackRedirectUri({ redirectUri: 'http://[::1]:8976/callback' })?.hostname).toBe('[::1]');
  });

  it('should not treat the :0 placeholder as capturable', () => {
    // Binding an ephemeral port here would send a redirect_uri that no longer matches the registered one.
    expect(parseLoopbackRedirectUri({ redirectUri: 'http://127.0.0.1:0/callback' })).toBeUndefined();
  });

  it('should not treat a portless loopback uri as capturable', () => {
    expect(parseLoopbackRedirectUri({ redirectUri: 'http://127.0.0.1/callback' })).toBeUndefined();
  });

  it('should not treat a non-loopback host as capturable', () => {
    expect(parseLoopbackRedirectUri({ redirectUri: 'http://example.com:8976/callback' })).toBeUndefined();
  });

  it('should not treat an https loopback uri as capturable', () => {
    expect(parseLoopbackRedirectUri({ redirectUri: 'https://127.0.0.1:8976/callback' })).toBeUndefined();
  });

  it('should not treat the out-of-band urn as capturable', () => {
    expect(parseLoopbackRedirectUri({ redirectUri: 'urn:ietf:wg:oauth:2.0:oob' })).toBeUndefined();
  });

  it('should return undefined for a missing redirect uri', () => {
    expect(parseLoopbackRedirectUri({ redirectUri: undefined })).toBeUndefined();
  });

  it('should apply a port override, including over the :0 placeholder', () => {
    const result = parseLoopbackRedirectUri({ redirectUri: 'http://127.0.0.1:0/callback', port: 8976 });
    expect(result?.redirectUri).toBe('http://127.0.0.1:8976/callback');
    expect(result?.port).toBe(8976);
  });
});

/**
 * Binds a capture on an OS-assigned port, so the suite never fights a port that happens to be busy.
 *
 * `parseLoopbackRedirectUri` deliberately refuses port `0`, so the target is built by binding an
 * ephemeral port through a throwaway target and reading back what the OS handed out — which is
 * exactly what the production path cannot do against a registered redirect URI.
 */
async function startTestCapture(pathname = '/callback'): Promise<LoopbackRedirectCapture> {
  let result: LoopbackRedirectCapture | undefined;
  let lastError: unknown;

  // A retry loop rather than an ephemeral bind: the capture's contract is that it binds the exact
  // port the redirect URI names, so the test picks a port and accepts a collision as a retry.
  for (let attempt = 0; attempt < 20 && result == null; attempt += 1) {
    const port = 30000 + Math.floor(Math.random() * 20000);
    const target = parseLoopbackRedirectUri({ redirectUri: `http://127.0.0.1:${port}${pathname}` });

    try {
      result = await startLoopbackRedirectCapture({ target: target as NonNullable<typeof target> });
    } catch (e) {
      lastError = e;
    }
  }

  if (!result) {
    throw lastError;
  }

  return result;
}

describe('startLoopbackRedirectCapture', () => {
  it('should resolve with the full redirect url when the provider redirects back', async () => {
    const capture = await startTestCapture();

    try {
      const pending = capture.waitForRedirect();
      const response = await fetch(`${capture.redirectUri}?code=the-code&state=the-state`);

      expect(response.status).toBe(200);
      expect(await pending).toBe(`${capture.redirectUri}?code=the-code&state=the-state`);
    } finally {
      await capture.close();
    }
  });

  it('should resolve rather than reject on a provider error redirect, so the shared parser reports it', async () => {
    const capture = await startTestCapture();

    try {
      const pending = capture.waitForRedirect();
      const response = await fetch(`${capture.redirectUri}?error=access_denied&error_description=nope`);

      expect(response.status).toBe(400);
      expect(await pending).toContain('error=access_denied');
    } finally {
      await capture.close();
    }
  });

  it('should ignore requests to other paths so a favicon fetch cannot end the flow', async () => {
    const capture = await startTestCapture();

    try {
      const pending = capture.waitForRedirect();
      const ignored = await fetch(`http://127.0.0.1:${capture.port}/favicon.ico`);
      expect(ignored.status).toBe(404);

      await fetch(`${capture.redirectUri}?code=the-code`);
      expect(await pending).toContain('code=the-code');
    } finally {
      await capture.close();
    }
  });

  it('should reject with AUTH_REDIRECT_TIMEOUT when no redirect arrives in time', async () => {
    const capture = await startTestCapture();

    try {
      await expect(capture.waitForRedirect(25)).rejects.toMatchObject({ code: LOOPBACK_REDIRECT_TIMEOUT_ERROR_CODE });
    } finally {
      await capture.close();
    }
  });

  it('should answer a localhost redirect on both loopback families', async () => {
    // Node binds one address per server and browsers pick their own — a listener that landed only on
    // `::1` refuses every connection the browser opens to `127.0.0.1`.
    let capture: LoopbackRedirectCapture | undefined;
    let lastError: unknown;

    for (let attempt = 0; attempt < 20 && capture == null; attempt += 1) {
      const port = 30000 + Math.floor(Math.random() * 20000);

      try {
        capture = await startLoopbackRedirectCapture({ target: parseLoopbackRedirectUri({ redirectUri: `http://localhost:${port}/callback` }) as never });
      } catch (e) {
        lastError = e;
      }
    }

    if (!capture) {
      throw lastError;
    }

    try {
      expect((await fetch(`http://127.0.0.1:${capture.port}/callback?code=ipv4`)).status).toBe(200);
      expect((await fetch(`http://[::1]:${capture.port}/callback?code=ipv6`)).status).toBe(200);
    } finally {
      await capture.close();
    }
  });

  it('should release the port on close', async () => {
    const capture = await startTestCapture();
    await capture.close();

    const rebound = await startLoopbackRedirectCapture({ target: parseLoopbackRedirectUri({ redirectUri: capture.redirectUri }) as never });
    expect(rebound.port).toBe(capture.port);
    await rebound.close();
  });
});

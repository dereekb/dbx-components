import { describe, it, expect } from 'vitest';
import { oidcCorsOriginDelegate } from './oauth-cors.module';
import { type OidcCorsConfig } from '../oidc.config';

const APP_URL = 'https://app.example.com';

/**
 * Invokes the delegate synchronously and returns the resolved `cors`-package origin value
 * (a string sets that exact `Access-Control-Allow-Origin`; `false` omits the header).
 */
function resolveOrigin(cors: OidcCorsConfig, requestOrigin: string | undefined): string | boolean | undefined {
  let resolved: string | boolean | undefined;

  oidcCorsOriginDelegate(APP_URL, cors)(requestOrigin, (_err, origin) => {
    resolved = origin;
  });

  return resolved;
}

describe('oidcCorsOriginDelegate()', () => {
  describe('legacy-equivalent (no allowOrigins, clientBased off)', () => {
    const cors: OidcCorsConfig = {};

    it('reflects appUrl for the appUrl origin', () => {
      expect(resolveOrigin(cors, APP_URL)).toBe(APP_URL);
    });

    it('falls back to appUrl for a non-allowlisted origin (no reflect-any)', () => {
      expect(resolveOrigin(cors, 'https://evil.example')).toBe(APP_URL);
    });

    it('falls back to appUrl when there is no Origin header', () => {
      expect(resolveOrigin(cors, undefined)).toBe(APP_URL);
    });
  });

  describe('explicit allowlist (clientBased off)', () => {
    const cors: OidcCorsConfig = { allowOrigins: ['http://localhost:3001', 'http://localhost:3000'] };

    it('reflects an allowlisted origin exactly', () => {
      expect(resolveOrigin(cors, 'http://localhost:3001')).toBe('http://localhost:3001');
      expect(resolveOrigin(cors, 'http://localhost:3000')).toBe('http://localhost:3000');
    });

    it('always allows appUrl even when it is not in allowOrigins', () => {
      expect(resolveOrigin(cors, APP_URL)).toBe(APP_URL);
    });

    it('falls back to appUrl for an origin that is not in the list', () => {
      expect(resolveOrigin(cors, 'https://evil.example')).toBe(APP_URL);
    });
  });

  describe('client-based (no explicit list)', () => {
    const cors: OidcCorsConfig = { clientBased: true };

    it('reflects appUrl for the appUrl origin', () => {
      expect(resolveOrigin(cors, APP_URL)).toBe(APP_URL);
    });

    it('omits the header (false) for a non-allowlisted origin so oidc-provider can decide', () => {
      expect(resolveOrigin(cors, 'http://localhost:3001')).toBe(false);
    });

    it('omits the header (false) when there is no Origin header', () => {
      expect(resolveOrigin(cors, undefined)).toBe(false);
    });
  });

  describe('both explicit list and client-based', () => {
    const cors: OidcCorsConfig = { allowOrigins: ['http://localhost:3001'], clientBased: true };

    it('reflects an allowlisted origin exactly (allowlist wins)', () => {
      expect(resolveOrigin(cors, 'http://localhost:3001')).toBe('http://localhost:3001');
    });

    it('defers a non-allowlisted origin to oidc-provider (false)', () => {
      expect(resolveOrigin(cors, 'https://lms.other.example')).toBe(false);
    });

    it('always allows appUrl', () => {
      expect(resolveOrigin(cors, APP_URL)).toBe(APP_URL);
    });
  });
});

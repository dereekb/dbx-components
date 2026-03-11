import { OidcAuthBearerTokenMiddleware } from './oauth-auth.middleware';
import { type OidcAuthenticatedRequest, type OidcAuthData } from '../service/auth';
import { UnauthorizedException } from '@nestjs/common';
import { type OidcService } from '../service/oidc.service';

function createMockOidcService(tokens: Map<string, OidcAuthData>): OidcService {
  return {
    verifyAccessToken: (token: string) => Promise.resolve(tokens.get(token) ?? undefined)
  } as unknown as OidcService;
}

function createMockRequest(authHeader?: string): OidcAuthenticatedRequest {
  return {
    headers: {
      authorization: authHeader
    }
  } as any;
}

describe('OidcAuthBearerTokenMiddleware', () => {
  const validToken = 'valid-token-123';
  const expectedAuthContext: OidcAuthData = {
    uid: 'user-uid-1',
    token: { uid: 'user-uid-1', sub: 'user-uid-1' } as any,
    rawToken: validToken,
    oidcValidatedToken: {
      sub: 'user-uid-1',
      scope: 'openid profile',
      client_id: 'client-1'
    }
  };

  let middleware: OidcAuthBearerTokenMiddleware;

  beforeEach(() => {
    const tokens = new Map<string, OidcAuthData>();
    tokens.set(validToken, expectedAuthContext);
    middleware = new OidcAuthBearerTokenMiddleware(createMockOidcService(tokens));
  });

  it('should attach auth context for valid bearer token', async () => {
    const req = createMockRequest(`Bearer ${validToken}`);
    const next = vi.fn();

    await middleware.use(req, {} as any, next);

    expect(req.auth).toBeDefined();
    expect(req.auth!.uid).toBe('user-uid-1');
    expect(req.auth!.oidcValidatedToken.sub).toBe('user-uid-1');
    expect(req.auth!.oidcValidatedToken.scope).toBe('openid profile');
    expect(req.auth!.oidcValidatedToken.client_id).toBe('client-1');
    expect(next).toHaveBeenCalled();
  });

  it('should throw UnauthorizedException for missing Authorization header', async () => {
    const req = createMockRequest();
    const next = vi.fn();

    await expect(middleware.use(req, {} as any, next)).rejects.toThrow(UnauthorizedException);
    expect(next).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException for non-Bearer auth header', async () => {
    const req = createMockRequest('Basic dXNlcjpwYXNz');
    const next = vi.fn();

    await expect(middleware.use(req, {} as any, next)).rejects.toThrow(UnauthorizedException);
    expect(next).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException for invalid/expired token', async () => {
    const req = createMockRequest('Bearer invalid-token');
    const next = vi.fn();

    await expect(middleware.use(req, {} as any, next)).rejects.toThrow(UnauthorizedException);
    expect(next).not.toHaveBeenCalled();
  });
});

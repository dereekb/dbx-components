import { OAuthBearerTokenMiddleware, type OAuthAuthenticatedRequest } from './oauth-auth.middleware';
import { UnauthorizedException } from '@nestjs/common';

function createMockProvider(tokens: Map<string, { accountId: string; scope: string; clientId: string }>) {
  return {
    AccessToken: {
      find(token: string) {
        return Promise.resolve(tokens.get(token) ?? null);
      }
    }
  };
}

function createMockRequest(authHeader?: string): OAuthAuthenticatedRequest {
  return {
    headers: {
      authorization: authHeader
    }
  } as any;
}

describe('OAuthBearerTokenMiddleware', () => {
  const validToken = 'valid-token-123';
  const tokenData = { accountId: 'user-uid-1', scope: 'openid profile', clientId: 'client-1' };

  let middleware: OAuthBearerTokenMiddleware;
  let mockProvider: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    const tokens = new Map();
    tokens.set(validToken, tokenData);
    mockProvider = createMockProvider(tokens);
    middleware = new OAuthBearerTokenMiddleware(mockProvider);
  });

  it('should attach auth context for valid bearer token', async () => {
    const req = createMockRequest(`Bearer ${validToken}`);
    const next = vi.fn();

    await middleware.use(req, {} as any, next);

    expect(req.oauthAuth).toBeDefined();
    expect(req.oauthAuth!.uid).toBe('user-uid-1');
    expect(req.oauthAuth!.token.sub).toBe('user-uid-1');
    expect(req.oauthAuth!.token.scope).toBe('openid profile');
    expect(req.oauthAuth!.token.client_id).toBe('client-1');
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

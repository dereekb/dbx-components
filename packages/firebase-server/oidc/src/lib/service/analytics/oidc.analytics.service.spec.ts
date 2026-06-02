import { describe, it, expect, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { type FirebaseServerAnalyticsService, type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { FirebaseServerOidcAnalyticsService } from './oidc.analytics.service';
import { type FirebaseServerOidcAnalyticsConfig } from './oidc.analytics.config';
import { emitOidcAnalyticsEvent, noopOidcAnalyticsService, type OidcAnalyticsEvent, type OidcAnalyticsService } from './oidc.analytics.handler';

interface SentEvent {
  readonly userId: string | null | undefined;
  readonly name: string;
  readonly data: Record<string, unknown>;
}

function capturingAnalyticsService(): { service: FirebaseServerAnalyticsService; sent: SentEvent[] } {
  const sent: SentEvent[] = [];
  const service = {
    sendEventData: (userId: string | null | undefined, name: string, data: Record<string, unknown>) => sent.push({ userId, name, data })
  } as unknown as FirebaseServerAnalyticsService;
  return { service, sent };
}

function envService(isProduction = false): FirebaseServerEnvService {
  return { isProduction } as unknown as FirebaseServerEnvService;
}

function makeService(options: { isProduction?: boolean; downstream?: FirebaseServerAnalyticsService; config?: FirebaseServerOidcAnalyticsConfig } = {}): FirebaseServerOidcAnalyticsService {
  return new FirebaseServerOidcAnalyticsService(envService(options.isProduction ?? false), options.downstream, options.config);
}

describe('FirebaseServerOidcAnalyticsService', () => {
  it('resolves a distinct prefixed event name per type and forwards to the downstream service', () => {
    const { service: downstream, sent } = capturingAnalyticsService();
    const service = makeService({ downstream });

    service.handleOidcAnalyticsEvent({ type: 'login', isSuccessful: true, uid: 'u1' });
    service.handleOidcAnalyticsEvent({ type: 'consent', isSuccessful: true, clientId: 'c1' });

    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({ userId: 'u1', name: 'OIDC Login' });
    expect(sent[0].data).toMatchObject({ success: true });
    expect(sent[1]).toMatchObject({ name: 'OIDC Consent' });
    expect(sent[1].data).toMatchObject({ clientId: 'c1', success: true });
  });

  it('joins scopes and drops undefined values from the forwarded payload', () => {
    const { service: downstream, sent } = capturingAnalyticsService();
    const service = makeService({ downstream });

    service.handleOidcAnalyticsEvent({ type: 'consent', isSuccessful: true, uid: 'u1', clientId: 'c1', scopes: ['openid', 'profile'], serviceToken: false, isAdmin: true });

    expect(sent).toHaveLength(1);
    expect(sent[0].data).toEqual({ clientId: 'c1', scopes: 'openid profile', serviceToken: false, isAdmin: true, success: true });
    expect(sent[0].data).not.toHaveProperty('grantId');
    expect(sent[0].data).not.toHaveProperty('reason');
  });

  it('honors the configurable event-name prefix and per-type overrides', () => {
    const { service: downstream, sent } = capturingAnalyticsService();
    const config: FirebaseServerOidcAnalyticsConfig = { eventNamePrefix: 'Auth: ', eventNames: { login: 'Sign In' } };
    const service = makeService({ downstream, config });

    service.handleOidcAnalyticsEvent({ type: 'login', isSuccessful: true, uid: 'u1' });
    service.handleOidcAnalyticsEvent({ type: 'consent', isSuccessful: true });

    expect(sent[0].name).toBe('Auth: Sign In');
    expect(sent[1].name).toBe('Auth: Consent');
  });

  it('logs a per-event line when logEvents is enabled (default in non-production)', () => {
    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    try {
      const service = makeService({ isProduction: false });
      service.handleOidcAnalyticsEvent({ type: 'login', isSuccessful: false, reason: 'invalid_id_token' });
      expect(logSpy.mock.calls.some(([msg]) => typeof msg === 'string' && msg.includes('OIDC Login') && msg.includes('Failed') && msg.includes('invalid_id_token'))).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('does not log per-event lines by default in production', () => {
    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    try {
      const service = makeService({ isProduction: true });
      service.handleOidcAnalyticsEvent({ type: 'login', isSuccessful: true, uid: 'u1' });
      expect(logSpy.mock.calls.some(([msg]) => typeof msg === 'string' && msg.includes('OIDC Login'))).toBe(false);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('is a no-op (aside from logging) when no downstream analytics service is registered', () => {
    const service = makeService({ downstream: undefined });
    expect(() => service.handleOidcAnalyticsEvent({ type: 'consent', isSuccessful: true, clientId: 'c1' })).not.toThrow();
  });
});

describe('emitOidcAnalyticsEvent', () => {
  const event: OidcAnalyticsEvent = { type: 'login', isSuccessful: true, uid: 'u1' };

  it('forwards the event to the service', () => {
    const events: OidcAnalyticsEvent[] = [];
    const service: OidcAnalyticsService = { handleOidcAnalyticsEvent: (e) => events.push(e) };

    emitOidcAnalyticsEvent(service, event, new Logger('test'));

    expect(events).toEqual([event]);
  });

  it('is fail-soft: a throwing handler does not propagate and logs a warning', () => {
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const throwing: OidcAnalyticsService = {
      handleOidcAnalyticsEvent: () => {
        throw new Error('analytics down');
      }
    };

    try {
      expect(() => emitOidcAnalyticsEvent(throwing, event, new Logger('test'))).not.toThrow();
      expect(warnSpy.mock.calls.some(([msg]) => typeof msg === 'string' && msg.includes('OIDC analytics handler threw'))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('noopOidcAnalyticsService discards events without throwing', () => {
    expect(() => noopOidcAnalyticsService().handleOidcAnalyticsEvent(event)).not.toThrow();
  });
});

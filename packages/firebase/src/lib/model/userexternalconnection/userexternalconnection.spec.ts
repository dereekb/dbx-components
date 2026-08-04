import { describe, expect, it } from 'vitest';
import { type UserExternalConnection, userExternalConnectionConverter } from './userexternalconnection';

describe('userExternalConnectionConverter', () => {
  const connectedAt = new Date('2026-01-02T03:04:05.000Z');
  const expiresAt = new Date('2026-01-02T04:04:05.000Z');
  const updatedAt = new Date('2026-01-02T05:04:05.000Z');

  const model: UserExternalConnection = {
    uid: 'testuid',
    e: {
      calcom: {
        st: 'connected',
        ca: ['booking:read', 'booking:write'],
        ea: 'cal-123',
        l: 'user@example.com',
        coa: connectedAt,
        exa: expiresAt,
        uat: updatedAt
      },
      zoom: {
        st: 'error',
        ea: 'zoom-456',
        coa: connectedAt,
        uat: updatedAt,
        er: 'unauthorized'
      }
    },
    c: ['calcom'],
    uat: updatedAt
  };

  it('should round-trip the per-provider entry map', () => {
    const data = userExternalConnectionConverter.mapFunctions.to(model);
    const result = userExternalConnectionConverter.mapFunctions.from(data);

    expect(Object.keys(result.e).length).toBe(2);
    expect(result.e['calcom'].st).toBe('connected');
    expect(result.e['calcom'].ca).toContain('booking:read');
    expect(result.e['calcom'].ca).toContain('booking:write');
    expect(result.e['calcom'].ea).toBe('cal-123');
    expect(result.e['calcom'].l).toBe('user@example.com');
    expect(result.e['calcom'].coa).toBeSameSecondAs(connectedAt);
    expect(result.e['calcom'].exa).toBeSameSecondAs(expiresAt);
    expect(result.e['calcom'].uat).toBeSameSecondAs(updatedAt);
    expect(result.e['calcom'].er).not.toBeDefined();

    expect(result.e['zoom'].st).toBe('error');
    expect(result.e['zoom'].er).toBe('unauthorized');
    expect(result.e['zoom'].exa).not.toBeDefined();
  });

  it('should store dates within the entry map as strings', () => {
    const data = userExternalConnectionConverter.mapFunctions.to(model);

    expect(typeof data.e['calcom'].coa).toBe('string');
    expect(typeof data.e['calcom'].uat).toBe('string');
  });

  it('should round-trip the connected provider types array', () => {
    const data = userExternalConnectionConverter.mapFunctions.to(model);
    const result = userExternalConnectionConverter.mapFunctions.from(data);

    expect(result.c).toContain('calcom');
    expect(result.c).not.toContain('zoom');
  });

  it('should convert an empty document into empty values', () => {
    const result = userExternalConnectionConverter.mapFunctions.from({});

    expect(result.e).toBeDefined();
    expect(Object.keys(result.e).length).toBe(0);
    expect(result.c).toBeDefined();
    expect(result.c.length).toBe(0);
    expect(result.uat).toBeDefined();
  });
});

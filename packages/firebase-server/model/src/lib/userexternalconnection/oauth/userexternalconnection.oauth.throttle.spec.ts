import { describe, expect, it } from 'vitest';
import { memoryUserExternalConnectionSignInThrottle } from './userexternalconnection.oauth.throttle';

const PROVIDER = 'testprovider';

describe('memoryUserExternalConnectionSignInThrottle()', () => {
  it('should allow attempts up to the burst limit', async () => {
    const throttle = memoryUserExternalConnectionSignInThrottle({ burstLimit: 3 });
    const results: boolean[] = [];

    for (let i = 0; i < 3; i += 1) {
      results.push(await throttle.throttleSignInAttempt({ providerType: PROVIDER, clientIp: '1.1.1.1' }));
    }

    expect(results).toEqual([false, false, false]);
  });

  it('should throttle past the burst limit', async () => {
    const throttle = memoryUserExternalConnectionSignInThrottle({ burstLimit: 2 });

    await throttle.throttleSignInAttempt({ providerType: PROVIDER, clientIp: '1.1.1.1' });
    await throttle.throttleSignInAttempt({ providerType: PROVIDER, clientIp: '1.1.1.1' });

    await expect(throttle.throttleSignInAttempt({ providerType: PROVIDER, clientIp: '1.1.1.1' })).resolves.toBe(true);
  });

  it('should budget each client IP separately', async () => {
    const throttle = memoryUserExternalConnectionSignInThrottle({ burstLimit: 1 });

    await throttle.throttleSignInAttempt({ providerType: PROVIDER, clientIp: '1.1.1.1' });

    await expect(throttle.throttleSignInAttempt({ providerType: PROVIDER, clientIp: '1.1.1.1' })).resolves.toBe(true);
    await expect(throttle.throttleSignInAttempt({ providerType: PROVIDER, clientIp: '2.2.2.2' })).resolves.toBe(false);
  });

  it('should budget each provider separately', async () => {
    // one provider's traffic must not exhaust another's budget
    const throttle = memoryUserExternalConnectionSignInThrottle({ burstLimit: 1 });

    await throttle.throttleSignInAttempt({ providerType: PROVIDER, clientIp: '1.1.1.1' });

    await expect(throttle.throttleSignInAttempt({ providerType: 'otherprovider', clientIp: '1.1.1.1' })).resolves.toBe(false);
  });

  it('should collapse callers with no resolvable IP onto ONE bucket', async () => {
    // the conservative reading: a deployment that cannot resolve client IPs gets a global budget,
    // not no budget
    const throttle = memoryUserExternalConnectionSignInThrottle({ burstLimit: 1 });

    await throttle.throttleSignInAttempt({ providerType: PROVIDER });

    await expect(throttle.throttleSignInAttempt({ providerType: PROVIDER, clientIp: null })).resolves.toBe(true);
  });

  it('should NOT impose a minimum gap by default', async () => {
    // a minimum gap punishes the shared-IP case hardest; the burst limit is the real guard
    const throttle = memoryUserExternalConnectionSignInThrottle();

    await throttle.throttleSignInAttempt({ providerType: PROVIDER, clientIp: '1.1.1.1' });

    await expect(throttle.throttleSignInAttempt({ providerType: PROVIDER, clientIp: '1.1.1.1' })).resolves.toBe(false);
  });

  it('should impose a minimum gap when one is configured', async () => {
    const throttle = memoryUserExternalConnectionSignInThrottle({ throttleTime: 60000 });

    await throttle.throttleSignInAttempt({ providerType: PROVIDER, clientIp: '1.1.1.1' });

    await expect(throttle.throttleSignInAttempt({ providerType: PROVIDER, clientIp: '1.1.1.1' })).resolves.toBe(true);
  });
});

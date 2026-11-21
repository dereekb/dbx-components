import { describe, it, expect } from 'vitest';
import { describeIfEnvFlag } from './shared.env';

describe('describeIfEnvFlag()', () => {
  const ran: string[] = [];

  describeIfEnvFlag('FLAG', { FLAG: ' True ' })('flag on', () => {
    it('should run', () => {
      ran.push('on');
    });
  });

  describeIfEnvFlag('FLAG', { FLAG: 'yes' })('flag set to yes', () => {
    it('must not run', () => {
      ran.push('yes');
    });
  });

  describeIfEnvFlag('FLAG', {})('flag absent', () => {
    it('must not run', () => {
      ran.push('absent');
    });
  });

  it('should run only the suite whose flag is on', () => {
    expect(ran).toEqual(['on']);
  });
});

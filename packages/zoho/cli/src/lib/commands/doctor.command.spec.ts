import { describe, expect, it } from 'vitest';
import { checkOrgIdProducts, doctorChecksHealthy } from './doctor.command';
import { configuredProducts, type ZohoCliConfig } from '../config/cli.config';

const fullCreds = {
  clientId: 'id',
  clientSecret: 'secret',
  refreshToken: 'token'
};

/**
 * Runs the org-id checks the way `doctor` does — over the products it reports as configured.
 */
function orgIdChecksFor(config: ZohoCliConfig) {
  return checkOrgIdProducts(config, configuredProducts(config));
}

function checkNamed(config: ZohoCliConfig, name: string) {
  return orgIdChecksFor(config).find((c) => c.name === name);
}

describe('checkOrgIdProducts()', () => {
  it('should produce a check for every org-scoped product', () => {
    const config: ZohoCliConfig = { shared: { ...fullCreds } };
    expect(orgIdChecksFor(config).map((c) => c.name)).toEqual(['desk-org-id', 'analytics-org-id']);
  });

  // analytics stays in configuredProducts without an org id (`orgs list` is how the id is found), so
  // nothing else in the run notices that every other analytics command is broken
  it('should FAIL when a configured analytics install has no org id', () => {
    const config: ZohoCliConfig = { shared: { ...fullCreds }, analytics: { ...fullCreds } };

    expect(configuredProducts(config)).toContain('analytics');
    expect(checkNamed(config, 'analytics-org-id')?.status).toBe('fail');
    expect(doctorChecksHealthy(orgIdChecksFor(config))).toBe(false);
  });

  it('should pass when a configured analytics install has an org id', () => {
    const config: ZohoCliConfig = { shared: { ...fullCreds }, analytics: { ...fullCreds, orgId: '783021215' } };

    const check = checkNamed(config, 'analytics-org-id');

    expect(check?.status).toBe('pass');
    expect(check?.message).toContain('783021215');
  });

  it('should pass when desk has an org id', () => {
    const config: ZohoCliConfig = { shared: { ...fullCreds }, desk: { orgId: 'org-1' } };
    expect(checkNamed(config, 'desk-org-id')?.status).toBe('pass');
  });

  // desk is dropped from configuredProducts without an org id, so this is "desk was never set up"
  // rather than a broken install — it must stay a warning, not become a failure for every user who
  // only ever configured recruit/crm
  it('should only WARN when desk has no org id and is therefore not configured', () => {
    const config: ZohoCliConfig = { shared: { ...fullCreds } };

    expect(configuredProducts(config)).not.toContain('desk');
    expect(checkNamed(config, 'desk-org-id')?.status).toBe('warn');
  });

  it('should only WARN when analytics is not configured at all', () => {
    const config: ZohoCliConfig = { shared: { ...fullCreds } };

    expect(configuredProducts(config)).not.toContain('analytics');
    expect(checkNamed(config, 'analytics-org-id')?.status).toBe('warn');
  });
});

describe('doctorChecksHealthy()', () => {
  it('should be healthy only when every check passed', () => {
    expect(doctorChecksHealthy([{ name: 'a', status: 'pass' }])).toBe(true);
    expect(
      doctorChecksHealthy([
        { name: 'a', status: 'pass' },
        { name: 'b', status: 'warn' }
      ])
    ).toBe(false);
    expect(doctorChecksHealthy([{ name: 'a', status: 'fail' }])).toBe(false);
  });
});

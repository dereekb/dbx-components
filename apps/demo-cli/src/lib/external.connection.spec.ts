import { describe, expect, it } from 'vitest';
import { type CliEnvConfig } from '@dereekb/dbx-cli';
import { MICROSOFT_MAIL_SIGNATURE_USER_EXTERNAL_CONNECTION_DATA_TYPE as MAIL_SIGNATURE } from '@dereekb/firebase';
import { DEMO_MICROSOFT_EXTERNAL_CONNECTION_PROVIDER_TYPE as MICROSOFT, DEMO_USER_EXTERNAL_CONNECTION_DATA_TYPES } from 'demo-firebase';
import { DEMO_CLI_EXTERNAL_CONNECTION_DATA_CONFIG } from './external.connection';

const TEST_ENV = {} as CliEnvConfig;

describe('DEMO_CLI_EXTERNAL_CONNECTION_DATA_CONFIG', () => {
  it('should share the data type registry demo-api validates against', () => {
    expect(DEMO_CLI_EXTERNAL_CONNECTION_DATA_CONFIG.dataTypes).toBe(DEMO_USER_EXTERNAL_CONNECTION_DATA_TYPES);
  });

  it('should have an adapter for every provider that registers a data type', () => {
    const providerTypes = new Set(DEMO_USER_EXTERNAL_CONNECTION_DATA_TYPES.map((x) => x.providerType));

    expect(providerTypes.has(MICROSOFT)).toBe(true);

    for (const providerType of providerTypes) {
      expect(DEMO_CLI_EXTERNAL_CONNECTION_DATA_CONFIG.adapters[providerType]).toBeDefined();
    }
  });

  describe('microsoft adapter', () => {
    const adapter = DEMO_CLI_EXTERNAL_CONNECTION_DATA_CONFIG.adapters[MICROSOFT];

    it('should unpack mail signatures into msgraph-cli settings keyed by data type', () => {
      const signature = { me: { html: '<p>Regards</p>' }, 'support@example.com': { text: 'Support' } };
      const settings = adapter.unpack({ providerType: MICROSOFT, data: { [MAIL_SIGNATURE]: signature }, env: TEST_ENV });

      expect(settings).toEqual({ [MAIL_SIGNATURE]: signature });
    });

    it('should drop data types msgraph-cli does not read', () => {
      const settings = adapter.unpack({ providerType: MICROSOFT, data: { other_type: { me: { value: 'x' } } }, env: TEST_ENV });

      expect(settings).toBeUndefined();
    });

    it('should pack msgraph-cli settings back into provider data', () => {
      const signature = { me: { html: '<p>Regards</p>' } };
      const data = adapter.pack?.({ providerType: MICROSOFT, settings: { [MAIL_SIGNATURE]: signature, unrelated: true } });

      expect(data).toEqual({ [MAIL_SIGNATURE]: signature });
    });
  });
});

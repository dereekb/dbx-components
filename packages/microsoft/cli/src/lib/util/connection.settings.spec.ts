import { describe, expect, it } from 'vitest';
import { CliError } from '@dereekb/dbx-cli';
import { msGraphCliDryRunOutput } from './mail.write';
import { msGraphCliConnectionSettingsFromToken, msGraphCliServerDefaults, msGraphCliServerSettingsGetter } from './connection.settings';

describe('msgraph-cli connection settings', () => {
  describe('msGraphCliConnectionSettingsFromToken()', () => {
    it('keeps valid signatures under lowercased keys', () => {
      expect(msGraphCliConnectionSettingsFromToken({ settings: { mail_signature: { ME: { html: '<p>Ada</p>' }, 'Support@Example.com': { text: 'Support' } } } })).toEqual({ mail_signature: { me: { html: '<p>Ada</p>' }, 'support@example.com': { text: 'Support' } } });
    });

    it('drops invalid entries and reports only their count', () => {
      const counts: number[] = [];
      const result = msGraphCliConnectionSettingsFromToken(
        {
          settings: {
            mail_signature: {
              me: { html: '<p>Ada</p>', text: 'both' },
              'not an address': { text: 'x' },
              'a@example.com': { html: '' },
              'b@example.com': 'plain string',
              'c@example.com': { text: 'C' }
            }
          }
        },
        { onInvalid: (count) => counts.push(count) }
      );

      expect(result).toEqual({ mail_signature: { 'c@example.com': { text: 'C' } } });
      expect(counts).toEqual([4]);
    });

    it('returns undefined with no settings, or none valid', () => {
      expect(msGraphCliConnectionSettingsFromToken(undefined)).toBeUndefined();
      expect(msGraphCliConnectionSettingsFromToken({ settings: undefined })).toBeUndefined();
      expect(msGraphCliConnectionSettingsFromToken({ settings: { mail_signature: ['x'] } })).toBeUndefined();
      expect(msGraphCliConnectionSettingsFromToken({ settings: { mail_signature: { me: {} } } })).toBeUndefined();
    });
  });

  describe('msGraphCliServerSettingsGetter()', () => {
    it('loads the token once, lazily', async () => {
      let loads = 0;
      const getter = msGraphCliServerSettingsGetter({
        tokenSource: {
          loadToken: async () => {
            loads += 1;
            return { settings: { mail_signature: { me: { text: 'Ada' } } } };
          }
        }
      });

      expect(loads).toBe(0);
      expect(await getter()).toEqual({ mail_signature: { me: { text: 'Ada' } } });
      await getter();
      expect(loads).toBe(1);
    });

    it('throws a token-source failure outside a dry run', async () => {
      const getter = msGraphCliServerSettingsGetter({
        tokenSource: {
          loadToken: async () => {
            throw new CliError({ message: 'nope', code: 'AUTH_FORBIDDEN' });
          }
        }
      });

      await expect(getter()).rejects.toThrow(CliError);
    });

    it('degrades a dry run to a warning in the preview', async () => {
      const defaults = msGraphCliServerDefaults(
        { dryRun: true },
        {
          tokenSource: {
            loadToken: async () => {
              throw new CliError({ message: 'nope', code: 'AUTH_FORBIDDEN' });
            }
          }
        }
      );

      expect(await defaults.serverSettings()).toBeUndefined();
      expect(defaults.warnings).toEqual(['server defaults unavailable (AUTH_FORBIDDEN)']);
      expect(msGraphCliDryRunOutput([], undefined, defaults.warnings).warnings).toEqual(['server defaults unavailable (AUTH_FORBIDDEN)']);
      expect(msGraphCliDryRunOutput([]).warnings).toBeUndefined();
    });
  });
});

import { describe, it, expect } from 'vitest';
import { zohoRecruitConfigApiUrl } from './recruit.config';

describe('zohoRecruitConfigApiUrl()', () => {
  it('should resolve the "sandbox" key to the sandbox Recruit URL', () => {
    expect(zohoRecruitConfigApiUrl('sandbox')).toBe('https://recruitsandbox.zoho.com/recruit');
  });

  it('should resolve the "production" key to the production Recruit URL', () => {
    expect(zohoRecruitConfigApiUrl('production')).toBe('https://recruit.zoho.com/recruit');
  });

  it('should pass through a custom URL unchanged', () => {
    const customUrl = 'https://recruit.zoho.eu/recruit';
    expect(zohoRecruitConfigApiUrl(customUrl)).toBe(customUrl);
  });
});

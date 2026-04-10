import { describe, it, expect } from 'vitest';
import { forgeDefaultValidationMessages } from './validation';

describe('forgeDefaultValidationMessages()', () => {
  it('should return an object with validation messages', () => {
    const messages = forgeDefaultValidationMessages();
    expect(messages).toBeDefined();
  });

  it('should include a required message', () => {
    const messages = forgeDefaultValidationMessages();
    expect(messages.required).toBe('This field is required.');
  });

  it('should include a minLength message with interpolation', () => {
    const messages = forgeDefaultValidationMessages();
    expect(messages.minLength).toContain('{{requiredLength}}');
  });

  it('should include a maxLength message with interpolation', () => {
    const messages = forgeDefaultValidationMessages();
    expect(messages.maxLength).toContain('{{requiredLength}}');
  });

  it('should include a min message with interpolation', () => {
    const messages = forgeDefaultValidationMessages();
    expect(messages.min).toContain('{{min}}');
  });

  it('should include a max message with interpolation', () => {
    const messages = forgeDefaultValidationMessages();
    expect(messages.max).toContain('{{max}}');
  });

  it('should include an email message', () => {
    const messages = forgeDefaultValidationMessages();
    expect(messages.email).toBeDefined();
  });

  it('should include a pattern message', () => {
    const messages = forgeDefaultValidationMessages();
    expect(messages.pattern).toBeDefined();
  });
});

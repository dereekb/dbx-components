import { type } from 'arktype';
import { e164PhoneNumberType, e164PhoneNumberWithOptionalExtensionType } from './phone';

describe('e164PhoneNumberType', () => {
  it('should pass a valid E.164 phone number', () => {
    const result = e164PhoneNumberType('+12345678910');
    expect(result instanceof type.errors).toBe(false);
  });

  it('should not pass a phone number with extension', () => {
    const result = e164PhoneNumberType('+12345678910#1234');
    expect(result instanceof type.errors).toBe(true);
  });

  it('should not pass an invalid phone number', () => {
    const result = e164PhoneNumberType('245678910');
    expect(result instanceof type.errors).toBe(true);
  });
});

describe('e164PhoneNumberWithOptionalExtensionType', () => {
  it('should pass a valid E.164 phone number', () => {
    const result = e164PhoneNumberWithOptionalExtensionType('+12345678910');
    expect(result instanceof type.errors).toBe(false);
  });

  it('should pass a phone number with extension', () => {
    const result = e164PhoneNumberWithOptionalExtensionType('+12345678910#1234');
    expect(result instanceof type.errors).toBe(false);
  });

  it('should not pass an invalid phone number', () => {
    const result = e164PhoneNumberWithOptionalExtensionType('245678910');
    expect(result instanceof type.errors).toBe(true);
  });
});

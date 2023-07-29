import { E164PHONE_NUMBER_WITH_OPTIONAL_EXTENSION_REGEX, E164PhoneNumber, E164PhoneNumberWithExtension, PhoneNumber, e164PhoneNumberExtensionPair, isE164PhoneNumberWithExtension, removeExtensionFromPhoneNumber } from './phone';

const validPhoneNumber: PhoneNumber = '234-567-8910';
const validE164PhoneNumber: E164PhoneNumber = '+12345678910';
const extensionNumber = `1234`;
const validE164PhoneNumberWithExtension: E164PhoneNumberWithExtension = `${validE164PhoneNumber}#${extensionNumber}`;

describe('E164PHONE_NUMBER_WITH_OPTIONAL_EXTENSION_REGEX', () => {
  it('should match a valid E.164 phone number', () => {
    const result = E164PHONE_NUMBER_WITH_OPTIONAL_EXTENSION_REGEX.test(validE164PhoneNumber);
    expect(result).toBe(true);
  });

  it('should match a valid E.164 phone number with an extension', () => {
    const result = E164PHONE_NUMBER_WITH_OPTIONAL_EXTENSION_REGEX.test(validE164PhoneNumberWithExtension);
    expect(result).toBe(true);
  });
});

describe('isE164PhoneNumberWithExtension()', () => {
  it('should return false for a valid E.164 phone number without an extension', () => {
    const result = isE164PhoneNumberWithExtension(validE164PhoneNumber);
    expect(result).toBe(false);
  });

  it('should match a valid E.164 phone number with an extension', () => {
    const result = isE164PhoneNumberWithExtension(validE164PhoneNumberWithExtension);
    expect(result).toBe(true);
  });
});

describe('removeExtensionFromPhoneNumber()', () => {
  it('should return the input validE164PhoneNumber as is', () => {
    const result = removeExtensionFromPhoneNumber(validE164PhoneNumber);
    expect(result).toBe(validE164PhoneNumber);
  });

  it('should remove the extension from the input validE164PhoneNumberWithExtension', () => {
    const result = removeExtensionFromPhoneNumber(validE164PhoneNumberWithExtension);
    expect(result).toBe(validE164PhoneNumber);
  });
});

describe('e164PhoneNumberExtensionPair()', () => {
  it('should create a pair from validE164PhoneNumber', () => {
    const pair = e164PhoneNumberExtensionPair(validE164PhoneNumber);
    expect(pair.number).toBe(validE164PhoneNumber);
    expect(pair.extension).toBeUndefined();
  });

  it('should create a pair from validE164PhoneNumber', () => {
    const pair = e164PhoneNumberExtensionPair(validE164PhoneNumberWithExtension);
    expect(pair.number).toBe(validE164PhoneNumber);
    expect(pair.extension).toBe(extensionNumber);
  });
});

import { type E164PhoneNumber } from './phone';
import { randomFromArrayFactory } from '../getter/getter.util';
import { type ArrayOrValue, asArray } from '../array/array';
import { type EmailAddressDomain } from './domain';
import { type EmailAddress } from './email';
import { type Factory } from '../getter';
import { KeyValueTypleValueFilter } from '../object/object.filter.tuple';
import { mergeObjects } from '../object/object.filter.pojo';
import { incrementingNumberFactory, type NumberFactory } from '../number/factory';
import { randomNumberFactory } from '../number/random';

// MARK: Email
/**
 * Configuration for generating random email addresses.
 */
export interface RandomEmailFactoryConfig {
  /**
   * Set of email prefixes to use
   */
  prefixes?: ArrayOrValue<string>;
  /**
   * domains to use
   */
  domains?: ArrayOrValue<EmailAddressDomain>;
  /**
   * Random number generator. Negative numbers are treated as an "ignored" value.
   */
  numberFactory?: NumberFactory;
}

/**
 * Default configuration that uses incrementing numbers and a test domain for safety in tests.
 */
export const DEFAULT_RANDOM_EMAIL_FACTORY_CONFIG: RandomEmailFactoryConfig = {
  prefixes: 'email.',
  domains: 'test.dereekb.com',
  numberFactory: incrementingNumberFactory() // use an incrementing number factory for safety in tests
};

export type RandomEmailFactory = Factory<EmailAddress>;

/**
 * Creates a factory that generates random email addresses using configurable prefixes, domains, and number generators.
 *
 * @param inputConfig - Optional configuration overrides
 * @returns A factory function that produces random email address strings
 */
export function randomEmailFactory(inputConfig?: RandomEmailFactoryConfig): RandomEmailFactory {
  const config = mergeObjects([DEFAULT_RANDOM_EMAIL_FACTORY_CONFIG, inputConfig], KeyValueTypleValueFilter.FALSY_AND_EMPTY);

  const prefixFactory = randomFromArrayFactory(asArray(config.prefixes ?? ''));
  const domainFactory = randomFromArrayFactory(asArray(config.domains ?? 'test.dereekb.com'));
  const numberFactory = config.numberFactory as NumberFactory;

  return () => {
    const prefix = prefixFactory();
    const domain = domainFactory();
    const number = numberFactory();
    const numberString = number >= 0 ? number.toString() : '';
    return `${prefix}${numberString}@${domain}`;
  };
}

// MARK: Phone
/**
 * Configuration for generating random E.164 phone numbers.
 */
export interface RandomPhoneNumberFactoryConfig {
  /**
   * Set of interntional numbers to use.
   */
  internationalAreaCodes?: ArrayOrValue<number>;
  /**
   * Random number generator. Should generate a 10-digit number. Generated numbers are not validated.
   */
  numberFactory?: NumberFactory;
}

/**
 * Default configuration using US area codes and random 7-digit number generation.
 */
export const DEFAULT_RANDOM_PHONE_NUMBER_FACTORY_CONFIG: RandomPhoneNumberFactoryConfig = {
  internationalAreaCodes: [1210, 1979, 1512, 1303],
  numberFactory: randomNumberFactory({
    min: 2000000, // numbers starting with 1 are invalid in the US
    max: 10000000, // up to 9999999
    round: 'floor'
  })
};

export type RandomPhoneNumberFactory = Factory<E164PhoneNumber>;

/**
 * Creates a factory that generates random E.164 phone numbers using configurable area codes and number generators.
 *
 * @param inputConfig - Optional configuration overrides
 * @returns A factory function that produces random E.164 phone number strings
 */
export function randomPhoneNumberFactory(inputConfig?: RandomPhoneNumberFactoryConfig): RandomPhoneNumberFactory {
  const config = mergeObjects([DEFAULT_RANDOM_PHONE_NUMBER_FACTORY_CONFIG, inputConfig], KeyValueTypleValueFilter.FALSY_AND_EMPTY);

  const internationalCodeFactory = randomFromArrayFactory(asArray(config.internationalAreaCodes ?? 1210));
  const numberFactory = config.numberFactory as NumberFactory;

  return () => {
    const code = internationalCodeFactory();
    const number = numberFactory();
    return `+${code}${number}`;
  };
}

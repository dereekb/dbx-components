import { E164PhoneNumber } from './phone';
import { randomFromArrayFactory } from '../getter/getter.util';
import { ArrayOrValue, asArray } from '../array/array';
import { EmailAddressDomain } from './domain';
import { EmailAddress } from './email';
import { Factory } from '../getter';
import { KeyValueTypleValueFilter } from '../object/object.filter.tuple';
import { mergeObjects } from '../object/object.filter.pojo';
import { incrementingNumberFactory, NumberFactory } from '../number/factory';
import { randomNumberFactory } from '../number/random';

// MARK: Email
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

export const DEFAULT_RANDOM_EMAIL_FACTORY_CONFIG: RandomEmailFactoryConfig = {
  prefixes: 'email.',
  domains: 'test.dereekb.com',
  numberFactory: incrementingNumberFactory() // use an incrementing number factory for safety in tests
};

export type RandomEmailFactory = Factory<EmailAddress>;

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

export const DEFAULT_RANDOM_PHONE_NUMBER_FACTORY_CONFIG: RandomPhoneNumberFactoryConfig = {
  internationalAreaCodes: [1210, 1979, 1512, 1303],
  numberFactory: randomNumberFactory({
    min: 2000000, // numbers starting with 1 are invalid in the US
    max: 9999999,
    round: 'floor'
  })
};

export type RandomPhoneNumberFactory = Factory<E164PhoneNumber>;

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

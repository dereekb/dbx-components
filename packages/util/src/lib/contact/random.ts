import { randomFromArrayFactory } from '../getter/getter.util';
import { ArrayOrValue, asArray } from '../array/array';
import { EmailAddressDomain } from './domain';
import { EmailAddress } from './email';
import { Factory } from '../getter';
import { KeyValueTypleValueFilter } from '../object/object.filter.tuple';
import { mergeObjects } from '../object/object.filter.pojo';
import { incrementingNumberFactory, NumberFactory } from '../number/factory';

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

export const DEFAULT_RANDOM_EMAIL_GENERATOR_CONFIG: RandomEmailFactoryConfig = {
  prefixes: 'email.',
  domains: 'test.dereekb.com',
  numberFactory: incrementingNumberFactory() // use an incrementing number factory for safety in tests
};

export type RandomEmailFactory = Factory<EmailAddress>;

export function randomEmailFactory(inputConfig?: RandomEmailFactoryConfig): RandomEmailFactory {
  const config = mergeObjects([DEFAULT_RANDOM_EMAIL_GENERATOR_CONFIG, inputConfig], KeyValueTypleValueFilter.FALSY_AND_EMPTY);

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

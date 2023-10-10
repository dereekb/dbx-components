import { ObjectWithConstructor } from '@dereekb/util';
import { ValidationArguments, ValidationOptions, registerDecorator } from 'class-validator';
import { isValidDateBlockRange, isValidDateBlockRangeSeries, isValidDateBlockTiming } from './date.block';

/**
 * isValidDateBlockTiming validator
 *
 * @deprecated use DateCell implementation instead.
 */
export function IsValidDateBlockTiming(validationOptions?: ValidationOptions) {
  return function (object: ObjectWithConstructor, propertyName: string) {
    registerDecorator({
      name: 'isValidDateBlockTiming',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate: isValidDateBlockTiming,
        defaultMessage(args: ValidationArguments) {
          return `"${JSON.stringify(args.value)}" is not a valid DateBlockTiming.`;
        }
      }
    });
  };
}

/**
 * isValidDateBlockRange validator
 *
 * @deprecated use DateCell implementation instead.
 */
export function IsValidDateBlockRange(validationOptions?: ValidationOptions) {
  return function (object: ObjectWithConstructor, propertyName: string) {
    registerDecorator({
      name: 'isValidDateBlockRange',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate: isValidDateBlockRange,
        defaultMessage(args: ValidationArguments) {
          return `"${JSON.stringify(args.value)}" is not a valid DateBlockRange.`;
        }
      }
    });
  };
}

/**
 * isValidDateBlockRangeSeries validator
 *
 * @deprecated use DateCell implementation instead.
 */
export function IsValidDateBlockRangeSeries(validationOptions?: ValidationOptions) {
  return function (object: ObjectWithConstructor, propertyName: string) {
    registerDecorator({
      name: 'isValidDateBlockRangeSeries',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate: isValidDateBlockRangeSeries,
        defaultMessage(args: ValidationArguments) {
          return `"${JSON.stringify(args.value)}" is not a valid DateBlockRange series. Items must be sorted in ascending order and have no repeat indexes.`;
        }
      }
    });
  };
}

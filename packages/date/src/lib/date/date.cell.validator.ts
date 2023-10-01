import { ObjectWithConstructor } from '@dereekb/util';
import { ValidationArguments, ValidationOptions, registerDecorator } from 'class-validator';
import { isValidDateCellTiming } from './date.cell';
import { isValidDateCellRange, isValidDateCellRangeSeries } from './date.cell.index';

/**
 * isValidDateCellTiming validator
 */
export function IsValidDateCellTiming(validationOptions?: ValidationOptions) {
  return function (object: ObjectWithConstructor, propertyName: string) {
    registerDecorator({
      name: 'isValidDateCellTiming',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate: isValidDateCellTiming,
        defaultMessage(args: ValidationArguments) {
          return `"${JSON.stringify(args.value)}" is not a valid DateCellTiming.`;
        }
      }
    });
  };
}

/**
 * isValidDateCellRange validator
 */
export function IsValidDateCellRange(validationOptions?: ValidationOptions) {
  return function (object: ObjectWithConstructor, propertyName: string) {
    registerDecorator({
      name: 'isValidDateCellRange',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate: isValidDateCellRange,
        defaultMessage(args: ValidationArguments) {
          return `"${JSON.stringify(args.value)}" is not a valid DateCellRange.`;
        }
      }
    });
  };
}

/**
 * isValidDateCellRangeSeries validator
 */
export function IsValidDateCellRangeSeries(validationOptions?: ValidationOptions) {
  return function (object: ObjectWithConstructor, propertyName: string) {
    registerDecorator({
      name: 'isValidDateCellRangeSeries',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate: isValidDateCellRangeSeries,
        defaultMessage(args: ValidationArguments) {
          return `"${JSON.stringify(args.value)}" is not a valid DateCellRange series. Items must be sorted in ascending order and have no repeat indexes.`;
        }
      }
    });
  };
}

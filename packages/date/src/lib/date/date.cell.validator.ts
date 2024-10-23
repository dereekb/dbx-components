import { type ObjectWithConstructor } from '@dereekb/util';
import { buildMessage, type ValidationOptions, registerDecorator } from 'class-validator';
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
        defaultMessage: buildMessage((eachPrefix, args) => eachPrefix + `$property value of "${JSON.stringify(args?.value)}" is not a valid DateCellTiming.`, validationOptions)
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
        defaultMessage: buildMessage((eachPrefix, args) => eachPrefix + `$property value of "${JSON.stringify(args?.value)}" is not a valid DateCellRange.`, validationOptions)
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
        defaultMessage: buildMessage((eachPrefix, args) => eachPrefix + `$property value of "${JSON.stringify(args?.value)}" is not a valid DateCellRange series. Items must be sorted in ascending order and have no repeat indexes.`, validationOptions)
      }
    });
  };
}

import { ObjectWithConstructor } from '@dereekb/util';
import { ValidationArguments, ValidationOptions, registerDecorator } from 'class-validator';
import { isValidDateBlockTiming } from './date.block';

/**
 * isValidDateBlockTiming validator
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
          return `"${args.value}" is not a valid DateBlockTiming.`;
        }
      }
    });
  };
}

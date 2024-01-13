import { isISO8601DayString, type ObjectWithConstructor } from '@dereekb/util';
import { type ValidationOptions, registerDecorator, type ValidationArguments } from 'class-validator';

/**
 * isISO8601DayString validator
 */
export function IsISO8601DayString(validationOptions?: ValidationOptions) {
  return function (object: ObjectWithConstructor, propertyName: string) {
    registerDecorator({
      name: 'isISO8601DayString',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate: isISO8601DayString,
        defaultMessage(args: ValidationArguments) {
          return `"${args.value}" is not a ISO8601DayString.`;
        }
      }
    });
  };
}

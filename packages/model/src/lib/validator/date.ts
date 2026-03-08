import { isISO8601DayString, type ObjectWithConstructor } from '@dereekb/util';
import { buildMessage, type ValidationOptions, registerDecorator } from 'class-validator';

/**
 * Class-validator decorator that validates a property value is a valid ISO 8601 day string (e.g., "2024-01-15").
 *
 * @param validationOptions - optional class-validator options
 * @returns a property decorator
 *
 * @example
 * ```typescript
 * class MyDto {
 *   @IsISO8601DayString()
 *   date!: string;
 * }
 * ```
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
        defaultMessage: buildMessage((eachPrefix, args) => eachPrefix + `$property value of "${args?.value}" is not a ISO8601DayString.`, validationOptions)
      }
    });
  };
}

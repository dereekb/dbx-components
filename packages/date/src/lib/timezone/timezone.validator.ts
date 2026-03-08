import { type ObjectWithConstructor } from '@dereekb/util';
import { buildMessage, type ValidationOptions, registerDecorator } from 'class-validator';
import { isKnownTimezone } from './timezone';

/**
 * `class-validator` property decorator that validates a string is a recognized IANA timezone.
 *
 * Delegates to {@link isKnownTimezone} for the actual check.
 *
 * @example
 * ```ts
 * class MyDto {
 *   @IsKnownTimezone()
 *   timezone!: string;
 * }
 * ```
 */
export function IsKnownTimezone(validationOptions?: ValidationOptions) {
  return function (object: ObjectWithConstructor, propertyName: string) {
    registerDecorator({
      name: 'isKnownTimezone',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate: isKnownTimezone,
        defaultMessage: buildMessage((eachPrefix, args) => eachPrefix + `$property value of "${args?.value}" is not a known timezone.`, validationOptions)
      }
    });
  };
}

import { isE164PhoneNumber, isE164PhoneNumberWithExtension, type ObjectWithConstructor } from '@dereekb/util';
import { buildMessage, type ValidationOptions, registerDecorator } from 'class-validator';

/**
 * Class-validator decorator that validates a property value is a valid E.164 phone number without an extension.
 *
 * @param validationOptions - optional class-validator options
 * @returns a property decorator
 *
 * @example
 * ```typescript
 * class ContactDto {
 *   @IsE164PhoneNumber()
 *   phone!: string; // e.g., "+15551234567"
 * }
 * ```
 */
export function IsE164PhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: ObjectWithConstructor, propertyName: string) {
    registerDecorator({
      name: 'isE164PhoneNumber',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate: (x) => isE164PhoneNumber(x, false),
        defaultMessage: buildMessage((eachPrefix, args) => eachPrefix + `$property value of "${args?.value}" is not a E164PhoneNumber with no extension.`, validationOptions)
      }
    });
  };
}

/**
 * Class-validator decorator that validates a property value is a valid E.164 phone number, optionally with an extension.
 *
 * @param validationOptions - optional class-validator options
 * @returns a property decorator
 */
export function IsE164PhoneNumberWithOptionalExtension(validationOptions?: ValidationOptions) {
  return function (object: ObjectWithConstructor, propertyName: string) {
    registerDecorator({
      name: 'isE164PhoneNumber',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate: (x) => isE164PhoneNumber(x, true),
        defaultMessage: buildMessage((eachPrefix, args) => eachPrefix + `$property value of "${args?.value}" is not an E164PhoneNumber or has an invalid extension.`, validationOptions)
      }
    });
  };
}

/**
 * Class-validator decorator that validates a property value is a valid E.164 phone number that includes an extension.
 *
 * @param validationOptions - optional class-validator options
 * @returns a property decorator
 */
export function IsE164PhoneNumberWithExtension(validationOptions?: ValidationOptions) {
  return function (object: ObjectWithConstructor, propertyName: string) {
    registerDecorator({
      name: 'isE164PhoneNumberWithExtension',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate: isE164PhoneNumberWithExtension,
        defaultMessage: buildMessage((eachPrefix, args) => eachPrefix + `$property value of "${args?.value}" is not a E164PhoneNumberWithExtension.`, validationOptions)
      }
    });
  };
}

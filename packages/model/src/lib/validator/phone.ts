import { isE164PhoneNumber, isE164PhoneNumberWithExtension, ObjectWithConstructor } from '@dereekb/util';
import { ValidationOptions, registerDecorator, ValidationArguments } from 'class-validator';

/**
 * isE164PhoneNumber validator that does not allowed extensions.
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
        defaultMessage(args: ValidationArguments) {
          return `"${args.value}" is not a E164PhoneNumber with no extension.`;
        }
      }
    });
  };
}

/**
 * isE164PhoneNumber validator that allows extensions.
 *
 * @param validationOptions
 * @returns
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
        defaultMessage(args: ValidationArguments) {
          return `"${args.value}" is not an E164PhoneNumber or has an invalid extension.`;
        }
      }
    });
  };
}

/**
 * isE164PhoneNumberWithExtension validator
 *
 * @param validationOptions
 * @returns
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
        defaultMessage(args: ValidationArguments) {
          return `"${args.value}" is not a E164PhoneNumberWithExtension.`;
        }
      }
    });
  };
}

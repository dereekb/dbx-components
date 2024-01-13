import { type ObjectWithConstructor } from '@dereekb/util';
import { type ValidationArguments, type ValidationOptions, registerDecorator } from 'class-validator';
import { isKnownTimezone } from './timezone';

/**
 * isKnownTimezone validator
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
        defaultMessage(args: ValidationArguments) {
          return `"${args.value}" is not a known timezone.`;
        }
      }
    });
  };
}

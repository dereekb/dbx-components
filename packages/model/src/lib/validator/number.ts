import { isMinuteOfDay, type ObjectWithConstructor } from '@dereekb/util';
import { type ValidationOptions, registerDecorator, type ValidationArguments } from 'class-validator';

/**
 * isMinuteOfDay validator
 */
export function IsMinuteOfDay(validationOptions?: ValidationOptions) {
  return function (object: ObjectWithConstructor, propertyName: string) {
    registerDecorator({
      name: 'isMinuteOfDay',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate: isMinuteOfDay,
        defaultMessage(args: ValidationArguments) {
          return `"${args.value}" is not a valid minute of the day.`;
        }
      }
    });
  };
}

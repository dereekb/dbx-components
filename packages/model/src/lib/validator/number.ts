import { isMinuteOfDay, type ObjectWithConstructor } from '@dereekb/util';
import { buildMessage, type ValidationOptions, registerDecorator } from 'class-validator';

/**
 * Class-validator decorator that validates a property value is a valid minute of the day (0-1439).
 *
 * @param validationOptions - optional class-validator options
 * @returns a property decorator
 *
 * @example
 * ```typescript
 * class ScheduleDto {
 *   @IsMinuteOfDay()
 *   startMinute!: number;
 * }
 * ```
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
        defaultMessage: buildMessage((eachPrefix, args) => eachPrefix + `$property value of "${args?.value}" is not a valid minute of the day.`, validationOptions)
      }
    });
  };
}

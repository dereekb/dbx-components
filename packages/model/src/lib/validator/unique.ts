import { isISO8601DayString, uniqueKeys, type ObjectWithConstructor, ReadKeyFunction, isUniqueKeyedFunction } from '@dereekb/util';
import { buildMessage, type ValidationOptions, registerDecorator, type ValidationArguments } from 'class-validator';

/**
 * isUniqueKeyedFunction validator
 */
export function IsUniqueKeyed<T>(readKey: ReadKeyFunction<T>, validationOptions?: ValidationOptions) {
  const isUniqueKeyed = isUniqueKeyedFunction(readKey);

  return function (object: ObjectWithConstructor, propertyName: string) {
    registerDecorator({
      name: 'isUniqueKeyed',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate: isUniqueKeyed,
        defaultMessage: buildMessage((eachPrefix, args) => eachPrefix + `$property value has one or more values with the same key. Keys must be unique.`, validationOptions)
      }
    });
  };
}

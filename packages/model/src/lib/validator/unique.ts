import { type ObjectWithConstructor, type ReadKeyFunction, isUniqueKeyedFunction } from '@dereekb/util';
import { buildMessage, type ValidationOptions, registerDecorator } from 'class-validator';

/**
 * Class-validator decorator that validates an array property has no duplicate keys (as determined by the given key reader function).
 *
 * @param readKey - function that extracts the key from each array element
 * @param validationOptions - optional class-validator options
 * @returns a property decorator
 *
 * @example
 * ```typescript
 * class ItemListDto {
 *   @IsUniqueKeyed((item: Item) => item.id)
 *   items!: Item[];
 * }
 * ```
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

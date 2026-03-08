import { isWebsiteUrl, isWebsiteUrlWithPrefix, type ObjectWithConstructor } from '@dereekb/util';
import { buildMessage, type ValidationOptions, registerDecorator } from 'class-validator';

/**
 * Class-validator decorator that validates a property value is a valid website URL (with or without protocol prefix).
 *
 * @param validationOptions - optional class-validator options
 * @returns a property decorator
 *
 * @example
 * ```typescript
 * class ProfileDto {
 *   @IsWebsiteUrl()
 *   website!: string; // e.g., "example.com" or "https://example.com"
 * }
 * ```
 */
export function IsWebsiteUrl(validationOptions?: ValidationOptions) {
  return function (object: ObjectWithConstructor, propertyName: string) {
    registerDecorator({
      name: 'isWebsiteUrl',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate: isWebsiteUrl,
        defaultMessage: buildMessage((eachPrefix, args) => eachPrefix + `$property value of "${args?.value}" is not a valid website url.`, validationOptions)
      }
    });
  };
}

/**
 * Class-validator decorator that validates a property value is a valid website URL that starts with `http://` or `https://`.
 *
 * @param validationOptions - optional class-validator options
 * @returns a property decorator
 */
export function IsWebsiteUrlWithPrefix(validationOptions?: ValidationOptions) {
  return function (object: ObjectWithConstructor, propertyName: string) {
    registerDecorator({
      name: 'isWebsiteUrlWithPrefix',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate: isWebsiteUrlWithPrefix,
        defaultMessage: buildMessage((eachPrefix, args) => eachPrefix + `$property value of "${args?.value}" is not a valid website url that starts with a http/https prefix.`, validationOptions)
      }
    });
  };
}

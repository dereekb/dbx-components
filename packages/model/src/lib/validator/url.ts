import { isWebsiteUrl, isWebsiteUrlWithPrefix, type ObjectWithConstructor } from '@dereekb/util';
import { type ValidationOptions, registerDecorator, type ValidationArguments } from 'class-validator';

/**
 * isWebsiteUrl validator
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
        defaultMessage(args: ValidationArguments) {
          return `"${args.value}" is not a valid website url`;
        }
      }
    });
  };
}

/**
 * isWebsiteUrlWithPrefix validator
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
        defaultMessage(args: ValidationArguments) {
          return `"${args.value}" is not a valid website url with a http/https prefix.`;
        }
      }
    });
  };
}

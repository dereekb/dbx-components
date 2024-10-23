import { isWebsiteUrl, isWebsiteUrlWithPrefix, type ObjectWithConstructor } from '@dereekb/util';
import { buildMessage, type ValidationOptions, registerDecorator } from 'class-validator';

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
        defaultMessage: buildMessage((eachPrefix, args) => eachPrefix + `$property value of "${args?.value}" is not a valid website url.`, validationOptions)
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
        defaultMessage: buildMessage((eachPrefix, args) => eachPrefix + `$property value of "${args?.value}" is not a valid website url that starts with a http/https prefix.`, validationOptions)
      }
    });
  };
}

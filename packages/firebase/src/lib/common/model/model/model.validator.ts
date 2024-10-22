import { type ObjectWithConstructor } from '@dereekb/util';
import { buildMessage, type ValidationArguments, type ValidationOptions, registerDecorator } from 'class-validator';
import { isFirestoreModelId, isFirestoreModelKey } from '../../firestore/collection/collection';

/**
 * isFirestoreModelKey validator
 */
export function IsFirestoreModelKey(validationOptions?: ValidationOptions) {
  return function (object: ObjectWithConstructor, propertyName: string) {
    registerDecorator({
      name: 'isFirestoreModelKey',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate: isFirestoreModelKey,
        defaultMessage: buildMessage((eachPrefix, args) => eachPrefix + `$property value of "${args?.value}" is not a FirestoreModelKey.`, validationOptions)
      }
    });
  };
}

/**
 * isFirestoreModelId validator
 */
export function IsFirestoreModelId(validationOptions?: ValidationOptions) {
  return function (object: ObjectWithConstructor, propertyName: string) {
    registerDecorator({
      name: 'isFirestoreModelId',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate: isFirestoreModelId,
        defaultMessage: buildMessage((eachPrefix, args) => eachPrefix + `$property value of "${args?.value}" is not a FirestoreModelId.`, validationOptions)
      }
    });
  };
}

import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, ValidationOptions, registerDecorator } from 'class-validator';
import { isFirestoreModelId, isFirestoreModelKey } from '../../firestore/collection/collection';

/**
 * isFirestoreModelKey validator
 */
export function IsFirestoreModelKey(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isFirestoreModelKey',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate: isFirestoreModelKey,
        defaultMessage(args: ValidationArguments) {
          return `"${args.value}" is not a FirestoreModelKey.`;
        }
      }
    });
  };
}

/**
 * isFirestoreModelId validator
 */
export function IsFirestoreModelId(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isFirestoreModelId',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate: isFirestoreModelId,
        defaultMessage(args: ValidationArguments) {
          return `"${args.value}" is not a FirestoreModelId.`;
        }
      }
    });
  };
}

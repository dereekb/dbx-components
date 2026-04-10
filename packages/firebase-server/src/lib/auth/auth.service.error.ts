import { type FirebaseErrorCode } from '@dereekb/firebase';
import { BaseError } from 'make-error';

/**
 * The type of identifier that caused the user-already-exists conflict.
 */
export type FirebaseServerAuthUserExistsErrorIdentifierType = 'phone' | 'email';

/**
 * Thrown by {@link AbstractFirebaseServerNewUserService.createNewUser} when Firebase Auth rejects
 * user creation because the provided phone number or email is already associated with another account.
 *
 * @example
 * ```typescript
 * try {
 *   await newUserService.initializeNewUser({ email, phone });
 * } catch (e) {
 *   if (e instanceof FirebaseServerAuthUserExistsError && e.identifierType === 'phone') {
 *     const existingUser = await auth.getUserByPhoneNumber(e.identifierValue);
 *   }
 * }
 * ```
 */
export class FirebaseServerAuthUserExistsError extends BaseError {
  readonly code: FirebaseErrorCode;
  readonly identifierType: FirebaseServerAuthUserExistsErrorIdentifierType;
  readonly identifierValue: string;

  constructor(code: FirebaseErrorCode, identifierType: FirebaseServerAuthUserExistsErrorIdentifierType, identifierValue: string) {
    super(`A user with the provided ${identifierType} already exists.`);
    this.code = code;
    this.identifierType = identifierType;
    this.identifierValue = identifierValue;
  }
}

/**
 * Thrown by {@link AbstractFirebaseServerNewUserService.createNewUser} when Firebase Auth rejects
 * user creation due to invalid input (e.g., a malformed phone number).
 *
 * @example
 * ```typescript
 * try {
 *   await newUserService.initializeNewUser({ email, phone: 'not-e164' });
 * } catch (e) {
 *   if (e instanceof FirebaseServerAuthUserBadInputError) {
 *     console.log(`Bad input (${e.code}): ${e.inputValue}`);
 *   }
 * }
 * ```
 */
export class FirebaseServerAuthUserBadInputError extends BaseError {
  readonly code: FirebaseErrorCode;
  readonly inputValue: string;

  constructor(code: FirebaseErrorCode, inputValue: string, message?: string) {
    super(message ?? `Invalid input for user creation: ${inputValue}`);
    this.code = code;
    this.inputValue = inputValue;
  }
}

/**
 * Thrown by sendSetupDetails() if the user has no setup configuration available, meaning they probably already have accepted their invite or is in an invalid state.
 */
export class FirebaseServerAuthNewUserSendSetupDetailsNoSetupConfigError extends BaseError {
  constructor() {
    super(`This user has no setup configuration available.`);
  }
}

/**
 * Thrown by sendSetupDetails() if the user was recently sent details.
 */
export class FirebaseServerAuthNewUserSendSetupDetailsThrottleError extends BaseError {
  readonly lastSentAt: Date;

  constructor(lastSentAt: Date) {
    super(`This user was recently sent details. Try again later.`);
    this.lastSentAt = lastSentAt;
  }
}

/**
 * Thrown by sendSetupDetails() if the user has already been sent setup details
 * and the `sendSetupDetailsOnce` option was enabled.
 */
export class FirebaseServerAuthNewUserSendSetupDetailsSendOnceError extends BaseError {
  constructor() {
    super(`The user has been sent details before and the sendSetupDetailsOnce configuration was true.`);
  }
}

// MARK: Password Reset Errors
/**
 * Thrown by {@link AbstractFirebaseServerUserPasswordResetService.sendResetContent} when the user
 * has no active password reset claims, meaning no reset has been initiated or it has already been completed.
 */
export class FirebaseServerAuthPasswordResetNoResetConfigError extends BaseError {
  constructor() {
    super(`This user has no active password reset configuration.`);
  }
}

/**
 * Thrown by {@link AbstractFirebaseServerUserPasswordResetService.sendResetContent} when the user
 * was recently sent reset content and the throttle window has not elapsed.
 */
export class FirebaseServerAuthPasswordResetThrottleError extends BaseError {
  readonly lastSentAt: Date;

  constructor(lastSentAt: Date) {
    super(`This user was recently sent password reset details. Try again later.`);
    this.lastSentAt = lastSentAt;
  }
}

/**
 * Thrown by {@link AbstractFirebaseServerUserPasswordResetService.sendResetContent} when the user
 * has already been sent reset content and the `sendResetDetailsOnce` option was enabled.
 */
export class FirebaseServerAuthPasswordResetSendOnceError extends BaseError {
  constructor() {
    super(`The user has been sent password reset details before and the sendResetDetailsOnce configuration was true.`);
  }
}

/**
 * Thrown by {@link AbstractFirebaseServerUserPasswordResetService.completePasswordReset} when the
 * provided reset code does not match the one stored in the user's claims, or no reset is active.
 */
export class FirebaseServerAuthPasswordResetInvalidCodeError extends BaseError {
  constructor() {
    super(`The provided reset password code is invalid or expired.`);
  }
}

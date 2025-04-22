import { BaseError } from 'make-error';

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
 * Thrown by sendSetupDetails() if the user was recently sent details.
 */
export class FirebaseServerAuthNewUserSendSetupDetailsSendOnceError extends BaseError {
  constructor() {
    super(`The user has been sent details before and the sendSetupDetailsOnce configuration was true.`);
  }
}

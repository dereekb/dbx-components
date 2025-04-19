import { type ReadableError } from '../error';
import { BaseError } from 'make-error';
import { type DescriptorAssertionOptions } from './assert';

/**
 * Interface representing an assertion issue that occurred.
 * Contains information about the object and property that failed the assertion.
 * @interface
 */
export interface AssertionIssue {
  /**
   * Object that encountered the issue.
   */
  readonly target: object;
  /**
   * Property key that failed the assertion.
   */
  readonly propertyKey: string;

  readonly options?: DescriptorAssertionOptions;
}

/**
 * Error code for assertion errors.
 */
export const ASSERTION_ERROR_CODE = 'DBX_ASSERTION_ERROR';

/**
 * Error thrown when an assertion fails.
 * Extends BaseError and implements ReadableError interface.
 */
export class AssertionError extends BaseError implements ReadableError {
  readonly code = ASSERTION_ERROR_CODE;

  private readonly _target: object;
  private readonly _property: string;

  constructor(error: { target: object; propertyKey: string }, message: string) {
    super(message);
    this.name = 'AssertionError';
    this._target = error.target;
    this._property = error.propertyKey;
  }

  /**
   * Gets the target object that failed the assertion.
   * @returns The target object
   */
  get target() {
    return this._target;
  }

  /**
   * Gets the property key that failed the assertion.
   * @returns The property key as a string
   */
  get propertyKey(): string {
    return this._property;
  }
}

/**
 * Handler for assertion issues that builds and throws appropriate errors.
 */
export class AssertionIssueHandler {
  /**
   * Handles an assertion issue by throwing an appropriate exception.
   * @param error - The assertion issue to handle
   * @throws AssertionError
   */
  public handle(error: AssertionIssue) {
    throw this.buildException(error);
  }

  /**
   * Builds an AssertionError from an AssertionIssue.
   * @param error - The assertion issue to build an exception from
   * @returns A new AssertionError instance
   */
  public buildException(error: AssertionIssue): AssertionError {
    const message: string = this.buildExceptionString(error);
    return new AssertionError(error, message);
  }

  /**
   * Builds an error message string from an AssertionIssue.
   * Uses the custom message if provided, otherwise creates a default message.
   * @param error - The assertion issue to build a message for
   * @returns The error message string
   */
  protected buildExceptionString(error: AssertionIssue): string {
    let message: string;

    if (error.options && error.options.message) {
      message = error.options.message;
    } else {
      message = "Assertion failed for property '" + error.propertyKey + '".';
    }

    return message;
  }
}

/**
 * Default instance of AssertionIssueHandler used for handling assertion issues.
 * TODO: Allow changing, if needed.
 */
export const ASSERTION_HANDLER: AssertionIssueHandler = new AssertionIssueHandler();

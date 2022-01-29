import { ReadableError } from '../error';
import { BaseError } from 'make-error';
import { DescriptorAssertionOptions } from "./assert";

export interface AssertionIssue {
  /**
   * Object that encoundered the issue.
   */
  target: object;
  /**
   * Property that 
   */
  propertyKey: string;
  options?: DescriptorAssertionOptions;
}

export const ASSERTION_ERROR_CODE = 'DBX_ASSERTION_ERROR';

export class AssertionError extends BaseError implements ReadableError {

  readonly code = ASSERTION_ERROR_CODE;

  private _target: object;
  private _property: string;

  constructor(error: { target: object, propertyKey: string }, message: string) {
    super(message);
    this.name = 'AssertionError';
    this._target = error.target;
    this._property = error.propertyKey;
  }

  get target() {
    return this._target;
  }

  get propertyKey(): string {
    return this._property;
  }

}

export class AssertionIssueHandler {

  public handle(error: AssertionIssue) {
    throw this.buildException(error);
  }

  public buildException(error: AssertionIssue): AssertionError {
    const message: string = this.buildExceptionString(error);
    return new AssertionError(error, message);
  }

  protected buildExceptionString(error: AssertionIssue): string {
    let message: string;

    if (error.options && error.options.message) {
      message = error.options.message;
    } else {
      message = 'Assertion failed for property \'' + error.propertyKey + '".';
    }

    return message;
  }

}

export const ASSERTION_HANDLER: AssertionIssueHandler = new AssertionIssueHandler(); // TODO: Allow changing, if needed.

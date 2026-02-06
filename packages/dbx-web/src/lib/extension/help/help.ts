import { Observable } from 'rxjs';

/**
 * String type for identifying help topics
 */
export type DbxHelpContextString = string;

/**
 * Reference object for tracking help context registrations.
 * Used internally to track multiple directives with the same context string.
 */
export interface DbxHelpContextReference {
  /**
   * Observable of context strings that this reference provides.
   */
  readonly helpContextStrings$: Observable<DbxHelpContextString[]>;
}

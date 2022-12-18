import { FirestoreDocument, FirestoreModelKey } from '@dereekb/firebase';
import { GrantedRole } from '@dereekb/model';
import { ObservableOrValue } from '@dereekb/rxjs';
import { DbxFirebaseInContextFirebaseModelInfoServiceInstance } from './model.context';

/**
 * Used for retrieving contexts for a specific model type/identity.
 */
export abstract class DbxFirebaseModelContextService {
  /**
   * Creates a new DbxFirebaseInContextFirebaseModelInfoServiceInstance for the input model key.
   *
   * @param key$
   */
  abstract modelInfoInstance<D extends FirestoreDocument<any> = any, R extends GrantedRole = GrantedRole>(key$: ObservableOrValue<FirestoreModelKey>): DbxFirebaseInContextFirebaseModelInfoServiceInstance<D, R>;
}

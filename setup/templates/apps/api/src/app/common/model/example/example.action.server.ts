import { FirebaseServerActionsContext } from "@dereekb/firebase-server";
import { AsyncExampleUpdateAction, ExampleDocument, ExampleFirestoreCollections, exampleWithUsername, SetExampleUsernameParams } from 'FIREBASE_COMPONENTS_NAME';

export interface ExampleServerActionsContext extends FirebaseServerActionsContext, ExampleFirestoreCollections { }

export abstract class ExampleServerActions {
  abstract setExampleUsername(params: SetExampleUsernameParams): AsyncExampleUpdateAction<SetExampleUsernameParams>;
}

export function exampleServerActions(context: ExampleServerActionsContext): ExampleServerActions {
  return {
    setExampleUsername: setExampleUsernameFactory(context)
  };
}

// MARK: Actions
export function setExampleUsernameFactory({ firebaseServerActionTransformFunctionFactory, exampleCollection }: ExampleServerActionsContext) {
  const { query: queryExample } = exampleCollection;

  return firebaseServerActionTransformFunctionFactory(SetExampleUsernameParams, async (params: SetExampleUsernameParams) => {
    const { username } = params;

    return async (document: ExampleDocument) => {
      const documentRef = document.documentRef;

      // perform the change in a transaction
      await exampleCollection.firestoreContext.runTransaction(async (transaction) => {
        const docs = await queryExample(exampleWithUsername(username)).getDocs(transaction);

        if (docs.empty) {
          const documentInTransaction = exampleCollection.documentAccessorForTransaction(transaction).loadDocument(documentRef);

          // update the username
          await documentInTransaction.accessor.set({ username }, { merge: true });

        } else {
          throw new Error('This username is already taken.');
        }
      });

      return document;
    };
  });
}

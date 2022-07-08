import { ExampleDocument, SetExampleUsernameParams } from 'FIREBASE_COMPONENTS_NAME';
import { inAuthContext } from '@dereekb/firebase-server';
import { onCallWithAPP_CODE_PREFIXNestContext } from '../function';
import { userHasNoExampleError } from '../../common/model/example/example.error';
import { exampleForUser } from './example.util';


export const exampleSetUsername = onCallWithAPP_CODE_PREFIXNestContext<SetExampleUsernameParams>(
  inAuthContext(async (request) => {
    const { nest, auth, data } = request;
    const setExampleUsername = await nest.exampleActions.setExampleUsername(data);

    const uid = auth?.uid!;

    const exampleDocument: ExampleDocument = exampleForUser(nest, uid);
    const exists = await exampleDocument.accessor.exists();

    if (!exists) {
      throw userHasNoExampleError(uid);
    }

    await setExampleUsername(exampleDocument);
  })
);

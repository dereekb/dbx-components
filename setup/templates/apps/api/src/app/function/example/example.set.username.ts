import { ExampleDocument, SetExampleUsernameParams } from 'FIREBASE_COMPONENTS_NAME';
import { inAuthContext } from '@dereekb/firebase-server';
import { onCallWithAPP_CODE_PREFIXNestContext } from '../function';
import { userHasNoExampleError } from '../../common/model/example/example.error';
import { exampleForUser } from './example.util';


export const exampleSetUsername = onCallWithAPP_CODE_PREFIXNestContext(inAuthContext(async (nest, data: SetExampleUsernameParams, context) => {
  const setExampleUsername = await nest.exampleActions.setExampleUsername(data);

  const uid = context.auth?.uid!;

  const exampleDocument: ExampleDocument = exampleForUser(nest, uid);
  const exists = await exampleDocument.accessor.exists();

  if (!exists) {
    throw userHasNoExampleError(uid);
  }

  await setExampleUsername(exampleDocument);
}));

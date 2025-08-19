import { DemoCreateModelFunction } from '../function';
import { OnCallCreateModelResult } from '@dereekb/firebase';
import { optionalAuthContext } from '@dereekb/firebase-server';

export const createNotification: DemoCreateModelFunction<{}> = optionalAuthContext(async (request) => {
  const { nest, auth, data } = request;

  // Does nothing. This is just to demonstrate the optionalAuthContext function and handling.

  const response: OnCallCreateModelResult = {
    modelKeys: []
  };

  return response;
});

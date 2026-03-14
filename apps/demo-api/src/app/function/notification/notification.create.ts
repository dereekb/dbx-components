import { type DemoCreateModelFunction } from '../function.context';
import { type OnCallCreateModelResult } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';

export const createNotification: DemoCreateModelFunction<{}> = withApiDetails({
  optionalAuth: true,
  mcp: { description: 'Create a notification (no auth required)' },
  fn: async (request) => {
    const { nest, auth, data } = request;

    // Does nothing. This is just to demonstrate withApiDetails with optionalAuth.

    const response: OnCallCreateModelResult = {
      modelKeys: []
    };

    return response;
  }
});

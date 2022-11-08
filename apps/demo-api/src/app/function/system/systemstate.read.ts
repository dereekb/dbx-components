import { onCallCreateModelResultWithDocs } from '@dereekb/firebase';
import { assertIsAdminInRequest, assertIsAdminOrTargetUserInRequestData } from '@dereekb/firebase-server';
import { ExampleReadParams, ExampleReadResponse } from '@dereekb/demo-firebase';
import { DemoReadModelFunction } from '../function';

export const systemStateExampleRead: DemoReadModelFunction<ExampleReadParams, ExampleReadResponse> = async (request) => {
  const { nest, data, auth } = request;

  // performed read.

  return {
    read: true,
    message: data.message
  };
};

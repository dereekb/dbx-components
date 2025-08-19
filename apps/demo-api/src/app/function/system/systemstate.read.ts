import { ExampleReadParams, ExampleReadResponse } from 'demo-firebase';
import { DemoReadModelFunction } from '../function';
import { OnCallSpecifierHandlerNestContextRequestWithOptionalAuth } from '@dereekb/firebase-server';

export const systemStateExampleRead: DemoReadModelFunction<ExampleReadParams, ExampleReadResponse> = async (request) => {
  const { nest, data, auth } = request;

  // performed read.

  return {
    read: true,
    message: data.message
  };
};

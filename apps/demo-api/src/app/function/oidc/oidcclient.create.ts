import { type CreateOidcClientParams, type CreateOidcClientResult } from '@dereekb/firebase';
import { type DemoCreateModelFunction } from '../function.context';

export const createOidcClient: DemoCreateModelFunction<CreateOidcClientParams, CreateOidcClientResult> = async (request) => {
  const { nest, data } = request;
  const createFn = await nest.oidcModelServerActions.createOidcClient(data);
  return createFn();
};

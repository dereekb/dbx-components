import { type DeleteFormSpaceParams, deleteFormSpaceParamsType } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { type DemoDeleteModelFunction } from '../function.context';

export const formSpaceDelete: DemoDeleteModelFunction<DeleteFormSpaceParams> = withApiDetails({
  inputType: deleteFormSpaceParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    const deleteFormSpace = await nest.formSpaceServerActions.deleteFormSpace(data);
    const formSpaceDocument = await nest.useModel('formSpace', {
      request,
      key: data.key,
      roles: 'delete',
      use: (x) => x.document
    });

    await deleteFormSpace(formSpaceDocument);
  }
});

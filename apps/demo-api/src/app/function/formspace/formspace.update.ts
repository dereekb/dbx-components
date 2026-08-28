import { type SubmitFormSpaceParams, type SubmitFormSpaceResult, type UpdateFormSpaceParams, submitFormSpaceParamsType, updateFormSpaceParamsType } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { type DemoUpdateModelFunction } from '../function.context';

export const formSpaceUpdate: DemoUpdateModelFunction<UpdateFormSpaceParams> = withApiDetails({
  inputType: updateFormSpaceParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    const updateFormSpace = await nest.formSpaceServerActions.updateFormSpace(data);
    const formSpaceDocument = await nest.useModel('formSpace', {
      request,
      key: data.key,
      roles: 'update',
      use: (x) => x.document
    });

    await updateFormSpace(formSpaceDocument);
  }
});

/**
 * Submits a FormSpace, locking it and queueing its type's handler.
 *
 * Gated on `submit` rather than `update`: submission is the one-way door, and an owner who may edit a draft
 * is not necessarily the party allowed to finalize it.
 */
export const formSpaceSubmit: DemoUpdateModelFunction<SubmitFormSpaceParams, SubmitFormSpaceResult> = withApiDetails({
  inputType: submitFormSpaceParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    const submitFormSpace = await nest.formSpaceServerActions.submitFormSpace(data);
    const formSpaceDocument = await nest.useModel('formSpace', {
      request,
      key: data.key,
      roles: 'submit',
      use: (x) => x.document
    });

    return submitFormSpace(formSpaceDocument);
  }
});

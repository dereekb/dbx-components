import { type RemoveFormSpaceFileParams, type SubmitFormSpaceParams, type SubmitFormSpaceResult, type UpdateFormSpaceParams, removeFormSpaceFileParamsType, submitFormSpaceParamsType, updateFormSpaceParamsType } from '@dereekb/firebase';
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

/**
 * Removes one uploaded file from a FormSpace slot.
 *
 * Gated on `update` rather than `submit`: removing a file is editing a draft, and the owner who uploaded it
 * is the one who should be able to take it back out.
 */
export const formSpaceRemoveFile: DemoUpdateModelFunction<RemoveFormSpaceFileParams> = withApiDetails({
  inputType: removeFormSpaceFileParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    const removeFormSpaceFile = await nest.formSpaceServerActions.removeFormSpaceFile(data);
    const formSpaceDocument = await nest.useModel('formSpace', {
      request,
      key: data.key,
      roles: 'update',
      use: (x) => x.document
    });

    await removeFormSpaceFile(formSpaceDocument);
  }
});

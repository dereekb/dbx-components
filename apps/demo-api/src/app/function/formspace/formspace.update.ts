import { type FirebaseAuthUserId, type LockFormSpaceParams, type RemoveFormSpaceFileParams, type ReopenFormSpaceParams, type SubmitFormSpaceParams, type SubmitFormSpaceResult, type UpdateFormSpaceParams, lockFormSpaceParamsType, removeFormSpaceFileParamsType, reopenFormSpaceParamsType, submitFormSpaceParamsType, updateFormSpaceParamsType } from '@dereekb/firebase';
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
 * Reopens a submitted FormSpace back into an editable draft.
 *
 * Gated on `reopen` rather than `submit` or `update`: undoing the one-way door is not the same privilege as
 * walking through it, and in a two-party flow the reviewer may hold this without holding either.
 *
 * The role only decides who may ASK. Whether this particular space is still reopenable is the type's
 * policy, re-asserted inside the action's transaction — a role map has neither a clock nor the type
 * registry to answer it with.
 *
 * The caller's uid comes from the request, never the body: it is what `rby` records.
 */
export const formSpaceReopen: DemoUpdateModelFunction<ReopenFormSpaceParams> = withApiDetails({
  inputType: reopenFormSpaceParamsType,
  fn: async (request) => {
    const { nest, data } = request;
    const uid = request.auth.uid as FirebaseAuthUserId;

    const reopenFormSpace = await nest.formSpaceServerActions.reopenFormSpace(data);
    const formSpaceDocument = await nest.useModel('formSpace', {
      request,
      key: data.key,
      roles: 'reopen',
      use: (x) => x.document
    });

    await reopenFormSpace(formSpaceDocument, { uid });
  }
});

/**
 * Locks a FormSpace's submission immediately, ending its reopen window early.
 *
 * Separate from `reopen` on purpose. Making a submission final is the opposite decision from undoing it,
 * and the party who submitted should not automatically hold it over the party reviewing.
 */
export const formSpaceLock: DemoUpdateModelFunction<LockFormSpaceParams> = withApiDetails({
  inputType: lockFormSpaceParamsType,
  fn: async (request) => {
    const { nest, data } = request;
    const uid = request.auth.uid as FirebaseAuthUserId;

    const lockFormSpace = await nest.formSpaceServerActions.lockFormSpace(data);
    const formSpaceDocument = await nest.useModel('formSpace', {
      request,
      key: data.key,
      roles: 'lock',
      use: (x) => x.document
    });

    await lockFormSpace(formSpaceDocument, { uid });
  }
});

/**
 * Removes one uploaded file from a FormSpace slot.
 *
 * TWO gates, in order. `removeFile` is the space-level role and is what this asks `useModel` for — separate
 * from `update` so a member of a SHARED space can take their own file back out without also being able to
 * rewrite the form everybody shares. The action behind it then applies the type's `FormSpaceFileAccess` to
 * the specific file, which is the check that keeps one signer out of another's photos.
 *
 * The caller's uid comes from the request, never the body: it IS the per-file decision.
 */
export const formSpaceRemoveFile: DemoUpdateModelFunction<RemoveFormSpaceFileParams> = withApiDetails({
  inputType: removeFormSpaceFileParamsType,
  fn: async (request) => {
    const { nest, data } = request;
    const uid = request.auth.uid as FirebaseAuthUserId;

    const removeFormSpaceFile = await nest.formSpaceServerActions.removeFormSpaceFile(data);
    const formSpaceDocument = await nest.useModel('formSpace', {
      request,
      key: data.key,
      roles: 'removeFile',
      use: (x) => x.document
    });

    await removeFormSpaceFile(formSpaceDocument, { uid });
  }
});

import { type RecomputeStorageFileChecksumsParams, type RecomputeStorageFileChecksumsResult, recomputeStorageFileChecksumsParamsType } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { type DemoInvokeModelFunction } from '../function.context';

/**
 * Demo invoke handler — exercises the sixth call type end-to-end.
 *
 * Permission check follows the same `useModel()` pattern as update handlers
 * since the OIDC `model.invoke` scope and per-model role gate access at the
 * scope + role layer respectively.
 */
export const storageFileRecomputeChecksums: DemoInvokeModelFunction<RecomputeStorageFileChecksumsParams, RecomputeStorageFileChecksumsResult> = withApiDetails({
  inputType: recomputeStorageFileChecksumsParamsType,
  mcp: {
    description: 'Recompute checksums for a single StorageFile record. Use `force: true` to recompute even when a checksum is already stored.'
  },
  fn: async (request) => {
    const { nest, data } = request;

    const storageFileDocument = await nest.useModel('storageFile', {
      request,
      key: data.key,
      roles: 'update',
      use: (x) => x.document
    });

    return {
      key: storageFileDocument.documentRef.path,
      recomputed: data.force === true
    };
  }
});

import { type SyncStorageFileWithGroupsParams, type SyncStorageFileWithGroupsResult, type ProcessStorageFileParams, type UpdateStorageFileParams, processStorageFileParamsType, syncStorageFileWithGroupsParamsType, updateStorageFileParamsType } from '@dereekb/firebase';
import { type DemoUpdateModelFunction } from '../function.context';
import { withApiDetails } from '@dereekb/firebase-server';

export const storageFileUpdate: DemoUpdateModelFunction<UpdateStorageFileParams> = withApiDetails({
  inputType: updateStorageFileParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    const updateStorageFile = await nest.storageFileServerActions.updateStorageFile(data);
    const storageFileDocument = await nest.useModel('storageFile', {
      request,
      key: data.key,
      roles: 'update',
      use: (x) => x.document
    });

    await updateStorageFile(storageFileDocument);
  }
});

export const storageFileProcess: DemoUpdateModelFunction<ProcessStorageFileParams> = withApiDetails({
  inputType: processStorageFileParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    const processStorageFile = await nest.storageFileServerActions.processStorageFile(data);
    const storageFileDocument = await nest.useModel('storageFile', {
      request,
      key: data.key,
      roles: 'process',
      use: (x) => x.document
    });

    await processStorageFile(storageFileDocument);
  }
});

export const storageFileSyncWithGroups: DemoUpdateModelFunction<SyncStorageFileWithGroupsParams, SyncStorageFileWithGroupsResult> = withApiDetails({
  inputType: syncStorageFileWithGroupsParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    const syncStorageFileWithGroups = await nest.storageFileServerActions.syncStorageFileWithGroups(data);
    const storageFileDocument = await nest.useModel('storageFile', {
      request,
      key: data.key,
      roles: data.force ? 'forceSyncWithGroups' : 'syncWithGroups',
      use: (x) => x.document
    });

    return syncStorageFileWithGroups(storageFileDocument);
  }
});

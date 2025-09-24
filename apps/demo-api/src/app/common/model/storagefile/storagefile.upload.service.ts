import { StorageFileInitializeFromUploadService, StorageFileInitializeFromUploadServiceConfig, storageFileInitializeFromUploadService } from '@dereekb/firebase-server/model';
import { DemoFirebaseServerActionsContext } from '../../firebase/action.context';

export function demoStorageFileUploadServiceFactory(demoFirebaseServerActionsContext: DemoFirebaseServerActionsContext): StorageFileInitializeFromUploadService {
  const storageFileUploadServiceConfig: StorageFileInitializeFromUploadServiceConfig = {
    validate: true,
    determiner: [],
    processors: []
  };

  return storageFileInitializeFromUploadService(storageFileUploadServiceConfig);
}

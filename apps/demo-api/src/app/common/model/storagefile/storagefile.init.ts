import { type MakeTemplateForStorageFileRelatedModelInitializationFunctionInput, type MakeTemplateForStorageFileRelatedModelInitializationFunctionResult, type StorageFileInitServerActionsContextConfig } from '@dereekb/firebase-server/model';
import { type DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { type StorageFileGroup } from '@dereekb/firebase';
import { profileIdentity } from 'demo-firebase';

/**
 * Builds the storage file initialization config that teaches the storage file system
 * how to create StorageFileGroup documents for demo models (currently Profile).
 * Determines whether zip files should be created for storage file groups.
 *
 * @param context - server actions context providing Firestore collection accessors
 * @returns a config with the initialization function for storage file groups
 */
export function demoStorageFileInitServerActionsContextConfig(context: DemoFirebaseServerActionsContext): StorageFileInitServerActionsContextConfig {
  const { profileCollection: _profileCollection } = context;

  const makeTemplateForStorageFileModelInitialization = async function (input: MakeTemplateForStorageFileRelatedModelInitializationFunctionInput): Promise<MakeTemplateForStorageFileRelatedModelInitializationFunctionResult<any>> {
    const { collectionName, modelKey: _modelKey } = input;
    let result: MakeTemplateForStorageFileRelatedModelInitializationFunctionResult<any> = null; // invalid

    const initProfileStorageFileGroup = () => {
      // const profileDocument = profileCollection.documentAccessor().loadDocumentForKey(modelKey);

      const result: MakeTemplateForStorageFileRelatedModelInitializationFunctionResult<StorageFileGroup> = {
        z: true // should create a zip file
      };

      return result;
    };

    switch (collectionName) {
      case profileIdentity.collectionName:
        result = initProfileStorageFileGroup();
        break;
    }

    return result;
  };

  const config: StorageFileInitServerActionsContextConfig = {
    makeTemplateForStorageFileGroupInitialization: makeTemplateForStorageFileModelInitialization
  };

  return config;
}

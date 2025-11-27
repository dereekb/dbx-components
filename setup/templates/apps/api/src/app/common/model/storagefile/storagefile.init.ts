import { MakeTemplateForStorageFileRelatedModelInitializationFunctionInput, MakeTemplateForStorageFileRelatedModelInitializationFunctionResult, StorageFileInitServerActionsContextConfig } from '@dereekb/firebase-server/model';
import { type APP_CODE_PREFIXFirebaseServerActionsContext } from '../../firebase/action.context';
import { StorageFileGroup } from '@dereekb/firebase';
import { profileIdentity } from 'FIREBASE_COMPONENTS_NAME';

export function APP_CODE_PREFIX_CAMELStorageFileInitServerActionsContextConfig(context: APP_CODE_PREFIXFirebaseServerActionsContext): StorageFileInitServerActionsContextConfig {
  const { profileCollection } = context;

  const makeTemplateForStorageFileModelInitialization = async function (input: MakeTemplateForStorageFileRelatedModelInitializationFunctionInput): Promise<MakeTemplateForStorageFileRelatedModelInitializationFunctionResult<any>> {
    const { collectionName, modelKey } = input;
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

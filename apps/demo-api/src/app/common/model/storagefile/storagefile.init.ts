import { MakeTemplateForStorageFileRelatedModelInitializationFunctionInput, MakeTemplateForStorageFileRelatedModelInitializationFunctionResult, StorageFileInitServerActionsContextConfig } from '@dereekb/firebase-server/model';
import { type DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { StorageFileGroup } from '@dereekb/firebase';
import { profileIdentity } from 'demo-firebase';

export function demoStorageFileInitServerActionsContextConfig(context: DemoFirebaseServerActionsContext): StorageFileInitServerActionsContextConfig {
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

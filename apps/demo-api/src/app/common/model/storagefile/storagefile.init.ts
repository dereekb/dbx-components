import { type MakeTemplateForStorageFileRelatedModelInitializationFunctionInput, type MakeTemplateForStorageFileRelatedModelInitializationFunctionResult, type StorageFileInitServerActionsContextConfig } from '@dereekb/firebase-server/model';
import { type DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { type StorageFileGroup, formSpaceIdentity } from '@dereekb/firebase';
import { profileIdentity } from 'demo-firebase';

/**
 * Builds the storage file initialization config that teaches the storage file system
 * how to create StorageFileGroup documents for demo models (currently Profile).
 * Determines whether zip files should be created for storage file groups.
 *
 * @param context - Server actions context providing Firestore collection accessors.
 * @returns A config with the initialization function for storage file groups.
 */
export function demoStorageFileInitServerActionsContextConfig(context: DemoFirebaseServerActionsContext): StorageFileInitServerActionsContextConfig {
  const { profileCollection: _profileCollection, formSpaceCollection } = context;

  const makeTemplateForStorageFileModelInitialization = async function (input: MakeTemplateForStorageFileRelatedModelInitializationFunctionInput): Promise<MakeTemplateForStorageFileRelatedModelInitializationFunctionResult<any>> {
    const { collectionName } = input;
    let result: MakeTemplateForStorageFileRelatedModelInitializationFunctionResult<any> = null; // invalid

    const initProfileStorageFileGroup = () => {
      // const profileDocument = profileCollection.documentAccessor().loadDocumentForKey(modelKey);

      const result: MakeTemplateForStorageFileRelatedModelInitializationFunctionResult<StorageFileGroup> = {
        z: true // should create a zip file
      };

      return result;
    };

    /**
     * A FormSpace's group inherits the space's ownership key, so the group is readable by whoever owns the
     * form. Returning false when the space is gone lets the group self-delete rather than linger as an
     * orphan pointing at files the delete sweep has already flagged.
     */
    const initFormSpaceStorageFileGroup = async () => {
      const formSpace = await formSpaceCollection.documentAccessor().loadDocumentForKey(input.modelKey).snapshotData();
      let groupResult: MakeTemplateForStorageFileRelatedModelInitializationFunctionResult<StorageFileGroup>;

      if (formSpace == null) {
        groupResult = false; // the FormSpace is gone; let the group clean itself up
      } else {
        groupResult = {
          o: formSpace.o,
          z: false // form attachments are downloaded individually, so there is nothing to zip
        };
      }

      return groupResult;
    };

    switch (collectionName) {
      case profileIdentity.collectionName:
        result = initProfileStorageFileGroup();
        break;
      case formSpaceIdentity.collectionName:
        result = await initFormSpaceStorageFileGroup();
        break;
    }

    return result;
  };

  const config: StorageFileInitServerActionsContextConfig = {
    makeTemplateForStorageFileGroupInitialization: makeTemplateForStorageFileModelInitialization
  };

  return config;
}

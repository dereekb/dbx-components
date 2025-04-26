import { MAKE_TEMPLATE_FOR_NOTIFICATION_RELATED_MODEL_INITIALIZATION_FUNCTION_DELETE_RESPONSE, MakeTemplateForNotificationRelatedModelInitializationFunctionInput, MakeTemplateForNotificationRelatedModelInitializationFunctionResult, NotificationInitServerActionsContextConfig } from '@dereekb/firebase-server/model';
import { APP_CODE_PREFIXFirebaseServerActionsContext } from '../../firebase/action.context';
import { NotificationBoxRecipient, firestoreModelKey, newNotificationBoxRecipientForUid } from '@dereekb/firebase';
import { profileIdentity } from 'FIREBASE_COMPONENTS_NAME';

export function APP_CODE_PREFIXNotificationInitServerActionsContextConfig(context: APP_CODE_PREFIXFirebaseServerActionsContext): NotificationInitServerActionsContextConfig {
  const { profileCollection } = context;

  const makeTemplateForNotificationModelInitialization = async function (input: MakeTemplateForNotificationRelatedModelInitializationFunctionInput): Promise<MakeTemplateForNotificationRelatedModelInitializationFunctionResult<any>> {
    const { collectionName, modelKey } = input;
    let result: MakeTemplateForNotificationRelatedModelInitializationFunctionResult<any> = null; // invalid

    const initProfileNotificationBox = () => {
      const profileDocument = profileCollection.documentAccessor().loadDocumentForKey(modelKey);
      const r: NotificationBoxRecipient[] = [newNotificationBoxRecipientForUid(profileDocument.id, 0)];

      return {
        o: profileDocument.key,
        r
      };
    };

    switch (collectionName) {
      case profileIdentity.collectionName:
        result = initProfileNotificationBox();
        break;
    }

    return result;
  };

  const config: NotificationInitServerActionsContextConfig = {
    makeTemplateForNotificationBoxInitialization: makeTemplateForNotificationModelInitialization,
    makeTemplateForNotificationSummaryInitialization: makeTemplateForNotificationModelInitialization
  };

  return config;
}

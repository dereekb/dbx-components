import { MakeTemplateForNotificationRelatedModelInitializationFunctionInput, MakeTemplateForNotificationRelatedModelInitializationFunctionResult, NotificationInitServerActionsContextConfig } from '@dereekb/firebase-server/model';
import { DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { NotificationBoxRecipient, newNotificationBoxRecipientForUid } from '@dereekb/firebase';
import { profileIdentity } from '@dereekb/demo-firebase';

export function demoNotificationInitServerActionsContextConfig(context: DemoFirebaseServerActionsContext): NotificationInitServerActionsContextConfig {
  const { profileCollection } = context;

  const makeTemplateForNotificationModelInitialization = async function (input: MakeTemplateForNotificationRelatedModelInitializationFunctionInput): Promise<MakeTemplateForNotificationRelatedModelInitializationFunctionResult<any>> {
    const { collectionName, modelKey } = input;
    let result: MakeTemplateForNotificationRelatedModelInitializationFunctionResult<any>;

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

import { appNotificationTemplateTypeInfoRecordService, firestoreModelIdentity, noContentNotificationMessageFunctionFactory, type NotificationTemplateTypeInfo } from '@dereekb/firebase';
import { assertNotificationTemplateServiceTemplateTypes, NotificationTemplateService, notificationTemplateServiceTemplateTypeMismatches } from './notification.config.service';
import { notificationServerActionsContextFactory } from './notification.module';
import { type BaseNotificationServerActionsContext } from './notification.action.server';
import { type NotificationSendService } from './notification.send.service';
import { type NotificationTaskService } from './notification.task.service';
import { type NotificationExpediteService } from './notification.expedite.service';

const profileIdentity = firestoreModelIdentity('profile', 'p');
const KNOWN_TYPE_INFO: NotificationTemplateTypeInfo = { type: 'known', name: 'Known', description: 'Known type.', notificationModelIdentity: profileIdentity };
const NO_FACTORY_TYPE_INFO: NotificationTemplateTypeInfo = { type: 'noFactory', name: 'No Factory', description: 'Type without a message factory.', notificationModelIdentity: profileIdentity };

const factory = noContentNotificationMessageFunctionFactory();
const recordService = appNotificationTemplateTypeInfoRecordService({ known: KNOWN_TYPE_INFO });

describe('notificationTemplateServiceTemplateTypeMismatches()', () => {
  it('should return the configured template types that have no template type info', () => {
    const notificationTemplateService = new NotificationTemplateService({ unknownDefault: factory }, [
      { type: 'known', factory },
      { type: 'unknown', factory }
    ]);

    const result = notificationTemplateServiceTemplateTypeMismatches({ notificationTemplateService, appNotificationTemplateTypeInfoRecordService: recordService });
    expect(result.unknownTemplateTypes.sort()).toEqual(['unknown', 'unknownDefault']);
    expect(result.unconfiguredTemplateTypes).toEqual([]);
  });

  it('should return the template types with info that have no message factory', () => {
    const notificationTemplateService = new NotificationTemplateService(undefined, [{ type: 'known', factory }]);
    const recordServiceWithNoFactoryType = appNotificationTemplateTypeInfoRecordService({ known: KNOWN_TYPE_INFO, noFactory: NO_FACTORY_TYPE_INFO });

    const result = notificationTemplateServiceTemplateTypeMismatches({ notificationTemplateService, appNotificationTemplateTypeInfoRecordService: recordServiceWithNoFactoryType });
    expect(result.unknownTemplateTypes).toEqual([]);
    expect(result.unconfiguredTemplateTypes).toEqual(['noFactory']);
  });
});

describe('assertNotificationTemplateServiceTemplateTypes()', () => {
  it('should not throw when every template type has both info and a message factory', () => {
    const notificationTemplateService = new NotificationTemplateService(undefined, [{ type: 'known', factory }]);
    expect(() => assertNotificationTemplateServiceTemplateTypes({ notificationTemplateService, appNotificationTemplateTypeInfoRecordService: recordService })).not.toThrow();
  });

  it('should throw naming a template type that has a message factory but no info', () => {
    const notificationTemplateService = new NotificationTemplateService(undefined, [
      { type: 'known', factory },
      { type: 'unknown', factory }
    ]);

    expect(() => assertNotificationTemplateServiceTemplateTypes({ notificationTemplateService, appNotificationTemplateTypeInfoRecordService: recordService })).toThrow(/without a NotificationTemplateTypeInfo: unknown/);
  });

  it('should throw naming a template type that has info but no message factory', () => {
    const notificationTemplateService = new NotificationTemplateService(undefined, []);
    expect(() => assertNotificationTemplateServiceTemplateTypes({ notificationTemplateService, appNotificationTemplateTypeInfoRecordService: recordService })).toThrow(/without a message factory: known/);
  });
});

describe('notificationServerActionsContextFactory()', () => {
  function createContext(context: object, notificationTemplateService: NotificationTemplateService) {
    return notificationServerActionsContextFactory(context as BaseNotificationServerActionsContext, notificationTemplateService, {} as NotificationSendService, {} as NotificationTaskService, {} as NotificationExpediteService);
  }

  it('should throw when the template service does not match the context template type info', () => {
    const notificationTemplateService = new NotificationTemplateService(undefined, []);
    expect(() => createContext({ appNotificationTemplateTypeInfoRecordService: recordService }, notificationTemplateService)).toThrow();
  });

  it('should skip the check when the context has no template type info', () => {
    const notificationTemplateService = new NotificationTemplateService(undefined, [{ type: 'unknown', factory }]);
    expect(() => createContext({}, notificationTemplateService)).not.toThrow();
  });
});

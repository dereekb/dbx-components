import { appNotificationTaskBotScriptConfigService, notificationTaskBotScriptConfigRecord, notificationTaskComplete } from '@dereekb/firebase';
import { type NotificationTaskBotScriptProcessorConfig, notificationTaskBotRunNotificationTaskHandler } from './notification.taskbot.task.service.handler';
import { type NotificationTaskBotServerActionsContext } from './notification.taskbot.action.server';

describe('notificationTaskBotRunNotificationTaskHandler()', () => {
  // creating the handler only reads the script registry from the context
  const notificationTaskBotContext = {
    appNotificationTaskBotScriptConfigService: appNotificationTaskBotScriptConfigService(notificationTaskBotScriptConfigRecord([{ scriptType: 'ping' }, { scriptType: 'reminder' }]))
  } as unknown as NotificationTaskBotServerActionsContext;

  function processor(target: string): NotificationTaskBotScriptProcessorConfig {
    return { target, flow: [{ subtask: 'only', fn: async () => notificationTaskComplete() }] };
  }

  it('should create the handler when the processors match the registry', () => {
    const handler = notificationTaskBotRunNotificationTaskHandler({ processors: [processor('ping'), processor('reminder')], notificationTaskBotContext });
    expect(handler.flow).toHaveLength(2);
  });

  it('should throw naming a registered script type that has no processor', () => {
    expect(() => notificationTaskBotRunNotificationTaskHandler({ processors: [processor('ping')], notificationTaskBotContext })).toThrow(/registered script types: reminder/);
  });

  it('should throw naming a processor target that is not a registered script type', () => {
    expect(() => notificationTaskBotRunNotificationTaskHandler({ processors: [processor('ping'), processor('reminder'), processor('unknown')], notificationTaskBotContext })).toThrow(/not registered script types: unknown/);
  });

  it('should throw when a target listed in validate has no processor', () => {
    expect(() => notificationTaskBotRunNotificationTaskHandler({ processors: [processor('ping'), processor('reminder')], validate: ['ping', 'reminder', 'missing'], notificationTaskBotContext })).toThrow(/validate: missing/);
  });
});

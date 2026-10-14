import { notificationTaskComplete } from '@dereekb/firebase';
import { notificationTaskSubtaskNotificationTaskHandlerFactory } from './notification.task.subtask.handler';

describe('notificationTaskSubtaskNotificationTaskHandlerFactory()', () => {
  const factory = notificationTaskSubtaskNotificationTaskHandlerFactory<any, any, any>({
    taskType: 'subtask',
    subtaskHandlerFunctionName: 'testSubtaskHandler',
    inputFunction: () => ({}),
    defaultCleanup: () => ({ cleanupSuccess: true }),
    cleanupFunction: async () => notificationTaskComplete()
  });

  const processor = { target: 'handled', flow: [{ subtask: 'only', fn: async () => notificationTaskComplete() }] };

  it('should create the handler when every target in validate has a processor', () => {
    const handler = factory({ validate: ['handled'], processors: [processor] });
    expect(handler.type).toBe('subtask');
  });

  it('should throw naming a target in validate that has no processor', () => {
    expect(() => factory({ validate: ['handled', 'missing'], processors: [processor] })).toThrow(/validate: missing/);
  });

  it('should not check anything without validate', () => {
    expect(() => factory({ processors: [processor] })).not.toThrow();
  });
});

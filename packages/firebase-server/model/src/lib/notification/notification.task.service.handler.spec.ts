import { notificationTaskService } from './notification.task.service.handler';

describe('notificationTaskService()', () => {
  const handler = { type: 'handled', flow: [{ fn: async () => ({ completion: true }) }] };

  it('should create the service when every task type in validate has a handler', () => {
    const service = notificationTaskService({ validate: ['handled'], handlers: [handler] });
    expect(service.isKnownNotificationTaskType('handled')).toBe(true);
  });

  it('should throw naming a task type in validate that has no handler', () => {
    expect(() => notificationTaskService({ validate: ['handled', 'missing'], handlers: [handler] })).toThrow(/validate: missing/);
  });

  it('should not check anything without validate', () => {
    expect(() => notificationTaskService({ handlers: [handler] })).not.toThrow();
  });
});

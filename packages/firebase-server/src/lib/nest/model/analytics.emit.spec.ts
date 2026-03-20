import { callWithAnalytics, onCallAnalyticsEmitterInstance } from './analytics.emit';
import { type OnCallModelFunctionAnalyticsDetails, type OnCallAnalyticsContext } from './analytics.details';
import { OnCallModelAnalyticsService, type OnCallModelAnalyticsEvent } from './analytics.handler';

// MARK: Test Helpers
class MockAnalyticsService extends OnCallModelAnalyticsService {
  readonly events: OnCallModelAnalyticsEvent[] = [];

  handleOnCallAnalyticsEvent(event: OnCallModelAnalyticsEvent): void {
    this.events.push(event);
  }
}

function mockContext(overrides?: Partial<OnCallAnalyticsContext>): OnCallAnalyticsContext {
  return {
    call: 'create',
    modelType: 'widget',
    specifier: undefined,
    uid: 'test-uid',
    request: {} as any,
    ...overrides
  };
}

// MARK: Tests
describe('analytics.emit', () => {
  // MARK: onCallAnalyticsEmitterInstance
  describe('onCallAnalyticsEmitterInstance()', () => {
    it('should create an emitter that sends events with auto-filled context', () => {
      const service = new MockAnalyticsService();
      const context = mockContext();
      const emitterFactory = onCallAnalyticsEmitterInstance({ service, context });
      const emitter = emitterFactory('success');

      emitter.sendEvent('Widget Created', { key: 'value' });

      expect(service.events).toHaveLength(1);
      expect(service.events[0].event).toBe('Widget Created');
      expect(service.events[0].lifecycle).toBe('success');
      expect(service.events[0].call).toBe('create');
      expect(service.events[0].modelType).toBe('widget');
      expect(service.events[0].uid).toBe('test-uid');
      expect(service.events[0].properties).toEqual({ key: 'value' });
    });

    it('should support sendEventType with no properties', () => {
      const service = new MockAnalyticsService();
      const emitterFactory = onCallAnalyticsEmitterInstance({ service, context: mockContext() });
      const emitter = emitterFactory('triggered');

      emitter.sendEventType('Action Started');

      expect(service.events).toHaveLength(1);
      expect(service.events[0].event).toBe('Action Started');
      expect(service.events[0].properties).toBeUndefined();
    });

    it('should create emitters with different lifecycle stages from the same factory', () => {
      const service = new MockAnalyticsService();
      const emitterFactory = onCallAnalyticsEmitterInstance({ service, context: mockContext() });

      emitterFactory('triggered').sendEventType('Start');
      emitterFactory('success').sendEventType('Done');

      expect(service.events).toHaveLength(2);
      expect(service.events[0].lifecycle).toBe('triggered');
      expect(service.events[1].lifecycle).toBe('success');
    });
  });

  // MARK: callWithAnalytics
  describe('callWithAnalytics()', () => {
    let service: MockAnalyticsService;
    let context: OnCallAnalyticsContext;

    beforeEach(() => {
      service = new MockAnalyticsService();
      context = mockContext();
    });

    // MARK: Sync success
    it('should call onSuccess lifecycle for sync success', async () => {
      const details: OnCallModelFunctionAnalyticsDetails = {
        onSuccess: (emitter, _request, result) => {
          emitter.sendEvent('Widget Created', { result });
        }
      };

      const result = await callWithAnalytics({ service, details, context, execute: () => 'sync-result' });
      expect(result).toBe('sync-result');

      expect(service.events).toHaveLength(1);
      expect(service.events[0].event).toBe('Widget Created');
      expect(service.events[0].lifecycle).toBe('success');
      expect(service.events[0].properties).toEqual({ result: 'sync-result' });
    });

    // MARK: Async success
    it('should call onSuccess lifecycle for async success', async () => {
      const details: OnCallModelFunctionAnalyticsDetails = {
        onSuccess: (emitter, _request, result) => {
          emitter.sendEvent('Async Created', { result });
        }
      };

      const result = await callWithAnalytics({ service, details, context, execute: () => Promise.resolve('async-result') });
      expect(result).toBe('async-result');

      expect(service.events).toHaveLength(1);
      expect(service.events[0].event).toBe('Async Created');
      expect(service.events[0].properties).toEqual({ result: 'async-result' });
    });

    // MARK: Sync error
    it('should call onError lifecycle for sync error and re-throw', async () => {
      const testError = new Error('sync failure');
      const details: OnCallModelFunctionAnalyticsDetails = {
        onError: (emitter, _request, error) => {
          emitter.sendEvent('Widget Failed', { errorMsg: (error as Error).message });
        }
      };

      await expect(
        callWithAnalytics({
          service,
          details,
          context,
          execute: () => {
            throw testError;
          }
        })
      ).rejects.toThrow(testError);

      expect(service.events).toHaveLength(1);
      expect(service.events[0].event).toBe('Widget Failed');
      expect(service.events[0].lifecycle).toBe('error');
      expect(service.events[0].properties).toEqual({ errorMsg: 'sync failure' });
    });

    // MARK: Async error
    it('should call onError lifecycle for async error and propagate rejection', async () => {
      const testError = new Error('async failure');
      const details: OnCallModelFunctionAnalyticsDetails = {
        onError: (emitter) => {
          emitter.sendEvent('Async Failed');
        }
      };

      await expect(callWithAnalytics({ service, details, context, execute: () => Promise.reject(testError) })).rejects.toThrow(testError);

      expect(service.events).toHaveLength(1);
      expect(service.events[0].event).toBe('Async Failed');
      expect(service.events[0].lifecycle).toBe('error');
    });

    // MARK: onTriggered
    it('should call onTriggered before handler execution', async () => {
      const callOrder: string[] = [];

      const details: OnCallModelFunctionAnalyticsDetails = {
        onTriggered: (emitter) => {
          callOrder.push('triggered');
          emitter.sendEventType('Handler Starting');
        },
        onSuccess: (emitter) => {
          callOrder.push('success');
          emitter.sendEventType('Handler Done');
        }
      };

      await callWithAnalytics({
        service,
        details,
        context,
        execute: () => {
          callOrder.push('execute');
          return 'ok';
        }
      });

      expect(callOrder).toEqual(['triggered', 'execute', 'success']);
      expect(service.events).toHaveLength(2);
      expect(service.events[0].lifecycle).toBe('triggered');
      expect(service.events[1].lifecycle).toBe('success');
    });

    // MARK: onComplete
    it('should call onComplete after success', async () => {
      const details: OnCallModelFunctionAnalyticsDetails = {
        onComplete: (emitter, _request, result) => {
          emitter.sendEvent('Completed', { result });
        }
      };

      await callWithAnalytics({ service, details, context, execute: () => 'done' });

      expect(service.events).toHaveLength(1);
      expect(service.events[0].lifecycle).toBe('complete');
      expect(service.events[0].properties).toEqual({ result: 'done' });
    });

    it('should call onComplete after error', async () => {
      const testError = new Error('fail');
      const details: OnCallModelFunctionAnalyticsDetails = {
        // eslint-disable-next-line @typescript-eslint/max-params
        onComplete: (emitter, _request, _result, error) => {
          emitter.sendEvent('Completed', { hadError: error != null });
        }
      };

      await expect(
        callWithAnalytics({
          service,
          details,
          context,
          execute: () => {
            throw testError;
          }
        })
      ).rejects.toThrow(testError);

      expect(service.events).toHaveLength(1);
      expect(service.events[0].lifecycle).toBe('complete');
      expect(service.events[0].properties).toEqual({ hadError: true });
    });

    // MARK: Multiple lifecycles
    it('should call multiple configured lifecycles', async () => {
      const details: OnCallModelFunctionAnalyticsDetails = {
        onTriggered: (emitter) => emitter.sendEventType('Start'),
        onSuccess: (emitter) => emitter.sendEventType('Done'),
        onComplete: (emitter) => emitter.sendEventType('Finished')
      };

      await callWithAnalytics({ service, details, context, execute: () => 'ok' });

      expect(service.events).toHaveLength(3);
      expect(service.events[0].lifecycle).toBe('triggered');
      expect(service.events[1].lifecycle).toBe('success');
      expect(service.events[2].lifecycle).toBe('complete');
    });

    // MARK: Request forwarding
    it('should pass request to lifecycle functions', async () => {
      const mockRequest = { data: 'test-data', auth: { uid: 'user-1' } } as any;
      const ctx = mockContext({ request: mockRequest });

      let receivedRequest: any;

      const details: OnCallModelFunctionAnalyticsDetails = {
        onSuccess: (_emitter, request) => {
          receivedRequest = request;
        }
      };

      await callWithAnalytics({ service, details, context: ctx, execute: () => 'ok' });
      expect(receivedRequest).toBe(mockRequest);
    });

    // MARK: Fire-and-forget
    it('should still return handler result when lifecycle function throws', async () => {
      const details: OnCallModelFunctionAnalyticsDetails = {
        onSuccess: () => {
          throw new Error('analytics broke');
        }
      };

      const result = await callWithAnalytics({ service, details, context, execute: () => 'still works' });
      expect(result).toBe('still works');
    });

    it('should still throw handler error when lifecycle function throws', async () => {
      const details: OnCallModelFunctionAnalyticsDetails = {
        onError: () => {
          throw new Error('analytics broke');
        }
      };

      const handlerError = new Error('handler error');
      await expect(
        callWithAnalytics({
          service,
          details,
          context,
          execute: () => {
            throw handlerError;
          }
        })
      ).rejects.toThrow(handlerError);
    });

    // MARK: No lifecycle functions
    it('should work with empty details (no lifecycle functions)', async () => {
      const details: OnCallModelFunctionAnalyticsDetails = {};
      const result = await callWithAnalytics({ service, details, context, execute: () => 'ok' });

      expect(result).toBe('ok');
      expect(service.events).toHaveLength(0);
    });

    // MARK: Context forwarding
    it('should forward specifier and uid to emitted events', async () => {
      const ctx = mockContext({ specifier: 'subscribeToNotifications', uid: 'user-123' });

      const details: OnCallModelFunctionAnalyticsDetails = {
        onSuccess: (emitter) => emitter.sendEventType('Test')
      };

      await callWithAnalytics({ service, details, context: ctx, execute: () => 'ok' });

      expect(service.events[0].specifier).toBe('subscribeToNotifications');
      expect(service.events[0].uid).toBe('user-123');
    });
  });
});

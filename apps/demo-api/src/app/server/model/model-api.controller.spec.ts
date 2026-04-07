import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory } from '../../../test/fixture';
import { ModelApiDispatchService, ModelApiDispatchConfig, getModelApiDetails } from '@dereekb/firebase-server';
import { demoCallModelFn } from '../../function/model/crud.functions';
import { mapDemoApiNestContext } from '../../function/function.context';
import { ModelApiController } from '@dereekb/firebase-server';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describe('ModelApiDispatchService', () => {
    let dispatchService: ModelApiDispatchService;

    beforeEach(() => {
      const config: ModelApiDispatchConfig = {
        callModelFn: demoCallModelFn,
        makeNestContext: mapDemoApiNestContext
      };

      dispatchService = new ModelApiDispatchService(config, f.instance.nest as any);
    });

    describe('getApiDetails()', () => {
      it('should return model-first API details', () => {
        const details = dispatchService.getApiDetails();
        expect(details).toBeDefined();
        expect(details!.models).toBeDefined();
      });

      it('should contain expected model types from demo app', () => {
        const details = dispatchService.getApiDetails();
        const modelNames = Object.keys(details!.models);

        expect(modelNames.length).toBeGreaterThan(0);
      });
    });
  });

  describe('ModelApiController', () => {
    let controller: ModelApiController;
    let mockDispatchService: ModelApiDispatchService;

    beforeEach(() => {
      mockDispatchService = {
        dispatch: vi.fn().mockResolvedValue({ success: true }),
        getApiDetails: vi.fn().mockReturnValue(undefined)
      } as unknown as ModelApiDispatchService;

      controller = new ModelApiController(mockDispatchService);
    });

    // MARK: Direct Dispatch
    describe('directDispatch()', () => {
      it('should call dispatch with the provided params', async () => {
        const body = { call: 'create', modelType: 'guestbook', data: { name: 'test' } } as any;
        const req = _mockRequest('POST', { uid: 'test-user' });

        await controller.directDispatch(body, req);

        expect(mockDispatchService.dispatch).toHaveBeenCalledWith(body, { uid: 'test-user' }, req);
      });

      it('should pass undefined auth when request has no auth', async () => {
        const body = { call: 'create', modelType: 'guestbook', data: {} } as any;
        const req = _mockRequest('POST');

        await controller.directDispatch(body, req);

        expect(mockDispatchService.dispatch).toHaveBeenCalledWith(body, undefined, req);
      });
    });

    // MARK: Read Routes (GET)
    describe('handleReadRequest()', () => {
      it('should dispatch read with modelType from path', async () => {
        const req = _mockRequest('GET', { uid: 'test-user' }, { path: 'systemState' });

        await controller.handleReadRequest(req);

        expect(mockDispatchService.dispatch).toHaveBeenCalledWith({ call: 'read', modelType: 'systemState', specifier: '_', data: {} }, { uid: 'test-user' }, req);
      });

      it('should dispatch read with specifier from path', async () => {
        const req = _mockRequest('GET', { uid: 'test-user' }, { path: 'systemState/exampleread' });

        await controller.handleReadRequest(req);

        expect(mockDispatchService.dispatch).toHaveBeenCalledWith({ call: 'read', modelType: 'systemState', specifier: 'exampleread', data: {} }, { uid: 'test-user' }, req);
      });

      it('should source data from query params', async () => {
        const req = _mockRequest('GET', { uid: 'test-user' }, { path: 'profile' });
        req.query = { key: 'abc123' };

        await controller.handleReadRequest(req);

        expect(mockDispatchService.dispatch).toHaveBeenCalledWith({ call: 'read', modelType: 'profile', specifier: '_', data: { key: 'abc123' } }, { uid: 'test-user' }, req);
      });

      it('should throw 400 when path has no model type', async () => {
        const req = _mockRequest('GET', { uid: 'test-user' }, { path: '' });

        await expect(controller.handleReadRequest(req)).rejects.toThrow();
      });
    });

    // MARK: Write Routes (POST / PUT / DELETE)
    describe('handleWriteRequest()', () => {
      it('should map POST to create', async () => {
        const req = _mockRequest('POST', { uid: 'test-user' }, { path: 'guestbook' });
        req.body = { name: 'test' };

        await controller.handleWriteRequest(req);

        expect(mockDispatchService.dispatch).toHaveBeenCalledWith({ call: 'create', modelType: 'guestbook', specifier: '_', data: { name: 'test' } }, { uid: 'test-user' }, req);
      });

      it('should map POST with specifier to create', async () => {
        const req = _mockRequest('POST', { uid: 'test-user' }, { path: 'storageFile/fromUpload' });
        req.body = { file: 'x' };

        await controller.handleWriteRequest(req);

        expect(mockDispatchService.dispatch).toHaveBeenCalledWith({ call: 'create', modelType: 'storageFile', specifier: 'fromUpload', data: { file: 'x' } }, { uid: 'test-user' }, req);
      });

      it('should map PUT to update', async () => {
        const req = _mockRequest('PUT', { uid: 'test-user' }, { path: 'profile' });
        req.body = { bio: 'hello' };

        await controller.handleWriteRequest(req);

        expect(mockDispatchService.dispatch).toHaveBeenCalledWith({ call: 'update', modelType: 'profile', specifier: '_', data: { bio: 'hello' } }, { uid: 'test-user' }, req);
      });

      it('should map PUT with specifier to update', async () => {
        const req = _mockRequest('PUT', { uid: 'test-user' }, { path: 'profile/username' });
        req.body = { username: 'newname' };

        await controller.handleWriteRequest(req);

        expect(mockDispatchService.dispatch).toHaveBeenCalledWith({ call: 'update', modelType: 'profile', specifier: 'username', data: { username: 'newname' } }, { uid: 'test-user' }, req);
      });

      it('should map DELETE to delete', async () => {
        const req = _mockRequest('DELETE', { uid: 'test-user' }, { path: 'oidcEntry' });
        req.body = { id: '123' };

        await controller.handleWriteRequest(req);

        expect(mockDispatchService.dispatch).toHaveBeenCalledWith({ call: 'delete', modelType: 'oidcEntry', specifier: '_', data: { id: '123' } }, { uid: 'test-user' }, req);
      });

      it('should map DELETE with specifier', async () => {
        const req = _mockRequest('DELETE', { uid: 'test-user' }, { path: 'oidcEntry/client' });
        req.body = { id: '123' };

        await controller.handleWriteRequest(req);

        expect(mockDispatchService.dispatch).toHaveBeenCalledWith({ call: 'delete', modelType: 'oidcEntry', specifier: 'client', data: { id: '123' } }, { uid: 'test-user' }, req);
      });

      it('should throw 405 for unsupported HTTP methods', async () => {
        const req = _mockRequest('PATCH', { uid: 'test-user' }, { path: 'profile' });

        await expect(controller.handleWriteRequest(req)).rejects.toThrow();
      });

      it('should throw 400 when path has no model type', async () => {
        const req = _mockRequest('POST', { uid: 'test-user' }, { path: '' });

        await expect(controller.handleWriteRequest(req)).rejects.toThrow();
      });
    });

    // MARK: Auth
    describe('auth propagation', () => {
      it('should pass auth from req.auth to dispatch service', async () => {
        const auth = { uid: 'test-user-123' };
        const req = _mockRequest('POST', auth, { path: 'guestbook' });
        req.body = {};

        await controller.handleWriteRequest(req);

        expect(mockDispatchService.dispatch).toHaveBeenCalledWith(expect.anything(), auth, req);
      });

      it('should pass undefined auth when request has no auth', async () => {
        const req = _mockRequest('POST', undefined, { path: 'guestbook' });
        req.body = {};

        await controller.handleWriteRequest(req);

        expect(mockDispatchService.dispatch).toHaveBeenCalledWith(expect.anything(), undefined, req);
      });
    });

    // MARK: Error Handling
    describe('error handling', () => {
      it('should convert dispatch errors to HttpException', async () => {
        (mockDispatchService.dispatch as any).mockRejectedValue({ status: 400, message: 'Bad request', code: 'BAD_REQUEST' });
        const req = _mockRequest('POST');

        await expect(controller.directDispatch({ call: 'create', modelType: 'test', data: {} } as any, req)).rejects.toThrow();
      });

      it('should return dispatch result on success', async () => {
        (mockDispatchService.dispatch as any).mockResolvedValue({ modelKeys: ['abc'] });
        const req = _mockRequest('POST', { uid: 'test-user' });

        const result = await controller.directDispatch({ call: 'create', modelType: 'guestbook', data: {} } as any, req);
        expect(result).toEqual({ modelKeys: ['abc'] });
      });
    });
  });

  describe('getModelApiDetails() with demoCallModelFn', () => {
    it('should return api details from the demo call model function', () => {
      const details = getModelApiDetails(demoCallModelFn);
      expect(details).toBeDefined();
    });

    it('should contain guestbook model with create call', () => {
      const details = getModelApiDetails(demoCallModelFn)!;
      const guestbook = details.models['guestbook'];

      expect(guestbook).toBeDefined();
      expect(guestbook.calls.create).toBeDefined();
    });

    it('should contain model types that have withApiDetails() configured', () => {
      const details = getModelApiDetails(demoCallModelFn)!;
      const modelNames = Object.keys(details.models);

      expect(modelNames).toContain('guestbook');
    });
  });
});

// MARK: Helpers
/**
 * Creates a mock Express Request with the given method, optional auth, and optional params.
 */
function _mockRequest(method: string, auth?: { uid: string }, params?: { path: string }): any {
  return {
    auth,
    method,
    params: params ?? {},
    headers: {},
    query: {},
    body: {},
    url: '/api/model/test',
    originalUrl: '/api/model/test'
  };
}

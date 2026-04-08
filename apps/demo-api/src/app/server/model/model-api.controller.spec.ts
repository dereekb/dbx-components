import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory } from '../../../test/fixture';
import { ModelApiCallModelDispatchService, type ModelApiDispatchConfig, type ModelApiGetService, MAX_MODEL_ACCESS_MULTI_READ_KEYS, getModelApiDetails, ModelApiController } from '@dereekb/firebase-server';
import { demoCallModelFn } from '../../function/model/crud.functions';
import { mapDemoApiNestContext } from '../../function/function.context';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describe('ModelApiDispatchService', () => {
    let dispatchService: ModelApiCallModelDispatchService;

    beforeEach(() => {
      const config: ModelApiDispatchConfig = {
        callModelFn: demoCallModelFn,
        makeNestContext: mapDemoApiNestContext
      };

      dispatchService = new ModelApiCallModelDispatchService(config, f.instance.nest as any);
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
    let mockDispatchService: ModelApiCallModelDispatchService;
    let mockAccessService: ModelApiGetService;

    beforeEach(() => {
      mockDispatchService = {
        dispatch: vi.fn().mockResolvedValue({ success: true }),
        getApiDetails: vi.fn().mockReturnValue(undefined)
      } as unknown as ModelApiCallModelDispatchService;

      mockAccessService = {
        readDocument: vi.fn().mockResolvedValue({ key: 'test/123', data: { name: 'test' } }),
        readDocuments: vi.fn().mockResolvedValue({ results: [], errors: [] })
      } as unknown as ModelApiGetService;

      controller = new ModelApiController(mockDispatchService, mockAccessService);
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

    // MARK: Document Access (Get)
    describe('getOne()', () => {
      it('should call readDocument with modelType, key, and auth', async () => {
        const req = _mockRequest('GET', { uid: 'test-user' });

        await controller.getOne('guestbook', 'gb/abc123', req);

        expect(mockAccessService.readDocument).toHaveBeenCalledWith('guestbook', 'gb/abc123', { uid: 'test-user' });
      });

      it('should throw 400 when key is missing', async () => {
        const req = _mockRequest('GET', { uid: 'test-user' });

        await expect(controller.getOne('guestbook', undefined, req)).rejects.toThrow();
      });

      it('should pass undefined auth when request has no auth', async () => {
        const req = _mockRequest('GET');

        await controller.getOne('guestbook', 'gb/abc123', req);

        expect(mockAccessService.readDocument).toHaveBeenCalledWith('guestbook', 'gb/abc123', undefined);
      });
    });

    describe('getMany()', () => {
      it('should call readDocuments with modelType, keys, and auth', async () => {
        const body = { keys: ['gb/abc', 'gb/def'] };
        const req = _mockRequest('POST', { uid: 'test-user' });

        await controller.getMany('guestbook', body, req);

        expect(mockAccessService.readDocuments).toHaveBeenCalledWith('guestbook', ['gb/abc', 'gb/def'], { uid: 'test-user' });
      });

      it('should throw 400 when keys array is empty', async () => {
        const body = { keys: [] };
        const req = _mockRequest('POST', { uid: 'test-user' });

        await expect(controller.getMany('guestbook', body, req)).rejects.toThrow();
      });

      it('should throw 400 when keys is not an array', async () => {
        const body = { keys: 'not-an-array' } as any;
        const req = _mockRequest('POST', { uid: 'test-user' });

        await expect(controller.getMany('guestbook', body, req)).rejects.toThrow();
      });

      it(`should throw 400 when keys exceeds ${MAX_MODEL_ACCESS_MULTI_READ_KEYS}`, async () => {
        const body = { keys: Array.from({ length: MAX_MODEL_ACCESS_MULTI_READ_KEYS + 1 }, (_, i) => `gb/${i}`) };
        const req = _mockRequest('POST', { uid: 'test-user' });

        await expect(controller.getMany('guestbook', body, req)).rejects.toThrow();
      });
    });

    // MARK: Path-Based Dispatch
    describe('handleDispatchRequest()', () => {
      it('should dispatch POST with modelType, call, and specifier from path', async () => {
        const req = _mockRequest('POST', { uid: 'test-user' }, { path: 'guestbook/create' });
        req.body = { name: 'test' };

        await controller.handleDispatchRequest(req);

        expect(mockDispatchService.dispatch).toHaveBeenCalledWith({ call: 'create', modelType: 'guestbook', specifier: '_', data: { name: 'test' } }, { uid: 'test-user' }, req);
      });

      it('should dispatch POST with specifier from path', async () => {
        const req = _mockRequest('POST', { uid: 'test-user' }, { path: 'storageFile/create/fromUpload' });
        req.body = { file: 'x' };

        await controller.handleDispatchRequest(req);

        expect(mockDispatchService.dispatch).toHaveBeenCalledWith({ call: 'create', modelType: 'storageFile', specifier: 'fromUpload', data: { file: 'x' } }, { uid: 'test-user' }, req);
      });

      it('should dispatch PUT with call from path', async () => {
        const req = _mockRequest('PUT', { uid: 'test-user' }, { path: 'profile/update' });
        req.body = { bio: 'hello' };

        await controller.handleDispatchRequest(req);

        expect(mockDispatchService.dispatch).toHaveBeenCalledWith({ call: 'update', modelType: 'profile', specifier: '_', data: { bio: 'hello' } }, { uid: 'test-user' }, req);
      });

      it('should dispatch PUT with specifier from path', async () => {
        const req = _mockRequest('PUT', { uid: 'test-user' }, { path: 'profile/update/username' });
        req.body = { username: 'newname' };

        await controller.handleDispatchRequest(req);

        expect(mockDispatchService.dispatch).toHaveBeenCalledWith({ call: 'update', modelType: 'profile', specifier: 'username', data: { username: 'newname' } }, { uid: 'test-user' }, req);
      });

      it('should allow DELETE only when call is delete', async () => {
        const req = _mockRequest('DELETE', { uid: 'test-user' }, { path: 'oidcEntry/delete' });
        req.body = { id: '123' };

        await controller.handleDispatchRequest(req);

        expect(mockDispatchService.dispatch).toHaveBeenCalledWith({ call: 'delete', modelType: 'oidcEntry', specifier: '_', data: { id: '123' } }, { uid: 'test-user' }, req);
      });

      it('should allow DELETE with specifier', async () => {
        const req = _mockRequest('DELETE', { uid: 'test-user' }, { path: 'oidcEntry/delete/client' });
        req.body = { id: '123' };

        await controller.handleDispatchRequest(req);

        expect(mockDispatchService.dispatch).toHaveBeenCalledWith({ call: 'delete', modelType: 'oidcEntry', specifier: 'client', data: { id: '123' } }, { uid: 'test-user' }, req);
      });

      it('should throw 405 when DELETE is used with a non-delete call', async () => {
        const req = _mockRequest('DELETE', { uid: 'test-user' }, { path: 'profile/update' });

        await expect(controller.handleDispatchRequest(req)).rejects.toThrow();
      });

      it('should throw 405 for GET method', async () => {
        const req = _mockRequest('GET', { uid: 'test-user' }, { path: 'profile/read' });

        await expect(controller.handleDispatchRequest(req)).rejects.toThrow();
      });

      it('should throw 405 for PATCH method', async () => {
        const req = _mockRequest('PATCH', { uid: 'test-user' }, { path: 'profile/update' });

        await expect(controller.handleDispatchRequest(req)).rejects.toThrow();
      });

      it('should throw 400 when path has no model type', async () => {
        const req = _mockRequest('POST', { uid: 'test-user' }, { path: '' });

        await expect(controller.handleDispatchRequest(req)).rejects.toThrow();
      });

      it('should throw 400 when path has no call type', async () => {
        const req = _mockRequest('POST', { uid: 'test-user' }, { path: 'guestbook' });

        await expect(controller.handleDispatchRequest(req)).rejects.toThrow();
      });
    });

    // MARK: Auth
    describe('auth propagation', () => {
      it('should pass auth from req.auth to dispatch service', async () => {
        const auth = { uid: 'test-user-123' };
        const req = _mockRequest('POST', auth, { path: 'guestbook/create' });
        req.body = {};

        await controller.handleDispatchRequest(req);

        expect(mockDispatchService.dispatch).toHaveBeenCalledWith(expect.anything(), auth, req);
      });

      it('should pass undefined auth when request has no auth', async () => {
        const req = _mockRequest('POST', undefined, { path: 'guestbook/create' });
        req.body = {};

        await controller.handleDispatchRequest(req);

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

      it('should convert access service errors to HttpException', async () => {
        (mockAccessService.readDocument as any).mockRejectedValue({ status: 404, message: 'Not found', code: 'NOT_FOUND' });
        const req = _mockRequest('GET', { uid: 'test-user' });

        await expect(controller.getOne('guestbook', 'gb/missing', req)).rejects.toThrow();
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

import { isServerError, partialServerError, serverError, ServerErrorResponse, UnauthorizedServerErrorResponse } from './error.server';

describe('isServerError', () => {
  it('should return true for a valid ServerError', () => {
    const error = { status: 400, code: 'BAD_REQUEST', message: 'Bad request' };
    expect(isServerError(error)).toBe(true);
  });

  it('should return false for an object without status', () => {
    expect(isServerError({ code: 'ERROR' })).toBe(false);
  });

  it('should return false for an object without code', () => {
    expect(isServerError({ status: 400 })).toBe(false);
  });

  it('should return false for null', () => {
    expect(isServerError(null)).toBe(false);
  });

  it('should return false for a string', () => {
    expect(isServerError('error')).toBe(false);
  });

  it('should return true for an object with null-valued status and code properties', () => {
    expect(isServerError({ status: null, code: null })).toBe(true);
  });
});

describe('partialServerError', () => {
  it('should create a partial server error from a string message', () => {
    const result = partialServerError('Something failed');
    expect(result.message).toBe('Something failed');
  });

  it('should pass through a partial server error object', () => {
    const input = { status: 500, message: 'Internal error' };
    const result = partialServerError(input);
    expect(result).toBe(input);
  });

  it('should return an empty object for null input', () => {
    const result = partialServerError(null);
    expect(result).toEqual({});
  });
});

describe('serverError', () => {
  it('should create a server error from config', () => {
    const result = serverError({ status: 404, code: 'NOT_FOUND', message: 'Not found' });
    expect(result.status).toBe(404);
    expect(result.code).toBe('NOT_FOUND');
    expect(result.message).toBe('Not found');
  });
});

describe('ServerErrorResponse', () => {
  it('should create a server error response', () => {
    const response = new ServerErrorResponse({ status: 500, code: 'INTERNAL', message: 'Error' });
    expect(response.status).toBe(500);
    expect(response.code).toBe('INTERNAL');
    expect(response.message).toBe('Error');
  });
});

describe('UnauthorizedServerErrorResponse', () => {
  it('should create a 401 error response', () => {
    const response = new UnauthorizedServerErrorResponse({});
    expect(response.status).toBe(401);
    expect(response.message).toBe('Unauthorized');
  });

  it('should use custom message if provided', () => {
    const response = new UnauthorizedServerErrorResponse({ message: 'Token expired' });
    expect(response.status).toBe(401);
    expect(response.message).toBe('Token expired');
  });
});

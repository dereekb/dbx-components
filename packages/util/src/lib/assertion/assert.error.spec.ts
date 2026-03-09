import { AssertionError, AssertionIssueHandler, ASSERTION_ERROR_CODE, type AssertionIssue } from './assert.error';

describe('AssertionError', () => {
  it('should store the target and propertyKey', () => {
    const target = { name: 'test' };
    const error = new AssertionError({ target, propertyKey: 'name' }, 'test error');

    expect(error.target).toBe(target);
    expect(error.propertyKey).toBe('name');
  });

  it('should have the ASSERTION_ERROR_CODE as its code', () => {
    const error = new AssertionError({ target: {}, propertyKey: 'x' }, 'msg');
    expect(error.code).toBe(ASSERTION_ERROR_CODE);
  });

  it('should set the error name to AssertionError', () => {
    const error = new AssertionError({ target: {}, propertyKey: 'x' }, 'msg');
    expect(error.name).toBe('AssertionError');
  });

  it('should use the provided message', () => {
    const error = new AssertionError({ target: {}, propertyKey: 'x' }, 'custom message');
    expect(error.message).toBe('custom message');
  });
});

describe('AssertionIssueHandler', () => {
  const handler = new AssertionIssueHandler();

  describe('handle', () => {
    it('should throw an AssertionError', () => {
      const issue: AssertionIssue = { target: {}, propertyKey: 'value' };
      expect(() => handler.handle(issue)).toThrow(AssertionError);
    });
  });

  describe('buildException', () => {
    it('should build an AssertionError with a default message when no options are provided', () => {
      const issue: AssertionIssue = { target: {}, propertyKey: 'myProp' };
      const error = handler.buildException(issue);

      expect(error).toBeInstanceOf(AssertionError);
      expect(error.message).toContain('myProp');
    });

    it('should use the custom message from options', () => {
      const issue: AssertionIssue = {
        target: {},
        propertyKey: 'myProp',
        options: { message: 'Custom failure message' }
      };
      const error = handler.buildException(issue);

      expect(error.message).toBe('Custom failure message');
    });
  });
});

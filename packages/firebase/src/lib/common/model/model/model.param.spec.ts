import { type } from 'arktype';
import { onCallQueryModelRequestParamsType } from './model.param';

describe('onCallQueryModelRequestParamsType', () => {
  it('should pass empty params', () => {
    const result = onCallQueryModelRequestParamsType({});
    expect(result instanceof type.errors).toBe(false);
  });

  it('should pass a limit and a cursor key', () => {
    const result = onCallQueryModelRequestParamsType({ limit: 5, cursorDocumentKey: 'a/b' });
    expect(result).toEqual({ limit: 5, cursorDocumentKey: 'a/b' });
  });

  it('should pass null values', () => {
    const result = onCallQueryModelRequestParamsType({ limit: null, cursorDocumentKey: null });
    expect(result instanceof type.errors).toBe(false);
  });

  it('should fail on a non-number limit', () => {
    const result = onCallQueryModelRequestParamsType({ limit: 'five' });
    expect(result instanceof type.errors).toBe(true);
  });

  it('should fail on a cursor that is not a key', () => {
    const result = onCallQueryModelRequestParamsType({ cursorDocumentKey: 'not a key' });
    expect(result instanceof type.errors).toBe(true);
  });
});

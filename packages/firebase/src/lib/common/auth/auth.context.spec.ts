import { useContextAuth } from './auth.context';

describe('useContextAuth()', () => {
  it('should use the auth if the auth is defined.', () => {
    const context = { auth: {} as any };
    let used = false;

    useContextAuth(context, (auth) => {
      expect(auth).toBeDefined();
      used = true;
    });

    expect(used).toBe(true);
  });

  it('should return the default value if auth is not defined.', () => {
    const context = { auth: undefined };
    const defaultValue = 'test';
    let used = false;

    const result = useContextAuth(
      context,
      () => {
        used = true;
        return '';
      },
      defaultValue
    );

    expect(used).toBe(false);
    expect(result).toBe(defaultValue);
  });
});

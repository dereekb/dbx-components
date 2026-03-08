import { joinHostAndPort } from './host';

describe('joinHostAndPort', () => {
  it('should join host and port as a string', () => {
    const result = joinHostAndPort({ host: 'localhost', port: 3000 });
    expect(result).toBe('localhost:3000');
  });

  it('should handle string port values', () => {
    const result = joinHostAndPort({ host: '127.0.0.1', port: '8080' });
    expect(result).toBe('127.0.0.1:8080');
  });

  it('should return null for null input', () => {
    const result = joinHostAndPort(null);
    expect(result).toBeNull();
  });

  it('should return undefined for undefined input', () => {
    const result = joinHostAndPort(undefined);
    expect(result).toBeUndefined();
  });
});

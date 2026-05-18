import { isIdleActionState, DbxActionState } from './action';

describe('isIdleActionState()', () => {
  it('should return true for IDLE', () => {
    expect(isIdleActionState(DbxActionState.IDLE)).toBe(true);
  });

  it('should return true for DISABLED', () => {
    expect(isIdleActionState(DbxActionState.DISABLED)).toBe(true);
  });

  it('should return true for REJECTED', () => {
    expect(isIdleActionState(DbxActionState.REJECTED)).toBe(true);
  });

  it('should return true for RESOLVED', () => {
    expect(isIdleActionState(DbxActionState.RESOLVED)).toBe(true);
  });

  it('should return false for TRIGGERED', () => {
    expect(isIdleActionState(DbxActionState.TRIGGERED)).toBe(false);
  });

  it('should return false for VALUE_READY', () => {
    expect(isIdleActionState(DbxActionState.VALUE_READY)).toBe(false);
  });

  it('should return false for WORKING', () => {
    expect(isIdleActionState(DbxActionState.WORKING)).toBe(false);
  });
});

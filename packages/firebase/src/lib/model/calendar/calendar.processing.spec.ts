import { describe, expect, it } from 'vitest';
import { CALENDAR_ROOT_FOLDER_PATH, calendarIcsFileStoragePath } from './calendar.processing';

describe('calendarIcsFileStoragePath()', () => {
  it('should build a flat ics path under the calendar root folder', () => {
    expect(calendarIcsFileStoragePath('0mfR2xk8SqVe1Nb7')).toBe('/cal/0mfR2xk8SqVe1Nb7.ics');
  });

  it('should key the path by the input id, so two StorageFiles never collide', () => {
    expect(calendarIcsFileStoragePath('a')).not.toBe(calendarIcsFileStoragePath('b'));
  });

  it('should stay under the reserved calendar root folder', () => {
    expect(calendarIcsFileStoragePath('0mfR2xk8SqVe1Nb7').startsWith(CALENDAR_ROOT_FOLDER_PATH)).toBe(true);
  });
});

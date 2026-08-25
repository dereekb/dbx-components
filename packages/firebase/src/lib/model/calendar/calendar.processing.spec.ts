import { describe, expect, it } from 'vitest';
import { CALENDAR_ICS_FILE_PATH, CALENDAR_ROOT_FOLDER_PATH, calendarIcsFileStoragePath } from './calendar.processing';

describe('calendarIcsFileStoragePath()', () => {
  it('should build the ics path inside the subfolder for the calendar', () => {
    expect(calendarIcsFileStoragePath('0mfR2xk8SqVe1Nb7')).toBe('/cal/0mfR2xk8SqVe1Nb7/c.ics');
  });

  it('should name the file with the shared ics file name, so the folder holds the calendar id', () => {
    expect(calendarIcsFileStoragePath('0mfR2xk8SqVe1Nb7').endsWith(`/${CALENDAR_ICS_FILE_PATH}`)).toBe(true);
  });

  it('should key the path by the input id, so two StorageFiles never collide', () => {
    expect(calendarIcsFileStoragePath('a')).not.toBe(calendarIcsFileStoragePath('b'));
  });

  it('should stay under the reserved calendar root folder', () => {
    expect(calendarIcsFileStoragePath('0mfR2xk8SqVe1Nb7').startsWith(CALENDAR_ROOT_FOLDER_PATH)).toBe(true);
  });
});

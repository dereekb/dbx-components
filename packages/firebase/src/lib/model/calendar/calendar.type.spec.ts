import { describe, expect, it } from 'vitest';
import { appCalendarTypeConfigService, calendarTypeConfigRecord, DEFAULT_CALENDAR_TYPE_CONFIG, type CalendarTypeConfig } from './calendar.type';

const DEMO_CONFIG: CalendarTypeConfig = { calendarType: 'demo_profile', name: 'Demo Profile', maxEvents: 100 };

describe('calendarTypeConfigRecord()', () => {
  it('should index the configs by their type', () => {
    expect(calendarTypeConfigRecord([DEMO_CONFIG])['demo_profile']).toBe(DEMO_CONFIG);
  });

  it('should throw for a duplicate type', () => {
    expect(() => calendarTypeConfigRecord([DEMO_CONFIG, { ...DEMO_CONFIG, maxEvents: 5 }])).toThrow();
  });
});

describe('appCalendarTypeConfigService()', () => {
  const service = appCalendarTypeConfigService(calendarTypeConfigRecord([DEMO_CONFIG]));

  it('should return the registered config for a known type', () => {
    expect(service.configForCalendarType('demo_profile')).toBe(DEMO_CONFIG);
  });

  it('should fall back to the default rather than throw for an unknown type', () => {
    // a scheduled sweep over every calendar in the app must not be taken down by one badly-typed document
    expect(service.configForCalendarType('never_registered')).toBe(DEFAULT_CALENDAR_TYPE_CONFIG);
  });

  it('should list the known types and configs', () => {
    expect(service.getAllKnownCalendarTypes()).toEqual(['demo_profile']);
    expect(service.getAllKnownCalendarTypeConfigs()).toEqual([DEMO_CONFIG]);
  });
});

import { subDays, addDays, addMinutes as dfnsAddMinutes } from 'date-fns';
import { DateDurationSpan, dateDurationSpanEndDate, durationSpanToDateRange, durationSpanFromDateRange, durationSpanDateRelativeState, fractionalHoursInDurationSpan, isSameDurationSpan, type Minutes } from './date.duration';
import { type DateRange } from './date.range';

describe('DateDurationSpan', () => {
  it('should create an instance with undefined properties if no template is provided', () => {
    const span = new DateDurationSpan();
    expect(span.startsAt).toBeUndefined();
    expect(span.duration).toBeUndefined();
  });

  it('should create an instance with properties from the template', () => {
    const template: DateDurationSpan = {
      startsAt: new Date(),
      duration: 60 as Minutes
    };
    const span = new DateDurationSpan(template);
    expect(span.startsAt).toEqual(template.startsAt);
    expect(span.duration).toEqual(template.duration);
  });
});

describe('dateDurationSpanEndDate', () => {
  it('should return the correct end date', () => {
    const startsAt = new Date(2024, 0, 1, 10, 0, 0);
    const duration = 60 as Minutes; // 60 minutes
    const span: DateDurationSpan = { startsAt, duration };
    const expectedEndDate = dfnsAddMinutes(startsAt, duration);
    expect(dateDurationSpanEndDate(span)).toEqual(expectedEndDate);
  });

  it('should return the same start date if duration is 0', () => {
    const startsAt = new Date(2024, 0, 1, 10, 0, 0);
    const duration = 0 as Minutes;
    const span: DateDurationSpan = { startsAt, duration };
    expect(dateDurationSpanEndDate(span)).toEqual(startsAt);
  });
});

describe('durationSpanToDateRange', () => {
  it('should convert DateDurationSpan to DateRange', () => {
    const startsAt = new Date(2024, 0, 1, 12, 0, 0);
    const duration = 120 as Minutes; // 120 minutes
    const span: DateDurationSpan = { startsAt, duration };
    const expectedEndDate = dfnsAddMinutes(startsAt, duration);
    const expectedDateRange: DateRange = {
      start: startsAt,
      end: expectedEndDate
    };
    expect(durationSpanToDateRange(span)).toEqual(expectedDateRange);
  });
});

describe('durationSpanFromDateRange', () => {
  it('should convert DateRange to DateDurationSpan', () => {
    const start = new Date(2024, 0, 1, 14, 0, 0);
    const end = dfnsAddMinutes(start, 90); // 90 minutes duration
    const dateRange: DateRange = { start, end };
    const expectedSpan: DateDurationSpan = {
      startsAt: start,
      duration: 90 as Minutes
    };
    expect(durationSpanFromDateRange(dateRange)).toEqual(expectedSpan);
  });

  it('should convert DateRange to DateDurationSpan with 0 duration if start and end are same', () => {
    const start = new Date(2024, 0, 1, 14, 0, 0);
    const dateRange: DateRange = { start, end: start };
    const expectedSpan: DateDurationSpan = {
      startsAt: start,
      duration: 0 as Minutes
    };
    expect(durationSpanFromDateRange(dateRange)).toEqual(expectedSpan);
  });
});

describe('durationSpanDateRelativeState', () => {
  const now = new Date();

  it('should return DateRelativeState.PAST if the span is in the past', () => {
    const startsAt = subDays(now, 2);
    const duration = 60 as Minutes;
    const span: DateDurationSpan = { startsAt, duration };
    expect(durationSpanDateRelativeState(span, now)).toBe('past');
  });

  it('should return DateRelativeState.PRESENT if the span is current', () => {
    const startsAt = dfnsAddMinutes(now, -30); // starts 30 minutes ago
    const duration = 60 as Minutes; // lasts for 60 minutes, so current for another 30 mins
    const span: DateDurationSpan = { startsAt, duration };
    expect(durationSpanDateRelativeState(span, now)).toBe('present');
  });

  it('should return DateRelativeState.FUTURE if the span is in the future', () => {
    const startsAt = addDays(now, 2);
    const duration = 60 as Minutes;
    const span: DateDurationSpan = { startsAt, duration };
    expect(durationSpanDateRelativeState(span, now)).toBe('future');
  });
});

describe('fractionalHoursInDurationSpan', () => {
  it('should convert duration to fractional hours', () => {
    const span1: DateDurationSpan = { startsAt: new Date(), duration: 60 as Minutes };
    expect(fractionalHoursInDurationSpan(span1)).toBe(1);

    const span2: DateDurationSpan = { startsAt: new Date(), duration: 30 as Minutes };
    expect(fractionalHoursInDurationSpan(span2)).toBe(0.5);

    const span3: DateDurationSpan = { startsAt: new Date(), duration: 90 as Minutes };
    expect(fractionalHoursInDurationSpan(span3)).toBe(1.5);

    const span4: DateDurationSpan = { startsAt: new Date(), duration: 0 as Minutes };
    expect(fractionalHoursInDurationSpan(span4)).toBe(0);
  });
});

describe('isSameDurationSpan', () => {
  const dateA = new Date(2024, 0, 1, 10, 0, 0);
  const dateB = new Date(2024, 0, 2, 10, 0, 0);

  const spanA1: DateDurationSpan = { startsAt: dateA, duration: 60 as Minutes };
  const spanA2: DateDurationSpan = { startsAt: dateA, duration: 60 as Minutes }; // same as A1
  const spanB: DateDurationSpan = { startsAt: dateB, duration: 60 as Minutes }; // different date
  const spanC: DateDurationSpan = { startsAt: dateA, duration: 30 as Minutes }; // different duration

  it('should return true for two identical DateDurationSpan objects', () => {
    expect(isSameDurationSpan(spanA1, spanA2)).toBe(true);
  });

  it('should return true for the same DateDurationSpan object instance', () => {
    expect(isSameDurationSpan(spanA1, spanA1)).toBe(true);
  });

  it('should return false if startsAt dates are different', () => {
    expect(isSameDurationSpan(spanA1, spanB)).toBe(false);
  });

  it('should return false if durations are different', () => {
    expect(isSameDurationSpan(spanA1, spanC)).toBe(false);
  });

  it('should return true if both are null', () => {
    expect(isSameDurationSpan(null, null)).toBe(true);
  });

  it('should return true if both are undefined', () => {
    expect(isSameDurationSpan(undefined, undefined)).toBe(true);
  });

  it('should return false if one is null and the other is a span', () => {
    expect(isSameDurationSpan(null, spanA1)).toBe(false);
    expect(isSameDurationSpan(spanA1, null)).toBe(false);
  });

  it('should return false if one is undefined and the other is a span', () => {
    expect(isSameDurationSpan(undefined, spanA1)).toBe(false);
    expect(isSameDurationSpan(spanA1, undefined)).toBe(false);
  });

  it('should return false if one is null and the other is undefined', () => {
    expect(isSameDurationSpan(null, undefined)).toBe(false);
    expect(isSameDurationSpan(undefined, null)).toBe(false);
  });
});

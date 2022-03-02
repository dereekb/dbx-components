import { ISO8601DayString } from "@dereekb/util";
import { differenceInMinutes, format, formatDistance, formatDistanceToNow, parse, startOfDay } from "date-fns";
import { DateRange, dateRangeState, DateRangeState } from "./date.range";

/**
 * Formats the input to be start - end
 */
 export function formatToTimeRangeString(start: Date, end: Date): string {
  return `${formatToTimeString(start)} - ${formatToTimeString(end)}`;
}

export function formatToDateString(date: Date): string {
  return format(date, 'EEE, MMM do');
}

export function formatToTimeString(date: Date): string {
  return format(date, 'h:mm a');
}

export function formatToTimeAndDurationString(start: Date, end: Date): string {
  const minutes = differenceInMinutes(end, start);
  let subtitle;

  if (minutes > 120) {
    subtitle = `(${formatDistance(end, start, { includeSeconds: false })})`;
  } else {
    subtitle = `${(minutes) ? `(${minutes} Minutes)` : ''}`;
  }

  return `${formatToTimeString(start)} ${subtitle}`;
}

export function formatStartedEndedDistanceString({ start, end }: DateRange): string {
  const state = dateRangeState({ start, end });
  let distanceText;

  switch (state) {
    case DateRangeState.PAST:
      distanceText = `ended ${formatDistanceToNow(end, {
        addSuffix: true
      })}`;
      break;
    case DateRangeState.PRESENT:
      distanceText = `started ${formatDistanceToNow(start, {
        addSuffix: true
      })}`;
      break;
    case DateRangeState.FUTURE:
      distanceText = `starting ${formatDistanceToNow(start, {
        addSuffix: true
      })}`;
      break;
  }

  return distanceText;
}

export function dateStringToDate(dateString: ISO8601DayString): Date {
  return startOfDay(parse(dateString, 'yyyy-MM-dd', new Date()));
}

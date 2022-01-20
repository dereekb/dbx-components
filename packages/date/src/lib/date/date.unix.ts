import { Maybe, DateOrUnixDateTimeNumber, UnixDateTimeNumber } from "@dereekb/util";
import { isDate } from "date-fns";

export function unixTimeNumberFromDateOrTimeNumber(input: Maybe<DateOrUnixDateTimeNumber>): Maybe<UnixDateTimeNumber> {
  if (input == null) {
    return input as null | undefined;
  } else if (isDate(input)) {
    return unixTimeNumberFromDate(input as Date);
  } else {
    return input as UnixDateTimeNumber;
  }
}

export function dateFromDateOrTimeNumber(input: Maybe<DateOrUnixDateTimeNumber>): Maybe<Date> {
  if (input == null) {
    return input as null | undefined;
  } else if (isDate(input)) {
    return input as Date;
  } else {
    return unixTimeNumberToDate(input as UnixDateTimeNumber);
  }
}

export function unixTimeNumberToDate(dateTimeNumber: Maybe<UnixDateTimeNumber>): Maybe<Date> {
  return (dateTimeNumber != null) ? new Date(dateTimeNumber * 1000) : dateTimeNumber as null | undefined;
}

export function unixTimeNumberForNow(): UnixDateTimeNumber {
  return unixTimeNumberFromDate(new Date())!;
}

export function unixTimeNumberFromDate(date: Maybe<Date>): Maybe<UnixDateTimeNumber> {
  return (date != null) ? Math.ceil(date.getTime() / 1000) : date as null | undefined;
}

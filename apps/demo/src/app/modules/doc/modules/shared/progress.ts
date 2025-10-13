import { interval, map } from 'rxjs';

export const DEMO_WORKING_INCREASE_OBSERVABLE = interval(100).pipe(
  map((x) => {
    const parts = 30;
    const halfParts = parts / 2;
    const pieceValue = 100 / parts;

    const xLoop = x % parts;
    const xVal = (x % halfParts) * pieceValue;
    const value = xLoop < halfParts ? xVal : 100 - xVal;

    return value;
  })
);

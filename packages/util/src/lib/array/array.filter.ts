

/**
 * Filters the input values by distance. The original order is retained.
 * 
 * If order is irrelevant, use filterValuesByDistanceNoOrder().
 */
export function filterValuesByDistance<T>(input: T[], minDistance: number, getValue: (value: T) => number | null): T[] {

  // TODO: Implement if needed.

  throw new Error('Incomplete implementation!');
}

/**
 * Filters the input values by an arbitrary "distance"/difference from eachother and returns the values sorted by their determined distance.
 * 
 * This is useful in cases where many values are too "close" to eachother (Generally items that share the same time, or within seconds of eachother), and
 * we are only interested in seeing one of those items.
 */
export function filterValuesByDistanceNoOrder<T>(input: T[], minDistance: number, getValue: (value: T) => number | null): T[] {
  const values: [T, number][] = input.map(x => [x, getValue(x)] as [T, number]).filter(x => x[1] != null);
  return _filterValuesByDistance(values, minDistance, (x) => x[0]);
}

// TODO: Can add a "mergeValuesByDistance" too to merge together values that are too close together.

function _filterValuesByDistance<T, Y>(values: [T, number][], minDistance: number, toOutputValue: (value: [T, number]) => Y): Y[] {

  // Exit if nothing to do.
  switch (values.length) {
    case 0:
      return [];
    case 1:
      return [toOutputValue(values[0])];
  }

  // Sort values
  values.sort((a, b) => a[1] - b[1]);

  let prev = values[0];

  const filtered: Y[] = [toOutputValue(prev)];

  for (let i = 1, n = values.length; i < n; i += 1) {
    const current = values[i];
    const distance = Math.abs(current[1] - prev[1]);

    if (distance > minDistance) {
      filtered.push(toOutputValue(current));
      prev = current;
    }
  }

  return filtered;
}

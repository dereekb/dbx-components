import { OperatorFunction } from 'rxjs';
import { scan } from 'rxjs/operators';

/**
 * Similar to count(), but counts emissions as they occur using scan.
 */
export function scanCount(): OperatorFunction<any, number> {
  return scan((count, _) => count + 1, 0);
}

import { first, of } from 'rxjs';
import { filterUnique } from './rxjs.unique';

describe('filterUnique', () => {
  it('should filter an array to unique items based on a key reader', (done) => {
    const items = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
      { id: 1, name: 'c' }
    ];

    of(items)
      .pipe(
        filterUnique((x) => x.id),
        first()
      )
      .subscribe((result) => {
        expect(result.length).toBe(2);
        expect(result[0].name).toBe('a');
        expect(result[1].name).toBe('b');
        done();
      });
  });

  it('should return all items when all keys are unique', (done) => {
    const items = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
      { id: 3, name: 'c' }
    ];

    of(items)
      .pipe(
        filterUnique((x) => x.id),
        first()
      )
      .subscribe((result) => {
        expect(result.length).toBe(3);
        done();
      });
  });

  it('should return an empty array for empty input', (done) => {
    of([])
      .pipe(
        filterUnique((x: { id: number }) => x.id),
        first()
      )
      .subscribe((result) => {
        expect(result).toEqual([]);
        done();
      });
  });
});

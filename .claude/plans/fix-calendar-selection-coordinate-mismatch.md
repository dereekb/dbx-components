# Fix: DbxCalendarScheduleSelectionStore output coordinate-mismatch bug

## Problem

When `setMinMaxDateRange.start` is set to a date after `filter.start`, the store's
`selectionValueSelectedIndexes$` (and the expansion's `i` values) emit indexes
anchored to **`dateScheduleRange.start`** (the clamped output start) while every
consumer (calendar view's `customizeDay`, real-app `jobWorkerApplyDayIndexStateFactory`)
treats those same indexes as anchored to **`state.start`** (= `filter.start`, used by
`state.indexFactory(date)` via `meta.i`).

Drift = `dateScheduleRange.start − filter.start` days. Visual symptom: clicking a
cell highlights/unhighlights a different cell that many days back.

Live reproduction: `apps/demo/src/app/modules/doc/modules/bugs/container/calendar.component.ts`
served at `http://localhost:9010/doc/bugs/calendar`. The pink dashed cells show
where the consumer thinks selection is — they drift away from the cells the
calendar's built-in renderer marks `cal-day-selected` whenever
`minMaxDateRange.start > filter.start`.

Root cause: commit `d22381100 fix: schedule selection output respects minMaxDateRange`
introduced a branch in `computeScheduleSelectionValue` (lines ~1321–1334 of
`packages/dbx-form/calendar/src/lib/calendar.schedule.selection.store.ts`) that
emits `dateScheduleRange.start = rangeStart` (clamped) with no prefix exclusions,
shifting the output coordinate anchor. That commit also changed
`updateStateWithDateCellScheduleRangeValue` to translate `change.ex` indexes by
`+inputStartIndex`, which is the matching round-trip half.

That fix solved a real round-trip problem (re-applying the output value caused
pre-`minMaxDateRange.start` days to "fill back up" as visually selected) but
broke the consumer contract: every caller of `selectionValueSelectedIndexes$`
and the expansion streams now silently sees output-anchored indexes.

## Invariants to restore / keep

The contract every consumer depends on is **filter-anchored output**:

1. `currentSelectionValue.dateScheduleRange.start === filter.start` (or, when no
   filter is set, `state.start` — which is `today` by default from
   `initialCalendarScheduleSelectionState()`).
2. `dateScheduleRange.ex` indexes are anchored at `dateScheduleRange.start`. Since
   that equals `filter.start` (or `state.start`), they match `state.indexFactory(date)`.
3. `selectionValueSelectedIndexes$` and the expansion `i` values are
   `state.indexFactory`-anchored — so a consumer's `customizeDay` can do
   `selectedIndexes.has(meta.i)` and `meta.i` is `state.indexFactory(viewDay.date)`.
4. The round-trip via `setDateCellScheduleRangeValue` must not let pre-
   `minMaxDateRange.start` days re-render as selected (the original d22381100 bug).

The "no filter set" case must still work: `state.start = today`,
`state.indexFactory` anchored at today. With no filter, output anchor =
`state.start` = today. Indexes from `selectionValueSelectedIndexes$` should match
`state.indexFactory(date)` exactly. (The "today" anchor moves only when
`initialCalendarScheduleSelectionState()` is called; once a state is built the
anchor is stable until `setFilter` updates it.)

## Files to change

All paths relative to repo root.

### `packages/dbx-form/calendar/src/lib/calendar.schedule.selection.store.ts`

**Change 1 — `computeScheduleSelectionValue` (around lines 1285–1369):**

Revert the `filterStartIndexOffset > 0 && state.minMaxDateRange?.start` branch.
Restore the legacy semantics: `start = filter.start` (timezone-converted as
before) with `filterOffsetExcludedRange = range(0, filterStartIndexOffset)` and
`indexOffset = indexOffset - filterStartIndexOffset`.

Concretely, replace this block:

```ts
const rangeStartIndex = systemIndexFactory(rangeStart);
const startIndex = systemIndexFactory(startInSystemTimezone);
const filterStartIndexOffset = rangeStartIndex - startIndex;

if (filterStartIndexOffset > 0 && state.minMaxDateRange?.start) {
  if (filter.timezone) {
    const filterNormal = dateTimezoneUtcNormal(filter.timezone);
    start = filterNormal.startOfDayInTargetTimezone(rangeStart);
  } else {
    start = rangeStart;
  }
} else {
  filterOffsetExcludedRange = range(0, filterStartIndexOffset);
  indexOffset = indexOffset - filterStartIndexOffset;
}
```

with the legacy form:

```ts
const rangeStartIndex = systemIndexFactory(rangeStart);
const startIndex = systemIndexFactory(startInSystemTimezone);
const filterStartIndexOffset = rangeStartIndex - startIndex;
filterOffsetExcludedRange = range(0, filterStartIndexOffset);
indexOffset = indexOffset - filterStartIndexOffset;
```

After this change, `dateScheduleRange.start` always equals `filter.start` (when
the filter has a start) or `state.start` (otherwise, the default-today anchor).

**Change 2 — `updateStateWithDateCellScheduleRangeValue` (around lines 894–901):**

Two sub-changes pair together to fix the original round-trip bug without the
output-anchor shift:

1. Drop the `+inputStartIndex` translation on `change.ex` — once Change 1 lands,
   `change.ex` is already state-anchored (its anchor is `change.start` =
   `filter.start` = `state.start`):

   ```ts
   const nextState: CalendarScheduleSelectionState = {
     ...state,
     inputStart: change.start,
     inputEnd: change.end,
     toggledIndexes: new Set(change.ex)
   };
   ```

2. Clamp `inputStart` to `state.minMaxDateRange?.start` when set, so the picker's
   input range stays within the clamp after the round-trip and pre-clamp days
   don't re-render as selected via the "toggled outside range" branch of
   `isEnabledDayInCalendarScheduleSelectionState`:

   ```ts
   const clampedInputStart = state.minMaxDateRange?.start && state.minMaxDateRange.start > change.start
     ? state.minMaxDateRange.start
     : change.start;

   const nextState: CalendarScheduleSelectionState = {
     ...state,
     inputStart: clampedInputStart,
     inputEnd: change.end,
     toggledIndexes: new Set(change.ex)
   };
   ```

   Use `>` (Date comparison via `getTime()` if needed) — only clamp when the
   minMaxDateRange.start is strictly later than the incoming start.

   Note: the picker visually displays `inputStart..inputEnd`. If the consumer
   round-trips a value with `start = filter.start` but the store has a
   minMaxDateRange clamping later, the picker should show the clamped range.

**Change 3 — `selectionValueSelectedIndexes$` (around lines 469–473):**

The current implementation maps the expansion's `i` directly. The expansion's
`i` is anchored at `dateScheduleRange.start`. After Change 1, that equals
`filter.start` = `state.start`, so direct mapping is already correct. **No code
change needed here**, but **add an explicit test** asserting that
`selectionValueSelectedIndexes$` emissions are `state.indexFactory(date)`-equivalent
(see Tests below).

(If a future change re-introduces a non-`state.start` output anchor, the fix
would be to translate output indexes back via
`state.indexFactory(dateScheduleRange.start)`. Document this in a comment
near `selectionValueSelectedIndexes$`.)

### Tests to add/update

#### `packages/dbx-form/calendar/src/lib/field/schedule/calendar.schedule.forge.field.spec.ts`

**Update existing tests** in the `forge component effect order` describe block
(around lines 168–228):

- `should clamp the output start to minMaxDateRange.start (not filter.start) when minMaxDateRange is set`
  → **Invert.** Rename to `should anchor the output start at filter.start (not minMaxDateRange.start)`.
  Assert `range!.start.getTime() === state.start.getTime()`. The clamp lives in
  `inputStart`/`minMaxRange`, not in `dateScheduleRange.start`.

- `should NOT include pre-minMaxDateRange days in the exclusion array`
  → **Invert.** Rename to `should include pre-minMaxDateRange days as prefix exclusions`.
  Assert `range!.ex` contains every index in `[0, minDateOffset)` (these are the
  days before `minMaxDateRange.start` and must be excluded so consumers expanding
  the range don't render them as selected).

**Keep these tests passing as-is** (they encode the round-trip invariant from
d22381100 and must continue to hold):

- `should not corrupt inputStart when the output value is fed back to the store`
- `should preserve a toggled middle day after round-trip`
- `should produce consistent values across multiple round-trips`

Add new assertion to `should not corrupt inputStart...`: after round-trip,
`roundTrippedState.inputStart.getTime() === state.minMaxDateRange.start.getTime()`
(the clamp survives the round-trip — this is what Change 2's `inputStart` clamp
guarantees).

#### `packages/dbx-form/calendar/src/lib/calendar.schedule.selection.store.spec.ts`

Add a new top-level describe `selector coordinate contract` with these cases.
All assertions express the invariant "**the indexes emitted by
`selectionValueSelectedIndexes$` and the expansion's `i` are
`state.indexFactory(date)`-equivalent**." Cases to cover:

1. **No filter, fresh state** — default state.start = today. Toggle a date
   `today + 5` ON. Assert: `selectionValueSelectedIndexes$` includes
   `state.indexFactory(today + 5)` (= 5).

2. **Filter only, no minMaxDateRange** — filter weekdays-only 4/16 → 5/28
   America/Chicago. Select all. Assert: every emitted output-index `i` satisfies
   `dateFactory(i)` (where `dateFactory` is built from `state.start` and
   `state.systemTimezone`) corresponds to a real selected weekday between 4/16
   and 5/28. Specifically: `state.indexFactory(dateFactory(i)) === i` for every
   emitted index.

3. **Filter + minMaxDateRange.start = filter.start + 15 (today)** — the user's
   bug scenario from the console: filter weekdays 4/16 → 5/28 Chicago,
   minMaxDateRange.start = 5/1.
   - selectAll, then expect:
     - `dateScheduleRange.start.toISOString() === filterStart.toISOString()` (= 4/16)
     - `dateScheduleRange.ex` includes every index in `[0, 15)` (the prefix)
       PLUS weekend indexes within `[15, 43)` — i.e., `[0,1,2,...,14, 16,17, 23,24, 30,31, 37,38]`.
   - Toggle state-index 36 (5/22 Fri) OFF. Expect:
     - `state.toggledIndexes.has(36) === true`
     - `dateScheduleRange.ex` includes 36
     - `selectionValueSelectedIndexes$` does NOT include 36
     - `selectionValueSelectedIndexes$` DOES include all other allowed weekdays
       in `[15, 43)` (15, 18, 19, 20, 21, 22, 25, 26, 27, 28, 29, 32, 33, 34, 35, 39, 40, 41, 42)
     - For every emitted index `i`: `state.indexFactory(addDays(state.start, i)) === i` (state-anchored contract)

4. **Filter + minMaxDateRange.start = filter.start + 18 (Monday 5/4)** — the
   second drift the user reported. selectAll, toggle state-index 36, assert the
   same state-anchored contract as case 3 but with `minMaxDateRange.start = 5/4`.

5. **Filter + minMaxDateRange + setSelectedIndexes (mirrors real
   `applicationDateCellIndexes$`)** — filter as case 3, minMaxDateRange.start = 5/1,
   then `setSelectedIndexes` with the user's actual set
   `[0,1,4,5,6,7,8,11,12,13,14,15,18,19,20,21,22,25,26,27,28,29,32,33,34,35,36,39,40,41,42]`
   (every weekday in the filter range, filter-anchored).
   - Expect `selectionValueSelectedIndexes$` to emit a set semantically equal to
     the input set restricted to `[15, 43)` — i.e., only weekdays at or after
     `minMaxDateRange.start`. The pre-minMax weekdays `[0,1,4,5,6,7,8,11,12,13,14]`
     must NOT appear in the emitted selected indexes (they're below the clamp).
   - Equivalent: `selectionValueSelectedDates$` must contain ISO strings only for
     dates ≥ 5/1.

6. **Round-trip stability** — for every above scenario, after
   `updateStateWithDateCellScheduleRangeValue(state, currentValue.dateScheduleRange)`:
   - `roundTripped.currentSelectionValue.dateScheduleRange.ex` deep-equals the
     pre-round-trip `ex`.
   - `roundTripped.inputStart.getTime() === state.minMaxDateRange.start.getTime()`
     (or `change.start` if no minMaxDateRange).
   - `selectionValueSelectedIndexes$` emits the same set as before the round-trip.

Helper: write a single utility in the spec to assert the state-anchored contract
given a state and the emitted indexes set:

```ts
function expectStateAnchoredIndexes(state: CalendarScheduleSelectionState, indexes: Set<number>) {
  for (const i of indexes) {
    const date = addDays(state.start, i); // state.start is the anchor
    expect(state.indexFactory(date)).toBe(i);
    // and the date must be in the filter+minMax range, i.e. enabled
    expect(state.isEnabledFilterDay(date)).toBe(true);
  }
}
```

#### `packages/dbx-form/calendar/src/lib/calendar.schedule.selection.store.spec.ts` — clean up the existing reproduction tests

The current spec has a `setFilter + setMinMaxDateRange selection bug reproduction`
describe block added during diagnosis. Once the fix lands:

- Remove the `BUG:` prefixes from the test titles (they'll be passing as-is).
- Update the assertions in `select all with filter + minMaxDateRange > matches the exact bug output reported in the user console` so it asserts the new (legacy-restored) shape: `start = filter.start (4/16)`, `ex` contains the prefix `[0..14]` plus weekends — NOT the buggy `start = 5/4, ex = [5,6,12,13,19,20]` shape.
- Update `BUG: toggling a Date for 5/22 should mark output-ex with the right index for that day` to use state-index 36 (not output-index 18) in the expected ex.

#### Demo

`apps/demo/src/app/modules/doc/modules/bugs/container/calendar.component.ts` — keep the demo as a regression page. After the fix, the pink dashed `doc-bugs-phantom-marker` cells should perfectly overlap the calendar's built-in `cal-day-selected` cells in every minMaxDateRange configuration. Add a brief note in the HTML hint that says "after the fix lands, the pink markers must always sit on the same cells as the green/blue selection highlight."

## Verification

1. From repo root: `npx nx test dbx-form-calendar --testFile=packages/dbx-form/calendar/src/lib/calendar.schedule.selection.store.spec.ts --reporter=agent`
   — all `selector coordinate contract` cases must pass.
2. `npx nx test dbx-form-calendar --testFile=packages/dbx-form/calendar/src/lib/field/schedule/calendar.schedule.forge.field.spec.ts --reporter=agent`
   — round-trip tests must still pass; the two inverted tests must pass with
   their new (legacy-anchored) assertions.
3. `npx nx test dbx-form-calendar --reporter=agent` — full calendar suite green.
4. `npx nx run demo:lint` — clean.
5. Manual smoke test in the demo at `/doc/bugs/calendar`:
   - Select All with `minMax start = 5/4` → pink markers must coincide with
     selected cells (no drift).
   - Toggle Date 5/22 → only 5/22 changes; no phantom day flips elsewhere.
   - Switch to `minMax start = 5/1` → same alignment, different first selected day.
   - Remove minMaxDateRange → same alignment.
   - In every case: `selectionValueSelectedIndexes` (debug panel) and
     `state.toggledIndexes` (debug panel) refer to the same coordinate space —
     dates in `selectionValueSelectedDates` correspond exactly to the cells
     visibly highlighted.

## Notes for the implementer

- Do **not** touch `currentSelectionValueDateCellTimingDateFactory$` (line 459):
  it's already built from `dateScheduleRange.start`, which after Change 1 will
  equal `state.start`, so it stays correct.
- Do **not** touch `currentSelectionValueWithTimezone$` (line 484): it
  transforms a whole `dateScheduleRange` to an output timezone; the index
  contract still holds because the expansion runs after the transform.
- The `computeSelectionResultRelativeToFilter === false` path (skipped by the
  `if (computeSelectionResultRelativeToFilter && filter?.start)` guard) is
  unaffected. In that path `start = rangeStart`, but consumers opting out of
  filter-relative computation are expected to handle their own coordinates.
- After Change 2, double-check `updateStateWithDateCellScheduleRangeValue`
  doesn't drop the clamp when `minMaxDateRange` is `undefined` (no filter or
  no clamp configured). The `&&` short-circuit handles this naturally —
  `clampedInputStart = change.start` when `state.minMaxDateRange?.start` is
  undefined.
- The first commit (`d22381100`) message says it also fixed "round-trip
  corruption of toggled day indexes." Verify by running the
  `should preserve a toggled middle day after round-trip` test before and
  after the fix — it should pass both before and after (we're keeping the
  invariant, just moving the clamp from `dateScheduleRange.start` to
  `inputStart`).

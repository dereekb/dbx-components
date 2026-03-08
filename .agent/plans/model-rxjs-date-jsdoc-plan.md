# @dereekb/model, @dereekb/rxjs, @dereekb/date JSDoc Update Plan

Track progress of adding JSDoc annotations with `@example` blocks to all exported functions in the model, rxjs, and date packages.

## Legend

- `[ ]` - Not started
- `[~]` - In progress
- `[x]` - Complete
- `[S]` - Skipped (types-only file, no exported functions)
- **NEEDS SPEC** - No `.spec.ts` file exists; must create one

## Statistics

- **Total source files:** 107
- **Files with specs:** 63
- **Files missing specs:** 44

---

# @dereekb/model (`packages/model/src/lib/`)

## 1. data/address/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 1 | address.ts | YES | `[x]` |

---

## 2. data/website/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 2 | link.ts | **NEEDS SPEC** | `[x]` |
| 3 | link.file.ts | YES | `[x]` |
| 4 | link.website.ts | YES | `[x]` |

---

## 3. service/loader/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 5 | model.loader.ts | **NEEDS SPEC** | `[S]` |

---

## 4. service/permission/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 6 | permission.ts | **NEEDS SPEC** | `[x]` |
| 7 | permission.service.ts | **NEEDS SPEC** | `[x]` |
| 8 | role.ts | YES | `[x]` |

---

## 5. service/sync/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 9 | sync.entity.ts | **NEEDS SPEC** | `[x]` |
| 10 | sync.entity.synchronizer.ts | **NEEDS SPEC** | `[x]` |
| 11 | sync.entity.synchronizer.basic.ts | YES | `[x]` |
| 12 | sync.error.ts | **NEEDS SPEC** | `[x]` |
| 13 | sync.service.ts | **NEEDS SPEC** | `[S]` |
| 14 | sync.source.ts | **NEEDS SPEC** | `[S]` |

---

## 6. transform/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 15 | transform.ts | YES | `[x]` |
| 16 | transform.function.ts | **NEEDS SPEC** | `[x]` |
| 17 | transform.result.ts | **NEEDS SPEC** | `[x]` |
| 18 | type.ts | **NEEDS SPEC** | `[x]` |
| 19 | type.annotation.ts | **NEEDS SPEC** | `[x]` |

---

## 7. validator/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 20 | date.ts | YES | `[x]` |
| 21 | number.ts | **NEEDS SPEC** | `[x]` |
| 22 | phone.ts | YES | `[x]` |
| 23 | unique.ts | YES | `[x]` |
| 24 | url.ts | YES | `[x]` |

---

# @dereekb/rxjs (`packages/rxjs/src/lib/`)

## 8. ROOT (`src/lib/`)

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 25 | lock.ts | YES | `[x]` |
| 26 | object.ts | YES | `[x]` |
| 27 | subscription.ts | YES | `[x]` |

---

## 9. filter/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 28 | filter.ts | **NEEDS SPEC** | `[S]` |
| 29 | filter.map.ts | YES | `[x]` |
| 30 | filter.preset.ts | YES | `[x]` |
| 31 | filter.source.ts | YES | `[x]` |

---

## 10. iterator/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 32 | iteration.ts | **NEEDS SPEC** | `[S]` |
| 33 | iteration.accumulator.ts | YES | `[x]` |
| 34 | iteration.accumulator.rxjs.ts | YES | `[x]` |
| 35 | iteration.mapped.ts | YES | `[x]` |
| 36 | iteration.mapped.page.ts | YES | `[x]` |
| 37 | iteration.next.ts | YES | `[x]` |
| 38 | iterator.page.ts | YES | `[x]` |

---

## 11. loading/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 39 | loading.ts | **NEEDS SPEC** | `[S]` |
| 40 | loading.context.ts | **NEEDS SPEC** | `[S]` |
| 41 | loading.context.rxjs.ts | YES | `[x]` |
| 42 | loading.context.simple.ts | YES | `[x]` |
| 43 | loading.context.state.ts | YES | `[x]` |
| 44 | loading.context.state.list.ts | YES | `[x]` |
| 45 | loading.context.value.ts | YES | `[x]` |
| 46 | loading.state.ts | YES | `[x]` |
| 47 | loading.state.list.ts | YES | `[x]` |
| 48 | loading.state.rxjs.ts | YES | `[x]` |

---

## 12. rxjs/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 49 | rxjs.ts | YES | `[x]` |
| 50 | rxjs.async.ts | YES | `[x]` |
| 51 | rxjs.error.ts | YES | `[x]` |
| 52 | rxjs.map.ts | YES | `[x]` |
| 53 | rxjs.unique.ts | YES | `[x]` |
| 54 | array.ts | YES | `[x]` |
| 55 | boolean.ts | YES | `[x]` |
| 56 | decision.ts | YES | `[x]` |
| 57 | delta.ts | YES | `[x]` |
| 58 | expires.ts | YES | `[x]` |
| 59 | factory.ts | YES | `[x]` |
| 60 | getter.ts | YES | `[x]` |
| 61 | key.ts | YES | `[x]` |
| 62 | lifecycle.ts | YES | `[x]` |
| 63 | loading.ts | YES | `[x]` |
| 64 | map.ts | YES | `[x]` |
| 65 | misc.ts | YES | `[x]` |
| 66 | model.ts | YES | `[x]` |
| 67 | number.ts | YES | `[x]` |
| 68 | set.ts | YES | `[x]` |
| 69 | string.ts | YES | `[x]` |
| 70 | timeout.ts | YES | `[x]` |
| 71 | use.ts | YES | `[x]` |
| 72 | value.ts | YES | `[x]` |

---

## 13. work/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 73 | work.factory.ts | YES | `[x]` |
| 74 | work.instance.ts | YES | `[x]` |

---

# @dereekb/date (`packages/date/src/lib/`)

## 14. date/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 75 | date.ts | YES | `[x]` |
| 76 | date.calendar.ts | YES | `[ ]` |
| 77 | date.cell.ts | YES | `[ ]` |
| 78 | date.cell.factory.ts | YES | `[ ]` |
| 79 | date.cell.filter.ts | YES | `[ ]` |
| 80 | date.cell.index.ts | YES | `[ ]` |
| 81 | date.cell.schedule.ts | YES | `[ ]` |
| 82 | date.cell.schedule.day.ts | YES | `[ ]` |
| 83 | date.cell.validator.ts | YES | `[ ]` |
| 84 | date.cell.week.ts | YES | `[ ]` |
| 85 | date.day.ts | YES | `[ ]` |
| 86 | date.duration.ts | YES | `[ ]` |
| 87 | date.format.ts | YES | `[ ]` |
| 88 | date.hashset.ts | **NEEDS SPEC** | `[ ]` |
| 89 | date.logical.ts | **NEEDS SPEC** | `[ ]` |
| 90 | date.range.ts | YES | `[ ]` |
| 91 | date.range.string.ts | **NEEDS SPEC** | `[ ]` |
| 92 | date.range.timezone.ts | YES | `[ ]` |
| 93 | date.round.ts | **NEEDS SPEC** | `[ ]` |
| 94 | date.rxjs.ts | YES | `[ ]` |
| 95 | date.sort.ts | YES | `[ ]` |
| 96 | date.time.ts | YES | `[ ]` |
| 97 | date.time.limit.ts | YES | `[ ]` |
| 98 | date.time.minute.ts | YES | `[ ]` |
| 99 | date.timezone.ts | YES | `[ ]` |
| 100 | date.unix.ts | **NEEDS SPEC** | `[ ]` |
| 101 | date.week.ts | YES | `[ ]` |

---

## 15. query/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 102 | query.builder.ts | **NEEDS SPEC** | `[ ]` |
| 103 | query.builder.mongo.ts | **NEEDS SPEC** | `[ ]` |
| 104 | query.filter.ts | **NEEDS SPEC** | `[ ]` |
| 105 | query.request.ts | **NEEDS SPEC** | `[ ]` |

---

## 16. rrule/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 106 | date.recurrence.ts | **NEEDS SPEC** | `[ ]` |
| 107 | date.rrule.ts | YES | `[ ]` |
| 108 | date.rrule.extension.ts | YES | `[ ]` |
| 109 | date.rrule.parse.ts | YES | `[ ]` |

---

## 17. timezone/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 110 | timezone.ts | **NEEDS SPEC** | `[ ]` |
| 111 | timezone.validator.ts | YES | `[ ]` |

---

## Approach per Session

Each session should:
1. Pick a module section (e.g., "filter/")
2. For each file in that section:
   a. Read the source file
   b. Read the corresponding `.spec.ts` (if exists) to extract examples
   c. Add JSDoc with `@example` blocks to all exported functions/classes/interfaces
   d. If no `.spec.ts` exists, create one with basic tests
3. Mark files as `[x]` complete in this plan
4. Run tests to verify nothing is broken:
   - Model: `pnpm nx test model`
   - RxJS: `pnpm nx test rxjs`
   - Date: `pnpm nx test date`

## Notes

- Some files may be types-only (interfaces, type aliases) with no functions. These can be marked `[S]` (Skipped) after inspection if they only contain type definitions.
- For NEEDS SPEC files, review neighboring spec patterns for test conventions before writing new specs.
- The date package tests are timezone-sensitive. Run date tests with `TZ=UTC` if needed (see `dbx-components-test-dates` skill).

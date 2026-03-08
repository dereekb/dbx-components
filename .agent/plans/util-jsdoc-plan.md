# @dereekb/util JSDoc Update Plan

Track progress of adding JSDoc annotations with `@example` blocks to all exported functions in `packages/util/src/lib/`.

## Legend

- `[ ]` - Not started
- `[~]` - In progress
- `[x]` - Complete
- `[S]` - Skipped (types-only file, no exported functions)
- **NEEDS SPEC** - No `.spec.ts` file exists; must create one

## Statistics

- **Total source files:** 165
- **Files with specs:** 106
- **Files missing specs:** 59

---

## 1. ROOT (`src/lib/`)

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 1 | boolean.ts | YES | `[x]` |
| 2 | grouping.ts | YES | `[x]` |
| 3 | hash.ts | YES | `[x]` |
| 4 | iterate.ts | YES | `[x]` |
| 5 | key.ts | YES | `[x]` |
| 6 | lifecycle.ts | YES | `[x]` |
| 7 | sort.ts | YES | `[x]` |
| 8 | type.ts | YES | `[x]` |

---

## 2. array/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 9 | array.ts | YES | `[x]` |
| 10 | array.boolean.ts | YES | `[x]` |
| 11 | array.factory.ts | YES | `[x]` |
| 12 | array.filter.ts | YES | `[x]` |
| 13 | array.find.ts | YES | `[x]` |
| 14 | array.index.ts | YES | `[x]` |
| 15 | array.indexed.ts | YES | `[x]` |
| 16 | array.limit.ts | YES | `[x]` |
| 17 | array.make.ts | YES | `[x]` |
| 18 | array.map.ts | YES | `[x]` |
| 19 | array.number.ts | YES | `[x]` |
| 20 | array.random.ts | YES | `[x]` |
| 21 | array.set.ts | YES | `[x]` |
| 22 | array.string.ts | YES | `[x]` |
| 23 | array.unique.ts | YES | `[x]` |
| 24 | array.value.ts | YES | `[x]` |

---

## 3. assertion/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 25 | assert.ts | **NEEDS SPEC** | `[x]` types-only |
| 26 | assert.error.ts | YES | `[x]` |
| 27 | assertion.ts | YES | `[x]` |
| 28 | assertion.generic.ts | YES | `[x]` |
| 29 | assertion.number.ts | YES | `[x]` |

---

## 4. auth/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 30 | auth.role.ts | YES | `[x]` |
| 31 | auth.role.claims.ts | YES | `[x]` |

---

## 5. contact/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 32 | domain.ts | YES | `[x]` |
| 33 | email.ts | YES | `[x]` |
| 34 | phone.ts | YES | `[x]` |
| 35 | random.ts | YES | `[x]` |

---

## 6. date/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 36 | date.ts | YES | `[x]` |
| 37 | date.time.ts | YES | `[x]` |
| 38 | date.unix.ts | YES | `[x]` |
| 39 | expires.ts | YES | `[x]` |
| 40 | hour.ts | YES | `[x]` |
| 41 | minute.ts | YES | `[x]` |
| 42 | time.ts | YES | `[x]` |
| 43 | week.ts | YES | `[x]` |

---

## 7. error/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 44 | error.ts | YES | `[x]` |
| 45 | error.server.ts | YES | `[x]` |

---

## 8. file/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 46 | file.ts | **NEEDS SPEC** | `[x]` types-only |
| 47 | pdf.ts | YES | `[x]` |
| 48 | xml.ts | **NEEDS SPEC** | `[x]` types-only |

---

## 9. filter/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 49 | filter.ts | YES | `[x]` |

---

## 10. function/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 50 | function.ts | YES | `[x]` |
| 51 | function.boolean.ts | YES | `[x]` |
| 52 | function.forward.ts | YES | `[x]` |

---

## 11. getter/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 53 | getter.ts | YES | `[x]` |
| 54 | getter.cache.ts | YES | `[x]` |
| 55 | getter.map.ts | YES | `[x]` |
| 56 | getter.util.ts | YES | `[x]` |
| 57 | type.ts | **NEEDS SPEC** | `[x]` types-only |

---

## 12. iterable/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 58 | iterable.ts | YES | `[x]` |
| 59 | iterable.map.ts | YES | `[x]` |

---

## 13. map/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 60 | map.ts | YES | `[x]` |
| 61 | map.intersection.ts | YES | `[x]` |
| 62 | map.key.ts | YES | `[x]` |

---

## 14. misc/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 63 | color.ts | **NEEDS SPEC** | `[x]` types-only |
| 64 | host.ts | YES | `[x]` |

---

## 15. model/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 65 | model.ts | YES | `[x]` |
| 66 | model.conversion.ts | YES | `[x]` |
| 67 | model.conversion.field.ts | YES | `[x]` |
| 68 | model.copy.ts | YES | `[x]` |
| 69 | model.modify.ts | YES | `[x]` |
| 70 | id.batch.ts | YES | `[x]` |
| 71 | id.factory.ts | YES | `[x]` |

---

## 16. nodejs/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 72 | stream.ts | YES | `[x]` |

---

## 17. number/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 73 | number.ts | YES | `[x]` |
| 74 | bitwise.dencoder.ts | YES | `[x]` |
| 75 | bound.ts | YES | `[x]` |
| 76 | dollar.ts | YES | `[x]` |
| 77 | factory.ts | YES | `[x]` |
| 78 | pay.ts | **NEEDS SPEC** | `[x]` types-only |
| 79 | random.ts | YES | `[x]` |
| 80 | round.ts | YES | `[x]` |
| 81 | sort.ts | YES | `[x]` |
| 82 | transform.ts | YES | `[x]` |

---

## 18. object/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 83 | object.ts | YES | `[x]` |
| 84 | object.array.ts | YES | `[x]` |
| 85 | object.array.delta.ts | YES | `[x]` |
| 86 | object.empty.ts | YES | `[x]` |
| 87 | object.equal.ts | YES | `[x]` |
| 88 | object.filter.pojo.ts | YES | `[x]` |
| 89 | object.filter.tuple.ts | YES | `[x]` |
| 90 | object.key.ts | YES | `[x]` |
| 91 | object.map.ts | YES | `[x]` |

---

## 19. page/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 92 | page.ts | YES | `[x]` |
| 93 | page.filter.ts | YES | `[x]` |

---

## 20. path/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 94 | path.ts | YES | `[x]` |
| 95 | path.tree.ts | YES | `[x]` |

---

## 21. promise/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 96 | promise.ts | YES | `[x]` |
| 97 | promise.factory.ts | YES | `[x]` |
| 98 | promise.limit.ts | YES | `[x]` |
| 99 | promise.loop.ts | YES | `[x]` |
| 100 | promise.ref.ts | YES | `[x]` |
| 101 | promise.task.ts | YES | `[x]` |
| 102 | promise.type.ts | YES | `[x]` |
| 103 | callback.ts | YES | `[x]` |
| 104 | is.ts | YES | `[x]` |
| 105 | map.ts | YES | `[x]` |
| 106 | poll.ts | YES | `[x]` |
| 107 | use.ts | YES | `[x]` |
| 108 | wait.ts | YES | `[x]` |

---

## 22. relation/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 109 | relation.ts | YES | `[x]` |

---

## 23. service/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 110 | handler.ts | YES | `[x]` |
| 111 | handler.config.ts | YES | `[x]` |
| 112 | typed.service.ts | YES | `[x]` |

---

## 24. set/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 113 | set.ts | YES | `[x]` |
| 114 | set.allowed.ts | YES | `[x]` |
| 115 | set.decision.ts | YES | `[x]` |
| 116 | set.delta.ts | YES | `[x]` |
| 117 | set.hashset.ts | YES | `[x]` |
| 118 | set.maybe.ts | YES | `[x]` |
| 119 | set.mode.ts | YES | `[S]` |
| 120 | set.selection.ts | YES | `[x]` |

---

## 25. storage/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 121 | storage.ts | YES | `[S]` |
| 122 | storage.error.ts | YES | `[x]` |
| 123 | storage.memory.ts | YES | `[x]` |
| 124 | storage.object.ts | YES | `[x]` |

---

## 26. string/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 125 | string.ts | YES | `[x]` |
| 126 | char.ts | YES | `[x]` |
| 127 | dencoder.ts | YES | `[x]` |
| 128 | factory.ts | YES | `[x]` |
| 129 | html.ts | YES | `[x]` |
| 130 | json.ts | YES | `[x]` |
| 131 | mimetype.ts | YES | `[x]` |
| 132 | password.ts | YES | `[x]` |
| 133 | prefix.ts | YES | `[x]` |
| 134 | record.ts | YES | `[x]` |
| 135 | replace.ts | YES | `[x]` |
| 136 | search.ts | YES | `[x]` |
| 137 | sort.ts | YES | `[x]` |
| 138 | transform.ts | YES | `[x]` |
| 139 | tree.ts | YES | `[x]` |
| 140 | url.ts | YES | `[x]` |

---

## 27. tree/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 141 | tree.ts | **NEEDS SPEC** | `[x]` types-only |
| 142 | tree.array.ts | YES | `[x]` |
| 143 | tree.expand.ts | YES | `[x]` |
| 144 | tree.explore.ts | YES | `[x]` |
| 145 | tree.flatten.ts | YES | `[x]` |

---

## 28. value/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 146 | address.ts | YES | `[x]` |
| 147 | bound.ts | YES | `[x]` |
| 148 | build.ts | YES | `[x]` |
| 149 | comparator.ts | YES | `[x]` |
| 150 | cron.ts | YES | `[x]` |
| 151 | decision.ts | YES | `[x]` |
| 152 | equal.ts | YES | `[x]` |
| 153 | indexed.ts | YES | `[x]` |
| 154 | label.ts | YES | `[x]` |
| 155 | map.ts | YES | `[x]` |
| 156 | maybe.ts | YES | `[x]` |
| 157 | maybe.type.ts | YES | `[S]` |
| 158 | modifier.ts | YES | `[x]` |
| 159 | pixel.ts | **NEEDS SPEC** | `[x]` types-only |
| 160 | point.ts | YES | `[x]` |
| 161 | sync.ts | **NEEDS SPEC** | `[x]` types-only |
| 162 | url.ts | YES | `[x]` |
| 163 | use.ts | YES | `[x]` |
| 164 | vector.ts | YES | `[x]` |
| 165 | zoom.ts | **NEEDS SPEC** | `[x]` types-only |

---

## Test Subpackage (`packages/util/test/`)

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 166 | jest/jest.ts | YES (jest.spec.ts) | `[x]` |
| 167 | jest/jest.fail.ts | NO (tested via jest.spec.ts) | `[x]` |
| 168 | jest/jest.function.ts | YES | `[x]` |
| 169 | jest/jest.wrap.ts | YES | `[x]` |
| 170 | shared/shared.ts | YES (shared.spec.ts) | `[x]` |
| 171 | shared/shared.fail.ts | YES | `[x]` |
| 172 | shared/shared.function.ts | YES | `[x]` |
| 173 | shared/shared.wrap.ts | YES | `[x]` |

---

## Approach per Session

Each session should:
1. Pick a module section (e.g., "array/")
2. For each file in that section:
   a. Read the source file
   b. Read the corresponding `.spec.ts` (if exists) to extract examples
   c. Add JSDoc with `@example` blocks to all exported functions/classes/interfaces
   d. If no `.spec.ts` exists, create one with basic tests
3. Mark files as `[x]` complete in this plan
4. Run tests to verify nothing is broken: `pnpm nx test util`

## Notes

- Some files may be types-only (interfaces, type aliases) with no functions. These can be marked `[S]` (Skipped) after inspection if they only contain type definitions.
- The `getter/type.ts` and `promise/promise.type.ts` files likely fall in this category.
- For NEEDS SPEC files, review neighboring spec patterns for test conventions before writing new specs.

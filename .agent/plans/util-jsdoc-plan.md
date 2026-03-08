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
| 25 | assert.ts | **NEEDS SPEC** | `[ ]` |
| 26 | assert.error.ts | **NEEDS SPEC** | `[ ]` |
| 27 | assertion.ts | **NEEDS SPEC** | `[ ]` |
| 28 | assertion.generic.ts | **NEEDS SPEC** | `[ ]` |
| 29 | assertion.number.ts | **NEEDS SPEC** | `[ ]` |

---

## 4. auth/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 30 | auth.role.ts | **NEEDS SPEC** | `[ ]` |
| 31 | auth.role.claims.ts | YES | `[ ]` |

---

## 5. contact/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 32 | domain.ts | YES | `[ ]` |
| 33 | email.ts | **NEEDS SPEC** | `[ ]` |
| 34 | phone.ts | YES | `[ ]` |
| 35 | random.ts | YES | `[ ]` |

---

## 6. date/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 36 | date.ts | YES | `[ ]` |
| 37 | date.time.ts | **NEEDS SPEC** | `[ ]` |
| 38 | date.unix.ts | YES | `[ ]` |
| 39 | expires.ts | YES | `[ ]` |
| 40 | hour.ts | YES | `[ ]` |
| 41 | minute.ts | YES | `[ ]` |
| 42 | time.ts | YES | `[ ]` |
| 43 | week.ts | YES | `[ ]` |

---

## 7. error/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 44 | error.ts | YES | `[ ]` |
| 45 | error.server.ts | **NEEDS SPEC** | `[ ]` |

---

## 8. file/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 46 | file.ts | **NEEDS SPEC** | `[ ]` |
| 47 | pdf.ts | **NEEDS SPEC** | `[ ]` |
| 48 | xml.ts | **NEEDS SPEC** | `[ ]` |

---

## 9. filter/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 49 | filter.ts | YES | `[ ]` |

---

## 10. function/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 50 | function.ts | YES | `[ ]` |
| 51 | function.boolean.ts | YES | `[ ]` |
| 52 | function.forward.ts | YES | `[ ]` |

---

## 11. getter/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 53 | getter.ts | YES | `[ ]` |
| 54 | getter.cache.ts | YES | `[ ]` |
| 55 | getter.map.ts | YES | `[ ]` |
| 56 | getter.util.ts | **NEEDS SPEC** | `[ ]` |
| 57 | type.ts | **NEEDS SPEC** | `[ ]` |

---

## 12. iterable/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 58 | iterable.ts | YES | `[ ]` |
| 59 | iterable.map.ts | **NEEDS SPEC** | `[ ]` |

---

## 13. map/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 60 | map.ts | **NEEDS SPEC** | `[ ]` |
| 61 | map.intersection.ts | **NEEDS SPEC** | `[ ]` |
| 62 | map.key.ts | YES | `[ ]` |

---

## 14. misc/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 63 | color.ts | **NEEDS SPEC** | `[ ]` |
| 64 | host.ts | **NEEDS SPEC** | `[ ]` |

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
| 78 | pay.ts | **NEEDS SPEC** | `[S]` |
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
| 92 | page.ts | **NEEDS SPEC** | `[ ]` |
| 93 | page.filter.ts | **NEEDS SPEC** | `[ ]` |

---

## 20. path/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 94 | path.ts | YES | `[ ]` |
| 95 | path.tree.ts | YES | `[ ]` |

---

## 21. promise/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 96 | promise.ts | YES | `[ ]` |
| 97 | promise.factory.ts | YES | `[ ]` |
| 98 | promise.limit.ts | YES | `[ ]` |
| 99 | promise.loop.ts | YES | `[ ]` |
| 100 | promise.ref.ts | YES | `[ ]` |
| 101 | promise.task.ts | YES | `[ ]` |
| 102 | promise.type.ts | **NEEDS SPEC** | `[ ]` |
| 103 | callback.ts | **NEEDS SPEC** | `[ ]` |
| 104 | is.ts | YES | `[ ]` |
| 105 | map.ts | **NEEDS SPEC** | `[ ]` |
| 106 | poll.ts | **NEEDS SPEC** | `[ ]` |
| 107 | use.ts | **NEEDS SPEC** | `[ ]` |
| 108 | wait.ts | **NEEDS SPEC** | `[ ]` |

---

## 22. relation/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 109 | relation.ts | YES | `[ ]` |

---

## 23. service/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 110 | handler.ts | YES | `[ ]` |
| 111 | handler.config.ts | YES | `[ ]` |
| 112 | typed.service.ts | YES | `[ ]` |

---

## 24. set/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 113 | set.ts | YES | `[ ]` |
| 114 | set.allowed.ts | YES | `[ ]` |
| 115 | set.decision.ts | YES | `[ ]` |
| 116 | set.delta.ts | YES | `[ ]` |
| 117 | set.hashset.ts | YES | `[ ]` |
| 118 | set.maybe.ts | **NEEDS SPEC** | `[ ]` |
| 119 | set.mode.ts | **NEEDS SPEC** | `[ ]` |
| 120 | set.selection.ts | YES | `[ ]` |

---

## 25. storage/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 121 | storage.ts | **NEEDS SPEC** | `[ ]` |
| 122 | storage.error.ts | YES | `[ ]` |
| 123 | storage.memory.ts | YES | `[ ]` |
| 124 | storage.object.ts | YES | `[ ]` |

---

## 26. string/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 125 | string.ts | YES | `[ ]` |
| 126 | char.ts | YES | `[ ]` |
| 127 | dencoder.ts | YES | `[ ]` |
| 128 | factory.ts | YES | `[ ]` |
| 129 | html.ts | YES | `[ ]` |
| 130 | json.ts | **NEEDS SPEC** | `[ ]` |
| 131 | mimetype.ts | **NEEDS SPEC** | `[ ]` |
| 132 | password.ts | **NEEDS SPEC** | `[ ]` |
| 133 | prefix.ts | YES | `[ ]` |
| 134 | record.ts | YES | `[ ]` |
| 135 | replace.ts | YES | `[ ]` |
| 136 | search.ts | YES | `[ ]` |
| 137 | sort.ts | YES | `[ ]` |
| 138 | transform.ts | YES | `[ ]` |
| 139 | tree.ts | YES | `[ ]` |
| 140 | url.ts | YES | `[ ]` |

---

## 27. tree/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 141 | tree.ts | **NEEDS SPEC** | `[ ]` |
| 142 | tree.array.ts | **NEEDS SPEC** | `[ ]` |
| 143 | tree.expand.ts | YES | `[ ]` |
| 144 | tree.explore.ts | YES | `[ ]` |
| 145 | tree.flatten.ts | YES | `[ ]` |

---

## 28. value/

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 146 | address.ts | YES | `[ ]` |
| 147 | bound.ts | YES | `[ ]` |
| 148 | build.ts | **NEEDS SPEC** | `[ ]` |
| 149 | comparator.ts | YES | `[ ]` |
| 150 | cron.ts | **NEEDS SPEC** | `[ ]` |
| 151 | decision.ts | **NEEDS SPEC** | `[ ]` |
| 152 | equal.ts | YES | `[ ]` |
| 153 | indexed.ts | YES | `[ ]` |
| 154 | label.ts | **NEEDS SPEC** | `[ ]` |
| 155 | map.ts | YES | `[ ]` |
| 156 | maybe.ts | YES | `[ ]` |
| 157 | maybe.type.ts | YES | `[ ]` |
| 158 | modifier.ts | **NEEDS SPEC** | `[ ]` |
| 159 | pixel.ts | **NEEDS SPEC** | `[ ]` |
| 160 | point.ts | YES | `[ ]` |
| 161 | sync.ts | **NEEDS SPEC** | `[ ]` |
| 162 | url.ts | YES | `[ ]` |
| 163 | use.ts | YES | `[ ]` |
| 164 | vector.ts | YES | `[ ]` |
| 165 | zoom.ts | **NEEDS SPEC** | `[ ]` |

---

## Test Subpackage (`packages/util/test/`)

| # | File | Spec? | JSDoc Status |
|---|------|-------|-------------|
| 166 | jest/jest.ts | YES (jest.spec.ts) | `[ ]` |
| 167 | jest/jest.fail.ts | NO (tested via jest.spec.ts) | `[ ]` |
| 168 | jest/jest.function.ts | YES | `[ ]` |
| 169 | jest/jest.wrap.ts | YES | `[ ]` |
| 170 | shared/shared.ts | YES (shared.spec.ts) | `[ ]` |
| 171 | shared/shared.fail.ts | YES | `[ ]` |
| 172 | shared/shared.function.ts | YES | `[ ]` |
| 173 | shared/shared.wrap.ts | YES | `[ ]` |

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

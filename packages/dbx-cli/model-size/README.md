# @dereekb/dbx-cli-model-size

A **design-time** calculator for Firestore snapshot converters. It generates a
sized sample model, runs it through a converter's **`to` conversion** (the
stored shape — dates become ISO strings, bitwise maps become numbers, etc.),
then `JSON.stringify`s the result and measures it against Firestore's **1 MB**
document limit. It also solves the inverse question: _how many elements of a
nested array/map fit before the document exceeds the limit?_

This is a tool you reach for while **designing models** — it is not wired into
any runtime CLI.

## Run it

```sh
MODEL_SIZE_PROFILE=packages/dbx-cli/model-size/example.profile.json \
  npx nx run dbx-cli-model-size:size
```

Add `MODEL_SIZE_JSON=1` to emit the structured report instead of the table.

## Profile

A profile is JSON. It names the converter by **source file** and (optionally)
**export**, then sizes the variable fields:

```jsonc
{
  "source": "./src/scratch/example.scratch.ts", // .ts file exporting the converter
  "export": "exampleScratchConverter",       // omit if the file exports one converter
  "limitBytes": 1048576,                      // default 1 MiB
  "includeOptional": true,                    // include optionalFirestore* fields (worst case)
  "defaults": { "string": 24, "number": 1000000, "arrayCount": 3, "mapCount": 3 },
  "fields": {
    "name": 40,            // string length
    "tags[]": 10,          // array element COUNT
    "meta.k": 12,          // sub-object child string length
    "entries[]": 200,      // object-array element COUNT
    "entries[].m": 80      // string length of `m` within each entry
  },
  "solveFor": "entries[]"  // report the max element count that fits
}
```

Path syntax for `fields` keys: `.` descends into sub-objects, `[]` marks an
array / object-array (its value is an element **count**), `{}` marks a map (its
value is a key **count**). A value on a string leaf sets its **length**; on a
number leaf it sets the **value**.

You can also supply a **theoretical object** verbatim via `sample` (inline) or
`sampleFile` (a JSON path); provided values are merged over the generated ones.

## Theoretical models

To size a model before it exists, author a converter in `src/scratch/` (see
`src/scratch/example.scratch.ts`) and point a profile at it. Scratch files other
than the committed example are gitignored.

## Notes

- The **stringified byte length** is the headline metric (per design choice). A
  secondary **Firestore-formula** estimate is also reported — it is closer to
  the real 1 MB trigger but ignores the document name/path and index entries.
- Converters that aren't barrel-exported are imported directly from their
  source `.ts` file; the tool therefore runs under vitest (which resolves the
  workspace TypeScript path aliases).

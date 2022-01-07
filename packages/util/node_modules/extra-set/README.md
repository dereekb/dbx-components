A [set] is a collection of unique values.<br>
:package: [NPM](https://www.npmjs.com/package/extra-set),
:smiley_cat: [GitHub](https://github.com/orgs/nodef/packages?repo_name=extra-set),
:running: [RunKit](https://npm.runkit.com/extra-set),
:vhs: [Asciinema](https://asciinema.org/a/339298),
:moon: [Minified](https://www.npmjs.com/package/extra-set.min),
:scroll: [Files](https://unpkg.com/extra-set/),
:newspaper: [JSDoc](https://nodef.github.io/extra-set/),
:blue_book: [Wiki](https://github.com/nodef/extra-set/wiki/).

Methods look like:
- `concat()`: doesn't modify the map itself (pure).
- `concat$()`: modifies the map itself (update).

Methods as separate packages:
- `@extra-set/concat`: use [rollup] to bundle this es module.
- `@extra-set/concat.min`: use in browser ([browserify], [uglify-js]).

> Stability: Experimental.

<br>

```javascript
const set = require("extra-set");
// import * as set from "extra-set";
// import * as set from "https://unpkg.com/extra-set@2.1.60/index.mjs"; (deno)

var x = new Set([1, 2, 3, 4, 5]);
var y = new Set([2, 4]);
set.difference(x, y);
// Set(3) { 1, 3, 5 }

var x = new Set([1, 2, 3]);
var y = new Set([3, 4]);
set.isDisjoint(x, y);
// false

var x = new Set([1, 2, 3, 4]);
var y = new Set([3, 4, 5, 6]);
set.symmetricDifference(x, y);
// Set(4) { 1, 2, 5, 6 }

var x = new Set([1, 2, 3]);
[...set.subsets(x)];
// [
//   Set(0) {},
//   Set(1) { 1 },
//   Set(1) { 2 },
//   Set(2) { 1, 2 },
//   Set(1) { 3 },
//   Set(2) { 1, 3 },
//   Set(2) { 2, 3 },
//   Set(3) { 1, 2, 3 }
// ]
```

<br>
<br>


## Index

| Method                | Action                                     |
| --------------------- | ------------------------------------------ |
| [is]                  | Checks if value is set.                    |
| [add]                 | Adds value to set.                         |
| [remove]              | Deletes a value.                           |
| [size]                | Gets size of set.                          |
|                       |
| [head]                | Gets first value.                          |
| [take]                | Keeps first n values only.                 |
| [shift]               | Removes first value.                       |
| [from]                | Creates a set from values.                 |
|                       |
| [concat]              | Appends values from sets.                  |
| [flat]                | Flattens nested set to given depth.        |
| [chunk]               | Breaks set into chunks of given size.      |
| [filterAt]            | Gets set with given values.                |
|                       |
| [map]                 | Updates values based on map function.      |
| [filter]              | Keeps values which pass a test.            |
| [reduce]              | Reduces values to a single value.          |
| [range]               | Finds smallest and largest entries.        |
| [count]               | Counts values which satisfy a test.        |
| [partition]           | Segregates values by test result.          |
| [cartesianProduct]    | Lists cartesian product of sets.           |
| [some]                | Checks if any value satisfies a test.      |
|                       |
| [union]               | Gives values present in any set.           |
| [intersection]        | Gives values present in both sets.         |
| [difference]          | Gives values of set not present in others. |
| [symmetricDifference] | Gives values not present in both sets.     |
| [isDisjoint]          | Checks if sets have no common values.      |
|                       |
| [value]               | Picks an arbitrary value.                  |
| [entry]               | Picks an arbitrary entry.                  |
| [subset]              | Picks an arbitrary subset.                 |
|                       |
| [isEmpty]             | Checks if set is empty.                    |
| [isEqual]             | Checks if two sets are equal.              |
| [compare]             | Compares two sets.                         |
| [find]                | Finds a value passing s test.              |
| [scanWhile]           | Finds first value not passing a test.      |

<br>
<br>

[![](https://img.youtube.com/vi/mvO6zaIUO18/maxresdefault.jpg)](https://www.youtube.com/watch?v=mvO6zaIUO18)

[set]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
[browserify]: https://www.npmjs.com/package/browserify
[rollup]: https://www.npmjs.com/package/rollup
[uglify-js]: https://www.npmjs.com/package/uglify-js
[is]: https://github.com/nodef/extra-set/wiki/is
[add]: https://github.com/nodef/extra-set/wiki/add
[remove]: https://github.com/nodef/extra-set/wiki/remove
[size]: https://github.com/nodef/extra-set/wiki/size
[head]: https://github.com/nodef/extra-set/wiki/head
[take]: https://github.com/nodef/extra-set/wiki/take
[shift]: https://github.com/nodef/extra-set/wiki/shift
[from]: https://github.com/nodef/extra-set/wiki/from
[concat]: https://github.com/nodef/extra-set/wiki/concat
[flat]: https://github.com/nodef/extra-set/wiki/flat
[chunk]: https://github.com/nodef/extra-set/wiki/chunk
[filterAt]: https://github.com/nodef/extra-set/wiki/filterAt
[map]: https://github.com/nodef/extra-set/wiki/map
[filter]: https://github.com/nodef/extra-set/wiki/filter
[reduce]: https://github.com/nodef/extra-set/wiki/reduce
[range]: https://github.com/nodef/extra-set/wiki/range
[count]: https://github.com/nodef/extra-set/wiki/count
[partition]: https://github.com/nodef/extra-set/wiki/partition
[cartesianProduct]: https://github.com/nodef/extra-set/wiki/cartesianProduct
[some]: https://github.com/nodef/extra-set/wiki/some
[union]: https://github.com/nodef/extra-set/wiki/union
[intersection]: https://github.com/nodef/extra-set/wiki/intersection
[difference]: https://github.com/nodef/extra-set/wiki/difference
[symmetricDifference]: https://github.com/nodef/extra-set/wiki/symmetricDifference
[isDisjoint]: https://github.com/nodef/extra-set/wiki/isDisjoint
[value]: https://github.com/nodef/extra-set/wiki/value
[entry]: https://github.com/nodef/extra-set/wiki/entry
[subset]: https://github.com/nodef/extra-set/wiki/subset
[isEmpty]: https://github.com/nodef/extra-set/wiki/isEmpty
[isEqual]: https://github.com/nodef/extra-set/wiki/isEqual
[compare]: https://github.com/nodef/extra-set/wiki/compare
[find]: https://github.com/nodef/extra-set/wiki/find
[scanWhile]: https://github.com/nodef/extra-set/wiki/scanWhile

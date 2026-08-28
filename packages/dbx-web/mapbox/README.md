@dereekb/dbx-web/mapbox
=======

The sources for this package are in the main [@dereekb/dbx-components](https://github.com/dereekb/dbx-components) repo. Please file issues and pull requests against that repo.

## Required build asset: the mapbox-gl web worker

Apps using `provideDbxMapbox()` must copy mapbox-gl's prebuilt CSP web worker into their
assets. Add this entry to the `assets` array of the app's `build` target in `project.json`:

```json
{
  "input": "node_modules/mapbox-gl/dist",
  "glob": "mapbox-gl-csp-worker.js",
  "output": "assets/mapbox-gl"
}
```

`provideDbxMapbox()` registers an app initializer that points `mapboxgl.workerUrl` at
`assets/mapbox-gl/mapbox-gl-csp-worker.js` before any map is created, and logs an error
naming this snippet if the asset is not reachable.

### Why

mapbox-gl builds its web worker by stringifying two of its own functions into a `Blob`.
Only those function *bodies* are serialized, so anything the bundler hoists to module scope
is missing inside the worker. `@angular/build` unconditionally disables esbuild's
`object-rest-spread` support (a V8 performance workaround, still present in Angular 22), which
rewrites every object spread into exactly such a hoisted helper. From mapbox-gl **3.26.0** on
there are object spreads in the serialized worker code, so the worker dies while loading tiles:

```
ReferenceError: __spreadValues is not defined   at Ie.loadTile
```

(In a production build the helper name is minified, so the same failure reads as
`ReferenceError: <mangled> is not defined`.)

Loading the worker from a real file instead of the generated blob — mapbox's own documented
`workerUrl` escape hatch — avoids the problem entirely at any mapbox-gl version. Copying the
asset out of the app's own `node_modules` keeps the worker in version lockstep with the
`mapbox-gl` the app bundles.

### Options

`provideDbxMapbox({ worker })` accepts:

- `workerUrl` — serve the asset from somewhere other than the default path.
- `enabled: false` — restore mapbox-gl's stock blob worker. Only safe below mapbox-gl 3.26.0.

Note the CSP worker does not support the dynamically loaded RTL text plugin
(`setRTLTextPlugin`) or `addTileProvider` modules, which rely on a hook the blob worker
provides. Apps needing those must set `enabled: false` and stay below mapbox-gl 3.26.0.

License: MIT

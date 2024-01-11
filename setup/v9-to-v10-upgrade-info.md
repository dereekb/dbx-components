# Steps
There are first 

## Migrations
We are jumping from Nx version 14 to version 16. It is important to run two independent migrations to ensure everything gets up to date properly.

### Migrate to Nx 15
First run the following:

```nx migrate 15.9```

This will setup the migration.json. It will also modify package.json, but it is best to manually check for the latest compatable versions of the dependencies. Compare the changes with the package.json for the v10 of dbxcomponents.

#### Modify migration.json
There are some migrations that are not applicable to our project or that we will need to manually resolve. These are the recommended ones to remove:

- update-configs-jest-29
- update-tests-jest-29
- switch-to-jasmine-marbles
- update-platform-server-exports
- migration-v15-router-link-with-href
- migration-v15-relative-link-resolution
- update-karma-main-file

#### Run the migrations

```npx nx migrate --run-migrations```

(After doing this step it is a good idea to commit the changes on git before continuing)

### Migrate to Nx 16
Clear or delete migrations.json now. Next we run the following:

```nx migrate 16.10```

This will setup the new migration.json.

#### Modify migration.json
There are some migrations that are not applicable to our project or that we will need to manually resolve. These are the recommended ones to remove:

- migration-v16-remove-module-id
- migration-v16-guard-and-resolve-interfaces (Unless using Angular Router. You may still need to resolve this manually.)

#### Run the migrations

```npx nx migrate --run-migrations```

(After doing this step it is a good idea to commit the changes on git before continuing)

## Manual Fixes and Changes

### Files to Copy from dbx-components
Copy the new version of the following files:

- jest.preset.ts
- jest.setup.angular.ts
- make-env.js

### Remove updateBuildableProjectDepsInPackageJson from project.json
Remove the configuration of `updateBuildableProjectDepsInPackageJson` from all project.json files

### Replacing Dependencies
Replace the following dependencies:

- Remove`@angular/flex-layout` and replace with `@ngbracket/ngx-layout`. Also update any imports in .ts files to reflect this change.

### Update package.json
Update the @dereekb dependencies to v10. There may be other dependencies that your project uses that need to be updated so they can use Angular 16.

### Update Node
Node16 needs to be replaced with Node18. Here are some of the files that need to be updated:

- `.circleci/config.yml`: Update the orbs ( -> `circleci/node@5.1.1`, `nrwl/nx@1.6.2`) and image ( -> `cimg/node:18.19`). 
- `Dockerfile`: Update from FROM line to be `FROM node:18.19-bullseye`
- `firebase.json`: Need to update functions to use nodejs18. Update engine to be 18.
  
## Angular Material 16
The biggest change comes from Angular Material 16. Various CSS styles changed, so any SCSS files that use material classes might need to be updated.

### Update styles.scss
With v16, Material no longer exports all css classes by default. You can update the configuration to either import every specific component that your app uses, or import everything.

If using multiple themes, skip to the multiple themes setup below.

First, cut the `$app-typography-config` declared here, and don't pass it to the `core()` functions anymore. Past the typography definition at the top of `styles/_app.scss`.

### Update _app.scss
Move the typography config to the to of this file, after the `@use` statements.

```
$app-typography-config: mat.define-typography-config(
  $font-family: 'Fira Sans'
);
```

Find the `$app-mat-theme` variable, and update the `mat.define-light-theme(...)` inputs:
- set density to 0
- set typography to `$app-typography-config`

### Alternative Changes (If using multiple themes)
If using multiple themes we'll need to define a few things. Add the following snippets after core but before the theme declarations:

```
// define all densities here since each theme uses the same density
@include mat.all-component-densities(0);
```

```
// define the topographies here since the themes use the same and we don't want to re-declare the config
@include mat.all-component-typographies($app-typography-config);
@include dbx.all-component-typographies($app-typography-config);
@include dbx-form.all-component-typographies($app-typography-config);
@include dbx-firebase.all-component-typographies($app-typography-config);
```

## Code Fixes

TODO...

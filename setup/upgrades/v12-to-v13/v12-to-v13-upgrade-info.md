# dbx-components v12 to v13 upgrade info
- Update Nx to v22
- Update Angular to v21

## Migrations
We are jumping from Nx version 20 to version 22. It is important to run two independent migrations to ensure everything gets up to date properly.

### Migrate to Nx 22
Nx 22 release info is here:

https://nx.dev/blog/nx-22-release

First run the following:

```nx migrate 22```

This will setup the migration.json. It will also modify package.json, but it is best to manually check for the latest compatable versions of the dependencies. Compare the changes with the `package.json` for the v12 of dbxcomponents.

#### Run the migrations
- run ```npx nx migrate --run-migrations```. No errors were encountered while upgrading.

After migrating, you can run ```nx reset``` to reset the workspace's cache if you encounter issues with building.

#### Nx Agent Skills
You might find it useful to install the nx skills here if you are using AI agents like Claude:

https://nx.dev/blog/nx-ai-agent-skills

### Updating Packages
Check the updated `package.json` for more info.

#### Angular
- Updated to v21.0.0

#### Ngx Formly
- At the time of writing, the update to v7.1.0 isn't compatable with angular 21.
- Additionally, there is an error within the material package:

```
✘ [ERROR] No matching export in "node_modules/@angular/material/fesm2022/core.mjs" for import "MatCommonModule"
    node_modules/@ngx-formly/material/fesm2022/ngx-formly-material-slider.mjs:11:9:
      11 │ import { MatCommonModule, MatRippleModule } from '@angular/materia...
```

#### Ngx Editor
- Replaced ```ngx-editor``` with ```@bobbyquantum/ngx-editor```, as the original package is no longer maintained. See https://github.com/bobbyquantum/ngx-editor

#### @angular/fire
At the time of writing, @angular/fire still hasn't had an Angular 21 update, possibly due to rxfire not being updated yet. We created a special branch on dereekb/rxfire that has the Angular 21 update. We will use that until the official package is updated.

You'll need to specify the following overrides in `package.json`:

```json
"overrides": {
  "@angular/fire": {
    "rxfire": "git+https://git@github.com/dereekb/rxfire#606da27059f8fce2563d6e5a79ec4c7d0843a942",
    "firebase-tools": "15.7.0"
  }
}
```

#### date-fns
- Updated to v4.1.0
- `date-fns-tz` supports date-fns v4, so we don't need to update it yet.
- In the future, we will also remove `date-fns-tz` and replace it with `date-fns/tz`.

#### ngx-material-intl-tel-input
- Has been added to replace `ngx-mat-intl-tel-input` that hasn't been updated in a while.

#### @jscutlery/semver
- Removed. Will be using Nx Release tools from now on since Nx has updating release tooling.
- See https://nx.dev/docs/features/manage-releases for more info. Updated release section will be below.

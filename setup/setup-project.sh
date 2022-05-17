#!/bin/bash
## Usage:
# ./setup-project.sh my-firebase-project-id
# The prefix is optional. It should be a single word.

# Before running this script, you should have done the following and have the relevant information:
# - Created a git repo (on github or other place)
# If not provided, the origin will not be set.
GIT_REPO_ORIGIN=                            # example: git@github.com:dereekb/gethapier.git
CI_GIT_USER_EMAIL=ci@example.dereekb.com    # git email to use
CI_GIT_USER_NAME=ci                         # git username to use in CI deployments

# - Created a project on firebase. This step is required.
FIREBASE_PROJECT_ID=${1?:'firebase project id is required.'}  # example: gethapier
INPUT_CODE_PREFIX=${2:-app}                                   # example: gethapier
FIREBASE_BASE_EMULATORS_PORT=${3:-9100}                       # example: 9100
PARENT_DIRECTORY=${4:-'../../'}                               # parent directory to create this project within. Defaults to relative to this script's space within dbx-components.

# - Project Details
NAME=$FIREBASE_PROJECT_ID
PROJECT_NAME=$FIREBASE_PROJECT_ID
ANGULAR_APP_PREFIX=$FIREBASE_PROJECT_ID

# The app prefix is used in Angular and Nest classes as the prefix for classes/components
APP_CODE_PREFIX="$(tr '[:lower:]' '[:upper:]' <<< ${INPUT_CODE_PREFIX:0:1})${INPUT_CODE_PREFIX:1}"
APP_CODE_PREFIX_LOWER="$(tr '[:upper:]' '[:lower:]' <<< ${INPUT_CODE_PREFIX})"
APP_CODE_PREFIX_UPPER="$(tr '[:lower:]' '[:upper:]' <<< ${INPUT_CODE_PREFIX})"

# shared angular library 
ANGULAR_COMPONENTS_NAME=$PROJECT_NAME-components
 # shared firebase library 
FIREBASE_COMPONENTS_NAME=$PROJECT_NAME-firebase
# app that is deployed
ANGULAR_APP_NAME=$PROJECT_NAME
# firebase functions app that is deployed
API_APP_NAME=$PROJECT_NAME-api
# E2E project (work in progress)
E2E_APP_NAME=$PROJECT_NAME-e2e

APPS_FOLDER=apps  # don't change
ANGULAR_APP_FOLDER=$APPS_FOLDER/$ANGULAR_APP_NAME
API_APP_FOLDER=$APPS_FOLDER/$API_APP_NAME
E2E_APP_FOLDER=$APPS_FOLDER/$E2E_APP_NAME

COMPONENTS_FOLDER=components
ANGULAR_COMPONENTS_FOLDER=$COMPONENTS_FOLDER/$ANGULAR_COMPONENTS_NAME
FIREBASE_COMPONENTS_FOLDER=$COMPONENTS_FOLDER/$FIREBASE_COMPONENTS_NAME

APPS_DIST_FOLDER=dist/$APPS_FOLDER
ANGULAR_APP_DIST_FOLDER=$APPS_DIST_FOLDER/$ANGULAR_APP_NAME
API_APP_DIST_FOLDER=$APPS_DIST_FOLDER/$API_APP_NAME

COMPONENTS_DIST_FOLDER=dist/$COMPONENTS_FOLDER
ANGULAR_COMPONENTS_DIST_FOLDER=$COMPONENTS_DIST_FOLDER/$ANGULAR_COMPONENTS_NAME
FIREBASE_COMPONENTS_DIST_FOLDER=$COMPONENTS_DIST_FOLDER/$FIREBASE_COMPONENTS_NAME

FIREBASE_EMULATOR_UI_PORT=$FIREBASE_BASE_EMULATORS_PORT
FIREBASE_EMULATOR_HOSTING_PORT=$(expr $FIREBASE_BASE_EMULATORS_PORT + 1)
FIREBASE_EMULATOR_FUNCTIONS_PORT=$(expr $FIREBASE_BASE_EMULATORS_PORT + 2)
FIREBASE_EMULATOR_AUTH_PORT=$(expr $FIREBASE_BASE_EMULATORS_PORT + 3)
FIREBASE_EMULATOR_FIRESTORE_PORT=$(expr $FIREBASE_BASE_EMULATORS_PORT + 4)
FIREBASE_EMULATOR_PUBSUB_PORT=$(expr $FIREBASE_BASE_EMULATORS_PORT + 5)
FIREBASE_EMULATOR_STORAGE_PORT=$(expr $FIREBASE_BASE_EMULATORS_PORT + 6)
FIREBASE_LOCALHOST=0.0.0.0
FIREBASE_EMULATOR_PORT_RANGE="$FIREBASE_EMULATOR_UI_PORT-$FIREBASE_EMULATOR_STORAGE_PORT"

ANGULAR_APP_PORT=$(expr $FIREBASE_BASE_EMULATORS_PORT + 10)

# - Setup Details

# Log into Firebase
echo "First log into Firebase if you're are not already logged in already."
firebase login

## Setup NX Project
cd $PARENT_DIRECTORY

# Create NX Workspace
echo "Creating new dbx-components project in folder \"$NAME\" with project name \"$PROJECT_NAME\"..."
npx --yes create-nx-workspace --interactive=false --style=scss --preset=angular --name=$NAME --appName=$PROJECT_NAME --packageManager=npm --nxCloud=true

# Enter Folder
echo "Entering new project folder, \"$NAME\""
cd $NAME

# change git branch to setup
git branch setup
git checkout setup

# remove decorate angular cli
rm decorate-angular-cli.js
npx --yes json -I -f package.json -e "this.scripts={ postinstall: 'ngcc --properties es2015 browser module main', prepare: 'husky install' };";

# Commit the cloud initialization
git add --all
git commit -m "init nx-cloud"

# update nx to the latest version and commit
nx migrate latest
npm install

if test -f "migrations.json"; then   # migrate if it is available
  nx migrate --run-migrations
  rm migrations.json                 # remove migrations file
fi

npx --yes json -I -f nx.json -e "this.workspaceLayout = { appsDir: '$APPS_FOLDER', libsDir: '$COMPONENTS_FOLDER' }";

git add --all
git commit -m "updated nx to latest version"

# Add Nest App - https://nx.dev/packages/nest
npm install -D @nrwl/nest           # install the nest generator
nx g @nrwl/nest:app $API_APP_NAME

git add --all
git commit -m "added nest app"

# Add App Components
nx g @nrwl/angular:library --name=$ANGULAR_COMPONENTS_NAME --buildable --publishable --importPath $ANGULAR_COMPONENTS_NAME --standaloneConfig=true --simpleModuleName=true

git add --all
git commit -m "added angular components package"

# Add Firebase Component
npm install -D @nrwl/node
nx g @nrwl/node:library --name=$FIREBASE_COMPONENTS_NAME --buildable --publishable --importPath $FIREBASE_COMPONENTS_NAME

git add --all
git commit -m "added firebase components package"

# Init Firebase
echo "Follow the instructions to init Firebase for this project."
echo "Instructions: Follow the prompt and log into the existing project you described above."
echo "Instructions: Setting up Firebase Storage - Hit Enter to keep default name."
firebase init storage

echo "Instructions: Firebase Firestore - Keep the rules and indexes the default name."
echo "NOTE: If the project has configuration already, it will pull the current configuration down from Firebase."
(sleep 1; echo; sleep 1; echo;) | firebase init firestore

echo "Instructions: Firebase Hosting - Setup single page application. Do not setup github actions."
(sleep 2; echo; sleep 1; echo 'y'; sleep 1; echo 'N'; sleep 1; echo 'n') | firebase init hosting

echo "Instructions: Firebase Functions - This configuration will be ignored."
(sleep 1; echo; sleep 1; echo 'N'; sleep 1; echo 'N';) | firebase init functions

# remove the public folder. We will use the $ANGULAR_APP_DIST_FOLDER instead.
rm -r public

# remove the functions folder. We will use the $API_APP_DIST_FOLDER instead.
rm -r functions

# edit firebase.json to have the correct configuration.

# Hosting
npx --yes json -I -f firebase.json -e "this.hosting.site='$PROJECT_NAME'; this.hosting.public='$ANGULAR_APP_DIST_FOLDER'; this.hosting.ignore=['firebase.json', '**/.*', '**/node_modules/**']";

# Functions
npx --yes json -I -f firebase.json -e "this.functions={ source:'$API_APP_DIST_FOLDER', runtime: 'nodejs16', engines: { node: '16' }, ignore: ['firebase.json', '**/.*', '**/node_modules/**'] }";

# Emulators
npx --yes json -I -f firebase.json -e "this.emulators={ ui: { host: '$FIREBASE_LOCALHOST', enabled: true, port: $FIREBASE_EMULATOR_UI_PORT }, hosting: { host: '$FIREBASE_LOCALHOST', port: $FIREBASE_EMULATOR_HOSTING_PORT }, functions: { host: '$FIREBASE_LOCALHOST', port: $FIREBASE_EMULATOR_FUNCTIONS_PORT }, auth: { host: '$FIREBASE_LOCALHOST', port: $FIREBASE_EMULATOR_AUTH_PORT }, firestore: { host: '$FIREBASE_LOCALHOST', port: $FIREBASE_EMULATOR_FIRESTORE_PORT }, pubsub: { host: '$FIREBASE_LOCALHOST', port: $FIREBASE_EMULATOR_PUBSUB_PORT }, storage: { host: '$FIREBASE_LOCALHOST', port: $FIREBASE_EMULATOR_STORAGE_PORT } };";

git add --all
git commit -m "added firebase configuration"

# Install npm dependencies
npm i @dereekb/dbx-analytics @dereekb/dbx-web @dereekb/dbx-form @dereekb/firebase @dereekb/firebase-server @dereekb/dbx-firebase --force  # TODO: Remove force once possible.

git add --all
git commit -m "added @dereekb dependencies"

# Docker
# Create docker files
echo "Copying Docker files from @dereekb/dbx-components"
curl https://raw.githubusercontent.com/dereekb/dbx-components/main/Dockerfile -o Dockerfile.tmp
sed "s/demo-api/$API_APP_NAME/g" Dockerfile.tmp > Dockerfile
rm Dockerfile.tmp

curl https://raw.githubusercontent.com/dereekb/dbx-components/main/docker-compose.yml -o docker-compose.yml.tmp
sed -e "s/demo-api-server/$API_APP_NAME-server/g" -e "s/dereekb-components/$FIREBASE_PROJECT_ID/g" -e "s/9900-9906/$FIREBASE_EMULATOR_PORT_RANGE/g" docker-compose.yml.tmp > docker-compose.yml
rm docker-compose.yml.tmp

# download .gitignore
curl https://raw.githubusercontent.com/dereekb/dbx-components/main/.gitignore -o .gitignore

# download additional utility scripts
curl https://raw.githubusercontent.com/dereekb/dbx-components/main/exec-with-emulator.sh -o exec-with-emulator.sh.tmp
sed -e "s/demo-api-server/$API_APP_NAME-server/g" -e "s/demo-api/$API_APP_NAME/g" exec-with-emulator.sh.tmp > exec-with-emulator.sh
rm exec-with-emulator.sh.tmp
chmod +x exec-with-emulator.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/main/reset-emulator-data.sh -o reset-emulator-data.sh
chmod +x reset-emulator-data.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/main/reset.sh -o reset.sh
chmod +x reset.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/main/down.sh -o down.sh
chmod +x down.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/main/test-all.sh -o test-all.sh
chmod +x test-all.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/main/run-server.sh -o run-server.sh.tmp
sed -e "s/demo-api-server/$API_APP_NAME-server/g" -e "s/demo-api/$API_APP_NAME/g" run-server.sh.tmp > run-server.sh
rm run-server.sh.tmp
chmod +x run-server.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/main/serve-server.sh -o serve-server.sh.tmp
sed -e "s/demo-api-server/$API_APP_NAME-server/g" -e "s/demo-api/$API_APP_NAME/g" serve-server.sh.tmp > serve-server.sh
rm serve-server.sh.tmp
chmod +x serve-server.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/main/serve-web.sh -o serve-web.sh.tmp
sed -e "s/demo/$ANGULAR_APP_NAME/g" serve-web.sh.tmp > serve-web.sh
rm serve-web.sh.tmp
chmod +x serve-web.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/main/test-demo-api.sh -o test-$API_APP_NAME.sh.tmp
sed -e "s/demo-api/$API_APP_NAME/g" test-$API_APP_NAME.sh.tmp > test-$API_APP_NAME.sh
rm test-$API_APP_NAME.sh.tmp
chmod +x test-$API_APP_NAME.sh

git add --all
git commit -m "added Docker files and other utility files"

# add semver for semantic versioning and linting for commits
npm install -D @jscutlery/semver
curl https://raw.githubusercontent.com/dereekb/dbx-components/main/.commitlintrc.json -o .commitlintrc.json

mkdir .husky
curl https://raw.githubusercontent.com/dereekb/dbx-components/main/.husky/commit-msg -o .husky/commit-msg
npm run prepare

mkdir -p ./.github/workflows
curl https://raw.githubusercontent.com/dereekb/dbx-components/main/.github/workflows/commitlint.yml -o ./.github/workflows/commitlint.yml

git add --all
git commit -m "added semver and commit linting"

# add jest setup/configurations
npm install -D jest-date jest-junit
rm jest.preset.js

curl https://raw.githubusercontent.com/dereekb/dbx-components/main/jest.preset.ts -o jest.preset.ts
curl https://raw.githubusercontent.com/dereekb/dbx-components/main/jest.setup.ts -o jest.setup.ts

# add env files to ensure that jest CI tests export properly.
mkdir tmp # TODO: Change from /develop to /main later.
curl https://raw.githubusercontent.com/dereekb/dbx-components/develop/setup/templates/apps/.env -o tmp/env.tmp
sed -e "s/APP_ID/$ANGULAR_APP_NAME/g" tmp/env.tmp > $ANGULAR_APP_FOLDER/.env
sed -e "s/APP_ID/$API_APP_NAME/g" tmp/env.tmp > $API_APP_FOLDER/.env
sed -e "s/APP_ID/$E2E_APP_NAME/g" tmp/env.tmp > $E2E_APP_FOLDER/.env
sed -e "s/APP_ID/$ANGULAR_COMPONENTS_NAME/g" tmp/env.tmp > $ANGULAR_COMPONENTS_FOLDER/.env
sed -e "s/APP_ID/$FIREBASE_COMPONENTS_NAME/g" tmp/env.tmp > $FIREBASE_COMPONENTS_FOLDER/.env

# make build-base and run-tests cacheable in nx cloud
npx --yes json -I -f nx.json -e "this.tasksRunnerOptions.default.options.cacheableOperations=Array.from(new Set([...this.tasksRunnerOptions.default.options.cacheableOperations, ...['build-base', 'run-tests']]));";

git add --all
git commit -m "added jest configurations"

# Add CircleCI Config
echo "Copying CircleCI Configurations."
echo "BEFORE CIRCLECI USE - Please update configuration on CircleCI and in \".circleci/config.yml\""
mkdir .circleci
curl https://raw.githubusercontent.com/dereekb/dbx-components/develop/setup/templates/.circleci/config.yml -o .circleci/config.yml.tmp
sed -e "s/CI_GIT_USER_EMAIL/$CI_GIT_USER_EMAIL/g" -e "s/CI_GIT_USER_NAME/$CI_GIT_USER_NAME/g" -e "s/ANGULAR_APP_NAME/$ANGULAR_APP_NAME/g"  -e "s/API_APP_NAME/$API_APP_NAME/g" -e "s/E2E_APP_NAME/$E2E_APP_NAME/g" .circleci/config.yml.tmp > .circleci/config.yml
rm .circleci/config.yml.tmp

git add --all
git commit -m "added circleci configrations"

# Apply Project Configurations
echo "Applying Configuration to Projects"
curl https://raw.githubusercontent.com/dereekb/dbx-components/develop/setup/templates/workspace.json -o ./workspace.json.tmp
sed -e "s:ANGULAR_APP_FOLDER:$ANGULAR_APP_FOLDER:g" -e "s:API_APP_FOLDER:$API_APP_FOLDER:g" -e "s:E2E_APP_FOLDER:$E2E_APP_FOLDER:g" -e "s:FIREBASE_COMPONENTS_FOLDER:$FIREBASE_COMPONENTS_FOLDER:g" -e "s:ANGULAR_COMPONENTS_FOLDER:$ANGULAR_COMPONENTS_FOLDER:g" -e "s:ANGULAR_APP_NAME:$ANGULAR_APP_NAME:g" -e "s:API_APP_NAME:$API_APP_NAME:g" -e "s:E2E_APP_NAME:$E2E_APP_NAME:g" -e "s:FIREBASE_COMPONENTS_NAME:$FIREBASE_COMPONENTS_NAME:g" -e "s:ANGULAR_COMPONENTS_NAME:$ANGULAR_COMPONENTS_NAME:g" ./workspace.json.tmp > ./workspace.json
rm ./workspace.json.tmp
rm ./angular.json

curl https://raw.githubusercontent.com/dereekb/dbx-components/develop/setup/templates/project.json -o ./project.json

rm $ANGULAR_APP_FOLDER/project.json
curl https://raw.githubusercontent.com/dereekb/dbx-components/develop/setup/templates/apps/app/project.json -o $ANGULAR_APP_FOLDER/project.json.tmp
sed -e "s:ANGULAR_APP_DIST_FOLDER:$ANGULAR_APP_DIST_FOLDER:g" -e "s:ANGULAR_APP_FOLDER:$ANGULAR_APP_FOLDER:g" -e "s:ANGULAR_APP_NAME:$ANGULAR_APP_NAME:g" -e "s:ANGULAR_APP_PORT:$ANGULAR_APP_PORT:g" $ANGULAR_APP_FOLDER/project.json.tmp > $ANGULAR_APP_FOLDER/project.json
rm $ANGULAR_APP_FOLDER/project.json.tmp

rm $API_APP_FOLDER/project.json
curl https://raw.githubusercontent.com/dereekb/dbx-components/develop/setup/templates/apps/api/project.json -o $API_APP_FOLDER/project.json.tmp
sed -e "s:API_APP_DIST_FOLDER:$API_APP_DIST_FOLDER:g" -e "s:API_APP_FOLDER:$API_APP_FOLDER:g" -e "s:API_APP_NAME:$API_APP_NAME:g" $API_APP_FOLDER/project.json.tmp > $API_APP_FOLDER/project.json
rm $API_APP_FOLDER/project.json.tmp

rm $ANGULAR_COMPONENTS_FOLDER/project.json
curl https://raw.githubusercontent.com/dereekb/dbx-components/develop/setup/templates/components/app/project.json -o $ANGULAR_COMPONENTS_FOLDER/project.json.tmp
sed -e "s:ANGULAR_COMPONENTS_DIST_FOLDER:$ANGULAR_COMPONENTS_DIST_FOLDER:g" -e "s:ANGULAR_COMPONENTS_FOLDER:$ANGULAR_COMPONENTS_FOLDER:g" -e "s:ANGULAR_APP_PREFIX:$ANGULAR_APP_PREFIX:g" -e "s:ANGULAR_COMPONENTS_NAME:$ANGULAR_COMPONENTS_NAME:g" $ANGULAR_COMPONENTS_FOLDER/project.json.tmp > $ANGULAR_COMPONENTS_FOLDER/project.json
rm $ANGULAR_COMPONENTS_FOLDER/project.json.tmp

rm $FIREBASE_COMPONENTS_FOLDER/project.json
curl https://raw.githubusercontent.com/dereekb/dbx-components/develop/setup/templates/components/firebase/project.json -o $FIREBASE_COMPONENTS_FOLDER/project.json.tmp
sed -e "s:FIREBASE_COMPONENTS_DIST_FOLDER:$FIREBASE_COMPONENTS_DIST_FOLDER:g" -e "s:FIREBASE_COMPONENTS_FOLDER:$FIREBASE_COMPONENTS_FOLDER:g" -e "s:FIREBASE_COMPONENTS_NAME:$FIREBASE_COMPONENTS_NAME:g" $FIREBASE_COMPONENTS_FOLDER/project.json.tmp > $FIREBASE_COMPONENTS_FOLDER/project.json
rm $FIREBASE_COMPONENTS_FOLDER/project.json.tmp

# add settings to tsconfig.base.json
npx --yes json -I -f tsconfig.base.json -e "this.compilerOptions={ ...this.compilerOptions, strict: true, allowSyntheticDefaultImports: true, resolveJsonModule: true }";

git add --all
git commit -m "added project configurations"

# Apply Project Templates
echo "Applying Templates to Projects"

download_ts_file () {
  # downloads and replaces the placeholder content in the file with the content for the project
  local DOWNLOAD_PATH=$1
  local TARGET_FOLDER=$2
  local FILE_PATH=$3
  local FULL_FILE_PATH=$TARGET_FOLDER/$FILE_PATH
  curl $DOWNLOAD_PATH/$FILE_PATH -o $FULL_FILE_PATH.tmp
  sed -e "s:APP_CODE_PREFIX_UPPER:$APP_CODE_PREFIX_UPPER:g" -e "s:APP_CODE_PREFIX_LOWER:$APP_CODE_PREFIX_LOWER:g" -e "s:APP_CODE_PREFIX:$APP_CODE_PREFIX:g" -e "s:FIREBASE_COMPONENTS_NAME:$FIREBASE_COMPONENTS_NAME:g" -e "s:ANGULAR_COMPONENTS_NAME:$ANGULAR_COMPONENTS_NAME:g" $FULL_FILE_PATH.tmp > $FULL_FILE_PATH
  rm $FULL_FILE_PATH.tmp
}

### Setup app components
download_app_ts_file () {
  local FILE_PATH=$1
  local TARGET_FOLDER=$ANGULAR_COMPONENTS_FOLDER
  local DOWNLOAD_PATH=https://raw.githubusercontent.com/dereekb/dbx-components/develop/setup/templates/components/app
  download_ts_file "$DOWNLOAD_PATH" "$TARGET_FOLDER" "$FILE_PATH"
}

rm $ANGULAR_COMPONENTS_FOLDER/src/index.ts
echo "export * from './lib'" > $ANGULAR_COMPONENTS_FOLDER/src/index.ts

rm -r $ANGULAR_COMPONENTS_FOLDER/src/lib
mkdir $ANGULAR_COMPONENTS_FOLDER/src/lib
download_app_ts_file "src/lib/index.ts"
download_app_ts_file "src/lib/root.shared.module.ts"
download_app_ts_file "src/lib/app.shared.module.ts"

mkdir $ANGULAR_COMPONENTS_FOLDER/src/lib/modules
download_app_ts_file "src/lib/modules/index.ts"

mkdir $ANGULAR_COMPONENTS_FOLDER/src/lib/services
download_app_ts_file "src/lib/services/index.ts"

git add --all
git commit -m "setup app components"

### Setup api components
download_firebase_ts_file () {
  local FILE_PATH=$1
  local TARGET_FOLDER=$FIREBASE_COMPONENTS_FOLDER
  local DOWNLOAD_PATH=https://raw.githubusercontent.com/dereekb/dbx-components/develop/setup/templates/components/firebase
  download_ts_file "$DOWNLOAD_PATH" "$TARGET_FOLDER" "$FILE_PATH"
}

## Lib Folder
rm -r $FIREBASE_COMPONENTS_FOLDER/src/lib
mkdir -p $FIREBASE_COMPONENTS_FOLDER/src/lib

rm $FIREBASE_COMPONENTS_FOLDER/src/index.ts
echo "export * from './lib'" > $FIREBASE_COMPONENTS_FOLDER/src/index.ts

download_firebase_ts_file "src/lib/index.ts"
download_firebase_ts_file "src/lib/collection.ts"
download_firebase_ts_file "src/lib/functions.ts"

# Example Folder
mkdir $FIREBASE_COMPONENTS_FOLDER/src/lib/example
download_firebase_ts_file "src/lib/example/example.action.ts"
download_firebase_ts_file "src/lib/example/example.api.ts"
download_firebase_ts_file "src/lib/example/example.query.ts"
download_firebase_ts_file "src/lib/example/example.ts"
download_firebase_ts_file "src/lib/example/index.ts"

git add --all
git commit -m "setup api components"

### Setup Angular App
download_angular_ts_file () {
  local FILE_PATH=$1
  local TARGET_FOLDER=$ANGULAR_APP_FOLDER
  local DOWNLOAD_PATH=https://raw.githubusercontent.com/dereekb/dbx-components/develop/setup/templates/apps/app
  download_ts_file "$DOWNLOAD_PATH" "$TARGET_FOLDER" "$FILE_PATH"
}

download_angular_ts_file "src/style.scss"
download_angular_ts_file "src/main.ts"
download_angular_ts_file "src/root.module.ts"
download_angular_ts_file "src/root.firebase.module.ts"

rm -r $ANGULAR_APP_FOLDER/src/style
mkdir $ANGULAR_APP_FOLDER/src/style
download_angular_ts_file "src/style/_app.scss"
download_angular_ts_file "src/style/_style.scss"
download_angular_ts_file "src/style/_variables.scss"

rm -r $ANGULAR_APP_FOLDER/src/environments
mkdir $ANGULAR_APP_FOLDER/src/environments
download_angular_ts_file "src/environments/base.ts"
download_angular_ts_file "src/environments/environment.prod.ts"
download_angular_ts_file "src/environments/environment.ts"

rm -r $ANGULAR_APP_FOLDER/src/app
mkdir -p $ANGULAR_APP_FOLDER/src/app
download_angular_ts_file "src/app/app.router.ts"
download_angular_ts_file "src/app/app.module.ts"

mkdir $ANGULAR_APP_FOLDER/src/app/components
mkdir $ANGULAR_APP_FOLDER/src/app/container
download_angular_ts_file "src/app/container/layout.component.html"
download_angular_ts_file "src/app/container/layout.component.ts"

mkdir $ANGULAR_APP_FOLDER/src/app/state
download_angular_ts_file "src/app/state/app.state.ts"
download_angular_ts_file "src/app/state/entity-metadata.ts"

mkdir $ANGULAR_APP_FOLDER/src/app/modules
mkdir $ANGULAR_APP_FOLDER/src/app/modules/app
download_angular_ts_file "src/app/modules/app/app.module.ts"
download_angular_ts_file "src/app/modules/app/app.router.ts"

mkdir $ANGULAR_APP_FOLDER/src/app/modules/app/container
download_angular_ts_file "src/app/modules/app/container/home.component.html"
download_angular_ts_file "src/app/modules/app/container/home.component.ts"
download_angular_ts_file "src/app/modules/app/container/layout.component.html"
download_angular_ts_file "src/app/modules/app/container/layout.component.ts"

mkdir $ANGULAR_APP_FOLDER/src/app/modules/landing
download_angular_ts_file "src/app/modules/landing/landing.module.ts"
download_angular_ts_file "src/app/modules/landing/landing.router.ts"

mkdir $ANGULAR_APP_FOLDER/src/app/modules/landing/container
download_angular_ts_file "src/app/modules/landing/container/layout.component.html"
download_angular_ts_file "src/app/modules/landing/container/layout.component.ts"

git add --all
git commit -m "setup app"

### Setup NestJS API
download_api_ts_file () {
  local FILE_PATH=$1
  local TARGET_FOLDER=$API_APP_FOLDER
  local DOWNLOAD_PATH=https://raw.githubusercontent.com/dereekb/dbx-components/develop/setup/templates/apps/api
  download_ts_file "$DOWNLOAD_PATH" "$TARGET_FOLDER" "$FILE_PATH"
}

rm $API_APP_FOLDER/src/main.ts
download_api_ts_file "src/main.ts"

# Test Folder
mkdir $API_APP_FOLDER/src/test
download_api_ts_file "src/test/fixture.ts"

# App Folder
rm -r $API_APP_FOLDER/src/app
mkdir $API_APP_FOLDER/src/app
download_api_ts_file "src/app/app.module.ts"
download_api_ts_file "src/app/app.ts"

## Common Folder
mkdir $API_APP_FOLDER/src/app/common
download_api_ts_file "src/app/common/index.ts"

# Common Firebase Folder
mkdir $API_APP_FOLDER/src/app/common/firebase
download_api_ts_file "src/app/common/firebase/action.context.ts"
download_api_ts_file "src/app/common/firebase/action.module.ts"
download_api_ts_file "src/app/common/firebase/auth.module.ts"
download_api_ts_file "src/app/common/firebase/auth.service.ts"
download_api_ts_file "src/app/common/firebase/firebase.module.ts"
download_api_ts_file "src/app/common/firebase/firestore.module.ts"
download_api_ts_file "src/app/common/firebase/index.ts"

# Common Model Folder
mkdir $API_APP_FOLDER/src/app/common/model
download_api_ts_file "src/app/common/model/model.module.ts"
download_api_ts_file "src/app/common/model/index.ts"

mkdir $API_APP_FOLDER/src/app/common/model/example
download_api_ts_file "src/app/common/model/example/example.action.server.ts"
download_api_ts_file "src/app/common/model/example/example.error.ts"
download_api_ts_file "src/app/common/model/example/example.module.ts"
download_api_ts_file "src/app/common/model/example/index.ts"

## Function Folder
mkdir $API_APP_FOLDER/src/app/function
download_api_ts_file "src/app/function/index.ts"
download_api_ts_file "src/app/function/function.ts"

mkdir $API_APP_FOLDER/src/app/function/auth
download_api_ts_file "src/app/function/auth/index.ts"
download_api_ts_file "src/app/function/auth/init.user.function.ts"

mkdir $API_APP_FOLDER/src/app/function/example
download_api_ts_file "src/app/function/example/index.ts"
download_api_ts_file "src/app/function/example/example.util.ts"
download_api_ts_file "src/app/function/example/example.set.username.ts"

git add --all
git commit -m "setup api"

echo "Performing test build..."
nx build $ANGULAR_APP_NAME
nx build $API_APP_NAME

echo "Completed $ANGULAR_APP_NAME project setup."
echo "Project was created at \"$(pwd)\""

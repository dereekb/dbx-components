#!/bin/bash
# exit when any command fails
set -e

## Usage:
# ./setup-project.sh my-firebase-project-id
# The prefix is optional. It should be a single word.

# There are several environment variables that can be set:
# - DBX_SETUP_PROJECT_MANUAL                  # whether or not to wait for user input for manual parts. if not y, then these pieces will be handled differently.
# - DBX_SETUP_PROJECT_BRANCH                  # branch to pull content from
# - DBX_SETUP_PROJECT_COMPONENTS_VERSION      # dbx-components version to install
# - DBX_SETUP_PROJECT_IS_CI_TEST              # whether or not this is being performed as a CI test

# Before running this script, you should have done the following and have the relevant information:
# - Created a git repo (on github or other place)
# If not provided, the origin will not be set.
GIT_REPO_ORIGIN=                            # example: git@github.com:dereekb/gethapier.git
CI_GIT_USER_EMAIL=ci@example.dereekb.com    # git email to use in CI deployments
CI_GIT_USER_NAME=ci                         # git username to use in CI deployments

# - Created a project on firebase. This step is required.
# - Create a Firestore Database
# - Make sure you have upgraded to the Blaze plan
FIREBASE_PROJECT_ID=${1?:'firebase project id is required.'}    # example: gethapierapp
INPUT_PROJECT_NAME=${2:-"$FIREBASE_PROJECT_ID"}                 # example: gethapier
INPUT_CODE_PREFIX=${3:-app}                                     # example: getHapier  #single-word prefix used in code that should be camelCase
FIREBASE_BASE_EMULATORS_PORT=${4:-9100}                         # example: 9100
PARENT_DIRECTORY=${5:-'../../'}                                 # parent directory to create this project within. Defaults to relative to this script's space within dbx-components.
FIREBASE_STAGING_PROJECT_ID=${6:-"$FIREBASE_PROJECT_ID-staging"} # example: gethapier-staging

# Example: ./setup-project.sh gethapierapp gethapier getHapier 9300

# Whether or not to perform manual setup
MANUAL_SETUP=${DBX_SETUP_PROJECT_MANUAL:-"y"}         # y/n
IS_CI_TEST=${DBX_SETUP_PROJECT_IS_CI_TEST:-"n"}       # y/n

# - Other Configuration
DEFAULT_SOURCE_BRANCH="develop"

if [[ "$IS_CI_TEST" =~ ^([yY][eE][sS]|[yY]|[tT])$ ]];
then
  DEFAULT_SOURCE_BRANCH="develop" # default to the develop branch if it is a CI test
fi

SOURCE_BRANCH=${DBX_SETUP_PROJECT_BRANCH:-"$DEFAULT_SOURCE_BRANCH"}     # develop or main

# - Project Details
PROJECT_NAME=$INPUT_PROJECT_NAME
NAME=$PROJECT_NAME
DBX_COMPONENTS_VERSION=${DBX_SETUP_PROJECT_COMPONENTS_VERSION:-"12.0.1"}    # update every major version
NX_VERSION=${NX_SETUP_VERSIONS:-"20.8.0"}
ANGULAR_VERSION=${ANGULAR_SETUP_VERSIONS:-"^18.0.0"}
TYPESCRIPT_VERSION=${TYPESCRIPT_SETUP_VERSIONS:-">=5.5.0 <5.6.0"}
FIREBASE_TOOLS_VERSION=${FIREBASE_TOOLS_SETUP_VERSION:-"^14.2.0"}

echo "Creating project: '$PROJECT_NAME' - nx: $NX_VERSION - angular: $ANGULAR_VERSION - from source branch $SOURCE_BRANCH"

# The app prefix is used in Angular and Nest classes as the prefix for classes/components
APP_CODE_PREFIX="$(tr '[:lower:]' '[:upper:]' <<< ${INPUT_CODE_PREFIX:0:1})${INPUT_CODE_PREFIX:1}"  # AppTest
APP_CODE_PREFIX_CAMEL=${INPUT_CODE_PREFIX}; # appTest
APP_CODE_PREFIX_LOWER="$(tr '[:upper:]' '[:lower:]' <<< ${INPUT_CODE_PREFIX})"  # apptest
APP_CODE_PREFIX_CAPS="$(tr '[:lower:]' '[:upper:]' <<< ${INPUT_CODE_PREFIX})"  # APPTEST

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
# docker container name
DOCKER_CONTAINER_APP_NAME=$API_APP_NAME-server
DOCKER_CONTAINER_NETWORK_NAME=$API_APP_NAME-network

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
FIREBASE_EMULATOR_FIRESTORE_WEBSOCKET_PORT=$(expr $FIREBASE_BASE_EMULATORS_PORT + 8)
FIREBASE_LOCALHOST=0.0.0.0
FIREBASE_EMULATOR_PORT_RANGE="$FIREBASE_EMULATOR_UI_PORT-$FIREBASE_EMULATOR_STORAGE_PORT"

ANGULAR_APP_PORT=$(expr $FIREBASE_BASE_EMULATORS_PORT + 10)

# other config
LINTER="eslint"
UNIT_TEST_RUNNER="jest"

# - Setup Details
NX_CLOUD_CONFIG_TYPE="yes"
#
#
if [[ "$IS_CI_TEST" =~ ^([yY][eE][sS]|[yY]|[tT])$ ]];
then
  # Mark IS_NOT_CI_TEST as false and skip the login
  echo "Looks like this is being run as a CI test (DBX_SETUP_PROJECT_IS_CI_TEST=y)"
  NX_CLOUD_CONFIG_TYPE="skip"

  # will configure the app to install from the CI built version instead of npm/remote
  CI_DIST_PATH=file:~/code/dist/packages
  DBX_COMPONENTS_VERSION_BROWSER=$CI_DIST_PATH/browser
  DBX_COMPONENTS_VERSION_DATE=$CI_DIST_PATH/date
  DBX_COMPONENTS_VERSION_DBX_ANALYTICS=$CI_DIST_PATH/dbx-analytics
  DBX_COMPONENTS_VERSION_DBX_CORE=$CI_DIST_PATH/dbx-core
  DBX_COMPONENTS_VERSION_DBX_FIREBASE=$CI_DIST_PATH/dbx-firebase
  DBX_COMPONENTS_VERSION_DBX_FORM=$CI_DIST_PATH/dbx-form
  DBX_COMPONENTS_VERSION_DBX_FORM_MAPBOX=$CI_DIST_PATH/dbx-form/mapbox
  DBX_COMPONENTS_VERSION_DBX_WEB=$CI_DIST_PATH/dbx-web
  DBX_COMPONENTS_VERSION_DBX_WEB_MAPBOX=$CI_DIST_PATH/dbx-web/mapbox
  DBX_COMPONENTS_VERSION_FIREBASE=$CI_DIST_PATH/firebase
  DBX_COMPONENTS_VERSION_FIREBASE_SERVER=$CI_DIST_PATH/firebase-server
  DBX_COMPONENTS_VERSION_FIREBASE_SERVER_MAILGUN=$CI_DIST_PATH/firebase-server/mailgun
  DBX_COMPONENTS_VERSION_FIREBASE_SERVER_ZOHO=$CI_DIST_PATH/firebase-server/zoho
  DBX_COMPONENTS_VERSION_FIREBASE_SERVER_MODEL=$CI_DIST_PATH/firebase-server/model
  DBX_COMPONENTS_VERSION_MODEL=$CI_DIST_PATH/model
  DBX_COMPONENTS_VERSION_ZOHO=$CI_DIST_PATH/zoho
  DBX_COMPONENTS_VERSION_NESTJS=$CI_DIST_PATH/nestjs
  DBX_COMPONENTS_VERSION_NESTJS_MAILGUN=$CI_DIST_PATH/nestjs/mailgun
  DBX_COMPONENTS_VERSION_RXJS=$CI_DIST_PATH/rxjs
  DBX_COMPONENTS_VERSION_UTIL=$CI_DIST_PATH/util

else
  DBX_COMPONENTS_VERSION_BROWSER=$DBX_COMPONENTS_VERSION
  DBX_COMPONENTS_VERSION_DATE=$DBX_COMPONENTS_VERSION
  DBX_COMPONENTS_VERSION_DBX_ANALYTICS=$DBX_COMPONENTS_VERSION
  DBX_COMPONENTS_VERSION_DBX_CORE=$DBX_COMPONENTS_VERSION
  DBX_COMPONENTS_VERSION_DBX_FIREBASE=$DBX_COMPONENTS_VERSION
  DBX_COMPONENTS_VERSION_DBX_FORM=$DBX_COMPONENTS_VERSION
  DBX_COMPONENTS_VERSION_DBX_WEB=$DBX_COMPONENTS_VERSION
  DBX_COMPONENTS_VERSION_FIREBASE=$DBX_COMPONENTS_VERSION
  DBX_COMPONENTS_VERSION_FIREBASE_SERVER=$DBX_COMPONENTS_VERSION
  DBX_COMPONENTS_VERSION_MODEL=$DBX_COMPONENTS_VERSION
  DBX_COMPONENTS_VERSION_ZOHO=$DBX_COMPONENTS_VERSION
  DBX_COMPONENTS_VERSION_NESTJS=$DBX_COMPONENTS_VERSION
  DBX_COMPONENTS_VERSION_RXJS=$DBX_COMPONENTS_VERSION
  DBX_COMPONENTS_VERSION_UTIL=$DBX_COMPONENTS_VERSION

  # Log into Firebase
  echo "First log into Firebase if you're are not already logged in already."
  npx firebase login
fi

## Setup NX Project
mkdir -p $PARENT_DIRECTORY
cd $PARENT_DIRECTORY

# Create NX Workspace
echo "Creating new dbx-components project in folder \"$NAME\" with project name \"$PROJECT_NAME\"..."
npx --yes create-nx-workspace@$NX_VERSION --name=$NAME --appName=$PROJECT_NAME --packageManager=npm --useGitHub --nxCloud=$NX_CLOUD_CONFIG_TYPE --interactive=false --style=scss --preset=angular-monorepo --workspaceType=package-based --unitTestRunner=$UNIT_TEST_RUNNER --e2eTestRunner=cypress --standaloneApi=true --ssr=false --routing=false

# Enter Folder
echo "Entering new project folder, \"$NAME\""
cd $NAME

# change git branch to setup
git branch setup
git checkout setup

# Commit the cloud initialization
# git add --all
# git commit --no-verify -m "checkpoint: init nx-cloud"

# update nx to the latest version and commit
#
#npx -y nx@$NX_VERSION migrate latest

#
#if test -f "migrations.json"; then   # migrate if it is available
#  npx -y nx migrate --run-migrations
#  rm migrations.json                 # remove migrations file
#fi

npx --yes json -I -f nx.json -e "this.workspaceLayout = { appsDir: '$APPS_FOLDER', libsDir: '$COMPONENTS_FOLDER' };";

git add --all
git commit --no-verify -m "checkpoint: updated nx to latest version"

# Add Nest App - https://nx.dev/packages/nest
# install the nest generator
npm install -D @nx/nest@$NX_VERSION
npx -y nx@$NX_VERSION g @nx/nest:app --name=$API_APP_NAME --directory=$API_APP_FOLDER --linter=$LINTER --unitTestRunner=$UNIT_TEST_RUNNER

git add --all
git commit --no-verify -m "checkpoint: added nest app"

# Add App Components
# NOTE: Nx may install a different version of angular, so we want to override all the installs here
echo "Installing angular@$ANGULAR_VERSION...";
rm -r node_modules
rm package-lock.json
npm install -D --force typescript@$TYPESCRIPT_VERSION @nx/angular@$NX_VERSION @angular-devkit/build-angular@$ANGULAR_VERSION @angular-devkit/core@$ANGULAR_VERSION @angular-eslint/eslint-plugin@$ANGULAR_VERSION @angular-eslint/eslint-plugin-template@$ANGULAR_VERSION @angular-eslint/template-parser@$ANGULAR_VERSION @angular-devkit/schematics@$ANGULAR_VERSION @angular/cli@$ANGULAR_VERSION @angular/language-service@$ANGULAR_VERSION @angular/compiler-cli@$ANGULAR_VERSION
npm install --force zone.js@0.14.10 @angular/core@$ANGULAR_VERSION @angular/common@$ANGULAR_VERSION @angular/animations@$ANGULAR_VERSION @angular/cdk@$ANGULAR_VERSION @angular/compiler@$ANGULAR_VERSION @angular/forms@$ANGULAR_VERSION @angular/material@$ANGULAR_VERSION @angular/platform-browser@$ANGULAR_VERSION @angular/platform-browser-dynamic@$ANGULAR_VERSION @angular/router@$ANGULAR_VERSION @angular/material-date-fns-adapter@$ANGULAR_VERSION
npm install -D --force typescript@$TYPESCRIPT_VERSION # install again incase it changed due to the above or other dependency...

echo "Creating angular components package..."
npx -y nx@$NX_VERSION g @nx/angular:library --name=$ANGULAR_COMPONENTS_NAME --directory=$ANGULAR_COMPONENTS_FOLDER --buildable --publishable --importPath $ANGULAR_COMPONENTS_NAME --standalone=true --simpleName=true --changeDetection=OnPush --linter=$LINTER --unitTestRunner=$UNIT_TEST_RUNNER

git add --all
git commit --no-verify -m "checkpoint: added angular components package"

# Add Firebase Component
echo "Creating firebase components package..."
npm install -D @nx/node@$NX_VERSION
npx -y nx@$NX_VERSION g @nx/node:library --name=$FIREBASE_COMPONENTS_NAME --directory=$FIREBASE_COMPONENTS_FOLDER --buildable --publishable --importPath $FIREBASE_COMPONENTS_NAME --linter=$LINTER --unitTestRunner=$UNIT_TEST_RUNNER

git add --all
git commit --no-verify -m "checkpoint: added firebase components package"

npm install -D firebase-tools@$FIREBASE_TOOLS_VERSION

# Init Firebase
if [[ "$MANUAL_SETUP" =~ ^([yY][eE][sS]|[yY])$ ]] 
then
  # manual configuration asks only for the name. Other commands are performed automatically using the firebase command
  echo "Follow the instructions to init Firebase for this project."
  echo "Instructions: Follow the prompt and log into the existing project you described above or create a new project."
  echo "Instructions: Setting up Firebase Storage - Hit Enter to keep default name."
  npx firebase init storage

  echo "Instructions: Firebase Firestore - Keep the rules and indexes the default name."
  echo "NOTE: If the project has configuration already, it will pull the current configuration down from Firebase."
  (sleep 3; echo; sleep 2; echo;) | npx firebase init firestore

  echo "Instructions: Firebase Hosting - Setup single page application. Do not setup github actions."
  (sleep 3; echo; sleep 1; echo 'y'; sleep 1; echo 'N'; sleep 1; echo 'n') | npx firebase init hosting

  echo "Instructions: Firebase Functions - This configuration will be ignored."
  (sleep 3; echo; sleep 1; echo 'N'; sleep 1; echo 'N';) | npx firebase init functions

  echo "Adding alias prod to default"
  # add prod alias to .firebaserc
  npx --yes json -I -f .firebaserc -e "this.projects = { ...this.projects, prod: this.projects.default }";
    
  # remove the public folder. We will use the app instead.
  echo "Removing public folder. (We will use the app instead)"
  rm -r public || true

  # remove the functions folder. We will use the api-app instead.
  echo "Removing functions folder. (We will use the api-app instead)"
  rm -r functions || true

else
  # automatic configuration. This should typically only be used for CI/testing, as using the firebase CLI can pull existing content in after logging in.
  echo "Initializing firebase automatically using project name..."
  curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/setup/templates/firebase.json -o firebase.json.tmp
  sed -e "s:FIREBASE_PROJECT_ID_STAGING:$FIREBASE_STAGING_PROJECT_ID:g" -e "s:FIREBASE_PROJECT_ID:$FIREBASE_PROJECT_ID:g" -e "s:ANGULAR_APP_DIST_FOLDER:$ANGULAR_APP_DIST_FOLDER:g" -e "s:API_APP_DIST_FOLDER:$API_APP_DIST_FOLDER:g" firebase.json.tmp > firebase.json
  rm firebase.json.tmp

  curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/setup/templates/.firebaserc -o .firebaserc.tmp
  sed -e "s:FIREBASE_PROJECT_ID_STAGING:$FIREBASE_STAGING_PROJECT_ID:g" -e "s:FIREBASE_PROJECT_ID:$FIREBASE_PROJECT_ID:g" .firebaserc.tmp > .firebaserc
  rm .firebaserc.tmp

  curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/setup/templates/firestore.indexes.json -o firestore.indexes.json
  curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/setup/templates/firestore.rules -o firestore.rules
  curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/setup/templates/storage.rules -o storage.rules
fi

# now edit firebase.json to have the correct configuration.
echo "Updating firebase.json config..."

# Hosting
npx --yes json -I -f firebase.json -e "this.hosting={ ...this.hosting, site: '$PROJECT_NAME', public: '$ANGULAR_APP_DIST_FOLDER', ignore: ['firebase.json', '**/.*', '**/node_modules/**'], rewrites: [{ source: '/api/**', function: 'api' }, { source: '**', destination: '/index.html' }] }";

# Functions
npx --yes json -I -f firebase.json -e "this.functions={ source:'$API_APP_DIST_FOLDER', runtime: 'nodejs16', engines: { node: '16' }, ignore: ['firebase.json', '**/.*', '**/node_modules/**'] }";

# Functions
npx --yes json -I -f firebase.json -e "this.firestore={ rules: 'firestore.rules', indexes: 'firestore.indexes.json' }";

# Emulators
npx --yes json -I -f firebase.json -e "this.emulators={ singleProjectMode: false, ui: { host: '$FIREBASE_LOCALHOST', enabled: true, port: $FIREBASE_EMULATOR_UI_PORT }, hosting: { host: '$FIREBASE_LOCALHOST', port: $FIREBASE_EMULATOR_HOSTING_PORT }, functions: { host: '$FIREBASE_LOCALHOST', port: $FIREBASE_EMULATOR_FUNCTIONS_PORT }, auth: { host: '$FIREBASE_LOCALHOST', port: $FIREBASE_EMULATOR_AUTH_PORT }, firestore: { host: '$FIREBASE_LOCALHOST', port: $FIREBASE_EMULATOR_FIRESTORE_PORT, websocketPort: $FIREBASE_EMULATOR_FIRESTORE_WEBSOCKET_PORT }, pubsub: { host: '$FIREBASE_LOCALHOST', port: $FIREBASE_EMULATOR_PUBSUB_PORT }, storage: { host: '$FIREBASE_LOCALHOST', port: $FIREBASE_EMULATOR_STORAGE_PORT } };";

git add --all
git commit --no-verify -m "checkpoint: added firebase configuration"

# Docker
# Create docker files
echo "Copying Docker files from @dereekb/dbx-components"
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/Dockerfile -o Dockerfile.tmp
sed "s/demo-api/$API_APP_NAME/g" Dockerfile.tmp > Dockerfile
rm Dockerfile.tmp

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/docker-compose.yml -o docker-compose.yml.tmp
sed -e "s/dereekb-components/$FIREBASE_STAGING_PROJECT_ID/g" -e "s/demo-api-server/$DOCKER_CONTAINER_APP_NAME/g" -e "s/demo-api-network/$DOCKER_CONTAINER_NETWORK_NAME/g" -e "s/demo-api/$API_APP_NAME/g" -e "s/9900-9908/$FIREBASE_EMULATOR_PORT_RANGE/g" docker-compose.yml.tmp > docker-compose.yml
rm docker-compose.yml.tmp

# download .gitignore
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/.gitignore -o .gitignore.tmp
sed -e "s/demo-api/$API_APP_NAME/g" .gitignore.tmp > .gitignore
rm .gitignore.tmp

# download additional utility scripts
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/exec-with-emulator.sh -o exec-with-emulator.sh.tmp
sed -e "s/demo-api-server/$DOCKER_CONTAINER_APP_NAME/g" -e "s/demo-api/$API_APP_NAME/g" exec-with-emulator.sh.tmp > exec-with-emulator.sh
rm exec-with-emulator.sh.tmp
chmod +x exec-with-emulator.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/setup/templates/update-dbx-components.sh -o update-dbx-components.sh
chmod +x update-dbx-components.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/reset-emulator-data.sh -o reset-emulator-data.sh
chmod +x reset-emulator-data.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/reset.sh -o reset.sh
chmod +x reset.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/down.sh -o down.sh
chmod +x down.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/start-merge-in-main.sh -o start-merge-in-main.sh
chmod +x start-merge-in-main.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/end-merge-in-main.sh -o end-merge-in-main.sh
chmod +x end-merge-in-main.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/force-start-release.sh -o force-start-release.sh
chmod +x force-start-release.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/lint-fix-all.sh -o lint-fix-all.sh
chmod +x lint-fix-all.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/make-dev-tag.sh -o make-dev-tag.sh
chmod +x make-dev-tag.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/start-release.sh -o start-release.sh
chmod +x start-release.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/test-all.sh -o test-all.sh.tmp
sed -e "s/demo-api/$API_APP_NAME/g" test-all.sh.tmp > test-all.sh
chmod +x test-all.sh
rm test-all.sh.tmp

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/run-server.sh -o run-server.sh.tmp
sed -e "s/demo-api-server/$DOCKER_CONTAINER_APP_NAME/g" -e "s/demo-api/$API_APP_NAME/g" run-server.sh.tmp > run-server.sh
rm run-server.sh.tmp
chmod +x run-server.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/serve-server.sh -o serve-server.sh.tmp
sed -e "s/demo-api-server/$DOCKER_CONTAINER_APP_NAME/g" -e "s/demo-api/$API_APP_NAME/g" serve-server.sh.tmp > serve-server.sh
rm serve-server.sh.tmp
chmod +x serve-server.sh

rm eslint.config.mjs || true
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/setup/templates/eslint.config.template.mjs -o eslint.config.mjs

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/serve-web.sh -o serve-web.sh.tmp
sed -e "s/demo/$ANGULAR_APP_NAME/g" serve-web.sh.tmp > serve-web.sh
rm serve-web.sh.tmp
chmod +x serve-web.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/test-demo-api.sh -o test-$API_APP_NAME.sh.tmp
sed -e "s/demo-api/$API_APP_NAME/g" test-$API_APP_NAME.sh.tmp > test-$API_APP_NAME.sh
rm test-$API_APP_NAME.sh.tmp
chmod +x test-$API_APP_NAME.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/wait-for-ports.sh -o wait-for-ports.sh.tmp
sed -e "s/9100-9108/$FIREBASE_EMULATOR_PORT_RANGE/g" wait-for-ports.sh.tmp > wait-for-ports.sh
rm wait-for-ports.sh.tmp
chmod +x wait-for-ports.sh

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/.env -o .env.tmp
sed -e "s/9910/$ANGULAR_APP_PORT/g" .env.tmp > .env
rm .env.tmp

echo "SECRETS=" > .env.local

git add --all
git commit --no-verify -m "checkpoint: added Docker files and other utility files"

# add semver for semantic versioning, husky for pre-commit hooks, and pretty-quick for running prettier
npm install -D @jscutlery/semver@5.6.0 husky prettier@3.5.3 pretty-quick@^4.1.1 @commitlint/cli @commitlint/config-angular eslint-plugin-import eslint-plugin-unused-imports
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/.commitlintrc.json -o .commitlintrc.json

mkdir .husky
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/.husky/commit-msg -o .husky/commit-msg
chmod +x .husky/commit-msg  # make executable
npx husky init

mkdir -p ./.github/workflows
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/.github/workflows/commitlint.yml -o .github/workflows/commitlint.yml

# add prettier configs
rm .prettierignore
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/.prettierignore -o .prettierignore
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/.prettierrc -o .prettierrc
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/.husky/pre-commit -o .husky/pre-commit

git add --all
git commit --no-verify -m "checkpoint: added semver and commit linting"

# add jest setup/configurations
echo "Adding jest configurations..."
npm install -D jest@29.7.0 jest-environment-jsdom@29.7.0 jest-preset-angular@14.1.1 ts-jest@^29.3.2 jest-date@^1.1.4 jest-junit@^16.0.0
rm jest.preset.js

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/jest.preset.ts -o jest.preset.ts
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/jest.environment.jsdom.ts -o jest.environment.jsdom.ts
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/jest.resolver.js -o jest.resolver.js
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/jest.setup.angular.ts -o jest.setup.angular.ts
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/jest.setup.firebase.ts -o jest.setup.firebase.ts
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/jest.setup.nestjs.ts -o jest.setup.nestjs.ts
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/jest.setup.node.ts -o jest.setup.node.ts
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/jest.setup.typings.ts -o jest.setup.typings.ts

# add env files to ensure that jest CI tests export properly.
echo "Adding env files..."
mkdir tmp
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/setup/templates/apps/.env -o tmp/env.tmp
sed -e "s/APP_ID/$ANGULAR_APP_NAME/g" tmp/env.tmp > $ANGULAR_APP_FOLDER/.env
sed -e "s/APP_ID/$API_APP_NAME/g" tmp/env.tmp > $API_APP_FOLDER/.env
sed -e "s/APP_ID/$E2E_APP_NAME/g" tmp/env.tmp > $E2E_APP_FOLDER/.env
sed -e "s/APP_ID/$ANGULAR_COMPONENTS_NAME/g" tmp/env.tmp > $ANGULAR_COMPONENTS_FOLDER/.env
sed -e "s/APP_ID/$FIREBASE_COMPONENTS_NAME/g" tmp/env.tmp > $FIREBASE_COMPONENTS_FOLDER/.env

# make build-base and run-tests cacheable in nx cloud
echo "Making tests cacheable in nx cloud..."
npx --yes json -I -f nx.json -e "this.targetDefaults['build-base'] = { cache: true }";

echo "Make build rely on parent build"
npx --yes json -I -f nx.json -e "this.targetDefaults['build'] = { dependsOn: ['^build'], inputs: ['production', '^production'], cache: true }";

git add --all
git commit --no-verify -m "checkpoint: added jest configurations"

# Install npm dependencies
echo "Installing @dereekb dependencies"
npm install --force mailgun.js@^12.0.0 rxjs@^7.5.0 firebase@^11.0.0 firebase-admin@^13.0.0 firebase-functions@^6.0.0 @dereekb/browser@$DBX_COMPONENTS_VERSION_BROWSER @dereekb/date@$DBX_COMPONENTS_VERSION_DATE @dereekb/dbx-analytics@$DBX_COMPONENTS_VERSION_DBX_ANALYTICS @dereekb/dbx-core@$DBX_COMPONENTS_VERSION_DBX_CORE @dereekb/dbx-firebase@$DBX_COMPONENTS_VERSION_DBX_FIREBASE @dereekb/dbx-form@$DBX_COMPONENTS_VERSION_DBX_FORM @dereekb/dbx-web@$DBX_COMPONENTS_VERSION_DBX_WEB @dereekb/firebase@$DBX_COMPONENTS_VERSION_FIREBASE @dereekb/firebase-server@$DBX_COMPONENTS_VERSION_FIREBASE_SERVER @dereekb/model@$DBX_COMPONENTS_VERSION_MODEL @dereekb/zoho@$DBX_COMPONENTS_VERSION_ZOHO @dereekb/nestjs@$DBX_COMPONENTS_VERSION_NESTJS @dereekb/rxjs@$DBX_COMPONENTS_VERSION_RXJS @dereekb/util@$DBX_COMPONENTS_VERSION_UTIL

# install mapbox dependencies
npm install --force mapbox-gl ngx-mapbox-gl@git+https://git@github.com/dereekb/ngx-mapbox-gl#e55fbfa2f334348f0ff6b4705776c958c67ffbb5 @ng-web-apis/geolocation @ng-web-apis/common

if [[ "$IS_CI_TEST" =~ ^([yY][eE][sS]|[yY]|[tT])$ ]];
then

install_local_peer_deps() {
  local FILE_PATH=$1
  echo "Installing dependencies from: $FILE_PATH"
  npm info x@$FILE_PATH peerDependencies --json | command sed 's/[\{\},]//g ; s/: /@/g; s/"@dereekb\/.*"@".*"//g ; s/"@angular\/.*"@".*"//g ;' | xargs npm install --force "$PKG";
}

# The CI environment does not seem to install any of the peer dependencies from the local @dereekb packages
echo "Installing angular dependencies"
npm install --force @placemarkio/geo-viewport@^1.0.2 @uirouter/rx@^1.0.0 @uirouter/core@^6.1.1 @uirouter/angular@^15.0.0 @angular/fire@git+https://git@github.com/dereekb/angularfire#32c69f7009db3a9b85148705c00e923d5a858807 @ngbracket/ngx-layout@^18.0.0 @angular/animations@$ANGULAR_VERSION @angular/common@$ANGULAR_VERSION @angular/compiler@$ANGULAR_VERSION @angular/core@$ANGULAR_VERSION @angular/forms@$ANGULAR_VERSION @angular/material@$ANGULAR_VERSION @angular/cdk@$ANGULAR_VERSION @angular/platform-browser@$ANGULAR_VERSION @angular/platform-browser-dynamic@$ANGULAR_VERSION @angular/router@$ANGULAR_SETUP_VERSIONS
# note @angular/fire and @ngbracket/ngx-layout dependencies are installed here, as install_local ignores any @angular prefix

echo "Installing @dereekb peer dependencies for CI"
install_local_peer_deps "$DBX_COMPONENTS_VERSION_BROWSER"
install_local_peer_deps "$DBX_COMPONENTS_VERSION_DATE"
install_local_peer_deps "$DBX_COMPONENTS_VERSION_DBX_ANALYTICS"
install_local_peer_deps "$DBX_COMPONENTS_VERSION_DBX_CORE"
install_local_peer_deps "$DBX_COMPONENTS_VERSION_DBX_FIREBASE"
install_local_peer_deps "$DBX_COMPONENTS_VERSION_DBX_WEB"
install_local_peer_deps "$DBX_COMPONENTS_VERSION_DBX_WEB_MAPBOX"
install_local_peer_deps "$DBX_COMPONENTS_VERSION_DBX_FORM"
install_local_peer_deps "$DBX_COMPONENTS_VERSION_DBX_FORM_MAPBOX"
install_local_peer_deps "$DBX_COMPONENTS_VERSION_FIREBASE" 
install_local_peer_deps "$DBX_COMPONENTS_VERSION_FIREBASE_SERVER" 
install_local_peer_deps "$DBX_COMPONENTS_VERSION_FIREBASE_SERVER_MAILGUN" 
install_local_peer_deps "$DBX_COMPONENTS_VERSION_MODEL"
install_local_peer_deps "$DBX_COMPONENTS_VERSION_ZOHO"
install_local_peer_deps "$DBX_COMPONENTS_VERSION_NESTJS" 
install_local_peer_deps "$DBX_COMPONENTS_VERSION_NESTJS_MAILGUN" 
install_local_peer_deps "$DBX_COMPONENTS_VERSION_RXJS" 
install_local_peer_deps "$DBX_COMPONENTS_VERSION_UTIL"
fi

echo "Installing dev dependencies"
npm install --force -D firebase-tools@$FIREBASE_TOOLS_VERSION @ngrx/store-devtools@18.1.1 @ngx-formly/schematics@6.3.12 @firebase/rules-unit-testing@^4.0.1 firebase-functions-test@^3.4.1 envfile env-cmd

git add --all
git commit --no-verify -m "checkpoint: added @dereekb dependencies"

# Add CircleCI Config
echo "Copying CircleCI Configurations."
echo "BEFORE CIRCLECI USE - Please update configuration on CircleCI and in \".circleci/config.yml\""
mkdir .circleci
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/setup/templates/.circleci/config.yml -o .circleci/config.yml.tmp
sed -e "s/CI_GIT_USER_EMAIL/$CI_GIT_USER_EMAIL/g" -e "s/CI_GIT_USER_NAME/$CI_GIT_USER_NAME/g" -e "s/ANGULAR_APP_NAME/$ANGULAR_APP_NAME/g"  -e "s/API_APP_NAME/$API_APP_NAME/g" -e "s/E2E_APP_NAME/$E2E_APP_NAME/g" .circleci/config.yml.tmp > .circleci/config.yml
rm .circleci/config.yml.tmp

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/make-api-package.js -o make-api-package.js.tmp
sed -e "s:API_APP_FOLDER:$API_APP_FOLDER:g" make-api-package.js.tmp > make-api-package.js
rm make-api-package.js.tmp

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/make-env.js -o make-env.js
echo "PUBLIC_PROD_VARIABLES_HERE" > ".env.prod"

git add --all
git commit --no-verify -m "checkpoint: added circleci configrations"

# Apply Project Configurations
echo "Applying Configuration to Projects"

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/setup/templates/project.template.json -o ./project.json

rm $ANGULAR_APP_FOLDER/project.json
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/setup/templates/apps/app/project.template.json -o $ANGULAR_APP_FOLDER/project.json.tmp
sed -e "s:ANGULAR_APP_DIST_FOLDER:$ANGULAR_APP_DIST_FOLDER:g" -e "s:ANGULAR_APP_FOLDER:$ANGULAR_APP_FOLDER:g" -e "s:ANGULAR_APP_NAME:$ANGULAR_APP_NAME:g" -e "s:ANGULAR_APP_PORT:$ANGULAR_APP_PORT:g" $ANGULAR_APP_FOLDER/project.json.tmp > $ANGULAR_APP_FOLDER/project.json
rm $ANGULAR_APP_FOLDER/project.json.tmp

rm $API_APP_FOLDER/project.json
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/setup/templates/apps/api/project.template.json -o $API_APP_FOLDER/project.json.tmp
sed -e "s:API_APP_DIST_FOLDER:$API_APP_DIST_FOLDER:g" -e "s:API_APP_FOLDER:$API_APP_FOLDER:g" -e "s:API_APP_NAME:$API_APP_NAME:g" $API_APP_FOLDER/project.json.tmp > $API_APP_FOLDER/project.json
rm $API_APP_FOLDER/project.json.tmp

rm $API_APP_FOLDER/webpack.config.js
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/setup/templates/apps/api/webpack.config.template.js -o $API_APP_FOLDER/webpack.config.js.tmp
sed -e "s:API_APP_DIST_FOLDER:$API_APP_DIST_FOLDER:g" -e "s:API_APP_FOLDER:$API_APP_FOLDER:g" -e "s:API_APP_NAME:$API_APP_NAME:g" $API_APP_FOLDER/webpack.config.js.tmp > $API_APP_FOLDER/webpack.config.js
rm $API_APP_FOLDER/webpack.config.js.tmp

rm $ANGULAR_COMPONENTS_FOLDER/project.json
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/setup/templates/components/app/project.template.json -o $ANGULAR_COMPONENTS_FOLDER/project.json.tmp
sed -e "s:ANGULAR_COMPONENTS_DIST_FOLDER:$ANGULAR_COMPONENTS_DIST_FOLDER:g" -e "s:FIREBASE_COMPONENTS_NAME:$FIREBASE_COMPONENTS_NAME:g" -e "s:ANGULAR_COMPONENTS_FOLDER:$ANGULAR_COMPONENTS_FOLDER:g" -e "s:APP_CODE_PREFIX_LOWER:$APP_CODE_PREFIX_LOWER:g" -e "s:ANGULAR_APP_PREFIX:$ANGULAR_APP_PREFIX:g" -e "s:ANGULAR_COMPONENTS_NAME:$ANGULAR_COMPONENTS_NAME:g" $ANGULAR_COMPONENTS_FOLDER/project.json.tmp > $ANGULAR_COMPONENTS_FOLDER/project.json
rm $ANGULAR_COMPONENTS_FOLDER/project.json.tmp

rm $FIREBASE_COMPONENTS_FOLDER/project.json
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/setup/templates/components/firebase/project.template.json -o $FIREBASE_COMPONENTS_FOLDER/project.json.tmp
sed -e "s:FIREBASE_COMPONENTS_DIST_FOLDER:$FIREBASE_COMPONENTS_DIST_FOLDER:g" -e "s:FIREBASE_COMPONENTS_FOLDER:$FIREBASE_COMPONENTS_FOLDER:g" -e "s:FIREBASE_COMPONENTS_NAME:$FIREBASE_COMPONENTS_NAME:g" $FIREBASE_COMPONENTS_FOLDER/project.json.tmp > $FIREBASE_COMPONENTS_FOLDER/project.json
rm $FIREBASE_COMPONENTS_FOLDER/project.json.tmp

# add settings to tsconfig.base.json
npx --yes json -I -f tsconfig.base.json -e "this.compilerOptions={ ...this.compilerOptions, strict: true, allowSyntheticDefaultImports: true, resolveJsonModule: true }";

git add --all
git commit --no-verify -m "checkpoint: added project configurations"

# Apply Project Templates
echo "Applying Templates to Projects"

download_ts_file () {
  # downloads and replaces the placeholder content in the file with the content for the project
  local DOWNLOAD_PATH=$1
  local TARGET_FOLDER=$2
  local FILE_PATH=$3
  local FULL_FILE_PATH=$TARGET_FOLDER/$FILE_PATH
  curl $DOWNLOAD_PATH/$FILE_PATH -o $FULL_FILE_PATH.tmp
  sed -e "s:FIREBASE_STAGING_PROJECT_ID:$FIREBASE_STAGING_PROJECT_ID:g" -e "s:FIREBASE_PROJECT_ID:$FIREBASE_PROJECT_ID:g" -e "s:APP_CODE_PREFIX_CAPS:$APP_CODE_PREFIX_CAPS:g" -e "s:APP_CODE_PREFIX_CAMEL:$APP_CODE_PREFIX_CAMEL:g" -e "s:APP_CODE_PREFIX_LOWER:$APP_CODE_PREFIX_LOWER:g" -e "s:APP_CODE_PREFIX:$APP_CODE_PREFIX:g" -e "s:FIREBASE_COMPONENTS_NAME:$FIREBASE_COMPONENTS_NAME:g" -e "s:ANGULAR_COMPONENTS_NAME:$ANGULAR_COMPONENTS_NAME:g" -e "s:ANGULAR_COMPONENTS_FOLDER:$ANGULAR_COMPONENTS_FOLDER:g" -e "s:FIREBASE_COMPONENTS_FOLDER:$FIREBASE_COMPONENTS_FOLDER:g" -e "s:ANGULAR_APP_NAME:$ANGULAR_APP_NAME:g" -e "s:API_APP_NAME:$API_APP_NAME:g" -e "s:FIREBASE_EMULATOR_AUTH_PORT:$FIREBASE_EMULATOR_AUTH_PORT:g" -e "s:FIREBASE_EMULATOR_FIRESTORE_PORT:$FIREBASE_EMULATOR_FIRESTORE_PORT:g" -e "s:FIREBASE_EMULATOR_STORAGE_PORT:$FIREBASE_EMULATOR_STORAGE_PORT:g" $FULL_FILE_PATH.tmp > $FULL_FILE_PATH
  rm $FULL_FILE_PATH.tmp

  # sleep for a moment
  sleep 0.1
}

### Setup app components
download_app_components_file () {
  local FILE_PATH=$1
  local TARGET_FOLDER=$ANGULAR_COMPONENTS_FOLDER
  local DOWNLOAD_PATH=https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/setup/templates/components/app
  download_ts_file "$DOWNLOAD_PATH" "$TARGET_FOLDER" "$FILE_PATH"
}

rm $ANGULAR_COMPONENTS_FOLDER/eslint.config.mjs
download_app_components_file "eslint.config.mjs"
download_app_components_file "jest.config.ts"
download_app_components_file "tsconfig.spec.json"

rm $ANGULAR_COMPONENTS_FOLDER/src/index.ts
echo "export * from './lib'" > $ANGULAR_COMPONENTS_FOLDER/src/index.ts

rm -r $ANGULAR_COMPONENTS_FOLDER/src/lib || true
mkdir $ANGULAR_COMPONENTS_FOLDER/src/lib
download_app_components_file "src/lib/index.ts"

mkdir $ANGULAR_COMPONENTS_FOLDER/src/lib/modules
download_app_components_file "src/lib/modules/index.ts"

mkdir $ANGULAR_COMPONENTS_FOLDER/src/lib/modules/profile
mkdir $ANGULAR_COMPONENTS_FOLDER/src/lib/modules/profile/store
download_app_components_file "src/lib/modules/profile/index.ts"
download_app_components_file "src/lib/modules/profile/store/profile.document.store.ts"
download_app_components_file "src/lib/modules/profile/store/profile.document.store.directive.ts"
download_app_components_file "src/lib/modules/profile/store/profile.collection.store.ts"
download_app_components_file "src/lib/modules/profile/store/profile.collection.store.directive.ts"

mkdir $ANGULAR_COMPONENTS_FOLDER/src/lib/services
download_app_components_file "src/lib/services/index.ts"
download_app_components_file "src/lib/services/firebase.context.service.ts"

git add --all
git commit --no-verify -m "checkpoint: setup app components"

# wait for potential download throttling
sleep 2

### Setup api components
download_firebase_components_file () {
  local FILE_PATH=$1
  local TARGET_FOLDER=$FIREBASE_COMPONENTS_FOLDER
  local DOWNLOAD_PATH=https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/setup/templates/components/firebase
  download_ts_file "$DOWNLOAD_PATH" "$TARGET_FOLDER" "$FILE_PATH"
}

rm $FIREBASE_COMPONENTS_FOLDER/eslint.config.mjs
download_firebase_components_file "eslint.config.mjs"
download_firebase_components_file "jest.config.ts"
download_firebase_components_file "tsconfig.spec.json"

## Lib Folder
rm -r $FIREBASE_COMPONENTS_FOLDER/src/lib
mkdir -p $FIREBASE_COMPONENTS_FOLDER/src/lib

rm $FIREBASE_COMPONENTS_FOLDER/src/index.ts
echo "export * from './lib'" > $FIREBASE_COMPONENTS_FOLDER/src/index.ts

download_firebase_components_file "src/lib/index.ts"
download_firebase_components_file "src/lib/functions.ts"

# Auth Folder
mkdir -p $FIREBASE_COMPONENTS_FOLDER/src/lib/auth
download_firebase_components_file "src/lib/auth/claims.ts"
download_firebase_components_file "src/lib/auth/index.ts"

# Development Folder
mkdir -p $FIREBASE_COMPONENTS_FOLDER/src/lib/development
download_firebase_components_file "src/lib/development/development.api.ts"
download_firebase_components_file "src/lib/development/index.ts"

# Model/Example/Profile Folder
mkdir -p $FIREBASE_COMPONENTS_FOLDER/src/lib/model
download_firebase_components_file "src/lib/model/index.ts"
download_firebase_components_file "src/lib/model/service.ts"

mkdir -p $FIREBASE_COMPONENTS_FOLDER/src/lib/model/example
download_firebase_components_file "src/lib/model/example/example.action.ts"
download_firebase_components_file "src/lib/model/example/example.api.ts"
download_firebase_components_file "src/lib/model/example/example.query.ts"
download_firebase_components_file "src/lib/model/example/example.ts"
download_firebase_components_file "src/lib/model/example/index.ts"

mkdir -p $FIREBASE_COMPONENTS_FOLDER/src/lib/model/notification
download_firebase_components_file "src/lib/model/notification/notification.ts"
download_firebase_components_file "src/lib/model/notification/index.ts"

mkdir -p $FIREBASE_COMPONENTS_FOLDER/src/lib/model/profile
download_firebase_components_file "src/lib/model/profile/profile.action.ts"
download_firebase_components_file "src/lib/model/profile/profile.api.ts"
download_firebase_components_file "src/lib/model/profile/profile.query.ts"
download_firebase_components_file "src/lib/model/profile/profile.id.ts"
download_firebase_components_file "src/lib/model/profile/profile.ts"
download_firebase_components_file "src/lib/model/profile/index.ts"

mkdir -p $FIREBASE_COMPONENTS_FOLDER/src/lib/model/system
download_firebase_components_file "src/lib/model/system/system.ts"
download_firebase_components_file "src/lib/model/system/index.ts"

git add --all
git commit --no-verify -m "checkpoint: setup api components"

# wait for potential download throttling
sleep 2

### Setup Angular App
download_angular_ts_file () {
  local FILE_PATH=$1
  local TARGET_FOLDER=$ANGULAR_APP_FOLDER
  local DOWNLOAD_PATH=https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/setup/templates/apps/app
  download_ts_file "$DOWNLOAD_PATH" "$TARGET_FOLDER" "$FILE_PATH"
}

download_angular_ts_file "jest.config.ts"
download_angular_ts_file "tsconfig.spec.json"

download_angular_ts_file "src/styles.scss"
download_angular_ts_file "src/main.ts"
download_angular_ts_file "src/root.app.config.ts"

# proxy.conf.dev.json
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/apps/demo/proxy.conf.dev.json -o $ANGULAR_APP_FOLDER/proxy.conf.dev.json.tmp
sed -e "s/9902/$FIREBASE_EMULATOR_AUTH_PORT/g" $ANGULAR_APP_FOLDER/proxy.conf.dev.json.tmp > $ANGULAR_APP_FOLDER/proxy.conf.dev.json
rm $ANGULAR_APP_FOLDER/proxy.conf.dev.json.tmp

curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/apps/demo/proxy.conf.prod.json -o $ANGULAR_APP_FOLDER/proxy.conf.prod.json.tmp
sed -e "s-components.dereekb.com-example.dereekb.com-g" $ANGULAR_APP_FOLDER/proxy.conf.prod.json.tmp > $ANGULAR_APP_FOLDER/proxy.conf.prod.json
rm $ANGULAR_APP_FOLDER/proxy.conf.prod.json.tmp

# lib
mkdir $ANGULAR_APP_FOLDER/src/lib
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/apps/demo/src/lib/segment.js -o $ANGULAR_APP_FOLDER/src/lib/segment.js

# assets
mkdir -p $ANGULAR_APP_FOLDER/src/assets/brand
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/apps/demo/src/assets/brand/icon.png -o $ANGULAR_APP_FOLDER/src/assets/brand/icon.png

# index.html
rm $ANGULAR_APP_FOLDER/src/index.html
download_angular_ts_file "src/index.html"

rm -rf $ANGULAR_APP_FOLDER/src/style ||:
mkdir $ANGULAR_APP_FOLDER/src/style
download_angular_ts_file "src/style/_app.scss"
download_angular_ts_file "src/style/_style.scss"
download_angular_ts_file "src/style/_variables.scss"

rm -rf $ANGULAR_APP_FOLDER/src/environments ||:
mkdir $ANGULAR_APP_FOLDER/src/environments
download_angular_ts_file "src/environments/base.ts"
download_angular_ts_file "src/environments/environment.prod.ts"
download_angular_ts_file "src/environments/environment.staging.ts"
download_angular_ts_file "src/environments/environment.ts"

rm -rf $ANGULAR_APP_FOLDER/src/app ||:
mkdir -p $ANGULAR_APP_FOLDER/src/app
download_angular_ts_file "src/app/app.router.ts"
download_angular_ts_file "src/app/app.module.ts"

mkdir $ANGULAR_APP_FOLDER/src/app/components
mkdir $ANGULAR_APP_FOLDER/src/app/container
download_angular_ts_file "src/app/container/layout.component.html"
download_angular_ts_file "src/app/container/layout.component.ts"

mkdir $ANGULAR_APP_FOLDER/src/app/state
download_angular_ts_file "src/app/state/app.state.ts"

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
git commit --no-verify -m "checkpoint: setup app"

# wait for potential download throttling
sleep 2

### Setup NestJS API
download_api_ts_file () {
  local FILE_PATH=$1
  local TARGET_FOLDER=$API_APP_FOLDER
  local DOWNLOAD_PATH=https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/setup/templates/apps/api
  download_ts_file "$DOWNLOAD_PATH" "$TARGET_FOLDER" "$FILE_PATH"
}

rm $API_APP_FOLDER/src/main.ts
download_api_ts_file "src/main.ts"

# add the setup file config
download_api_ts_file "jest.config.ts"
download_api_ts_file "tsconfig.spec.json"

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
download_api_ts_file "src/app/common/firebase/storage.module.ts"
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

mkdir $API_APP_FOLDER/src/app/common/model/profile
download_api_ts_file "src/app/common/model/profile/profile.action.server.ts"
download_api_ts_file "src/app/common/model/profile/profile.error.ts"
download_api_ts_file "src/app/common/model/profile/profile.module.ts"
download_api_ts_file "src/app/common/model/profile/index.ts"

mkdir $API_APP_FOLDER/src/app/common/model/notification
download_api_ts_file "src/app/common/model/notification/notification.action.context.ts"
download_api_ts_file "src/app/common/model/notification/notification.factory.ts"
download_api_ts_file "src/app/common/model/notification/notification.init.ts"
download_api_ts_file "src/app/common/model/notification/notification.mailgun.ts"
download_api_ts_file "src/app/common/model/notification/notification.send.mailgun.service.ts"
download_api_ts_file "src/app/common/model/notification/notification.send.service.ts"
download_api_ts_file "src/app/common/model/notification/notification.module.ts"
download_api_ts_file "src/app/common/model/notification/index.ts"

# wait for potential download throttling
sleep 2

## Function Folder
mkdir $API_APP_FOLDER/src/app/function
download_api_ts_file "src/app/function/index.ts"
download_api_ts_file "src/app/function/function.ts"

mkdir $API_APP_FOLDER/src/app/function/model
download_api_ts_file "src/app/function/model/index.ts"
download_api_ts_file "src/app/function/model/crud.functions.ts"
download_api_ts_file "src/app/function/model/development.functions.ts"
download_api_ts_file "src/app/function/model/schedule.functions.ts"

mkdir $API_APP_FOLDER/src/app/function/auth
download_api_ts_file "src/app/function/auth/index.ts"
download_api_ts_file "src/app/function/auth/init.user.function.ts"

mkdir $API_APP_FOLDER/src/app/function/example
download_api_ts_file "src/app/function/example/index.ts"
download_api_ts_file "src/app/function/example/example.development.ts"
download_api_ts_file "src/app/function/example/example.schedule.ts"
download_api_ts_file "src/app/function/example/example.util.ts"
download_api_ts_file "src/app/function/example/example.set.username.ts"
download_api_ts_file "src/app/function/example/example.set.username.spec.ts"

mkdir $API_APP_FOLDER/src/app/function/profile
download_api_ts_file "src/app/function/profile/index.ts"
download_api_ts_file "src/app/function/profile/profile.crud.spec.ts"
download_api_ts_file "src/app/function/profile/profile.util.ts"
download_api_ts_file "src/app/function/profile/profile.update.ts"

mkdir $API_APP_FOLDER/src/app/function/notification
download_api_ts_file "src/app/function/notification/index.ts"
download_api_ts_file "src/app/function/notification/notification.crud.spec.ts"
download_api_ts_file "src/app/function/notification/notification.scenario.spec.ts"
download_api_ts_file "src/app/function/notification/notification.schedule.ts"
download_api_ts_file "src/app/function/notification/notificationbox.update.ts"
download_api_ts_file "src/app/function/notification/notificationuser.update.ts"

# environment folder
mkdir -p $API_APP_FOLDER/src/environments
download_api_ts_file "src/environments/environment.ts"
download_api_ts_file "src/environments/environment.prod.ts"

git add --all
git commit --no-verify -m "checkpoint: setup api"

# Final checks
if [[ "$IS_CI_TEST" =~ ^([yY][eE][sS]|[yY]|[tT])$ ]];
then
  # do not do anything in CI, as the environment is different. CI will perform other tasks.
  echo "Finished setup in CI."
else
  echo "Performing test build..."
  npx -y nx@$NX_VERSION build $ANGULAR_APP_NAME
  npx -y nx@$NX_VERSION build $API_APP_NAME

  echo "Completed $ANGULAR_APP_NAME project setup."
  echo "Project was created at \"$(pwd)\""

  # Docker Checking
  echo "Performing docker cleaning and resetting...";

  # todo - check if docker is available.
  sh ./down.sh
  sh ./reset.sh

  echo "Performing tests..."
  sh ./test-all.sh
fi

# Start On Orphan Branch
# https://stackoverflow.com/questions/1657017/how-to-squash-all-git-commits-into-one
echo "Squashing all commits into a single orphan"
git reset $(git commit-tree HEAD^{tree} -m "started dbx-components project")

# Copy setup checklist readme to the root of the project
curl https://raw.githubusercontent.com/dereekb/dbx-components/$SOURCE_BRANCH/setup/getting-started-checklist.md -o getting-started-checklist.md

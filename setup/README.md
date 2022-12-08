# Setup Project
Use this script to create a new dbx-components project. It will be similar to this project in structure, but has a few differences.

## Pre-Script Setup
You should create your Firebase project. During setup, it will ask you to login to the Firebase CLI and pick a project to configure.

## Post-Script Setup
### Creating a GitHub Repo
You will need to create a github repo (or any other provider) for your project, if you choose. This README will continue assuming GitHub usage.

### Setup CircleCI
Log into CircleCI and 

https://circleci.com/docs/2.0/add-ssh-key/#adding-ssh-keys-to-a-job

The first step is to create an SSH key for CircleCI to use to write back to your project. If you don't plan on letting CircleCI write to your project (using gitflow-like release to main), then you can skip this step.

#### Creating an SSH Key
Use ssh-keygen to generate a new SSH key for your project. Generate one that does not have a a pass-phrase, as CircleCI cannot decrypt it otherwise. You should name your key after the name of your project and with `ci` as a prefix (dbxcomponentsci) to differentiate it.

Instructions for generating an SSH key can be found here: https://www.atlassian.com/git/tutorials/git-ssh

Example usage: `ssh-keygen -t rsa -b 4096 -C "ci@dereekb.com"`

Tip: You can use `cat` to print your keys to your terminal (`cat dbxcomponentsci`, `cat dbxcomponentsci.pub`). The .pub is your public key which goes to github. The private key is uploaded to CircleCI.

Don't forget to add the "add_ssh_keys" section to the step they will be used in.

```
  - add_ssh_keys:
      fingerprints:
        - 'SET_THIS_VALUE_TO_BE_VALID'
```

#### Add to Github
Add your public key to your Github project in the Deploy Keys settings page. 

Example URL: https://github.com/dereekb/dbx-components/settings/keys

Do not forget to also enable write access by checking the box before adding your key.

#### Add To CircleCI
Go to your project settings on CircleCI and to the SSH keys tab. Go to the Additional SSH Keys tab and add the private key. Make sure the hostname is set to github.com.

#### Updating .circleci/config.yml SSH Key Fingerprints
Replace the SSH fingerprints with the fingerprints that now show up for your uploaded key on CircleCI. Replace the `SET_THIS_VALUE_TO_BE_VALID` value. You should also update the user.email and user.name values on line 80 to match your desired values.

### CircleCI Environment Variables
#### NX_CLOUD_AUTH_TOKEN
Add this to CircleCI to specify a specific auth token. You should generate a new token after claiming your workspace on https://nx.app. If your project already has a dev token attached this may not be necessary, as the read/write token within the repo will get used if available.

Add it to CircleCI as `NX_CLOUD_AUTH_TOKEN`

#### GOOGLE_SERVICE_ACCOUNT_JSON
This is needed for deploying to firebase, and authenticating with the CLI. You'll need a service accounts JSON file for your project.

https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk

Once downloaded, you will need to encode it:

In terminal use: `cat dereekb-components-firebase-adminsdk.json | base64`

Add this string to CircleCI as `FIREBASE_SECRETS_BASE64`.

In your CI, add a step that decodes your firebase secret:

```
- run:
    name: decode firebase secrets
    command: echo ${{ FIREBASE_SECRETS_BASE64 }} | base64 -d > ~/code/firebase-secrets.json 
```

Then set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable for any steps that require this to the decoded path:

```
environment:
  GOOGLE_APPLICATION_CREDENTIALS: firebase-secrets.json
```

This is preferred to FIREBASE_TOKEN, since FIREBASE_TOKEN is always available, while you can more easily control when to decode and use your GOOGLE_SERVICE_ACCOUNT_JSON.

Additionally, you may need to update the account's roles within console.cloud.google.com in order to deploy functions properly. Follow instructions here:

https://cloud.google.com/build/docs/deploying-builds/deploy-firebase

You may also need to deploy from your own device/account first, as the first deployment configures the different services using permissions your service account doesn't have access to. Once you've deployed once no further configuration will be necessary and your service worker account used by your CI can deploy properly.

#### FIREBASE_TOKEN
THIS IS DEPRECATED: Use GOOGLE_SERVICE_ACCOUNT_JSON above instead.

This is the important one, as it lets CircleCI deploy to Firebase. The easiest way to generate a token is [using the Firebase CLI](https://github.com/firebase/firebase-tools#using-with-ci-systems).

Run `firebase login:ci` to generate a new token, then add it to CircleCI as `FIREBASE_TOKEN`.

#### NPM_TOKEN
This one is only necessary if you are deploying to NPM.

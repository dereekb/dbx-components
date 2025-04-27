# Pre-setup Checklist
You'll need to do the following before running the setup-project.sh script:

## Firebase
You'll need to setup a new Firebase project first (or rather one needs to exist by the time the script is run). You'll use this project name as part of the setup script input.

For example, if you wanted to name your project `gethapier` but firebase only had `gethapierapp` and you setup your firebase project with that, then you use the setup script with the following:

`./setup-project.sh gethapierapp gethapier getHapier 9300 ~/Desktop gethapier-staging`

It is also recommended that you create a staging project too while you're setting up the production project.

### Firebase Firestore Setup
You'll need to setup a Firestore database for your project. You can do this by going to the Firebase Console and clicking on the Firestore database tab. The Project Overview may also say "Get started by adding Firebase to your app", for which you can create the web icon to get started.

You should type in your project's id as the App nickname for consistency. Also check the box for "Also setup Firebase Hosting for this app."

It is helpful to also copy/paste the setup details that are provided in the "Add Firebase SDK" step/section, as you'll copy/paste these details into the `base.ts` environment file.

### Billing Setup
Upgrade your billing account to the Blaze plan.

## After Setup
Read the `getting-started-checklist.md` file afterwards for the next steps.

# Running Setup
Run the `setup-project.sh` script.

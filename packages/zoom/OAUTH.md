## Server to Server Integration
The server to server integration is used to control your organization's zoom account. This type of integration also does not require going through the approval process.

### Setup
To get started, create a new app at https://marketplace.zoom.us/

#### App Credentials
Copy the credentials to your `.env.local` file and add to CircleCI for deployment. These are the following environment variables that the `@dereekb/zoom` packages uses:

- ZOOM_ACCOUNT_ID
- ZOOM_CLIENT_ID
- ZOOM_CLIENT_SECRET
- ZOOM_SECRET_TOKEN

#### Scopes
Select the scopes that you want to grant to your app.

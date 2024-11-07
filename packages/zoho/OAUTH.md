# Zoho OAuth Overview
These are the instructions for Recruit, but generally apply to Zoho products:

https://www.zoho.com/recruit/developer-guide/apiv2/oauth-overview.html

## For generating an oauth key, do the following steps:

### 1. Register the Client
https://www.zoho.com/recruit/developer-guide/apiv2/register-client.html

Create a "Web Based" client. Here's the values used for the demo:

- Client Name: `Localhost`
- Homepage URL: `http://localhost`
- Authorized Redirect URIs: `http://localhost/oauth`

Copy your clientId and clientSecret

### 2. Craft Authorization Url
Edit the following URL with the specific details:

https://accounts.zoho.com/oauth/v2/auth?scope=`ZohoRecruit.modules.ALL`&client_id=`1000.ABCDE`&response_type=code&access_type=offline&redirect_uri=`http://localhost/oauth`

https://accounts.zoho.com/oauth/v2/auth?scope=ZohoRecruit.modules.ALL&client_id=CLIENT_ID&response_type=code&access_type=offline&redirect_uri=http://localhost/oauth

- The scope is the list of roles we want to grant this refresh token
- The clientId is the client id generated in the previous step
- The redirectUrl is where the web page will redirect us after we authorize the request.
- The access_type should be "offline" to get a refresh token

This token lasts for only 2 minutes.

### 3. Authorize using Authorization Url

Open the link created above, and follow all the steps. You will have to authorize for a production system or any sandboxes separately.

Once complete, it will redirect you to a page like the following. It will look like the following:

http://localhost/oauth?code=1000.ABC.123&location=us&accounts-server=https%3A%2F%2Faccounts.zoho.com&

Copy the code from your generated url. We need this code to get a refresh token.

This generated code lasts for 2 minutes.

### 4. Retrive a Refresh Token

Using Postman or some other program, send a post request to the following url:

https://accounts.zoho.com/oauth/v2/token?grant_type=authorization_code&client_id=`{{clientid}}`&client_secret=`{{clientsecret}}`&redirect_uri=`{{redirecturl}}`&code=`{{authCode}}`

- The redirectUrl used previously (`http://localhost/oauth` in the example). If this does not match, you will get an error
- client_id and client_secret come from the client generated in step 1
- the auth code is the code from the url in step 3

This refresh token will be used as the 
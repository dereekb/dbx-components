# @dereekb/firebase-server/zoho

Firebase-server integrations for Zoho. Provides `firebaseZohoAccountsAccessTokenCacheService`, a
`SystemState`-backed cache for the server-to-server Zoho access token, and the Zoho provider adapter
for the generic `UserExternalConnection` OAuth framework — a controller, service, and module that
mount a per-user Zoho connect flow at `/oauth/zoho`. The two are independent: the cache holds one
token for the whole app, while the connect flow stores per-user credentials on the private
connection document.

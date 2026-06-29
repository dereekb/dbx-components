@dereekb/browser/oidc
=======

A lean, framework-agnostic OIDC relying-party (token-consumer) client for backend-less browser
apps. Drives the authorization-code-with-PKCE flow against a dbx-components OIDC provider as a
public client (`token_endpoint_auth_method: 'none'`), persists tokens in Web Storage, exposes an
`authState$` observable, and produces a Bearer-injecting `fetch` for calling the API.

Built on the shared relying-party core: pure helpers + wire types in `@dereekb/util`, the network
protocol + lazy token manager in `@dereekb/util/oidc`, and the Bearer client factory in
`@dereekb/util/fetch`. No Angular dependency.

## Known limitation — multi-tab refresh-token rotation

The token manager refreshes **lazily** and de-duplicates concurrent refreshes **within a single
page context** (single-flight). It does NOT coordinate across browser tabs. When two tabs hold the
same rotating refresh token and both refresh at once, the slower tab's now-rotated token is
rejected (`invalid_grant`) and that tab is logged out. The remaining tab stays authenticated.

A fast-follow will add cross-tab single-flight (Web Locks + `BroadcastChannel`) and a proactive
refresh timer. Until then, prefer a single active tab for long-lived sessions.

The sources for this package are in the main [@dereekb/dbx-components](https://github.com/dereekb/dbx-components) repo. Please file issues and pull requests against that repo.

License: MIT

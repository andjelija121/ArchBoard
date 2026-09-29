I got this error in next js console on site when i triedto sing in with antoher google acc

Console Error



Cannot initialize Smart CAPTCHA widget because the `clerk-captcha` DOM element was not found; falling back to Invisible CAPTCHA widget. If you are using a custom flow, visit https://clerk.com/docs/guides/development/custom-flows/authentication/bot-sign-up-protection for instructions

and this error in console in vsc
  at ic (https://complete-anteater-7025.clerk.accounts.dev/npm/@clerk/clerk-js@6/dist/clerk.browser.js:43:2471)
    at async ih.managedOrInvisible (https://complete-anteater-7025.clerk.accounts.dev/npm/@clerk/clerk-js@6/dist/clerk.browser.js:43:5430)
    at async nH.create (https://complete-anteater-7025.clerk.accounts.dev/npm/@clerk/clerk-js@6/dist/clerk.browser.js:44:127316)
    at async ac._handleRedirectCallback (https://complete-anteater-7025.clerk.accounts.dev/npm/@clerk/clerk-js@6/dist/clerk.browser.js:44:234729) (https://complete-anteater-7025.clerk.accounts.dev/npm/@clerk/clerk-js@6/dist/clerk.browser.js:43:2471)
[browser] [Cloudflare Turnstile] Turnstile already has been loaded. Was Turnstile imported multiple times? (https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit:2:17362)
[browser] Cannot initialize Smart CAPTCHA widget because the `clerk-captcha` DOM element was not found; falling back to Invisible CAPTCHA widget. If you are using a custom flow, visit https://clerk.com/docs/guides/development/custom-flows/authentication/bot-sign-up-protection for instructions 
    at ic (https://complete-anteater-7025.clerk.accounts.dev/npm/@clerk/clerk-js@6/dist/clerk.browser.js:43:2471)
    at async ih.managedOrInvisible (https://complete-anteater-7025.clerk.accounts.dev/npm/@clerk/clerk-js@6/dist/clerk.browser.js:43:5430)
    at async nH.create (https://complete-anteater-7025.clerk.accounts.dev/npm/@clerk/clerk-js@6/dist/clerk.browser.js:44:127316)
    at async ac._handleRedirectCallback (https://complete-anteater-7025.clerk.accounts.dev/npm/@clerk/clerk-js@6/dist/clerk.browser.js:44:234729) (https://complete-anteater-7025.clerk.accounts.dev/npm/@clerk/clerk-js@6/dist/clerk.browser.js:43:2471)
[browser] [Cloudflare Turnstile] Turnstile has already been rendered in this container. The render attempt was rejected. (https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit:2:17362)
[browser] [Cloudflare Turnstile] Ignored message from unexpected source for event: requestExtraParams. (https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit:2:17362)
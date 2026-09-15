// Central/special-admin login passwords.
//
// Every value below MUST come from an environment variable — there is no
// hardcoded fallback. If a variable is missing, the corresponding account
// simply cannot log in via this path: readRequired() returns null, and
// every comparison site in portal-login/route.js, validate-brand-password/
// route.js, and the home-portal login path uses `&&`-guards or strict `===`
// against the submitted password, so `null` can never match (including
// edge cases like a submitted password literally equal to "null"). This
// fails safely (that one account's login just behaves like a wrong
// password — no crash, no effect on any other account/portal) and clearly
// (a specific console.warn is emitted server-side naming exactly which env
// var is missing, visible in Vercel function logs).
//
// Required environment variables (set in .env locally AND in the Vercel
// production project — see docs handed to the repo owner for current
// values; this file intentionally does not store or fall back to them):
//   ADMIN_PW_YOURLETTERS2ME_GMAIL
//   ADMIN_PW_YOURLETTERS2ME_LIVE
//   ADMIN_PW_SUDARSANAN
//   ADMIN_PW_MAKEWITHUS
//   ADMIN_PW_KRRISH
//   ADMIN_PW_ADMINISTRATOR_DKJU
//   ADMIN_PW_MWUS
//   ADMIN_PW_DEV_MWUS
//   ADMIN_PW_DEVELOPER_MWUS

// Module-level cache in dev, module scope in prod — either way this warns
// once per env var per server process instead of once per request, so an
// unconfigured account doesn't spam the terminal on every login attempt.
const warnedVars = new Set();

function readRequired(envVar, email) {
  const value = process.env[envVar];
  if (!value) {
    if (!warnedVars.has(envVar)) {
      warnedVars.add(envVar);
      console.warn(
        `[adminCredentials] ${envVar} is not set — login for "${email}" via this path is disabled until it is configured.`
      );
    }
    return null;
  }
  return value;
}

export const SPECIAL_ADMIN_PASSWORDS = {
  "yourletters2me@gmail.com": readRequired("ADMIN_PW_YOURLETTERS2ME_GMAIL", "yourletters2me@gmail.com"),
  "yourletters2me@live.com": readRequired("ADMIN_PW_YOURLETTERS2ME_LIVE", "yourletters2me@live.com"),
 
};

export const ADMIN_HARDCODED_CREDS = {
  "admin@dkju.org": readRequired("ADMIN_PW_ADMINISTRATOR_DKJU", "admin@dkju.org"),
 
};

export const HOME_PORTAL_CREDS = {
  "admin@dkju.org": ADMIN_HARDCODED_CREDS["admin@dkju.org"],
  
  "yourletters2me@gmail.com": SPECIAL_ADMIN_PASSWORDS["yourletters2me@gmail.com"],
  "yourletters2me@live.com": SPECIAL_ADMIN_PASSWORDS["yourletters2me@live.com"],
};

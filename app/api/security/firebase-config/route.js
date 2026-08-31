export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const env = (name) => process.env[name] || process.env[`NEXT_PUBLIC_${name}`] || "";

export async function GET() {
  const config = {
    apiKey: env("FIREBASE_API_KEY"),
    authDomain: env("FIREBASE_AUTH_DOMAIN"),
    projectId: env("FIREBASE_PROJECT_ID"),
    storageBucket: env("FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: env("FIREBASE_MESSAGING_SENDER_ID"),
    appId: env("FIREBASE_APP_ID"),
    appCheckSiteKey: env("FIREBASE_APPCHECK_SITE_KEY"),
  };

  return new Response(
    `window.__DKJU_FIREBASE_CONFIG__ = ${JSON.stringify(config)};`,
    {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

import "./globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import AuthProvider from "@/components/AuthProvider";
import DateFormatOverride from "@/components/DateFormatOverride";
import SessionAnalytics from "@/components/SessionAnalytics";
import WhatsAppSupport from "@/components/WhatsAppSupport";

const inter = Inter({ subsets: ["latin"] });

const firebaseClientConfig = {
  apiKey:
    process.env.FIREBASE_API_KEY || process.env.NEXT_FIREBASE_API_KEY || "",
  authDomain:
    process.env.FIREBASE_AUTH_DOMAIN ||
    process.env.NEXT_FIREBASE_AUTH_DOMAIN ||
    "",
  projectId:
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_FIREBASE_PROJECT_ID ||
    "",
  storageBucket:
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_FIREBASE_STORAGE_BUCKET ||
    "",
  messagingSenderId:
    process.env.FIREBASE_MESSAGING_SENDER_ID ||
    process.env.NEXT_FIREBASE_MESSAGING_SENDER_ID ||
    "",
  appId:
    process.env.FIREBASE_APP_ID || process.env.NEXT_FIREBASE_APP_ID || "",
  appCheckSiteKey:
    process.env.FIREBASE_APPCHECK_SITE_KEY ||
    process.env.NEXT_FIREBASE_APPCHECK_SITE_KEY ||
    "",
};

const firebaseConfigScript = `window.__DKJU_FIREBASE_CONFIG__ = ${JSON.stringify(
  firebaseClientConfig,
).replace(/</g, "\\u003c")};`;

export const metadata = {
  title: "DKJU - Smart Islamic Education",
  description:
    "DKJU ERP Portal for Student Admission and Management - Smart Islamic Education System",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DKJU",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "DKJU",
    "application-name": "DKJU",
    "msapplication-TileColor": "#0d9488",
    "msapplication-config": "/browserconfig.xml",
  },
};

// Move themeColor and viewport here
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0d9488",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          id="dkju-firebase-runtime-config"
          dangerouslySetInnerHTML={{ __html: firebaseConfigScript }}
        />
        <link rel="icon" href="/logo.png" sizes="any" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="DKJU" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="DKJU" />
        <meta name="msapplication-TileColor" content="#0d9488" />
        <meta name="msapplication-TileImage" content="/logo.png" />
      </head>
      <body
        suppressHydrationWarning
        className={`${inter.className} max-w-[1700px] antialiased mx-auto bg-gray-50 flex flex-col min-h-screen`}
      >
        <DateFormatOverride />
        <AuthProvider>
          <SessionAnalytics />
          {children}
           <WhatsAppSupport />
        </AuthProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}

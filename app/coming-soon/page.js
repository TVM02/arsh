import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Coming Soon | DKJU",
  description: "Digital E-Learning platform is being developed. Stay tuned.",
};

export default function ComingSoonPage() {
  return (
    <main
      style={{
        backgroundColor: "#ffffff",
        color: "#274629",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div
        style={{
          maxWidth: "520px",
          width: "100%",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem",
        }}
      >
        {/* Logo */}
        <div
          style={{
            borderRadius: "50%",
            border: "2px solid rgba(201,179,126,0.45)",
            padding: "1rem",
            background: "rgba(201,179,126,0.06)",
          }}
        >
          <Image
            src="/images/logo2.png"
            alt="DKJU Logo"
            width={80}
            height={80}
          />
        </div>

        {/* Arabic */}
        <p
          style={{
            fontFamily: "serif",
            fontSize: "2.5rem",
            color: "#c9b37e",
            lineHeight: 1,
            margin: 0,
            direction: "rtl",
          }}
        >
          قريباً
        </p>

        {/* Heading */}
        <h1
          style={{
            fontFamily: "serif",
            fontSize: "clamp(2rem, 6vw, 3rem)",
            color: "#274629",
            margin: 0,
            fontWeight: "normal",
            lineHeight: 1.2,
          }}
        >
          Coming Soon
        </h1>

        {/* Divider */}
        <div
          style={{
            width: "80px",
            height: "3px",
            background: "linear-gradient(90deg, transparent, #c9b37e, transparent)",
            borderRadius: "2px",
          }}
        />

        {/* Description */}
        <p
          style={{
            color: "#355a2c",
            fontSize: "1.05rem",
            lineHeight: 1.7,
            margin: 0,
          }}
        >
          IT Coordinators platform is being developed. Stay tuned.
        </p>

        {/* Back link */}
        <Link
          href="/"
          style={{
            display: "inline-block",
            marginTop: "0.5rem",
            padding: "0.65rem 1.75rem",
            background: "#274629",
            color: "#f7f3e9",
            borderRadius: "4px",
            textDecoration: "none",
            fontWeight: 500,
            fontSize: "0.95rem",
            transition: "background 0.2s",
          }}
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}

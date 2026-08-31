import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const getClientIp = (request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("fastly-client-ip") ||
    "Unavailable"
  );
};

const detectDevice = (userAgent) => {
  if (/ipad|tablet/i.test(userAgent)) return "Tablet";
  if (/mobile|android|iphone|ipod/i.test(userAgent)) return "Mobile";
  return "Desktop";
};

const detectOs = (userAgent) => {
  if (/windows nt/i.test(userAgent)) return "Windows";
  if (/android/i.test(userAgent)) return "Android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "iOS";
  if (/mac os x|macintosh/i.test(userAgent)) return "macOS";
  if (/linux/i.test(userAgent)) return "Linux";
  return "Unknown OS";
};

const detectBrowser = (userAgent) => {
  if (/edg\//i.test(userAgent)) return "Edge";
  if (/opr\/|opera/i.test(userAgent)) return "Opera";
  if (/chrome|crios/i.test(userAgent) && !/edg\//i.test(userAgent)) return "Chrome";
  if (/firefox|fxios/i.test(userAgent)) return "Firefox";
  if (/safari/i.test(userAgent) && !/chrome|crios/i.test(userAgent)) return "Safari";
  return "Unknown Browser";
};

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const getHeader = (request, name) => request.headers.get(name) || "";

const calculateBotScore = (request, userAgent) => {
  const cfScore = Number(getHeader(request, "cf-bot-score"));
  if (Number.isFinite(cfScore) && cfScore >= 1 && cfScore <= 99) {
    return {
      botScore: clamp(100 - cfScore),
      botScoreSource: "cloudflare",
      botSignals: [`Cloudflare bot score ${cfScore}`],
    };
  }

  const acceptLanguage = getHeader(request, "accept-language");
  const secFetchSite = getHeader(request, "sec-fetch-site");
  const secFetchMode = getHeader(request, "sec-fetch-mode");
  const secChUa = getHeader(request, "sec-ch-ua");
  const secChPlatform = getHeader(request, "sec-ch-ua-platform");
  const lowerAgent = userAgent.toLowerCase();
  const signals = [];
  let score = 12;

  const addSignal = (points, signal) => {
    score += points;
    signals.push(signal);
  };

  if (!userAgent || userAgent === "Unavailable") addSignal(35, "missing user agent");
  if (/bot|crawler|spider|scraper|curl|wget|python|httpclient|postman|axios|go-http-client/i.test(userAgent)) {
    addSignal(55, "automation user agent keyword");
  }
  if (/headless|phantomjs|puppeteer|playwright|selenium/i.test(userAgent)) {
    addSignal(70, "headless/browser automation keyword");
  }
  if (!acceptLanguage) addSignal(12, "missing accept-language header");
  if (!secFetchSite || !secFetchMode) addSignal(8, "missing fetch metadata headers");
  if ((/chrome|edg|opr|firefox|safari/i.test(userAgent)) && !secChUa && !/firefox|safari/i.test(lowerAgent)) {
    addSignal(8, "missing browser client hints");
  }
  if (secChPlatform && !userAgent.toLowerCase().includes(secChPlatform.replace(/"/g, "").toLowerCase().split(" ")[0])) {
    addSignal(4, "client hint platform mismatch");
  }

  if (signals.length === 0) {
    signals.push("normal browser request headers");
  }

  return {
    botScore: clamp(Math.round(score)),
    botScoreSource: "request_header_heuristic",
    botSignals: signals,
  };
};

export async function GET(request) {
  const userAgent = request.headers.get("user-agent") || "Unavailable";
  const device = detectDevice(userAgent);
  const os = detectOs(userAgent);
  const browser = detectBrowser(userAgent);
  const { botScore, botScoreSource, botSignals } = calculateBotScore(request, userAgent);

  return NextResponse.json({
    ip: getClientIp(request),
    userAgent,
    device,
    os,
    browser,
    system: `${browser} on ${os}`,
    botScore,
    botScoreSource,
    botSignals,
    botStatus: botScore >= 70 ? "likely_bot" : "likely_human",
  });
}

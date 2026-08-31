import { NextResponse } from "next/server";

export async function GET(request) {
  return handleProxy(request);
}

export async function POST(request) {
  return handleProxy(request);
}

async function handleProxy(request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return new NextResponse("Missing URL parameter", { status: 400 });
  }

  try {
    const fetchOptions = {
      method: request.method,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8,application/json",
        "Accept-Language": "en-US,en;q=0.5",
      },
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      fetchOptions.body = await request.blob();
      const reqContentType = request.headers.get("content-type");
      if (reqContentType) fetchOptions.headers["Content-Type"] = reqContentType;
    }

    if (targetUrl.includes("awqaf.gov.ae")) {
      fetchOptions.headers["Origin"] = "https://www.awqaf.gov.ae";
      fetchOptions.headers["Referer"] = "https://www.awqaf.gov.ae/";
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("text/html")) {
      let html = await response.text();

      if (targetUrl.includes("awqaf.gov.ae")) {
        const proxyPrefix = '/api/iframe-proxy?url=https://www.awqaf.gov.ae/';
        html = html.replace(/href="\//g, `href="${proxyPrefix}`);
        html = html.replace(/src="\//g, `src="${proxyPrefix}`);
        html = html.replace(/\s*crossorigin(="[^"]*")?/gi, "");
        html = html.replace(/\s*integrity="[^"]*"/gi, "");
        
        // Inject XHR/Fetch monkey patch to force all API requests through our proxy
        const monkeyPatch = `
<script>
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    let url = args[0];
    if (typeof url === 'string' && url.includes('awqaf.gov.ae')) {
      args[0] = '/api/iframe-proxy?url=' + encodeURIComponent(url);
    }
    return originalFetch.apply(this, args);
  };

  const originalXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    if (typeof url === 'string' && url.includes('awqaf.gov.ae')) {
      url = '/api/iframe-proxy?url=' + encodeURIComponent(url);
    }
    return originalXhrOpen.call(this, method, url, ...rest);
  };
</script>
        `;
        html = html.replace('<head>', '<head>' + monkeyPatch);
      }

      return new NextResponse(html, {
        status: response.status,
        headers: {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
        },
      });
    } else {
      const buffer = await response.arrayBuffer();
      let headers = {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      };
      
      if (contentType.includes("text/css")) {
        let cssText = new TextDecoder().decode(buffer);
        const proxyPrefix = '/api/iframe-proxy?url=https://www.awqaf.gov.ae/';
        cssText = cssText.replace(/url\(\s*['"]?(\/[^'"\)]+)['"]?\s*\)/g, (match, p1) => {
          return `url("${proxyPrefix}${p1.substring(1)}")`;
        });
        return new NextResponse(cssText, { status: response.status, headers });
      }

      if (contentType.includes("application/javascript") || contentType.includes("text/javascript")) {
        let jsText = new TextDecoder().decode(buffer);
        // Rewrite problematic API endpoints and missing locales in the JS payload
        jsText = jsText.replace(/https:\/\/mobileappapi\.awqaf\.gov\.ae/g, '/api/iframe-proxy?url=https://mobileappapi.awqaf.gov.ae');
        jsText = jsText.replace(/\/locales\//g, '/api/iframe-proxy?url=https://www.awqaf.gov.ae/locales/');
        return new NextResponse(jsText, { status: response.status, headers });
      }

      return new NextResponse(buffer, { status: response.status, headers });
    }
  } catch (error) {
    console.error("Proxy error:", error);
    return new NextResponse("Failed to fetch content", { status: 500 });
  }
}

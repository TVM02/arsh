import { auth } from "@/lib/firebase";

export async function authHeaders(extra = {}) {
  const token = await auth.currentUser?.getIdToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function authFetch(url, options = {}) {
  const headers = await authHeaders(options.headers || {});
  return fetch(url, {
    ...options,
    headers,
  });
}

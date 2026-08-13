/**
 * The app's own public base URL.
 *
 * This is not cosmetic: it builds the OneLogin OIDC callback and post-logout
 * redirect, and the QuickBooks OAuth redirect_uri, both of which must match
 * what is registered with those providers exactly. The previous code defaulted
 * to a hardcoded Replit URL, so a missing APP_URL in production would not fail
 * loudly -- it would send users to a dead Replit domain mid-login.
 *
 * In production APP_URL is therefore required. Locally it falls back to the
 * dev server's port.
 */
export function getAppUrl(): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "APP_URL must be set in production. It builds the OneLogin and QuickBooks " +
      "OAuth redirect URIs, which must match the values registered with those providers.",
    );
  }

  return `http://localhost:${process.env.PORT || "5000"}`;
}

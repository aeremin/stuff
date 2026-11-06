/**
 * Who may use the inventory: Firebase Auth users with the custom claim
 * `admin: true`. The Firestore and Storage rules check the same claim. The
 * function uses the Admin SDK, which bypasses those rules, so the checks here
 * are what guard the data on this side.
 *
 * The claim is set by hand (Admin SDK `setCustomUserClaims(uid, { admin: true })`).
 * It shows up in ID tokens only once they are refreshed, so after granting
 * access the user signs out and back in.
 */
import { logger } from "firebase-functions";
import { adminAuth } from "./firebase.js";

function hasAdminClaim(claims: Record<string, unknown> | undefined): boolean {
  return claims?.admin === true;
}

export type IdTokenCheck =
  | { ok: true; uid: string; email: string }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Checks a Firebase ID token sent by the web app: it must be valid, for a
 * verified email, and carry the admin claim.
 */
export async function checkIdToken(idToken: string, purpose: string): Promise<IdTokenCheck> {
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch (err) {
    logger.warn(`Rejected ID token on ${purpose}`, err);
    return {
      ok: false,
      status: 401,
      error: "Your sign-in has expired. Sign out, sign in again and retry.",
    };
  }
  if (!decoded.email || decoded.email_verified !== true || !hasAdminClaim(decoded)) {
    return {
      ok: false,
      status: 403,
      error:
        `${decoded.email ?? "This account"} is not allowed to access this inventory. ` +
        "If access was granted just now, sign out and sign in again.",
    };
  }
  return { ok: true, uid: decoded.uid, email: decoded.email };
}

const CACHE_MS = 60 * 1000;
const cache = new Map<string, { allowed: boolean; checkedAt: number }>();

/**
 * Whether a user who was granted an MCP token still has access: the account
 * exists, is not disabled and still has the admin claim. Looked up in Firebase
 * Auth, and remembered by the instance for a minute so that a burst of MCP
 * requests does not cost a lookup each.
 */
export async function userHasAccess(uid: string): Promise<boolean> {
  const cached = cache.get(uid);
  if (cached && Date.now() - cached.checkedAt < CACHE_MS) return cached.allowed;

  let allowed: boolean;
  try {
    const user = await adminAuth.getUser(uid);
    allowed = !user.disabled && hasAdminClaim(user.customClaims);
  } catch (err) {
    if ((err as { code?: unknown }).code !== "auth/user-not-found") throw err;
    allowed = false;
  }
  cache.set(uid, { allowed, checkedAt: Date.now() });
  return allowed;
}

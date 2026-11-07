import { Link } from "react-router-dom";

// The home page's query string (e.g. "?kind=Climbing"), so "Back to home"
// returns to the category the user came from. Kept in sessionStorage so it
// survives a reload of the item page.
const STORAGE_KEY = "homeSearch";

export function rememberHomeSearch(search: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, search);
  } catch {
    // Storage unavailable (e.g. blocked); the link falls back to plain "/".
  }
}

function homeSearch(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** The home page, in the category the user came from. */
export function homeLocation() {
  return { pathname: "/", search: homeSearch() };
}

export function BackToHomeLink() {
  return (
    <Link to={homeLocation()} className="item-page__back">
      ← Back to home
    </Link>
  );
}

import { Link } from "react-router-dom";
import "./ItemPage.css";

export function NotFoundPage() {
  return (
    <div className="item-page">
      <div className="item-page__not-found">Page not found</div>
      <Link to="/" className="item-page__back">
        ← Back to home
      </Link>
    </div>
  );
}

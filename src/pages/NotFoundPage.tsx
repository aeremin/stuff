import "./ItemPage.css";
import { BackToHomeLink } from "../components/BackToHomeLink";

export function NotFoundPage() {
  return (
    <div className="item-page">
      <div className="item-page__not-found">Page not found</div>
      <BackToHomeLink />
    </div>
  );
}

import type { ItemState } from "../useItem";
import "../pages/ItemPage.css";
import { BackToHomeLink } from "./BackToHomeLink";

/** What the item pages show while an item isn't loaded. */
export function ItemLoadStatus({
  state,
}: {
  state: Exclude<ItemState, { status: "loaded" }>;
}) {
  if (state.status === "loading") {
    return (
      <div className="item-page">
        <div className="item-page__loading">Loading…</div>
      </div>
    );
  }

  return (
    <div className="item-page">
      {state.status === "error" ? (
        <div className="item-page__error">{state.message}</div>
      ) : (
        <div className="item-page__not-found">Item not found</div>
      )}
      <BackToHomeLink />
    </div>
  );
}

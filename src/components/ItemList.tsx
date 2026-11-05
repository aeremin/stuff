import { Link } from "react-router-dom";
import type { InventoryItem } from "../common";
import { MarkdownView } from "./MarkdownView";

/** Items as linked cards with their description, as on the home page. */
export function ItemList({ items }: { items: InventoryItem[] }) {
  return (
    <ul className="home__list">
      {items.map((item) => {
        const name = item.name || "(no name)";
        const description =
          typeof item.description === "string" ? item.description : "";
        return (
          <li key={item.id} className="home__list-item">
            <div className="home__list-item-card">
              <Link to={`/item/${item.id}`} className="home__item-link">
                <span className="home__item-name">{name}</span>
              </Link>
              {description.trim() !== "" && (
                <MarkdownView
                  markdown={description}
                  className="home__item-description markdown-view--compact"
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

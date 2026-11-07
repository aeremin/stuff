import { Link } from "react-router-dom";
import type { InventoryItem } from "../common";
import { availableFields, thumbnailUrl } from "../schema";
import { MarkdownView } from "./MarkdownView";

const imageFieldIds = availableFields
  .filter((f) => f.type === "image")
  .map((f) => f.id);

/**
 * The first image field's thumbnail. Lists only show thumbnails, never the
 * full photo, which can be several MB.
 */
function itemThumbnail(item: InventoryItem): string | undefined {
  for (const id of imageFieldIds) {
    const url = thumbnailUrl(item, id);
    if (url) return url;
  }
  return undefined;
}

/**
 * Items as linked cards with a thumbnail and their description, as on the
 * home page. Works for Firestore items and for search hits (the Algolia index
 * copies every field, `thumbnails` included).
 */
export function ItemList({ items }: { items: InventoryItem[] }) {
  return (
    <ul className="home__list">
      {items.map((item) => {
        const name = item.name || "(no name)";
        const description =
          typeof item.description === "string" ? item.description : "";
        const thumbnail = itemThumbnail(item);
        return (
          <li key={item.id} className="home__list-item">
            <div className="home__list-item-card">
              {/* The name below is the accessible link; this one is just a
                  bigger target. */}
              <Link
                to={`/item/${item.id}`}
                className="home__item-thumb"
                tabIndex={-1}
                aria-hidden="true"
              >
                {thumbnail ? (
                  <img src={thumbnail} alt="" loading="lazy" decoding="async" />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="home__item-thumb-placeholder"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  >
                    <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
                    <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
                  </svg>
                )}
              </Link>
              <div className="home__item-body">
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
            </div>
          </li>
        );
      })}
    </ul>
  );
}

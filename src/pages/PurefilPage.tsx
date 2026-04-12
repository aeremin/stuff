import { collection, getDocs, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BarShapeProps } from "recharts/types/cartesian/Bar";
import converter from "ral-hex-converter";
import pantones from "pantone-converter/pantones.json";
import type { InventoryItem } from "../common.ts";
import { db, INVENTORY_COLLECTION } from "../firebase.ts";

interface ChartItem {
  id: string;
  name: string;
  color: string;
  hexColor: string;
  amount: number;
  isRainbow: boolean;
}

function resolveColorToHex(colorStr: string): string {
  const ralMatch = colorStr.match(/RAL\s*(\d{4})/i);
  if (ralMatch) {
    try {
      return converter.toHex(Number(ralMatch[1]));
    } catch {
      // unknown RAL code — fall through
    }
  }

  const pantoneMatch = colorStr.match(/Pantone\s+(.+)/i);
  if (pantoneMatch) {
    const name = pantoneMatch[1].trim();
    const hex =
      pantones[`Pantone ${name}`] ??
      pantones[`Pantone PMS ${name}`] ??
      pantones[name];
    if (hex) return hex;
  }

  return "#888888";
}

function hexToHue(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d + 6) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return h * 60;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartItem }[];
}) {
  if (!active || !payload?.[0]) return null;
  const item = payload[0].payload;
  const swatchBg = item.isRainbow
    ? "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)"
    : item.hexColor;
  return (
    <div className="purefil__tooltip">
      <div
        className="purefil__tooltip-swatch"
        style={{ background: swatchBg }}
      />
      <div className="purefil__tooltip-text">
        <span className="purefil__tooltip-color">{item.color}</span>
        <span className="purefil__tooltip-amount">Amount: {item.amount}</span>
      </div>
    </div>
  );
}

function ClickableBarShape(props: BarShapeProps) {
  const { x, y, width, height, fill, background } = props;
  const item = props.payload as ChartItem | undefined;
  const gradientId = `rainbow-${item?.id ?? ""}`;
  return (
    <g cursor="pointer">
      {item?.isRainbow && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#f00" />
            <stop offset="17%" stopColor="#ff0" />
            <stop offset="33%" stopColor="#0f0" />
            <stop offset="50%" stopColor="#0ff" />
            <stop offset="67%" stopColor="#00f" />
            <stop offset="83%" stopColor="#f0f" />
            <stop offset="100%" stopColor="#f00" />
          </linearGradient>
        </defs>
      )}
      {background && background.x != null && background.y != null && (
        <rect
          x={background.x}
          y={background.y}
          width={background.width}
          height={background.height}
          fill="transparent"
        />
      )}
      {height > 0 && (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={item?.isRainbow ? `url(#${gradientId})` : fill}
          rx={4}
        />
      )}
    </g>
  );
}

export function PurefilPage() {
  const [items, setItems] = useState<ChartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!db) {
        setError("Database not available");
        setLoading(false);
        return;
      }

      try {
        const q = query(
          collection(db, INVENTORY_COLLECTION),
          where("kind", "==", "Filament"),
        );
        const snap = await getDocs(q);
        if (cancelled) return;

        const chartItems: ChartItem[] = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as InventoryItem)
          .filter((item) => String(item.name).startsWith("Purefil"))
          .map((item) => {
            const colorStr = String(item["color"] ?? "");
            const isRainbow = /farbwechsel/i.test(colorStr);
            return {
              id: item.id,
              name: item.name,
              color: colorStr,
              hexColor: isRainbow ? "#888888" : resolveColorToHex(colorStr),
              amount: Number(item["amount"]) || 0,
              isRainbow,
            };
          });

        chartItems.sort((a, b) => {
          if (a.isRainbow !== b.isRainbow) return a.isRainbow ? 1 : -1;
          return hexToHue(a.hexColor) - hexToHue(b.hexColor);
        });
        setItems(chartItems);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load items",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p>Loading…</p>;
  if (error) return <p className="purefil__error">{error}</p>;
  if (items.length === 0) return <p>No Purefil items found.</p>;

  return (
    <div className="purefil">
      <h1 className="purefil__title">Purefil Filaments</h1>
      <div className="purefil__chart-container">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={items} barCategoryGap="15%">
            <XAxis dataKey="color" hide />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={{ stroke: "#334155" }}
              tickLine={false}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
            />
            <Bar
              dataKey="amount"
              shape={ClickableBarShape}
              onClick={(data) => {
                const item = data as unknown as ChartItem;
                navigate(`/item/${item.id}`);
              }}
            >
              {items.map((item) => (
                <Cell key={item.id} fill={item.hexColor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";

export type IndexListItem = {
  label: string;
  to: string;
  children?: IndexListItem[];
};

type IndexListProps = {
  items: IndexListItem[];
};

function IndexRow({ item, nested = false }: { item: IndexListItem; nested?: boolean }) {
  return (
    <div className={nested ? "ml-4" : ""}>
      <Link to={item.to} className={`index-row ${nested ? "py-2 text-sm" : "py-3 text-base"}`}>
        <span className="truncate">{nested ? `-- ${item.label}` : item.label}</span>
        <span aria-hidden className="text-lg leading-none">
          &#8250;
        </span>
      </Link>
      {item.children ? (
        <div className="mt-2 space-y-2">
          {item.children.map((child) => (
            <IndexRow key={child.to} item={child} nested />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function IndexList({ items }: IndexListProps) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <IndexRow key={item.to} item={item} />
      ))}
    </div>
  );
}

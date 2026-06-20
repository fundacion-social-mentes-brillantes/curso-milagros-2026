import Image from "next/image";

export function EmptyState({
  icon = "🌱",
  imageSrc,
  imageAlt,
  title,
  description,
  action,
}: {
  icon?: string;
  imageSrc?: string;
  imageAlt?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt={imageAlt ?? ""}
          width={800}
          height={600}
          className="h-36 w-auto max-w-full sm:h-44"
        />
      ) : (
        <span className="text-4xl" aria-hidden>
          {icon}
        </span>
      )}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}

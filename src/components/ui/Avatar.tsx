"use client";

import Image from "next/image";
import { useState } from "react";

export function Avatar({
  src,
  name,
  size = 36,
}: {
  src: string | null | undefined;
  name: string;
  size?: number;
}) {
  const [error, setError] = useState(false);
  const initial = (name?.trim()?.[0] ?? "✦").toUpperCase();

  if (!src || error) {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full bg-primary/15 font-semibold text-primary"
        style={{ width: size, height: size, fontSize: size * 0.42 }}
        aria-hidden
      >
        {initial}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={name}
      width={size}
      height={size}
      onError={() => setError(true)}
      className="shrink-0 rounded-full object-cover"
      referrerPolicy="no-referrer"
    />
  );
}

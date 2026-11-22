import type { SessionUser } from "@/server/auth/types";

/** Up to two initials from a display name, e.g. "Mina Park" -> "MP". */
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "");
  return letters.join("").toUpperCase() || "?";
}

export function Avatar({
  user,
  size = 36,
}: {
  user: Pick<SessionUser, "name" | "image">;
  size?: number;
}) {
  const style = { width: size, height: size };
  if (user.image) {
    return (
      // Plain <img>: avatars come from Google's CDN, and next/image would need
      // remotePatterns config plus an optimizer hop for a 36px picture.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.image}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full object-cover"
        style={style}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#FFD23F] font-bold text-[#15161A]"
      // Initials scale with the circle: 13px at 36px, 34px on the profile.
      style={{ ...style, fontSize: Math.max(11, Math.round(size * 0.36)) }}
    >
      {initials(user.name)}
    </span>
  );
}

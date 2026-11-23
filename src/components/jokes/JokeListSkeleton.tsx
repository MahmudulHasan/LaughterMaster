/** Placeholder while a server-rendered list streams in. */
export function JokeListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="h-32 animate-pulse rounded-2xl border border-[#E3E5EA] bg-white"
        />
      ))}
    </div>
  );
}

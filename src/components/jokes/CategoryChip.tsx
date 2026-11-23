/** Grey pill naming a joke's category (assigned by Claude from M5). */
export function CategoryChip({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#EEF0F4] px-2.5 py-0.5 text-xs font-medium text-[#3A3D46]">
      {category}
    </span>
  );
}

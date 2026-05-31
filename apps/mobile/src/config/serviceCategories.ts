export const SERVICE_CATEGORIES = [
  {
    key: 'plumbing',
    label: 'Plumbing',
    subcategories: [
      { key: 'leak_repair', label: 'Leak Repair' },
      { key: 'pipe_installation', label: 'Pipe Installation' },
      { key: 'bathroom', label: 'Bathroom' },
      { key: 'sink_repair', label: 'Sink Repair' },
    ],
  },
  {
    key: 'electrical',
    label: 'Electrical',
    subcategories: [
      { key: 'wiring', label: 'Wiring' },
      { key: 'lighting', label: 'Lighting' },
      { key: 'repairs', label: 'Repairs' },
      { key: 'appliances', label: 'Appliances' },
    ],
  },
  {
    key: 'painting',
    label: 'Painting',
    subcategories: [
      { key: 'interior', label: 'Interior' },
      { key: 'exterior', label: 'Exterior' },
      { key: 'walls', label: 'Walls' },
      { key: 'doors_windows', label: 'Doors & Windows' },
    ],
  },
  {
    key: 'construction',
    label: 'Construction',
    subcategories: [
      { key: 'renovation', label: 'Renovation' },
      { key: 'tiles', label: 'Tiles' },
      { key: 'flooring', label: 'Flooring' },
      { key: 'small_repairs', label: 'Small Repairs' },
    ],
  },
  {
    key: 'cleaning',
    label: 'Cleaning',
    subcategories: [
      { key: 'home_cleaning', label: 'Home Cleaning' },
      { key: 'deep_cleaning', label: 'Deep Cleaning' },
      { key: 'office_cleaning', label: 'Office Cleaning' },
      { key: 'post_construction', label: 'Post Construction' },
    ],
  },
  {
    key: 'handyman',
    label: 'Handyman',
    subcategories: [
      { key: 'furniture_assembly', label: 'Furniture Assembly' },
      { key: 'mounting', label: 'Mounting' },
      { key: 'general_repairs', label: 'General Repairs' },
      { key: 'maintenance', label: 'Maintenance' },
    ],
  },
] as const;

export function serviceCategoryLabel(key: string) {
  return SERVICE_CATEGORIES.find((category) => category.key === key)?.label ?? key;
}

export function serviceSubcategoryLabel(categoryKey: string, subcategoryKey: string) {
  return (
    SERVICE_CATEGORIES.find((category) => category.key === categoryKey)?.subcategories.find(
      (subcategory) => subcategory.key === subcategoryKey,
    )?.label ?? subcategoryKey
  );
}

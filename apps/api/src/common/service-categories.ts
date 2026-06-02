import { BadRequestException } from '@nestjs/common';

export const SERVICE_CATEGORIES = [
  {
    key: 'plumbing',
    label: 'Plumbing',
    subcategories: [
      { key: 'leak_repair', label: 'Leak Repair' },
      { key: 'pipe_installation', label: 'Pipe Installation' },
      { key: 'bathroom_repairs', label: 'Bathroom Repairs' },
      { key: 'sink_repair', label: 'Sink Repair' },
      { key: 'toilet_repair', label: 'Toilet Repair' },
      { key: 'water_heater', label: 'Water Heater' },
      { key: 'drain_cleaning', label: 'Drain Cleaning' },
    ],
  },
  {
    key: 'electrical',
    label: 'Electrical',
    subcategories: [
      { key: 'wiring', label: 'Wiring' },
      { key: 'lighting', label: 'Lighting' },
      { key: 'socket_switches', label: 'Sockets & Switches' },
      { key: 'fuse_box', label: 'Fuse Box' },
      { key: 'appliance_connection', label: 'Appliance Connection' },
      { key: 'fault_finding', label: 'Fault Finding' },
    ],
  },
  {
    key: 'painting',
    label: 'Painting',
    subcategories: [
      { key: 'interior_painting', label: 'Interior Painting' },
      { key: 'exterior_painting', label: 'Exterior Painting' },
      { key: 'wall_repair', label: 'Wall Repair' },
      { key: 'doors_windows', label: 'Doors & Windows' },
      { key: 'decorative_painting', label: 'Decorative Painting' },
    ],
  },
  {
    key: 'construction',
    label: 'Construction & Renovation',
    subcategories: [
      { key: 'home_renovation', label: 'Home Renovation' },
      { key: 'bathroom_renovation', label: 'Bathroom Renovation' },
      { key: 'kitchen_renovation', label: 'Kitchen Renovation' },
      { key: 'small_building_repairs', label: 'Small Building Repairs' },
      { key: 'plastering', label: 'Plastering' },
      { key: 'tiling', label: 'Tiling' },
      { key: 'flooring', label: 'Flooring' },
    ],
  },
  {
    key: 'cleaning',
    label: 'Cleaning',
    subcategories: [
      { key: 'home_cleaning', label: 'Home Cleaning' },
      { key: 'deep_cleaning', label: 'Deep Cleaning' },
      { key: 'office_cleaning', label: 'Office Cleaning' },
      { key: 'post_construction_cleaning', label: 'Post-Construction Cleaning' },
      { key: 'window_cleaning', label: 'Window Cleaning' },
      { key: 'short_let_cleaning', label: 'Short-Let Cleaning' },
    ],
  },
  {
    key: 'handyman',
    label: 'Handyman',
    subcategories: [
      { key: 'general_repairs', label: 'General Repairs' },
      { key: 'furniture_assembly', label: 'Furniture Assembly' },
      { key: 'mounting', label: 'Mounting' },
      { key: 'maintenance', label: 'Maintenance' },
      { key: 'small_installations', label: 'Small Installations' },
    ],
  },
  {
    key: 'ac_heating',
    label: 'AC & Heating',
    subcategories: [
      { key: 'ac_installation', label: 'AC Installation' },
      { key: 'ac_service', label: 'AC Service' },
      { key: 'ac_repair', label: 'AC Repair' },
      { key: 'heating_repair', label: 'Heating Repair' },
    ],
  },
  {
    key: 'carpentry',
    label: 'Carpentry',
    subcategories: [
      { key: 'custom_furniture', label: 'Custom Furniture' },
      { key: 'door_repair', label: 'Door Repair' },
      { key: 'wardrobes', label: 'Wardrobes' },
      { key: 'kitchen_cabinets', label: 'Kitchen Cabinets' },
      { key: 'wood_repairs', label: 'Wood Repairs' },
    ],
  },
  {
    key: 'gardening',
    label: 'Gardening & Outdoor',
    subcategories: [
      { key: 'garden_maintenance', label: 'Garden Maintenance' },
      { key: 'tree_trimming', label: 'Tree Trimming' },
      { key: 'landscaping', label: 'Landscaping' },
      { key: 'irrigation', label: 'Irrigation' },
      { key: 'outdoor_cleaning', label: 'Outdoor Cleaning' },
    ],
  },
  {
    key: 'appliance_repair',
    label: 'Appliance Repair',
    subcategories: [
      { key: 'washing_machine', label: 'Washing Machine' },
      { key: 'dishwasher', label: 'Dishwasher' },
      { key: 'oven_stove', label: 'Oven & Stove' },
      { key: 'fridge_freezer', label: 'Fridge & Freezer' },
      { key: 'dryer', label: 'Dryer' },
    ],
  },
  {
    key: 'locksmith',
    label: 'Locksmith',
    subcategories: [
      { key: 'lock_repair', label: 'Lock Repair' },
      { key: 'lock_replacement', label: 'Lock Replacement' },
      { key: 'emergency_lockout', label: 'Emergency Lockout' },
      { key: 'key_copy', label: 'Key Copy' },
    ],
  },
  {
    key: 'moving_delivery',
    label: 'Moving & Delivery',
    subcategories: [
      { key: 'small_moves', label: 'Small Moves' },
      { key: 'furniture_delivery', label: 'Furniture Delivery' },
      { key: 'appliance_delivery', label: 'Appliance Delivery' },
      { key: 'packing_help', label: 'Packing Help' },
    ],
  },
  {
    key: 'pest_control',
    label: 'Pest Control',
    subcategories: [
      { key: 'insects', label: 'Insects' },
      { key: 'rodents', label: 'Rodents' },
      { key: 'general_pest_control', label: 'General Pest Control' },
    ],
  },
  {
    key: 'solar_energy',
    label: 'Solar & Energy',
    subcategories: [
      { key: 'solar_panel_cleaning', label: 'Solar Panel Cleaning' },
      { key: 'solar_maintenance', label: 'Solar Maintenance' },
      { key: 'energy_consultation', label: 'Energy Consultation' },
    ],
  },
] as const;

export function assertValidServiceCategory(category: string, subcategory?: string) {
  const serviceCategory = SERVICE_CATEGORIES.find((item) => item.key === category);

  if (!serviceCategory) {
    throw new BadRequestException('Invalid service category.');
  }

  if (subcategory && !serviceCategory.subcategories.some((item) => item.key === subcategory)) {
    throw new BadRequestException('Invalid service subcategory for selected category.');
  }
}

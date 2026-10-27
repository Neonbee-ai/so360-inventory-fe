import React from 'react';
import {
  Package, Tag, Layers, Grid3X3,
  Coffee, Apple, Utensils, Wine,
  Laptop, Smartphone, Monitor, Headphones,
  Shirt, ShoppingBag, Gem, Watch,
  Home, Sofa, Leaf, Lamp,
  Dumbbell, Bike, Heart, Sparkles,
} from 'lucide-react';

export const PRESET_ICON_PREFIX = 'preset:';

export interface PresetIconDef {
  id: string;
  label: string;
  group: string;
  icon: React.FC<{ size?: number; className?: string }>;
  defaultColor: string;
}

export const PRESET_ICONS: PresetIconDef[] = [
  // General
  { id: 'package',    label: 'Package',    group: 'General',  icon: Package,     defaultColor: '#3B82F6' },
  { id: 'tag',        label: 'Tag',        group: 'General',  icon: Tag,         defaultColor: '#8B5CF6' },
  { id: 'layers',     label: 'Layers',     group: 'General',  icon: Layers,      defaultColor: '#0EA5E9' },
  { id: 'grid',       label: 'Grid',       group: 'General',  icon: Grid3X3,     defaultColor: '#64748B' },
  // Food & Beverage
  { id: 'coffee',     label: 'Coffee',     group: 'Food',     icon: Coffee,      defaultColor: '#F59E0B' },
  { id: 'apple',      label: 'Produce',    group: 'Food',     icon: Apple,       defaultColor: '#10B981' },
  { id: 'utensils',   label: 'Food',       group: 'Food',     icon: Utensils,    defaultColor: '#EF4444' },
  { id: 'wine',       label: 'Beverages',  group: 'Food',     icon: Wine,        defaultColor: '#7C3AED' },
  // Technology
  { id: 'laptop',     label: 'Laptops',    group: 'Tech',     icon: Laptop,      defaultColor: '#1D4ED8' },
  { id: 'smartphone', label: 'Phones',     group: 'Tech',     icon: Smartphone,  defaultColor: '#0F172A' },
  { id: 'monitor',    label: 'Desktops',   group: 'Tech',     icon: Monitor,     defaultColor: '#1E293B' },
  { id: 'headphones', label: 'Audio',      group: 'Tech',     icon: Headphones,  defaultColor: '#6366F1' },
  // Fashion
  { id: 'shirt',      label: 'Clothing',   group: 'Fashion',  icon: Shirt,       defaultColor: '#EC4899' },
  { id: 'bag',        label: 'Bags',       group: 'Fashion',  icon: ShoppingBag, defaultColor: '#DB2777' },
  { id: 'gem',        label: 'Jewelry',    group: 'Fashion',  icon: Gem,         defaultColor: '#9333EA' },
  { id: 'watch',      label: 'Watches',    group: 'Fashion',  icon: Watch,       defaultColor: '#374151' },
  // Home & Garden
  { id: 'home',       label: 'Home',       group: 'Home',     icon: Home,        defaultColor: '#0369A1' },
  { id: 'sofa',       label: 'Furniture',  group: 'Home',     icon: Sofa,        defaultColor: '#78350F' },
  { id: 'leaf',       label: 'Garden',     group: 'Home',     icon: Leaf,        defaultColor: '#15803D' },
  { id: 'lamp',       label: 'Lighting',   group: 'Home',     icon: Lamp,        defaultColor: '#A16207' },
  // Sports & Wellness
  { id: 'dumbbell',   label: 'Fitness',    group: 'Sports',   icon: Dumbbell,    defaultColor: '#DC2626' },
  { id: 'bike',       label: 'Cycling',    group: 'Sports',   icon: Bike,        defaultColor: '#2563EB' },
  { id: 'heart',      label: 'Health',     group: 'Sports',   icon: Heart,       defaultColor: '#E11D48' },
  { id: 'sparkles',   label: 'Beauty',     group: 'Sports',   icon: Sparkles,    defaultColor: '#C026D3' },
];

export const PRESET_ICON_MAP = Object.fromEntries(
  PRESET_ICONS.map(p => [p.id, p])
) as Record<string, PresetIconDef>;

export const isPresetUrl = (url?: string | null): boolean =>
  !!url && url.startsWith(PRESET_ICON_PREFIX);

export const getPresetId = (url: string): string =>
  url.slice(PRESET_ICON_PREFIX.length);

export const buildPresetUrl = (id: string): string =>
  `${PRESET_ICON_PREFIX}${id}`;

/**
 * Returns JSX for a category icon.
 * Handles preset:*, real image URLs, image_url fallback, and colored letter.
 */
export function renderCategoryIcon({
  iconUrl,
  imageUrl,
  name,
  color,
  size = 28,
  className = '',
}: {
  iconUrl?: string | null;
  imageUrl?: string | null;
  name: string;
  color?: string | null;
  size?: number;
  className?: string;
}): React.ReactNode {
  const bg = color || '#334155';

  if (iconUrl && isPresetUrl(iconUrl)) {
    const def = PRESET_ICON_MAP[getPresetId(iconUrl)];
    if (def) {
      const IconComp = def.icon;
      return React.createElement(
        'div',
        {
          className: `flex items-center justify-center rounded-lg overflow-hidden ${className}`,
          style: { background: bg, width: size, height: size, flexShrink: 0 },
        },
        React.createElement(IconComp, { size: Math.round(size * 0.6), className: 'text-primary-fg' })
      );
    }
  }

  if (iconUrl) {
    return React.createElement(
      'div',
      {
        className: `rounded-lg overflow-hidden ${className}`,
        style: { width: size, height: size, flexShrink: 0 },
      },
      React.createElement('img', { src: iconUrl, alt: name, className: 'w-full h-full object-cover' })
    );
  }

  if (imageUrl) {
    return React.createElement(
      'div',
      {
        className: `rounded-lg overflow-hidden ${className}`,
        style: { width: size, height: size, flexShrink: 0 },
      },
      React.createElement('img', { src: imageUrl, alt: name, className: 'w-full h-full object-cover' })
    );
  }

  return React.createElement(
    'div',
    {
      className: `flex items-center justify-center rounded-lg text-primary-fg font-bold ${className}`,
      style: { background: bg, width: size, height: size, flexShrink: 0, fontSize: Math.round(size * 0.4) },
    },
    name.charAt(0).toUpperCase()
  );
}

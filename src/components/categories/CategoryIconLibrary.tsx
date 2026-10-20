import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button, Grid } from '@so360/design-system';
import { PRESET_ICONS, buildPresetUrl, isPresetUrl, getPresetId } from '../../constants/categoryIcons';

interface CategoryIconLibraryProps {
  currentUrl?: string | null;
  categoryColor?: string;
  onSelect: (url: string) => void;
}

// Group icons by their group label
const GROUPS = Array.from(new Set(PRESET_ICONS.map(i => i.group)));

const CategoryIconLibrary: React.FC<CategoryIconLibraryProps> = ({ currentUrl, categoryColor, onSelect }) => {
  const [open, setOpen] = useState(false);

  const currentPresetId = currentUrl && isPresetUrl(currentUrl) ? getPresetId(currentUrl) : null;

  return (
    <div className="border border-line rounded-xl overflow-hidden">
      <Button
        type="button"
        variant="ghost"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="w-full justify-between"
      >
        <span className="text-xs font-medium text-fg-muted">Preset Icons</span>
        {open ? (
          <ChevronUp size={14} className="text-fg-subtle" />
        ) : (
          <ChevronDown size={14} className="text-fg-subtle" />
        )}
      </Button>

      {open && (
        <div className="px-4 pb-4 pt-1 bg-surface/30">
          {GROUPS.map(group => (
            <div key={group} className="mb-3">
              <p className="text-[10px] font-semibold text-fg-subtle mb-2">{group}</p>
              <Grid columns={4} gap="sm">
                {PRESET_ICONS.filter(icon => icon.group === group).map(icon => {
                  const IconComp = icon.icon;
                  const isActive = currentPresetId === icon.id;
                  const bg = categoryColor || icon.defaultColor;
                  return (
                    <Button
                      key={icon.id}
                      type="button"
                      variant="ghost"
                      onClick={() => onSelect(buildPresetUrl(icon.id))}
                      className={`!h-auto flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                        isActive
                          ? 'border-primary bg-primary/10 ring-1 ring-focus'
                          : 'border-line bg-surface-raised/30'
                      }`}
                      title={icon.label}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: bg }}
                      >
                        <IconComp size={16} className="text-fg" />
                      </Grid>
                      <span className="text-[10px] text-fg-subtle leading-tight text-center truncate w-full">{icon.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}

          <p className="text-[10px] text-fg-subtle mt-2 text-center">
            Or upload a custom image ↑
          </p>
        </div>
      )}
    </div>
  );
};

export default CategoryIconLibrary;

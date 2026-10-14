import React, { useEffect, useRef, useState } from 'react';
import { inventoryService } from '../services/inventoryService';

interface SelectedItem {
    id: string;
    name: string;
    sku: string;
    price?: number;
    tax_code_id?: string;
}

interface ItemSearchSelectorProps {
    value: string;
    selectedName?: string;
    onSelect: (item: SelectedItem) => void;
    className?: string;
}

const ItemSearchSelector: React.FC<ItemSearchSelectorProps> = ({
    value,
    selectedName,
    onSelect,
    className = '',
}) => {
    const [query, setQuery] = useState(selectedName || '');
    const [results, setResults] = useState<any[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Sync display text when selectedName changes externally
    useEffect(() => {
        setQuery(selectedName || '');
    }, [selectedName]);

    // Click-outside closes dropdown
    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, []);

    const search = (term: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            if (!term.trim()) {
                setResults([]);
                return;
            }
            setLoading(true);
            try {
                const data = await inventoryService.getItems({ search: term, limit: 20 });
                setResults(data.data || []);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        setOpen(true);
        search(val);
    };

    const handleFocus = () => {
        setOpen(true);
        if (!query && !value) {
            search('');
        }
    };

    const handleSelect = (item: any) => {
        const displayName = `${item.name} (${item.sku})`;
        setQuery(displayName);
        setOpen(false);
        setResults([]);
        onSelect({
            id: item.id,
            name: item.name,
            sku: item.sku,
            price: item.unit_price ?? item.cost_price ?? item.price ?? 0,
            tax_code_id: item.tax_code_id,
        });
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <input
                type="text"
                value={query}
                placeholder="Search item by name or SKU..."
                className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-focus/30 placeholder-fg-subtle"
                onChange={handleInputChange}
                onFocus={handleFocus}
            />
            {open && (query.length > 0 || results.length > 0) && (
                <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-surface border border-line-strong rounded-lg shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                    {loading ? (
                        <div className="px-3 py-3 text-xs text-fg-subtle animate-pulse">Searching...</div>
                    ) : results.length === 0 ? (
                        <div className="px-3 py-3 text-xs text-fg-subtle italic">No items found.</div>
                    ) : results.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className="w-full text-left px-3 py-2.5 hover:bg-surface-raised transition-colors border-b border-line/60 last:border-0 flex items-center justify-between gap-4"
                            onMouseDown={() => handleSelect(item)}
                        >
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-fg truncate">{item.name}</div>
                                <div className="text-[10px] text-fg-subtle font-mono">{item.sku}</div>
                            </div>
                            {(item.unit_price ?? item.cost_price ?? item.price) != null && (
                                <div className="text-xs text-fg-muted font-mono whitespace-nowrap">
                                    {(item.unit_price ?? item.cost_price ?? item.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ItemSearchSelector;

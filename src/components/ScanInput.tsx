import React, { useRef, useState } from 'react';
import { ScanLine } from 'lucide-react';
import { inventoryService, type ScannedItem } from '../services/inventoryService';

export interface ScanInputProps {
    /** Called with the item matched by barcode or SKU. */
    onScan: (item: ScannedItem) => void;
    /** Called when no item matches the code. */
    onNotFound?: (code: string) => void;
    placeholder?: string;
    autoFocus?: boolean;
    className?: string;
    label?: string;
    /** Large-button layout for handheld scanners (Scan mode). */
    large?: boolean;
}

/**
 * Barcode / SKU entry that works with keyboard-wedge scanners: the scanner
 * types the code quickly and ends with Enter. Manual typing + Enter works the
 * same way. The field clears and keeps focus so the next scan can follow.
 */
const ScanInput: React.FC<ScanInputProps> = ({
    onScan,
    onNotFound,
    placeholder = 'Scan or type barcode / SKU',
    autoFocus = false,
    className = '',
    label = 'Scan barcode',
    large = false,
}) => {
    const [value, setValue] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const submit = async () => {
        const code = value.trim();
        if (!code || busy) return;
        setBusy(true);
        setMessage(null);
        try {
            const item = await inventoryService.getItemByCode(code);
            if (item) {
                setMessage({ tone: 'ok', text: item.name });
                onScan(item);
            } else {
                setMessage({ tone: 'warn', text: `No item for ${code}` });
                onNotFound?.(code);
            }
        } catch (e: any) {
            setMessage({ tone: 'warn', text: e?.message || 'Lookup failed' });
        } finally {
            setValue('');
            setBusy(false);
            inputRef.current?.focus();
        }
    };

    return (
        <div className={className}>
            <div className="relative">
                <ScanLine size={large ? 22 : 16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                    ref={inputRef}
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    autoFocus={autoFocus}
                    aria-label={label}
                    placeholder={placeholder}
                    value={value}
                    disabled={busy}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            void submit();
                        }
                    }}
                    className={`w-full bg-slate-950 border border-slate-700 rounded-lg pr-3 text-slate-100 ${large ? 'pl-11 py-4 text-lg' : 'pl-9 py-2.5 text-sm'} placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    data-size={large ? 'large' : 'normal'}
                />
            </div>
            {message && (
                <p
                    role="status"
                    className={`mt-1 ${large ? 'text-base' : 'text-xs'} ${message.tone === 'ok' ? 'text-emerald-400' : 'text-amber-400'}`}
                >
                    {message.text}
                </p>
            )}
        </div>
    );
};

export default ScanInput;

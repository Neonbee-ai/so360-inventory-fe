import React, { useEffect, useState } from 'react';
import { vendorService } from '../../services/vendorService';
import { useInventoryFormatters } from '../../utils/formatters';

const ContractsPage = () => {
    const formatters = useInventoryFormatters();
    const [contracts, setContracts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetch = async () => {
            try {
                const data = await vendorService.getContracts();
                setContracts(data);
            } catch (e) {
                console.error(e);
                setError('Failed to load contracts. Please refresh the page.');
            } finally { setLoading(false); }
        };
        fetch();
    }, []);

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700">
            <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-rose-400 bg-clip-text text-transparent">
                    Subcontractor Contracts
                </h1>
                <p className="text-fg-muted mt-2 font-medium">Lump-sum and value-based service agreements.</p>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-sm">
                    <span>⚠</span> {error}
                </div>
            )}
            <div className="bg-surface/50 border border-line rounded-3xl overflow-hidden backdrop-blur-sm">
                <table className="w-full text-left">
                    <thead className="bg-surface-raised/30 border-b border-line">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-fg-subtle tracking-widest">Contract #</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-fg-subtle tracking-widest">Subcontractor</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-fg-subtle tracking-widest">Status</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-fg-subtle tracking-widest">Value</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-fg-subtle tracking-widest">Duration</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line/50">
                        {loading ? (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-fg-subtle animate-pulse">Loading contracts...</td></tr>
                        ) : contracts.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-fg-subtle italic">No active contracts found.</td></tr>
                        ) : contracts.map(c => (
                            <tr key={c.id} className="hover:bg-surface-raised/20 transition-colors">
                                <td className="px-6 py-4 font-bold text-fg">#{c.id.slice(0, 8).toUpperCase()}</td>
                                <td className="px-6 py-4 text-sm text-fg-muted">{c.vendor?.name}</td>
                                <td className="px-6 py-4">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-success/10 text-success border border-success/20 font-bold uppercase">{c.status}</span>
                                </td>
                                <td className="px-6 py-4 font-mono font-bold text-fg">{formatters.formatCurrency(parseFloat(c.contract_value))}</td>
                                <td className="px-6 py-4 text-[10px] font-bold text-fg-subtle uppercase">
                                    {formatters.formatDate(c.start_date)} - {formatters.formatDate(c.end_date)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ContractsPage;

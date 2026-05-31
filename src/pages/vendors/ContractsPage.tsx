import React, { useEffect, useState } from 'react';
import { vendorService } from '../../services/vendorService';
import { useInventoryFormatters } from '../../utils/formatters';

const ContractsPage = () => {
    const formatters = useInventoryFormatters();
    const [contracts, setContracts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const data = await vendorService.getContracts();
                setContracts(data);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetch();
    }, []);

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700">
            <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-rose-400 bg-clip-text text-transparent">
                    Subcontractor Contracts
                </h1>
                <p className="text-slate-400 mt-2 font-medium">Lump-sum and value-based service agreements.</p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-sm">
                <table className="w-full text-left">
                    <thead className="bg-slate-800/30 border-b border-slate-800">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest">Contract #</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest">Subcontractor</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest">Status</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest">Value</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest">Duration</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {loading ? (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 animate-pulse">Loading contracts...</td></tr>
                        ) : contracts.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">No active contracts found.</td></tr>
                        ) : contracts.map(c => (
                            <tr key={c.id} className="hover:bg-slate-800/20 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-200">#{c.id.slice(0, 8).toUpperCase()}</td>
                                <td className="px-6 py-4 text-sm text-slate-300">{c.vendor?.name}</td>
                                <td className="px-6 py-4">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">{c.status}</span>
                                </td>
                                <td className="px-6 py-4 font-mono font-bold text-slate-100">{formatters.formatCurrency(parseFloat(c.contract_value))}</td>
                                <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">
                                    {new Date(c.start_date).toLocaleDateString()} - {new Date(c.end_date).toLocaleDateString()}
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

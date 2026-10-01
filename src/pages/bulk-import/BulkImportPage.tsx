import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { useShellBridge } from '@so360/shell-context';
import StepIndicator from './components/StepIndicator';
import CsvUploadStep from './components/CsvUploadStep';
import ImageUploadStep from './components/ImageUploadStep';
import PreviewTableStep from './components/PreviewTableStep';
import ImportResultStep from './components/ImportResultStep';
import { importableRowKeyCounts, planImages, rowNameKey } from './nameKey';

const STEPS = [
    { label: 'Upload CSV' },
    { label: 'Upload Images' },
    { label: 'Preview' },
    { label: 'Result' },
];


const BulkImportPage: React.FC = () => {
    const navigate = useNavigate();
    const shell = useShellBridge();
    const orgId = shell?.currentOrg?.id || '';

    const [step, setStep] = useState(0);
    const [parsedResult, setParsedResult] = useState<any>(null);
    const [rows, setRows] = useState<any[]>([]);
    const [commitResult, setCommitResult] = useState<any>(null);
    const [committing, setCommitting] = useState(false);
    const [submittedRows, setSubmittedRows] = useState<any[]>([]);

    const handleParsed = (result: any) => {
        setParsedResult(result);
        setRows(result.rows);
        setStep(1);
    };

    // Images map to products by product name; `Name.jpg` is the primary image and
    // `Name_2.jpg`, `Name_3.jpg`… follow in order. A name that is ambiguous (several
    // products), a position claimed twice, or numbered images with no primary are
    // never guessed — the row keeps no image and says why.
    const handleImagesUploaded = (uploaded: { filename: string; name_key?: string; cdn_url: string }[]) => {
        const cdnByFile = new Map(uploaded.map(u => [u.filename, u.cdn_url]));
        setRows(prev => {
            const { groups } = planImages(uploaded.map(u => u.filename), importableRowKeyCounts(prev));
            return prev.map(row => {
                if (row.status === 'error') return row;
                const group = groups.get(rowNameKey(row));
                // Nothing was uploaded under this product's name.
                if (!group) return { ...row, image_status: 'not_found' };
                if (group.status === 'ambiguous') return { ...row, image_status: 'ambiguous' };
                if (group.status === 'duplicate_image') {
                    return {
                        ...row,
                        status: 'warning',
                        image_status: 'duplicate_image',
                        warnings: [...row.warnings, `more than one image is named for the same position of "${row.data.name}" — none mapped`],
                    };
                }
                if (group.status === 'missing_primary') {
                    return {
                        ...row,
                        status: 'warning',
                        image_status: 'missing_primary',
                        warnings: [...row.warnings, `numbered images found for "${row.data.name}" but no primary image — upload "${row.data.name}.jpg" first; none mapped`],
                    };
                }
                if (group.status !== 'matched') return { ...row, image_status: 'not_found' };
                const gapWarning = group.gaps.length > 0
                    ? [`image number${group.gaps.length > 1 ? 's' : ''} ${group.gaps.join(', ')} missing for "${row.data.name}" — images mapped in order`]
                    : [];
                return {
                    ...row,
                    status: group.gaps.length > 0 ? 'warning' : row.status === 'warning' ? 'valid' : row.status,
                    image_status: 'mapped',
                    warnings: [...row.warnings, ...gapWarning],
                    data: { ...row.data, image_urls: group.ordered.map(f => cdnByFile.get(f)).filter(Boolean) },
                };
            });
        });
    };

    const handleCommit = async (validRows: any[]) => {
        setSubmittedRows(validRows);
        setStep(3);
        setCommitting(true);
        try {
            const result = await inventoryService.bulkImportCommit(orgId, validRows);
            setCommitResult(result);
            inventoryService.clearOrgStaticCache();
        } catch (e: any) {
            setCommitResult({ total: 0, succeeded: 0, failed: validRows.length, results: validRows.map((_, i) => ({ row_index: i + 1, status: 'error', reason: e.message })) });
        } finally {
            setCommitting(false);
        }
    };

    return (
        <div className="p-8">
            <header className="mb-8">
                <button
                    onClick={() => navigate('/inventory/items')}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm mb-4 transition-colors"
                >
                    <ArrowLeft size={15} />
                    Back to Items
                </button>
                <h1 className="text-3xl font-bold text-slate-50 tracking-tight">Bulk Import</h1>
                <p className="text-slate-400 mt-1">Import multiple inventory items from a CSV file with optional images</p>
            </header>

            <StepIndicator steps={STEPS} current={step} />

            {step === 0 && (
                <CsvUploadStep
                    onParsed={handleParsed}
                    onParse={(file) => inventoryService.bulkImportParseCsv(orgId, file)}
                />
            )}

            {step === 1 && (
                <ImageUploadStep
                    parsedRows={rows}
                    onImagesUploaded={handleImagesUploaded}
                    onUpload={(files) => inventoryService.bulkImportUploadImages(orgId, files)}
                    onSkip={() => setStep(2)}
                />
            )}

            {step === 2 && (
                <PreviewTableStep
                    rows={rows}
                    onConfirm={handleCommit}
                    onBack={() => setStep(1)}
                />
            )}

            {step === 3 && (
                <ImportResultStep
                    result={commitResult}
                    loading={committing}
                    submittedRows={submittedRows}
                    onGoToItems={() => navigate('/inventory/items')}
                    onReset={() => { setStep(0); setParsedResult(null); setRows([]); setCommitResult(null); }}
                    onNavigateToItem={(id) => navigate(`/inventory/items/${id}`)}
                />
            )}
        </div>
    );
};

export default BulkImportPage;

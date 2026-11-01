import React from 'react';
/**
 * Side-drawer file preview, shared by every module that shows a stored file.
 *
 * It began inside the Documents module (FolderView.tsx), where it fetched its
 * own URL from documentsService. That made it unreachable to anyone else — an
 * MFE cannot import a sibling's internals — so Support had no way to preview a
 * ticket attachment without a second, divergent implementation of the same
 * thing.
 *
 * The one change that makes it shareable: the URL is INJECTED. The caller
 * knows how its own files are authorised — Documents resolves through the
 * user's DMS permissions, Support through a message-scoped check that the file
 * is actually attached to the message being read — and neither belongs in here.
 */
export interface PreviewDoc {
    id: string;
    name?: string;
    mime_type?: string;
    file_size?: number;
    updated_at?: string;
    created_at?: string;
    uploaded_by?: string;
}
/** What a resolver may hand back: a bare URL, or the URL plus what it learned. */
export type ResolvedPreview = string | ({
    url: string;
} & Omit<PreviewDoc, 'id'>);
export interface DocumentPreviewDrawerProps {
    doc: PreviewDoc;
    /**
     * Resolves a URL for the file. Called once per document, on open.
     *
     * May also return `{ url, name, mime_type, file_size }`, and a caller that
     * can should: without a mime type there is no way to choose a strategy and
     * EVERY file falls through to the download panel. Support hit exactly that
     * — its older messages stored a bare document id, so real PDFs reported
     * "inline preview isn't available". Whatever the resolver learns wins over
     * what the caller guessed.
     */
    onResolveUrl: (documentId: string) => Promise<ResolvedPreview>;
    onClose: () => void;
    canDownload?: boolean;
    /**
     * Whether Word/Excel/PowerPoint may be previewed via the Google Docs
     * Viewer. OFF by default, and that default is deliberate: the viewer works
     * by handing Google a URL to the file, so it sends the document off-platform
     * to a third party.
     *
     * Inside Documents that is a reasonable trade for a document someone chose
     * to upload there. It is NOT a safe default for a file a customer attached
     * to a support ticket, so each caller opts in for itself rather than
     * inheriting a decision made somewhere else.
     */
    allowOfficeViewer?: boolean;
    /** Rendered beside Download — e.g. Support's "Open in Documents". */
    headerActions?: React.ReactNode;
}
export declare const DocumentPreviewDrawer: React.FC<DocumentPreviewDrawerProps>;

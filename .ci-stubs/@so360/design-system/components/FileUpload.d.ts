import React from 'react';
export type FileRejectReason = 'type' | 'size' | 'count';
export interface FileRejection {
    file: File;
    reason: FileRejectReason;
    message: string;
}
export interface FileUploadProps {
    value?: File[];
    defaultValue?: File[];
    onChange?: (files: File[]) => void;
    onReject?: (rejections: FileRejection[]) => void;
    /** Same syntax as <input accept>: ".pdf", "image/*", "application/pdf". */
    accept?: string;
    multiple?: boolean;
    /** Max size per file in bytes. */
    maxSize?: number;
    /** Max total files (only meaningful with `multiple`). */
    maxFiles?: number;
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    /** Primary call to action text. */
    prompt?: string;
    'aria-label'?: string;
    'data-testid'?: string;
}
export declare function formatBytes(bytes: number): string;
/** Drag-and-drop or click-to-browse file picker with type, size and count validation. */
export declare const FileUpload: React.FC<FileUploadProps>;

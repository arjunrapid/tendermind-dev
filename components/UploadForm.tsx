'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/lib/auth';

interface UploadFormProps {
  onUploadSuccess: (data: {
    fileName: string;
    extractedText: string;
    documentId?: string;
    file: File;
  }) => void;
  onUploadStart?: (file: File) => void;
  onUploadProgress?: (percent: number) => void;
  disabled?: boolean;
}

/** Uploads via XHR (not fetch) so real upload-progress events are available
 * to drive the progress bar - fetch has no upload progress API. */
function uploadWithProgress(
  file: File,
  token: string | null,
  onProgress: (percent: number) => void,
): Promise<{ fileName: string; extractedText: string; documentId?: string }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Failed to parse upload response'));
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText) as { error?: string; detail?: string };
          reject(new Error(data.error || data.detail || 'Failed to upload file'));
        } catch {
          reject(new Error('Failed to upload file'));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Failed to upload file'));

    xhr.send(formData);
  });
}

export default function UploadForm({
  onUploadSuccess,
  onUploadStart,
  onUploadProgress,
  disabled = false,
}: UploadFormProps) {
  const { token } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = isUploading || disabled;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isBusy) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    setError(null);
    setIsUploading(true);
    onUploadStart?.(file);
    onUploadProgress?.(0);

    try {
      const data = await uploadWithProgress(file, token, (percent) => onUploadProgress?.(percent));
      onUploadSuccess({ ...data, file });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An error occurred during upload',
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isBusy) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
    // Reset so selecting the same file again still fires onChange.
    e.currentTarget.value = '';
  };

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isBusy
            ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 cursor-not-allowed opacity-70'
            : isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 cursor-pointer'
              : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 hover:border-gray-400 cursor-pointer'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isBusy}
        />

        <div
          onClick={() => !isBusy && fileInputRef.current?.click()}
          className={isBusy ? '' : 'cursor-pointer'}
        >
          <svg
            className={`mx-auto h-12 w-12 ${isBusy ? 'text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20a4 4 0 004 4h24a4 4 0 004-4V20m-14-8v12m0 0l-4-4m4 4l4-4"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <p className="mt-4 text-sm font-medium text-gray-900 dark:text-gray-100">
            {isUploading
              ? 'Uploading...'
              : disabled
                ? 'Processing in progress...'
                : 'Drag and drop your PDF or text file here'}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isBusy ? 'Please wait' : 'or click to browse'}
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

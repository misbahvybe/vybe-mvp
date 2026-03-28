'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { uploadMenuImageFile, type ImageUploadRole } from '@/services/uploadImage';

export function GalleryImageInput({
  value,
  onChange,
  uploadRole,
  idPrefix = 'gallery',
}: {
  value: string;
  onChange: (url: string) => void;
  uploadRole: ImageUploadRole;
  /** Unique prefix for input id when multiple fields on one page */
  idPrefix?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.type)) {
      alert('Please choose a JPEG, PNG, GIF, or WebP image.');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadMenuImageFile(file, uploadRole);
      onChange(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex flex-wrap items-start gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="h-20 max-w-[200px] rounded-lg object-cover border border-slate-200 bg-slate-50"
          />
          <button
            type="button"
            className="text-xs text-slate-600 underline"
            onClick={() => onChange('')}
          >
            Remove photo
          </button>
        </div>
      ) : null}
      <input
        id={`${idPrefix}-file`}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        className="sr-only"
        onChange={onFile}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        loading={uploading}
        onClick={() => inputRef.current?.click()}
      >
        Choose from gallery
      </Button>
      <p className="text-xs text-slate-500">Or paste an image URL</p>
      <input
        type="text"
        inputMode="url"
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
        placeholder="https://…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

"use client";

// Unggah gambar admin (plan Task 8): pratinjau gambar saat ini, tombol
// unggah/ganti lewat server action (validateImageInput → processPoster →
// putImage di sisi server), dan hapus yang memanggil deleteImage lewat
// server action. Pesan error validasi tampil inline Bahasa Indonesia.

import { useRef, useState } from "react";
import {
  deleteImageAction,
  uploadImageAction,
} from "../../app/admin/(protected)/upload-action.ts";
import { useToast } from "./Toast.tsx";

export interface ImageUploadProps {
  label: string;
  value: string | null;
  kind: "poster" | "logo" | "photo";
  ownerId: string;
  onChange(url: string | null): void;
}

export function ImageUpload({
  label,
  value,
  kind,
  ownerId,
  onChange,
}: ImageUploadProps) {
  const { show } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | null) => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("kind", kind);
      formData.set("ownerId", ownerId);
      const result = await uploadImageAction(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const previous = value;
      onChange(result.url);
      show(`${label} berhasil diunggah.`);
      // Berkas lama diganti: hapus dari storage agar tidak yatim.
      if (previous && previous !== result.url) {
        await deleteImageAction(previous);
      }
    } catch {
      setError("Gagal mengunggah gambar. Silakan coba lagi.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await deleteImageAction(value);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onChange(null);
      show(`${label} dihapus. Jangan lupa menyimpan perubahan.`);
    } catch {
      setError("Gagal menghapus gambar. Silakan coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt={`Pratinjau ${label.toLowerCase()}`}
          className="max-h-48 w-auto max-w-full rounded-lg border border-neutral-200 object-contain"
        />
      ) : (
        <p className="rounded-lg border border-dashed border-neutral-300 px-3 py-4 text-sm text-neutral-500">
          Belum ada gambar.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-semibold hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Memproses…" : value ? "Ganti gambar" : "Unggah gambar"}
        </button>
        {value && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleDelete()}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Hapus gambar
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label={`Pilih berkas ${label.toLowerCase()}`}
        onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
      />
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <p className="text-xs text-neutral-500">
        JPG, PNG, atau WebP, maksimal 5 MB. Gambar otomatis dikonversi ke
        WebP.
      </p>
    </div>
  );
}

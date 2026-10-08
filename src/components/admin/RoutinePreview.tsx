// Pratinjau tampilan jamaah untuk Jadwal Rutin (plan Task 10):
// ringkasan pola + detail versi publik + daftar kemunculan berikutnya,
// dirender dari data yang diberikan pemanggil (nilai form saat ini di
// RoutineForm, atau record tersimpan di halaman pratinjau admin).
// Kemunculan dihitung pemanggil dengan computeOccurrences yang sama
// (klien di form, server di halaman pratinjau) agar keduanya konsisten.
// Field sourceInfo TIDAK PERNAH diterima komponen ini, jadi tidak
// mungkin bocor ke pratinjau (spec §6.2/§13.5).

import type { Audience, Category, Occurrence } from "../../lib/domain.ts";
import {
  categoryColor,
  categoryLabel,
  formatEventDateLabel,
  formatEventTimeLabel,
} from "./EventPreview.tsx";

export interface RoutinePreviewData {
  title: string;
  category: Category | "";
  /** Keterangan pola bahasa manusia dari describePattern. */
  patternDescription: string;
  startTime: string;
  endTime: string | null;
  venueName: string;
  address: string;
  city: string;
  district: string;
  mapsUrl: string | null;
  posterUrl: string | null;
  organizerName: string | null;
  speakers: string[];
  audience: Audience;
  liveStreamUrl: string | null;
  contact: string | null;
  extraInfo: string | null;
  libraryUrl: string | null;
  description: string | null;
  specialNote: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isActive: boolean;
  /** Kemunculan berikutnya (libur sudah dilewati oleh pemanggil). */
  occurrences: Occurrence[];
}

const AUDIENCE_LABEL: Record<Audience, string> = {
  umum: "Umum",
  ikhwan: "Ikhwan",
  akhwat: "Akhwat",
};

/** Angka hari besar untuk fallback dari kemunculan pertama. */
function bigDayNumber(occurrences: Occurrence[]): string {
  const date = occurrences[0]?.date;
  if (!date) return "–";
  const day = Number(date.split("-")[2]);
  return Number.isFinite(day) && day > 0 ? String(day) : "–";
}

export function RoutinePreview({ data }: { data: RoutinePreviewData }) {
  const title = data.title.trim() === "" ? "(Tanpa judul)" : data.title;
  const next = data.occurrences[0] ?? null;
  const nextLabel = next
    ? `${formatEventDateLabel(next.date)}, ${formatEventTimeLabel(next.startTime, data.endTime)}`
    : "Belum ada kemunculan terhitung";

  return (
    <div className="flex flex-col gap-6">
      {/* Kartu ringkas — seperti yang tampil di daftar publik (§9.2). */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Kartu di daftar publik
        </h3>
        <article className="mt-2 max-w-sm overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {data.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.posterUrl}
              alt={`Poster ${title}`}
              className="aspect-[4/3] w-full object-cover"
            />
          ) : (
            <div
              className="flex aspect-[4/3] flex-col justify-between p-5 text-white"
              style={{ backgroundColor: categoryColor(data.category) }}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-6xl font-bold leading-none">
                  {bigDayNumber(data.occurrences)}
                </span>
                <span className="flex gap-1">
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">
                    Rutin
                  </span>
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">
                    {categoryLabel(data.category)}
                  </span>
                </span>
              </div>
              <div>
                <p className="text-lg font-bold leading-snug">{title}</p>
                {data.organizerName && (
                  <p className="mt-1 text-sm text-white/85">
                    {data.organizerName}
                  </p>
                )}
                <p className="mt-1 text-sm text-white/85">
                  {data.district || "Kecamatan"} · {data.city || "Kota"}
                </p>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1 p-4">
            <p className="font-semibold leading-snug">{title}</p>
            <p className="text-sm text-neutral-600">
              {data.patternDescription} ·{" "}
              {formatEventTimeLabel(data.startTime, data.endTime)}
            </p>
            <p className="text-sm text-neutral-600">
              Berikutnya: {nextLabel}
            </p>
            <p className="text-sm text-neutral-600">
              {data.venueName || "Nama tempat"} — {data.district || "Kecamatan"},{" "}
              {data.city || "Kota"}
            </p>
          </div>
        </article>
      </div>

      {/* Detail versi publik (§9.6) — tanpa field internal apa pun. */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Halaman detail publik
        </h3>
        <article className="mt-2 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {data.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.posterUrl}
              alt={`Poster ${title}`}
              className="max-h-80 w-full object-cover"
            />
          ) : (
            <div
              className="flex flex-col gap-1 p-6 text-white"
              style={{ backgroundColor: categoryColor(data.category) }}
            >
              <span className="text-sm font-medium">
                Rutin · {data.patternDescription}
              </span>
              <span className="text-2xl font-bold leading-snug">{title}</span>
              {data.organizerName && (
                <span className="text-sm text-white/85">{data.organizerName}</span>
              )}
            </div>
          )}
          <div className="flex flex-col gap-3 p-5 text-sm">
            <p>
              <span className="font-semibold">Kategori:</span>{" "}
              {categoryLabel(data.category)}
            </p>
            <p>
              <span className="font-semibold">Pola:</span>{" "}
              {data.patternDescription}
            </p>
            <p>
              <span className="font-semibold">Waktu:</span>{" "}
              {formatEventTimeLabel(data.startTime, data.endTime)}
            </p>
            {!data.isActive && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 font-medium text-amber-900">
                Jadwal ini sedang NONAKTIF — tidak tampil ke publik walau
                diterbitkan.
              </p>
            )}
            <p>
              <span className="font-semibold">Tempat:</span>{" "}
              {data.venueName || "—"}
              <br />
              <span className="text-neutral-600">
                {data.address || "—"} — {data.district || "—"},{" "}
                {data.city || "—"}
              </span>
            </p>
            {data.organizerName && (
              <p>
                <span className="font-semibold">Penyelenggara:</span>{" "}
                {data.organizerName}
              </p>
            )}
            {data.speakers.length > 0 && (
              <p>
                <span className="font-semibold">Penceramah:</span>{" "}
                {data.speakers.join(", ")}
              </p>
            )}
            <p>
              <span className="font-semibold">Untuk siapa:</span>{" "}
              {AUDIENCE_LABEL[data.audience]}
            </p>
            {data.specialNote && (
              <p>
                <span className="font-semibold">Keterangan khusus:</span>{" "}
                {data.specialNote}
              </p>
            )}
            {(data.effectiveFrom || data.effectiveTo) && (
              <p className="text-neutral-600">
                Berlaku{" "}
                {data.effectiveFrom
                  ? `sejak ${formatEventDateLabel(data.effectiveFrom)}`
                  : ""}
                {data.effectiveFrom && data.effectiveTo ? " " : ""}
                {data.effectiveTo
                  ? `sampai ${formatEventDateLabel(data.effectiveTo)}`
                  : ""}
                .
              </p>
            )}
            {data.description && (
              <p className="whitespace-pre-line text-neutral-700">
                {data.description}
              </p>
            )}
            {data.extraInfo && (
              <p>
                <span className="font-semibold">Info tambahan:</span>{" "}
                {data.extraInfo}
              </p>
            )}
            {data.liveStreamUrl && (
              <p>
                <span className="font-semibold">Live streaming:</span>{" "}
                <span className="break-all text-emerald-800 underline">
                  {data.liveStreamUrl}
                </span>
              </p>
            )}
            {data.contact && (
              <p>
                <span className="font-semibold">Kontak panitia:</span>{" "}
                {data.contact}
              </p>
            )}
            {data.libraryUrl && (
              <p>
                <span className="font-semibold">Bacaan terkait:</span>{" "}
                <span className="break-all text-emerald-800 underline">
                  Perpustakaan Shalawat
                </span>
              </p>
            )}

            <div>
              <p className="font-semibold">Kemunculan berikutnya:</p>
              {data.occurrences.length === 0 ? (
                <p className="mt-1 text-neutral-600">
                  Belum ada kemunculan yang dapat dihitung dari pola &
                  tanggal berlaku saat ini.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {data.occurrences.map((occurrence) => (
                    <li
                      key={occurrence.date}
                      className="rounded-lg border border-neutral-200 px-3 py-2"
                    >
                      <span className="font-medium">
                        {formatEventDateLabel(occurrence.date)}
                      </span>{" "}
                      · {occurrence.startTime} WIB
                      {occurrence.exceptionKind === "edisi-spesial" && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
                          Edisi Spesial
                        </span>
                      )}
                      {occurrence.isOngoing && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                          Sedang berlangsung
                        </span>
                      )}
                      {(occurrence.venueName !== data.venueName ||
                        occurrence.address !== data.address) && (
                        <span className="mt-0.5 block text-neutral-600">
                          di {occurrence.venueName} — {occurrence.address}
                        </span>
                      )}
                      {occurrence.note && (
                        <span className="mt-0.5 block text-neutral-600">
                          {occurrence.note}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-neutral-500">
              Tombol publik: Rute ke Lokasi (Google Maps) · Bagikan
              (WhatsApp / salin tautan)
              {data.mapsUrl ? " — memakai link Maps manual admin." : "."}
            </p>
          </div>
        </article>
      </div>
    </div>
  );
}

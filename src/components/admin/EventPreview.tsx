// Pratinjau tampilan jamaah untuk Event (plan Task 9): kartu ringkas +
// detail versi publik yang dirender dari data yang diberikan pemanggil
// (nilai form saat ini di EventForm, atau record tersimpan di halaman
// pratinjau admin). Field sourceInfo TIDAK PERNAH diterima komponen ini,
// jadi tidak mungkin bocor ke pratinjau (spec §6.2/§13.5).
//
// Tanpa poster, tampil fallback design spec §11: blok berwarna per
// kategori berisi tanggal besar, judul, penyelenggara, kecamatan+kota.

import { CATEGORIES } from "../../lib/constants.ts";
import type { Audience, Category } from "../../lib/domain.ts";
import { EVENT_DRAFT_PLACEHOLDER_DATE } from "../../lib/utils.ts";

export interface EventPreviewData {
  title: string;
  category: Category | "";
  startDate: string;
  endDate: string | null;
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
}

/** Warna latar fallback per colorToken kategori (spec §11). */
const FALLBACK_BG: Record<string, string> = {
  emerald: "#047857",
  navy: "#1e3a8a",
  teal: "#0f766e",
  "golden-brown": "#92400e",
  purple: "#7e22ce",
  maroon: "#7f1d1d",
  sage: "#5f7161",
  "neutral-gray": "#525252",
};

const AUDIENCE_LABEL: Record<Audience, string> = {
  umum: "Umum",
  ikhwan: "Ikhwan",
  akhwat: "Akhwat",
};

export function categoryLabel(category: Category | ""): string {
  return CATEGORIES.find((c) => c.value === category)?.label ?? "Kategori";
}

function categoryColor(category: Category | ""): string {
  const token = CATEGORIES.find((c) => c.value === category)?.colorToken;
  return (token && FALLBACK_BG[token]) || FALLBACK_BG["neutral-gray"];
}

/** "2026-10-20" → "Selasa, 20 Oktober 2026" (kalender WIB). */
export function formatEventDateLabel(dateStr: string): string {
  if (!dateStr || dateStr === EVENT_DRAFT_PLACEHOLDER_DATE) {
    return "Tanggal belum diisi";
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/** Angka hari besar untuk fallback ("20"), atau "–" bila belum ada tanggal. */
function bigDayNumber(dateStr: string): string {
  if (!dateStr || dateStr === EVENT_DRAFT_PLACEHOLDER_DATE) return "–";
  const day = Number(dateStr.split("-")[2]);
  return Number.isFinite(day) && day > 0 ? String(day) : "–";
}

export function formatEventTimeLabel(
  startTime: string,
  endTime: string | null,
): string {
  if (!startTime) return "Jam belum diisi";
  return endTime
    ? `${startTime} – ${endTime} WIB`
    : `${startTime} WIB – selesai`;
}

export function EventPreview({ data }: { data: EventPreviewData }) {
  const title = data.title.trim() === "" ? "(Tanpa judul)" : data.title;
  const dateLabel = formatEventDateLabel(data.startDate);
  const timeLabel = formatEventTimeLabel(data.startTime, data.endTime);
  const endDateLabel =
    data.endDate && data.endDate !== data.startDate
      ? formatEventDateLabel(data.endDate)
      : null;

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
                  {bigDayNumber(data.startDate)}
                </span>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">
                  {categoryLabel(data.category)}
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
              {dateLabel} · {timeLabel}
            </p>
            <p className="text-sm text-neutral-600">
              {data.venueName || "Nama tempat"} — {data.district || "Kecamatan"},{" "}
              {data.city || "Kota"}
            </p>
          </div>
        </article>
      </div>

      {/* Detail versi publik (§9.5) — tanpa field internal apa pun. */}
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
              <span className="text-sm font-medium">{dateLabel}</span>
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
              <span className="font-semibold">Tanggal:</span> {dateLabel}
              {endDateLabel ? ` s.d. ${endDateLabel}` : ""}
            </p>
            <p>
              <span className="font-semibold">Waktu:</span> {timeLabel}
            </p>
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

// Bilah filter publik (plan Task 11; spec §9.1): form GET murni —
// seluruh state hidup di query string (searchParams), jadi tautan dapat
// dibagikan & di-refresh dan halaman tetap berfungsi tanpa JavaScript.
//
// Gaya mengikuti arah Kalender Dinding (Task 14): formulir koran —
// label kecil berhuruf kapital, isian bergaris bawah, pilihan rentang &
// kategori sebagai label persegi tegas, tombol solid tinta.

import { CATEGORIES, REGIONS } from "../../lib/constants.ts";
import type { UpcomingRange } from "../../lib/feed.ts";

export interface FilterValues {
  range: UpcomingRange;
  category: string;
  city: string;
  district: string;
  q: string;
}

export const RANGE_OPTIONS: { value: UpcomingRange; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "today", label: "Hari Ini" },
  { value: "week", label: "Minggu Ini" },
  { value: "weekend", label: "Akhir Pekan" },
];

const inputClass =
  "w-full rounded-none border-0 border-b border-neutral-400 bg-transparent px-0 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none";
const labelClass =
  "block text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-500";
const chipClass =
  "inline-block border border-neutral-400 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600 peer-checked:border-neutral-900 peer-checked:bg-neutral-900 peer-checked:font-bold peer-checked:text-white";

export function FilterBar({
  action,
  values,
  districts,
  resultCount,
}: {
  /** Path tujuan form, mis. "/acara" (atau "/" dari beranda). */
  action: string;
  values: FilterValues;
  /** Saran kecamatan untuk datalist (dari data terbit saja, via getDistrictSuggestions server). */
  districts: string[];
  /** Bila diberikan, jumlah hasil ditampilkan di bawah form. */
  resultCount?: number;
}) {
  const datalistId = `kecamatan-${action.replace(/\W/g, "") || "beranda"}`;
  return (
    <div className="border-b border-[#e3e0d5] border-t-[3px] border-t-neutral-900 py-4">
      <form method="get" action={action} className="flex flex-col gap-4">
        <div>
          <label htmlFor="filter-q" className={labelClass}>
            Cari acara
          </label>
          <input
            id="filter-q"
            type="search"
            name="q"
            defaultValue={values.q}
            placeholder="Judul, penceramah, penyelenggara, tempat…"
            className={inputClass}
          />
        </div>

        <fieldset>
          <legend className={labelClass}>Rentang tanggal</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {RANGE_OPTIONS.map((opt) => (
              <label key={opt.value} className="cursor-pointer">
                <input
                  type="radio"
                  name="range"
                  value={opt.value}
                  defaultChecked={values.range === opt.value}
                  className="peer sr-only"
                />
                <span className={chipClass}>{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={labelClass}>Kategori</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <label className="cursor-pointer">
              <input
                type="radio"
                name="category"
                value=""
                defaultChecked={values.category === ""}
                className="peer sr-only"
              />
              <span className={chipClass}>Semua Kategori</span>
            </label>
            {CATEGORIES.map((c) => (
              <label key={c.value} className="cursor-pointer">
                <input
                  type="radio"
                  name="category"
                  value={c.value}
                  defaultChecked={values.category === c.value}
                  className="peer sr-only"
                />
                <span className={chipClass}>{c.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="filter-city" className={labelClass}>
              Kota/Kabupaten
            </label>
            <select
              id="filter-city"
              name="city"
              defaultValue={values.city}
              className={inputClass}
            >
              <option value="">Semua kota/kabupaten</option>
              {REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-district" className={labelClass}>
              Kecamatan
            </label>
            <input
              id="filter-district"
              type="text"
              name="district"
              defaultValue={values.district}
              list={datalistId}
              placeholder="Ketik atau pilih kecamatan"
              className={inputClass}
            />
            <datalist id={datalistId}>
              {districts.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded-none bg-neutral-900 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-neutral-700"
          >
            Terapkan
          </button>
          <a
            href={action}
            className="rounded-none border border-neutral-900 px-5 py-2 text-xs font-bold uppercase tracking-wider text-neutral-900 hover:bg-neutral-100"
          >
            Atur Ulang
          </a>
        </div>
      </form>
      {resultCount !== undefined ? (
        <p className="mt-3 text-sm text-neutral-600" role="status">
          Menampilkan {resultCount} acara
        </p>
      ) : null}
    </div>
  );
}

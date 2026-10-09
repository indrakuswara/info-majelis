// Bilah filter publik (plan Task 11; spec §9.1): form GET murni —
// seluruh state hidup di query string (searchParams), jadi tautan dapat
// dibagikan & di-refresh dan halaman tetap berfungsi tanpa JavaScript.
//
// Presentasi Serambi (plan redesign Task 3): markup form selalu satu
// bentuk dengan kelas akar `filterbar`; perbedaannya antar-wadah
// diatur CSS turunan penanda slot di globals.css — di rail desktop
// (.slot-rail) filter bertumpuk satu kolom dengan teks terang di atas
// zamrud, di bar mobile (.slot-bar) ia menjadi baris gulir horizontal
// ringkas, dan di aliran konten (fallback tanpa JS) ia memakai gaya
// dasar token Serambi di atas kertas.

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
  "w-full rounded-[2px] border border-line bg-paper px-2.5 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-em focus:outline-none";
const labelClass =
  "block text-[11px] font-bold uppercase tracking-[0.12em] text-muted";
const chipClass =
  "inline-block rounded-[2px] border border-line bg-ivory px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted peer-checked:border-em peer-checked:bg-em peer-checked:font-bold peer-checked:text-paper";

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
    <div>
      <form method="get" action={action} className="filterbar flex flex-col gap-4">
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

        {/* Label chip WAJIB relative: input radio sr-only di dalamnya
            position:absolute — tanpa labuh ke label, containing
            block-nya lolos keluar form gulir dan posisi statisnya yang
            jauh menyumbang overflow horizontal ke seluruh halaman. */}
        <fieldset>
          <legend className={labelClass}>Rentang tanggal</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {RANGE_OPTIONS.map((opt) => (
              <label key={opt.value} className="relative cursor-pointer">
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
            <label className="relative cursor-pointer">
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
              <label key={c.value} className="relative cursor-pointer">
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

        <div className="flex items-stretch gap-2">
          <button
            type="submit"
            className="flex-1 whitespace-nowrap rounded-[2px] bg-em px-5 py-2 text-center text-xs font-bold uppercase tracking-wider text-paper hover:bg-em2"
          >
            Terapkan
          </button>
          <a
            href={action}
            className="flex flex-1 items-center justify-center whitespace-nowrap rounded-[2px] border border-em px-5 py-2 text-center text-xs font-bold uppercase tracking-wider text-em hover:bg-ivory"
          >
            Reset
          </a>
        </div>
      </form>
      {resultCount !== undefined ? (
        <p className="filterbar-count mt-3 text-sm text-muted" role="status">
          Menampilkan {resultCount} acara
        </p>
      ) : null}
    </div>
  );
}

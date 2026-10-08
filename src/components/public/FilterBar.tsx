// Bilah filter publik (plan Task 11; spec §9.1): form GET murni —
// seluruh state hidup di query string (searchParams), jadi tautan dapat
// dibagikan & di-refresh dan halaman tetap berfungsi tanpa JavaScript.

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
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900";
const labelClass = "block text-xs font-semibold uppercase tracking-wide text-neutral-500";

export function FilterBar({
  action,
  values,
  districts,
  resultCount,
}: {
  /** Path tujuan form, mis. "/acara" (atau "/" dari beranda). */
  action: string;
  values: FilterValues;
  /** Saran kecamatan untuk datalist (dari listKnownDistricts server). */
  districts: string[];
  /** Bila diberikan, jumlah hasil ditampilkan di bawah form. */
  resultCount?: number;
}) {
  const datalistId = `kecamatan-${action.replace(/\W/g, "") || "beranda"}`;
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
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
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {RANGE_OPTIONS.map((opt) => (
              <label key={opt.value} className="cursor-pointer">
                <input
                  type="radio"
                  name="range"
                  value={opt.value}
                  defaultChecked={values.range === opt.value}
                  className="peer sr-only"
                />
                <span className="inline-block rounded-full border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 peer-checked:border-emerald-700 peer-checked:bg-emerald-700 peer-checked:font-semibold peer-checked:text-white">
                  {opt.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={labelClass}>Kategori</legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <label className="cursor-pointer">
              <input
                type="radio"
                name="category"
                value=""
                defaultChecked={values.category === ""}
                className="peer sr-only"
              />
              <span className="inline-block rounded-full border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 peer-checked:border-emerald-700 peer-checked:bg-emerald-700 peer-checked:font-semibold peer-checked:text-white">
                Semua Kategori
              </span>
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
                <span className="inline-block rounded-full border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 peer-checked:border-emerald-700 peer-checked:bg-emerald-700 peer-checked:font-semibold peer-checked:text-white">
                  {c.label}
                </span>
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
            className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Terapkan
          </button>
          <a
            href={action}
            className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
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

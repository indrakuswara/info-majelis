// Daftar Jadwal Rutin admin (plan Task 10; spec §7.3): tab status +
// filter kategori + cari, badge status & aktif/nonaktif, pola dalam
// bahasa manusia (describePattern), kemunculan berikutnya per rutin,
// dan toggle aktif/nonaktif lewat dialog konfirmasi (§8).

import Link from "next/link";
import { connection } from "next/server";
import { RoutineActiveToggle } from "../../../../components/admin/RoutineActiveToggle.tsx";
import { StatusBadge } from "../../../../components/admin/StatusBadge.tsx";
import { formatEventDateLabel } from "../../../../components/admin/EventPreview.tsx";
import { CATEGORIES } from "../../../../lib/constants.ts";
import {
  ensureSchema,
  listAdminRoutines,
  listRoutineExceptions,
} from "../../../../lib/db.ts";
import type { ContentStatus } from "../../../../lib/domain.ts";
import { computeOccurrences, describePattern } from "../../../../lib/recurrence.ts";
import { formatRelativeTime, nowWibISO } from "../../../../lib/utils.ts";

export const instant = false;

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "", label: "Semua" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Terbit" },
];

function tabHref(status: string, category: string, q: string): string {
  const params = new URLSearchParams();
  if (status !== "") params.set("status", status);
  if (category !== "") params.set("category", category);
  if (q !== "") params.set("q", q);
  const query = params.toString();
  return query === "" ? "/admin/routines" : `/admin/routines?${query}`;
}

export default async function AdminRoutinesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string }>;
}) {
  await connection();
  await ensureSchema();
  const params = await searchParams;
  const status = STATUS_TABS.some((t) => t.value === params.status)
    ? (params.status ?? "")
    : "";
  const category = CATEGORIES.some((c) => c.value === params.category)
    ? (params.category ?? "")
    : "";
  const q = (params.q ?? "").trim();

  const allRoutines = await listAdminRoutines({
    status: status === "" ? undefined : (status as ContentStatus),
    q: q === "" ? undefined : q,
  });
  const routines =
    category === ""
      ? allRoutines
      : allRoutines.filter((routine) => routine.category === category);

  const nowISO = nowWibISO();
  const nextOccurrences = await Promise.all(
    routines.map(async (routine) => {
      const exceptions = await listRoutineExceptions(routine.id);
      try {
        return computeOccurrences(routine, exceptions, nowISO, 1)[0] ?? null;
      } catch {
        return null;
      }
    }),
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jadwal Rutin</h1>
          <p className="mt-2 text-neutral-600">
            Jadwal berulang mingguan dan bulanan. Kemunculan berikutnya
            dihitung otomatis dari pola + pengecualian; draft tidak
            tampil ke publik.
          </p>
        </div>
        <Link
          href="/admin/routines/new"
          className="rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"
        >
          + Tambah Jadwal Rutin
        </Link>
      </div>

      <nav aria-label="Filter status" className="mt-6 flex gap-2">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tabHref(tab.value, category, q)}
            aria-current={status === tab.value ? "page" : undefined}
            className={
              status === tab.value
                ? "rounded-full bg-emerald-700 px-4 py-1.5 text-sm font-semibold text-white"
                : "rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-semibold hover:bg-neutral-100"
            }
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <form
        method="get"
        className="mt-4 flex flex-wrap gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
      >
        <input type="hidden" name="status" value={status} />
        <label className="flex flex-col gap-1 text-sm font-medium">
          Kategori
          <select
            name="category"
            defaultValue={category}
            className="rounded-md border border-neutral-300 px-3 py-2 font-normal"
          >
            <option value="">Semua kategori</option>
            {CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          Cari
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Judul jadwal, penyelenggara, atau tempat…"
            className="rounded-md border border-neutral-300 px-3 py-2 font-normal"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 font-semibold text-white hover:bg-neutral-800"
          >
            Terapkan
          </button>
          {(category !== "" || q !== "") && (
            <Link
              href={tabHref(status, "", "")}
              className="rounded-md border border-neutral-300 px-4 py-2 font-semibold hover:bg-neutral-100"
            >
              Reset
            </Link>
          )}
        </div>
      </form>

      <section
        aria-label="Daftar jadwal rutin"
        className="mt-6 rounded-2xl border border-neutral-200 bg-white shadow-sm"
      >
        {routines.length === 0 ? (
          <p className="px-5 py-6 text-neutral-600">
            {status !== "" || category !== "" || q !== ""
              ? "Tidak ada jadwal rutin yang cocok dengan filter. Coba ubah kata kunci, status, atau kategori."
              : "Belum ada jadwal rutin. Tambahkan lewat tombol \"+ Tambah Jadwal Rutin\"."}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {routines.map((routine, index) => {
              const next = nextOccurrences[index];
              const patternComplete =
                routine.pattern.kind === "monthly-date"
                  ? routine.pattern.dayOfMonth >= 1 &&
                    routine.pattern.dayOfMonth <= 31
                  : routine.pattern.weekday >= 0 &&
                    routine.pattern.weekday <= 6;
              return (
                <li
                  key={routine.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {routine.title.trim() === ""
                        ? "(Tanpa judul)"
                        : routine.title}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500">
                      {CATEGORIES.find((c) => c.value === routine.category)
                        ?.label ?? "Kategori belum dipilih"}{" "}
                      ·{" "}
                      {patternComplete
                        ? describePattern(routine.pattern, {
                            startTime: routine.startTime,
                          })
                        : "Pola belum lengkap"}
                      {routine.startTime !== "00:00" &&
                        `, ${routine.startTime} WIB`}{" "}
                      · {routine.venueName || "Tempat belum diisi"} ·{" "}
                      {next
                        ? `Berikutnya: ${formatEventDateLabel(next.date)}`
                        : "Belum ada kemunculan"}{" "}
                      · Diubah {formatRelativeTime(routine.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={routine.status} />
                    {routine.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                        Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-semibold text-neutral-700">
                        Nonaktif
                      </span>
                    )}
                    <RoutineActiveToggle
                      id={routine.id}
                      title={
                        routine.title.trim() === ""
                          ? "(Tanpa judul)"
                          : routine.title
                      }
                      isActive={routine.isActive}
                    />
                    <Link
                      href={`/admin/routines/${routine.id}/preview`}
                      className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-semibold hover:bg-neutral-100"
                    >
                      Pratinjau
                    </Link>
                    <Link
                      href={`/admin/routines/${routine.id}/edit`}
                      className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-semibold hover:bg-neutral-100"
                    >
                      Ubah
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

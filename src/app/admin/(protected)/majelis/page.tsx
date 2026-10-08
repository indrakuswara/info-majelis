// Daftar Majelis admin (plan Task 8; spec §7.3): filter status + cari,
// badge status, dan bagian promosi nama penyelenggara manual yang
// muncul ≥2 kali (dialog & aksi di komponen PromoteOrganizer).

import Link from "next/link";
import { connection } from "next/server";
import { PromoteOrganizer } from "../../../../components/admin/PromoteOrganizer.tsx";
import { StatusBadge } from "../../../../components/admin/StatusBadge.tsx";
import {
  ensureSchema,
  listAdminMajelis,
  listManualOrganizerNames,
} from "../../../../lib/db.ts";
import type { ContentStatus } from "../../../../lib/domain.ts";
import { formatRelativeTime } from "../../../../lib/utils.ts";

export const instant = false;

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Semua status" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Terbit" },
];

export default async function AdminMajelisPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await connection();
  await ensureSchema();
  const params = await searchParams;
  const status = STATUS_OPTIONS.some((o) => o.value === params.status)
    ? (params.status ?? "")
    : "";
  const q = (params.q ?? "").trim();

  const [majelisList, manualGroups] = await Promise.all([
    listAdminMajelis({
      status: status === "" ? undefined : (status as ContentStatus),
      q: q === "" ? undefined : q,
    }),
    listManualOrganizerNames(),
  ]);
  const promotable = manualGroups.filter(
    (group) => group.eventCount + group.routineCount >= 2,
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Majelis</h1>
          <p className="mt-2 text-neutral-600">
            Profil majelis terdaftar. Profil bersifat opsional — event dan
            jadwal rutin tetap dapat memakai nama penyelenggara manual.
          </p>
        </div>
        <Link
          href="/admin/majelis/new"
          className="rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"
        >
          + Tambah Majelis
        </Link>
      </div>

      <form
        method="get"
        className="mt-6 flex flex-wrap gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          Status
          <select
            name="status"
            defaultValue={status}
            className="rounded-md border border-neutral-300 px-3 py-2 font-normal"
          >
            {STATUS_OPTIONS.map((option) => (
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
            placeholder="Nama majelis atau pimpinan…"
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
          {(status !== "" || q !== "") && (
            <Link
              href="/admin/majelis"
              className="rounded-md border border-neutral-300 px-4 py-2 font-semibold hover:bg-neutral-100"
            >
              Reset
            </Link>
          )}
        </div>
      </form>

      <section
        aria-label="Daftar majelis"
        className="mt-6 rounded-2xl border border-neutral-200 bg-white shadow-sm"
      >
        {majelisList.length === 0 ? (
          <p className="px-5 py-6 text-neutral-600">
            {status !== "" || q !== ""
              ? "Tidak ada majelis yang cocok dengan filter. Coba ubah kata kunci atau status."
              : "Belum ada profil majelis. Tambahkan lewat tombol \"+ Tambah Majelis\"."}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {majelisList.map((majelis) => (
              <li
                key={majelis.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{majelis.name}</p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {majelis.city || "Kota belum diisi"}
                    {majelis.leader ? ` · ${majelis.leader}` : ""} · Diubah{" "}
                    {formatRelativeTime(majelis.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={majelis.status} />
                  <Link
                    href={`/admin/majelis/${majelis.id}`}
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-semibold hover:bg-neutral-100"
                  >
                    Ubah
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PromoteOrganizer groups={promotable} />
    </main>
  );
}

// Pratinjau admin Jadwal Rutin (plan Task 10): render tampilan
// detail publik dari data record TERSIMPAN — termasuk draft.
// Kemunculan berikutnya (6) dihitung di server dengan
// computeOccurrences yang sama persis dengan panel live di form,
// memakai pengecualian tersimpan (libur dilewati, edisi spesial
// memakai override). Route ini berada di balik layout terproteksi
// sesi; publik tetap tidak dapat mengakses draft. Field sourceInfo
// tidak diteruskan ke komponen pratinjau sama sekali.

import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { RoutinePreview } from "../../../../../../components/admin/RoutinePreview.tsx";
import { StatusBadge } from "../../../../../../components/admin/StatusBadge.tsx";
import {
  ensureSchema,
  getMajelisById,
  getRoutineById,
  listRoutineExceptions,
} from "../../../../../../lib/db.ts";
import {
  computeOccurrences,
  describePattern,
} from "../../../../../../lib/recurrence.ts";
import { nowWibISO } from "../../../../../../lib/utils.ts";

export const instant = false;

export default async function AdminRoutinePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  await ensureSchema();
  const { id } = await params;
  const routine = await getRoutineById(id);
  if (!routine) notFound();

  const organizerName = routine.organizerMajelisId
    ? ((await getMajelisById(routine.organizerMajelisId))?.name ?? null)
    : routine.organizerNameManual;

  const exceptions = await listRoutineExceptions(routine.id);
  let occurrences: ReturnType<typeof computeOccurrences> = [];
  try {
    occurrences = computeOccurrences(routine, exceptions, nowWibISO(), 6);
  } catch {
    occurrences = [];
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href={`/admin/routines/${routine.id}/edit`}
        className="text-sm font-medium text-emerald-800 underline"
      >
        ← Kembali ke form Jadwal Rutin
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Pratinjau Jadwal Rutin
        </h1>
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
      </div>
      <p className="mt-2 text-neutral-600">
        Pratinjau khusus admin dari data tersimpan.{" "}
        {routine.status === "draft"
          ? "Jadwal ini masih draft — halaman publiknya belum dapat diakses siapa pun."
          : routine.isActive
            ? "Jadwal ini sudah terbit, aktif, dan tampil ke publik."
            : "Jadwal ini terbit tetapi sedang nonaktif — tidak tampil ke publik."}
      </p>
      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <RoutinePreview
          data={{
            title: routine.title,
            category: routine.category,
            patternDescription: describePattern(routine.pattern, {
              startTime: routine.startTime,
            }),
            startTime: routine.startTime,
            endTime: routine.endTime,
            venueName: routine.venueName,
            address: routine.address,
            city: routine.city,
            district: routine.district,
            mapsUrl: routine.mapsUrl,
            posterUrl: routine.posterUrl,
            organizerName,
            speakers: routine.speakers,
            audience: routine.audience,
            liveStreamUrl: routine.liveStreamUrl,
            contact: routine.contact,
            extraInfo: routine.extraInfo,
            libraryUrl: routine.libraryUrl,
            description: routine.description,
            specialNote: routine.specialNote,
            effectiveFrom: routine.effectiveFrom,
            effectiveTo: routine.effectiveTo,
            isActive: routine.isActive,
            occurrences,
          }}
        />
      </div>
      {routine.status === "published" && routine.isActive && (
        <p className="mt-4 text-sm">
          <Link
            href={`/rutin/${routine.slug}`}
            className="font-medium text-emerald-800 underline"
          >
            Lihat Halaman Publik
          </Link>{" "}
          (halaman publik dibangun pada Task 12.)
        </p>
      )}
    </main>
  );
}

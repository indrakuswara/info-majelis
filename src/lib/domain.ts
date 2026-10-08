// Tipe domain Info Majelis — satu-satunya sumber tipe (lihat plan Task 1).
// Field mengacu spec §6.1–§6.5. Tanggal berupa string "YYYY-MM-DD" dan
// waktu "HH:mm" dalam zona Asia/Jakarta; timestamp berupa ISO datetime.

export type Category =
  | "maulid"
  | "tabligh-akbar"
  | "kajian"
  | "haul"
  | "istighosah"
  | "phbi"
  | "ziarah"
  | "lainnya";

export type ContentStatus = "draft" | "published";

export type Audience = "umum" | "ikhwan" | "akhwat";

/** 0 = Minggu, mengikuti Date.getDay(). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RecurrencePattern =
  | { kind: "weekly"; weekday: Weekday }
  | { kind: "monthly-date"; dayOfMonth: number }
  | {
      kind: "monthly-weekday";
      weekday: Weekday;
      weekOfMonth: 1 | 2 | 3 | 4 | 5 | "last";
    };

export type ExceptionKind = "libur" | "edisi-spesial";

/** Field lokasi yang dipakai bersama Event & Jadwal Rutin (spec §6.2). */
export interface ScheduleVenueFields {
  venueName: string;
  address: string;
  /** Salah satu dari 14 wilayah di REGIONS (spec §6.1). */
  city: string;
  district: string;
  mapsUrl: string | null;
  /** Koordinat hasil ekstraksi best-effort dari mapsUrl (spec §13.4). */
  lat: number | null;
  lng: number | null;
}

/** Field tampilan/isi yang sama persis antara Event dan Jadwal Rutin (spec §6.3). */
export interface ScheduleCommonFields extends ScheduleVenueFields {
  title: string;
  category: Category;
  /** "HH:mm" */
  startTime: string;
  /** "HH:mm"; null = "s/d selesai". Lebih kecil dari startTime = keesokan hari. */
  endTime: string | null;
  description: string | null;
  posterUrl: string | null;
  /** Penyelenggara: majelis terdaftar ATAU nama manual ATAU null (tiga jalan, spec §6.2). */
  organizerMajelisId: string | null;
  organizerNameManual: string | null;
  speakers: string[];
  audience: Audience;
  liveStreamUrl: string | null;
  /** Tampil publik — form admin wajib mengingatkan hal ini. */
  contact: string | null;
  extraInfo: string | null;
  libraryUrl: string | null;
  /** Khusus admin, tidak pernah tampil ke publik. */
  sourceInfo: string | null;
  status: ContentStatus;
  /** Antisipasi Fase 2 (spec §6.5); di MVP selalu admin tunggal. */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventRecord extends ScheduleCommonFields {
  id: string;
  slug: string;
  /** "YYYY-MM-DD" */
  startDate: string;
  /** "YYYY-MM-DD"; null = sama dengan startDate (event satu hari). */
  endDate: string | null;
}

export interface RoutineRecord extends ScheduleCommonFields {
  id: string;
  slug: string;
  pattern: RecurrencePattern;
  /** "YYYY-MM-DD"; null = berlaku sejak dibuat. */
  effectiveFrom: string | null;
  /** "YYYY-MM-DD"; null = tanpa batas akhir. */
  effectiveTo: string | null;
  specialNote: string | null;
  isActive: boolean;
}

export interface RoutineExceptionRecord {
  id: string;
  routineId: string;
  /** "YYYY-MM-DD" — harus tanggal yang memang hasil pola induk. */
  date: string;
  kind: ExceptionKind;
  note: string | null;
  /** Override hanya untuk kind "edisi-spesial"; null = pakai nilai induk. */
  overrideVenueName: string | null;
  overrideAddress: string | null;
  /** "HH:mm" */
  overrideStartTime: string | null;
  overrideDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MajelisRecord {
  id: string;
  slug: string;
  name: string;
  /** Salah satu dari 14 wilayah di REGIONS (spec §6.1). */
  city: string;
  leader: string | null;
  logoUrl: string | null;
  photoUrl: string | null;
  baseAddress: string | null;
  baseDistrict: string | null;
  baseMapsUrl: string | null;
  description: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  tiktokUrl: string | null;
  websiteUrl: string | null;
  /** Tampil publik — form admin wajib mengingatkan hal ini. */
  contact: string | null;
  status: ContentStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Satu kemunculan konkret hasil perhitungan pola jadwal rutin (Task 2). */
export interface Occurrence {
  /** "YYYY-MM-DD" */
  date: string;
  startISO: string;
  endISO: string | null;
  isOngoing: boolean;
  exceptionKind: ExceptionKind | null;
  note: string | null;
  venueName: string;
  address: string;
  /** "HH:mm" */
  startTime: string;
}

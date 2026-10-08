// Tombol Bagikan (spec §10). Menu Web Share API/WhatsApp/salin tautan
// final dikerjakan di Task 13; di Task 12 tempat finalnya dirender
// sebagai tautan bagikan WhatsApp dengan teks dari buildShareText.

export function ShareButtons({ text }: { text: string }) {
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex flex-1 items-center justify-center rounded-full border border-emerald-700 px-5 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
    >
      Bagikan
    </a>
  );
}

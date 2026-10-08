// Data pendukung form Event (plan Task 9), dimuat server-side oleh
// halaman new & [id]: profil majelis TERBIT untuk OrganizerPicker
// (profil draft tidak dapat dipilih, spec §6.5) dan peta auto-saran
// kecamatan per kota dari listKnownDistricts (Task 4) agar saran di
// form mengikuti kota yang sedang dipilih admin.

import { REGIONS } from "../../../../lib/constants.ts";
import {
  listAdminMajelis,
  listKnownDistricts,
} from "../../../../lib/db.ts";
import type { OrganizerOption } from "../../../../components/admin/OrganizerPicker.tsx";

export async function loadEventFormData(): Promise<{
  organizerOptions: OrganizerOption[];
  districtSuggestionsByCity: Record<string, string[]>;
}> {
  const [publishedMajelis, districtLists] = await Promise.all([
    listAdminMajelis({ status: "published" }),
    Promise.all(REGIONS.map((region) => listKnownDistricts(region))),
  ]);
  const districtSuggestionsByCity: Record<string, string[]> = {};
  REGIONS.forEach((region, index) => {
    districtSuggestionsByCity[region] = districtLists[index];
  });
  return {
    organizerOptions: publishedMajelis.map((majelis) => ({
      id: majelis.id,
      name: majelis.name,
      city: majelis.city,
    })),
    districtSuggestionsByCity,
  };
}

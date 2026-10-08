// Server actions area admin terproteksi (plan Task 5).

import { redirect } from "next/navigation";
import { destroySession } from "../../../lib/auth.ts";

export async function logoutAction() {
  "use server";
  await destroySession();
  redirect("/admin/login");
}

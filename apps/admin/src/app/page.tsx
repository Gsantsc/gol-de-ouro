import { redirect } from "next/navigation";

export default function Page() {
  redirect(process.env.GOL_DE_OURO_ENTRY === "dashboard" ? "/dashboard" : "/admin");
}

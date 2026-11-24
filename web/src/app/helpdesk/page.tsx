import { redirect } from "next/navigation";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const incoming = await searchParams;
  const next = new URLSearchParams({ section: "helpdesk" });
  for (const [key, value] of Object.entries(incoming)) {
    if (typeof value === "string") next.set(key, value);
  }
  redirect(`/hub?${next}`);
}

import { redirect } from "next/navigation";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const incoming = await searchParams;
  const next = new URLSearchParams({ section: "map" });
  for (const [key, value] of Object.entries(incoming)) {
    if (Array.isArray(value)) value.forEach((item) => next.append(key, item));
    else if (value !== undefined) next.set(key, value);
  }
  redirect(`/hub?${next}`);
}

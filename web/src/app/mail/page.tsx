import { Suspense } from "react";
import { MailView } from "@/components/pages/MailView";
export const metadata = { title: "Mail assistant | XMUM Compass" };
export default function Page() { return <Suspense><MailView /></Suspense>; }

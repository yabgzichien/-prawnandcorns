import type { Metadata } from "next";
import { DemoConsole } from "@/components/demo/DemoConsole";

export const metadata: Metadata = { title: "Demo console", robots: { index: false, follow: false } };

export default function Page() { return <DemoConsole />; }

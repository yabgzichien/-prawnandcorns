import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal/PortalShell";

export const metadata: Metadata = { title: "Demo console", robots: { index: false, follow: false } };

export default function Layout({ children }: { children: ReactNode }) { return <PortalShell>{children}</PortalShell>; }

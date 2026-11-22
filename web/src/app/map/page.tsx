import { Suspense } from "react";
import { MapView } from "@/components/map/MapView";
export const metadata = { title: "Campus map · XMUM Compass" };
export default function Page() { return <Suspense><MapView /></Suspense>; }

import { Suspense } from "react";
import { StudentHubView } from "@/components/hub/StudentHubView";

export const metadata = { title: "Student hub · XMUM Compass" };

export default function Page() {
  return <Suspense><StudentHubView /></Suspense>;
}

import { PageSkeleton } from "@/components/ui/page-skeleton";
import { TabBar } from "@/components/ui/tab-bar";

export default function Loading() {
  return (
    <>
      <PageSkeleton />
      <TabBar active="remember" />
    </>
  );
}

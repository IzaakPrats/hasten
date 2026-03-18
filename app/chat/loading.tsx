import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export default function ChatLoading() {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="h-16 w-3/4 animate-pulse rounded-lg bg-muted" />
            <div className="h-24 w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-24 w-4/5 animate-pulse rounded-lg bg-muted" />
          </div>
        </main>
      </div>
    </div>
  );
}

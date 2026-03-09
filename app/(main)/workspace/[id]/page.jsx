"use client";

import dynamic from "next/dynamic";

const LoadingCard = () => (
  <div
    className="h-full animate-pulse rounded-lg bg-gray-800"
    aria-hidden="true"
  />
);

const ChatView = dynamic(() => import("@/components/custom/ChatView"), {
  ssr: false,
  loading: LoadingCard,
});

const CodeView = dynamic(() => import("@/components/custom/CodeView"), {
  ssr: false,
  loading: LoadingCard,
});

function BackgroundPattern() {
  return (
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px]">
      <div className="absolute left-1/2 top-0 h-[500px] w-[1000px] -translate-x-1/2 bg-[radial-gradient(circle_400px_at_50%_300px,#3b82f625,transparent)]" />
    </div>
  );
}

export default function Workspace() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gray-950">
      <BackgroundPattern />

      <div className="relative z-10 p-4 md:p-8 xl:p-10">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-4 xl:gap-10">
          <section className="xl:col-span-1">
            <ChatView />
          </section>

          <section className="xl:col-span-3 min-w-0">
            <CodeView />
          </section>
        </div>
      </div>
    </main>
  );
}

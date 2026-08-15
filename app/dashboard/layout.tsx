export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#080d1a]">
      <main className="w-full">
        {children}
      </main>
    </div>
  );
}

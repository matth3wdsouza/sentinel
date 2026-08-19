export default function PageShell({ children }) {
  return (
    <main className="min-h-screen px-6 pt-6 pb-10 sm:px-10 sm:pt-8 sm:pb-12">
      <div className="max-w-2xl mx-auto animate-page-enter">
        {children}
      </div>
    </main>
  );
}

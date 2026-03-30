export function SiteFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-10 text-sm text-neutral-600 md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} Crossover Apparel. Crafted for game-day identity.</p>
        <p>Premium teamwear customization with production-grade workflows.</p>
      </div>
    </footer>
  );
}

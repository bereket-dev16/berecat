const skeletonCardCounts = [2, 2, 1, 1, 1, 1, 2]

export function HomeLoading() {
  return (
    <section
      role="status"
      aria-label="Anasayfa yükleniyor"
      className="home-board-scroll min-h-[calc(100dvh-8.5rem)] overflow-x-auto p-3 sm:p-4"
    >
      <span className="sr-only">Anasayfa verileri yükleniyor.</span>
      <div className="flex min-w-max items-start gap-3 pb-3">
        {skeletonCardCounts.map((cardCount, moduleIndex) => (
          <div
            key={moduleIndex}
            className="w-[min(78vw,16.5rem)] shrink-0 overflow-hidden rounded-lg border border-white/6 bg-[var(--module-surface)] sm:w-[16.5rem]"
          >
            <div className="border-b border-white/6 px-3.5 py-3">
              <div className="home-skeleton h-4 w-28 rounded" />
            </div>
            <div className="space-y-2.5 p-2.5">
              {Array.from({ length: cardCount }).map((_, cardIndex) => (
                <div
                  key={cardIndex}
                  className="rounded-lg border border-white/5 bg-[var(--card-olive)] px-3.5 py-3"
                >
                  <div className="home-skeleton h-4 w-4/5 rounded" />
                  <div className="home-skeleton mt-2 h-4 w-3/5 rounded" />
                  <div className="mt-4 flex items-center justify-between">
                    <div className="home-skeleton h-3 w-16 rounded" />
                    <div className="home-skeleton size-7 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

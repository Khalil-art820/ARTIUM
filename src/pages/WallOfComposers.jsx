import React from "react";
import { ChevronLeft } from "lucide-react";

// Twelve, curated rather than exhaustive — a wall that names names instead
// of trying to be a music history syllabus. Years and one line of legacy
// each, the same restraint the hub's card copy uses.
const COMPOSERS = [
  { name: "Johann Sebastian Bach", years: "1685 – 1750", legacy: "Counterpoint taken to its limit — the Baroque's structural mind." },
  { name: "Wolfgang Amadeus Mozart", years: "1756 – 1791", legacy: "Clarity and invention in equal measure, across every form he touched." },
  { name: "Ludwig van Beethoven", years: "1770 – 1827", legacy: "Bridged the Classical and Romantic eras by force of will." },
  { name: "Frédéric Chopin", years: "1810 – 1849", legacy: "Reinvented the piano as an intimate, singing instrument." },
  { name: "Franz Liszt", years: "1811 – 1886", legacy: "Virtuosity and showmanship that redefined what a pianist could be." },
  { name: "Johannes Brahms", years: "1833 – 1897", legacy: "Classical discipline carried into the Romantic era's full voice." },
  { name: "Pyotr Ilyich Tchaikovsky", years: "1840 – 1893", legacy: "Melody and orchestration in service of pure emotional weight." },
  { name: "Claude Debussy", years: "1862 – 1918", legacy: "Dissolved traditional harmony into colour and atmosphere." },
  { name: "Sergei Rachmaninoff", years: "1873 – 1943", legacy: "The last great Romantic — sweeping, virtuosic, unashamedly lyrical." },
  { name: "Maurice Ravel", years: "1875 – 1937", legacy: "Precision and orchestral colour, French clarity at its height." },
  { name: "Franz Schubert", years: "1797 – 1828", legacy: "Song elevated to the level of symphony — melody as architecture." },
  { name: "Robert Schumann", years: "1810 – 1856", legacy: "Poetic, literary Romanticism translated into sound." },
];

/**
 * A quieter page than the hub — no cards-as-buttons, just twelve names to
 * read. Same light material and serif/sans pairing as the rest of the
 * rebuilt gate, so leaving it doesn't feel like leaving Artium.
 */
export default function WallOfComposers({ onBack }) {
  // The app around this page is dark, and so is the body behind it. On iOS,
  // rubber-band overscroll shows the body — a black flash framing a white
  // editorial page. Own the body while mounted; put it back on the way out.
  React.useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#FFFFFF";
    return () => { document.body.style.backgroundColor = prev; };
  }, []);
  return (
    <div className="min-h-screen bg-white" style={{ colorScheme: "light" }}>
      <header className="flex items-center gap-4 px-6 py-6 md:px-12 md:py-8">
        <button
          onClick={onBack}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-gold transition-colors hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <ChevronLeft size={17} strokeWidth={2} />
        </button>
        <span className="flex items-center gap-2">
          <svg width="14" height="20" viewBox="0 0 28 40" aria-hidden="true">
            <path
              fillRule="evenodd" fill="#C49339"
              d="M14 0.9C6.82 0.9 1.4 6.28 1.4 13.2c0 3.35 1.3 6.36 3.2 9.36 1.6 2.53 3.63 5.02 5.53 7.62 1.35 1.85 2.6 3.72 3.28 5.98a.62.62 0 0 0 1.18 0c.68-2.26 1.93-4.13 3.28-5.98 1.9-2.6 3.93-5.09 5.53-7.62 1.9-3 3.2-6.01 3.2-9.36C26.6 6.28 21.18.9 14 .9zm0 7.68a5.04 5.04 0 1 0 0 10.08 5.04 5.04 0 0 0 0-10.08z"
            />
          </svg>
          <span className="text-[17px] leading-none text-gold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}>
            artium
          </span>
        </span>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-16 md:px-10">
        <div className="mb-12 text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-gold" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Legacy
          </p>
          <h1 className="mt-3 text-[36px] leading-tight text-ink md:text-[46px]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}>
            The Wall of Composers
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {COMPOSERS.map((c) => (
            <div
              key={c.name}
              className="rounded-[22px] border border-border bg-white px-6 py-6 shadow-[0_10px_28px_rgba(25,30,35,0.06)]"
              style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #FFFDF9 100%)" }}
            >
              <p className="text-[19px] leading-tight text-ink" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}>
                {c.name}
              </p>
              <p className="mt-1 text-[12px] tracking-wide text-gold" style={{ fontFamily: "'Manrope', sans-serif" }}>
                {c.years}
              </p>
              <span className="mt-3 block h-px w-8 bg-gold/50" aria-hidden="true" />
              <p className="mt-3 text-[13.5px] leading-relaxed text-muted" style={{ fontFamily: "'Manrope', sans-serif" }}>
                {c.legacy}
              </p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-14 max-w-md text-center text-[13px] italic text-muted" style={{ fontFamily: "'Manrope', sans-serif" }}>
          Portraits and stories are on their way — this wall is just being raised.
        </p>
      </main>
    </div>
  );
}

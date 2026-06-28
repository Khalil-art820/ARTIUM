export const C = {
  ink: "#14120F",
  inkSoft: "#1D1A15",
  inkLine: "rgba(244,238,219,0.14)",
  parchment: "#EFE6CD",
  parchmentDim: "#E3D7B0",
  parchmentLine: "rgba(31,28,22,0.14)",
  ivory: "#F4EEDB",
  ivoryDim: "rgba(244,238,219,0.62)",
  inkText: "#1F1C16",
  inkTextDim: "rgba(31,28,22,0.6)",
  brass: "#C9A24B",
  brassDim: "rgba(201,162,75,0.35)",
  burgundy: "#8A3636",
  forest: "#33503F",
};

export const FONT_DISPLAY = "'Fraunces', serif";
export const FONT_BODY = "'Inter', sans-serif";
export const FONT_MONO = "'JetBrains Mono', monospace";

export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

export const TASTE_OPTIONS = [
  "Bach", "Mozart", "Beethoven", "Schubert", "Chopin", "Schumann", "Brahms",
  "Liszt", "Debussy", "Ravel", "Rachmaninoff", "Scriabin", "Prokofiev",
  "Messiaen", "Baroque", "Classical Era", "Romantic Era", "Impressionism", "20th Century",
];

export const INSTRUMENT_OPTIONS = [
  "Piano", "Violin", "Viola", "Cello", "Double Bass", "Voice", "Flute", "Clarinet",
  "Oboe", "Bassoon", "Trumpet", "Horn", "Trombone", "Guitar", "Harp", "Percussion", "Organ", "Composition",
];

export const PALETTE = [C.burgundy, C.forest, "#3B4A6B", "#8A5A2B", "#5B3A66"];

export const CONSERVATORIES = [
  { id: "paris", name: "Conservatoire de Paris", short: "CNSMDP", city: "Paris", country: "France", x: 506, y: 105, founded: 1795, code: "FR-75" },
  { id: "vienna", name: "University of Music Vienna", short: "mdw", city: "Vienna", country: "Austria", x: 545, y: 107, founded: 1817, code: "AT-01" },
  { id: "moscow", name: "Moscow Tchaikovsky Conservatory", short: "MGK", city: "Moscow", country: "Russia", x: 604, y: 88, founded: 1866, code: "RU-77" },
  { id: "juilliard", name: "The Juilliard School", short: "Juilliard", city: "New York", country: "USA", x: 294, y: 126, founded: 1905, code: "US-NY" },
  { id: "curtis", name: "Curtis Institute of Music", short: "Curtis", city: "Philadelphia", country: "USA", x: 291, y: 128, founded: 1924, code: "US-PA" },
  { id: "rcm", name: "Royal College of Music", short: "RCM", city: "London", country: "UK", x: 500, y: 98, founded: 1882, code: "UK-LN" },
  { id: "shanghai", name: "Shanghai Conservatory of Music", short: "SHCM", city: "Shanghai", country: "China", x: 837, y: 150, founded: 1927, code: "CN-SH" },
  { id: "geidai", name: "Tokyo University of the Arts", short: "Geidai", city: "Tokyo", country: "Japan", x: 888, y: 139, founded: 1887, code: "JP-TK" },
  { id: "snu", name: "Seoul National University", short: "SNU", city: "Seoul", country: "South Korea", x: 853, y: 134, founded: 1946, code: "KR-SE" },
  { id: "eisler", name: "Hanns Eisler Berlin", short: "HfM", city: "Berlin", country: "Germany", x: 537, y: 96, founded: 1950, code: "DE-BE" },
  { id: "rcmt", name: "The Royal Conservatory", short: "TRC", city: "Toronto", country: "Canada", x: 279, y: 118, founded: 1886, code: "CA-ON" },
  { id: "sydney", name: "Sydney Conservatorium", short: "SCM", city: "Sydney", country: "Australia", x: 920, y: 316, founded: 1915, code: "AU-SY" },
  { id: "milan", name: "Milan Conservatory 'Giuseppe Verdi'", short: "Cons. Verdi", city: "Milan", country: "Italy", x: 525, y: 113, founded: 1807, code: "IT-MI" },
  { id: "hague", name: "Royal Conservatoire The Hague", short: "KC Den Haag", city: "The Hague", country: "Netherlands", x: 512, y: 97, founded: 1826, code: "NL-ZH" },
  { id: "geneva", name: "Haute École de Musique de Genève", short: "HEM Genève", city: "Geneva", country: "Switzerland", x: 517, y: 112, founded: 1835, code: "CH-GE" },
  { id: "helsinki", name: "Sibelius Academy", short: "Sibelius", city: "Helsinki", country: "Finland", x: 569, y: 77, founded: 1882, code: "FI-HE" },
  { id: "stpetersburg", name: "St Petersburg Conservatory", short: "SPb Cons.", city: "St Petersburg", country: "Russia", x: 584, y: 78, founded: 1862, code: "RU-78" },
  { id: "singapore", name: "Yong Siew Toh Conservatory", short: "YST", city: "Singapore", country: "Singapore", x: 788, y: 222, founded: 2001, code: "SG-01" },
  { id: "nec", name: "New England Conservatory", short: "NEC", city: "Boston", country: "USA", x: 302, y: 121, founded: 1867, code: "US-MA" },
  { id: "peabody", name: "Peabody Institute", short: "Peabody", city: "Baltimore", country: "USA", x: 288, y: 129, founded: 1857, code: "US-MD" },
  { id: "saopaulo", name: "Escola de Música da USP", short: "USP Música", city: "São Paulo", country: "Brazil", x: 370, y: 283, founded: 1938, code: "BR-SP" },
  { id: "capetown", name: "South African College of Music", short: "SACM", city: "Cape Town", country: "South Africa", x: 551, y: 309, founded: 1910, code: "ZA-WC" },
];

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
  "Oboe", "Bassoon", "Trumpet", "Horn", "Trombone", "Guitar", "Harp", "Percussion", "Organ", "Cimbalom",
];

export const PALETTE = [C.burgundy, C.forest, "#3B4A6B", "#8A5A2B", "#5B3A66"];

export const CONSERVATORIES = [
  { id: "paris", name: "Conservatoire de Paris", short: "CNSMDP", city: "Paris", country: "France", x: 506.0, y: 105.0, lat: 48.8566, lng: 2.3522, founded: 1795, code: "FR-75" },
  { id: "vienna", name: "University of Music Vienna", short: "mdw", city: "Vienna", country: "Austria", x: 545.0, y: 106.6, lat: 48.2082, lng: 16.3738, founded: 1817, code: "AT-01" },
  { id: "moscow", name: "Moscow Tchaikovsky Conservatory", short: "MGK", city: "Moscow", country: "Russia", x: 604.1, y: 88.0, lat: 55.7558, lng: 37.6173, founded: 1866, code: "RU-77" },
  { id: "juilliard", name: "The Juilliard School", short: "Juilliard", city: "New York", country: "USA", x: 293.8, y: 125.1, lat: 40.7128, lng: -74.0060, founded: 1905, code: "US-NY" },
  { id: "curtis", name: "Curtis Institute of Music", short: "Curtis", city: "Philadelphia", country: "USA", x: 290.5, y: 127.0, lat: 39.9526, lng: -75.1652, founded: 1924, code: "US-PA" },
  { id: "rcm", name: "Royal College of Music", short: "RCM", city: "London", country: "UK", x: 499.1, y: 98.5, lat: 51.5074, lng: -0.1278, founded: 1882, code: "UK-LN" },
  { id: "shanghai", name: "Shanghai Conservatory of Music", short: "SHCM", city: "Shanghai", country: "China", x: 837.2, y: 148.4, lat: 31.2304, lng: 121.4737, founded: 1927, code: "CN-SH" },
  { id: "geidai", name: "Tokyo University of the Arts", short: "Geidai", city: "Tokyo", country: "Japan", x: 887.7, y: 137.5, lat: 35.6762, lng: 139.6503, founded: 1887, code: "JP-TK" },
  { id: "snu", name: "Seoul National University", short: "SNU", city: "Seoul", country: "South Korea", x: 852.5, y: 132.8, lat: 37.5665, lng: 126.9780, founded: 1946, code: "KR-SE" },
  { id: "eisler", name: "Hanns Eisler Berlin", short: "HfM", city: "Berlin", country: "Germany", x: 536.8, y: 96.0, lat: 52.5200, lng: 13.4050, founded: 1950, code: "DE-BE" },
  { id: "rcmt", name: "The Royal Conservatory", short: "TRC", city: "Toronto", country: "Canada", x: 278.8, y: 117.8, lat: 43.6532, lng: -79.3832, founded: 1886, code: "CA-ON" },
  { id: "sydney", name: "Sydney Conservatorium", short: "SCM", city: "Sydney", country: "Australia", x: 919.9, y: 308.9, lat: -33.8688, lng: 151.2093, founded: 1915, code: "AU-SY" },
  { id: "milan", name: "Milan Conservatory 'Giuseppe Verdi'", short: "Cons. Verdi", city: "Milan", country: "Italy", x: 525.0, y: 113.4, lat: 45.4642, lng: 9.1900, founded: 1807, code: "IT-MI" },
  { id: "hague", name: "Royal Conservatoire The Hague", short: "KC Den Haag", city: "The Hague", country: "Netherlands", x: 511.5, y: 97.1, lat: 52.0705, lng: 4.3007, founded: 1826, code: "NL-ZH" },
  { id: "geneva", name: "Haute École de Musique de Genève", short: "HEM Genève", city: "Geneva", country: "Switzerland", x: 516.6, y: 111.6, lat: 46.2044, lng: 6.1432, founded: 1835, code: "CH-GE" },
  { id: "helsinki", name: "Sibelius Academy", short: "Sibelius", city: "Helsinki", country: "Finland", x: 568.8, y: 77.1, lat: 60.1699, lng: 24.9384, founded: 1882, code: "FI-HE" },
  { id: "stpetersburg", name: "St Petersburg Conservatory", short: "SPb Cons.", city: "St Petersburg", country: "Russia", x: 583.9, y: 77.7, lat: 59.9311, lng: 30.3609, founded: 1862, code: "RU-78" },
  { id: "singapore", name: "Yong Siew Toh Conservatory", short: "YST", city: "Singapore", country: "Singapore", x: 788.1, y: 222.1, lat: 1.3521, lng: 103.8198, founded: 2001, code: "SG-01" },
  { id: "nec", name: "New England Conservatory", short: "NEC", city: "Boston", country: "USA", x: 302.0, y: 121.0, lat: 42.3601, lng: -71.0589, founded: 1867, code: "US-MA" },
  { id: "peabody", name: "Peabody Institute", short: "Peabody", city: "Baltimore", country: "USA", x: 286.5, y: 128.6, lat: 39.2904, lng: -76.6122, founded: 1857, code: "US-MD" },
  { id: "saopaulo", name: "Escola de Música da USP", short: "USP Música", city: "São Paulo", country: "Brazil", x: 369.9, y: 283.4, lat: -23.5505, lng: -46.6333, founded: 1938, code: "BR-SP" },
  { id: "capetown", name: "South African College of Music", short: "SACM", city: "Cape Town", country: "South Africa", x: 550.7, y: 309.0, lat: -33.9249, lng: 18.4241, founded: 1910, code: "ZA-WC" },
];

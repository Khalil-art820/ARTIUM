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

  // UK
  { id: "ram", name: "Royal Academy of Music", short: "RAM", city: "London", country: "UK", x: 499.7, y: 98.3, lat: 51.5236, lng: -0.1535, founded: 1822, code: "UK-LN" },
  { id: "guildhall", name: "Guildhall School of Music & Drama", short: "GSMD", city: "London", country: "UK", x: 500.1, y: 98.6, lat: 51.5197, lng: -0.0969, founded: 1880, code: "UK-LN" },
  { id: "rncm", name: "Royal Northern College of Music", short: "RNCM", city: "Manchester", country: "UK", x: 494.0, y: 93.4, lat: 53.4808, lng: -2.2426, founded: 1973, code: "UK-MN" },
  { id: "rcs", name: "Royal Conservatoire of Scotland", short: "RCS", city: "Glasgow", country: "UK", x: 488.4, y: 87.3, lat: 55.8642, lng: -4.2518, founded: 1890, code: "UK-SC" },
  { id: "trinitylaban", name: "Trinity Laban Conservatoire", short: "TLM", city: "London", country: "UK", x: 500.5, y: 98.7, lat: 51.4844, lng: -0.0147, founded: 2005, code: "UK-LN" },

  // Germany & Austria
  { id: "mozarteum", name: "Mozarteum University Salzburg", short: "Mozarteum", city: "Salzburg", country: "Austria", x: 536.5, y: 107.8, lat: 47.8095, lng: 13.0550, founded: 1841, code: "AT-SA" },
  { id: "hfmm", name: "Hochschule für Musik München", short: "HfM München", city: "Munich", country: "Germany", x: 532.4, y: 107.0, lat: 48.1351, lng: 11.5820, founded: 1846, code: "DE-BY" },
  { id: "hfmh", name: "Hochschule für Musik und Theater Hamburg", short: "HfMT Hamburg", city: "Hamburg", country: "Germany", x: 527.9, y: 93.1, lat: 53.5753, lng: 9.9932, founded: 1950, code: "DE-HH" },
  { id: "hfmk", name: "Hochschule für Musik und Tanz Köln", short: "HfMT Köln", city: "Cologne", country: "Germany", x: 519.5, y: 99.9, lat: 50.9333, lng: 6.9500, founded: 1925, code: "DE-NW" },
  { id: "weimar", name: "Hochschule für Musik Franz Liszt Weimar", short: "HfM Weimar", city: "Weimar", country: "Germany", x: 531.7, y: 99.8, lat: 50.9795, lng: 11.3236, founded: 1872, code: "DE-TH" },

  // Central & Eastern Europe
  { id: "liszt", name: "Franz Liszt Academy of Music", short: "Liszt Academy", city: "Budapest", country: "Hungary", x: 553.1, y: 108.6, lat: 47.4979, lng: 19.0402, founded: 1875, code: "HU-BP" },
  { id: "chopin", name: "Chopin University of Music", short: "UMFC", city: "Warsaw", country: "Poland", x: 558.6, y: 96.6, lat: 52.2297, lng: 21.0122, founded: 1810, code: "PL-WA" },
  { id: "prague", name: "Prague Conservatory", short: "Prague Cons.", city: "Prague", country: "Czech Republic", x: 540.4, y: 102.1, lat: 50.0755, lng: 14.4378, founded: 1808, code: "CZ-PR" },

  // Southern Europe
  { id: "santacecilia", name: "Conservatorio Santa Cecilia", short: "Cons. S. Cecilia", city: "Rome", country: "Italy", x: 534.9, y: 123.0, lat: 41.9028, lng: 12.4964, founded: 1876, code: "IT-RM" },
  { id: "cherubini", name: "Conservatorio Cherubini", short: "Cons. Cherubini", city: "Florence", country: "Italy", x: 531.5, y: 118.2, lat: 43.7696, lng: 11.2558, founded: 1849, code: "IT-FI" },
  { id: "madrid", name: "Real Conservatorio Superior de Música de Madrid", short: "RCSMM", city: "Madrid", country: "Spain", x: 489.9, y: 126.8, lat: 40.4168, lng: -3.7038, founded: 1830, code: "ES-MA" },
  { id: "lisbon", name: "Conservatório Nacional de Lisboa", short: "CN Lisboa", city: "Lisbon", country: "Portugal", x: 474.9, y: 131.1, lat: 38.7223, lng: -9.1393, founded: 1835, code: "PT-LI" },
  { id: "porto", name: "Conservatório de Música do Porto", short: "Cons. Porto", city: "Porto", country: "Portugal", x: 476.3, y: 124.9, lat: 41.1579, lng: -8.6291, founded: 1917, code: "PT-PO" },

  // Western & Northern Europe
  { id: "brussels", name: "Conservatoire Royal de Bruxelles", short: "KCB", city: "Brussels", country: "Belgium", x: 512.2, y: 100.1, lat: 50.8503, lng: 4.3517, founded: 1813, code: "BE-BR" },
  { id: "copenhagen", name: "Royal Danish Academy of Music", short: "DKDM", city: "Copenhagen", country: "Denmark", x: 535.2, y: 87.7, lat: 55.6761, lng: 12.5683, founded: 1867, code: "DK-CO" },
  { id: "oslo", name: "Norwegian Academy of Music", short: "NMH", city: "Oslo", country: "Norway", x: 530.0, y: 76.9, lat: 59.9139, lng: 10.7522, founded: 1973, code: "NO-OS" },
  { id: "stockholm", name: "Royal College of Music Stockholm", short: "KMH", city: "Stockholm", country: "Sweden", x: 550.4, y: 78.4, lat: 59.3293, lng: 18.0686, founded: 1771, code: "SE-ST" },
  { id: "lyon", name: "Conservatoire National Supérieur de Lyon", short: "CNSMD Lyon", city: "Lyon", country: "France", x: 513.6, y: 113.1, lat: 45.7640, lng: 4.8357, founded: 1980, code: "FR-LY" },

  // USA (additional)
  { id: "manhattan", name: "Manhattan School of Music", short: "MSM", city: "New York", country: "USA", x: 294.6, y: 125.7, lat: 40.8176, lng: -73.9582, founded: 1917, code: "US-NY" },
  { id: "eastman", name: "Eastman School of Music", short: "Eastman", city: "Rochester", country: "USA", x: 284.5, y: 119.8, lat: 43.1566, lng: -77.6088, founded: 1921, code: "US-NY" },
  { id: "sfcm", name: "San Francisco Conservatory of Music", short: "SFCM", city: "San Francisco", country: "USA", x: 159.9, y: 133.5, lat: 37.7749, lng: -122.4194, founded: 1917, code: "US-CA" },
  { id: "oberlin", name: "Oberlin Conservatory of Music", short: "Oberlin", city: "Oberlin", country: "USA", x: 271.8, y: 124.5, lat: 41.2933, lng: -82.2170, founded: 1865, code: "US-OH" },
  { id: "yale", name: "Yale School of Music", short: "Yale SOM", city: "New Haven", country: "USA", x: 297.5, y: 124.5, lat: 41.3083, lng: -72.9279, founded: 1894, code: "US-CT" },
  { id: "indiana", name: "Indiana University Jacobs School of Music", short: "IU Jacobs", city: "Bloomington", country: "USA", x: 259.7, y: 130.0, lat: 39.1653, lng: -86.5264, founded: 1921, code: "US-IN" },
  { id: "berklee", name: "Berklee College of Music", short: "Berklee", city: "Boston", country: "USA", x: 302.6, y: 121.8, lat: 42.3467, lng: -71.0865, founded: 1945, code: "US-MA" },
  { id: "cim", name: "Cleveland Institute of Music", short: "CIM", city: "Cleveland", country: "USA", x: 273.4, y: 123.9, lat: 41.5100, lng: -81.6089, founded: 1920, code: "US-OH" },
  { id: "usc", name: "USC Thornton School of Music", short: "USC Thornton", city: "Los Angeles", country: "USA", x: 171.4, y: 143.1, lat: 34.0224, lng: -118.2851, founded: 1884, code: "US-CA" },

  // Asia (additional)
  { id: "ccom", name: "Central Conservatory of Music", short: "CCOM", city: "Beijing", country: "China", x: 823.6, y: 128.1, lat: 39.9042, lng: 116.4074, founded: 1950, code: "CN-BJ" },
  { id: "sichuan", name: "Sichuan Conservatory of Music", short: "SCCOM", city: "Chengdu", country: "China", x: 789.3, y: 151.9, lat: 30.5728, lng: 104.0668, founded: 1939, code: "CN-SC" },
  { id: "osaka", name: "Osaka College of Music", short: "OCM", city: "Osaka", country: "Japan", x: 869.8, y: 141.1, lat: 34.6937, lng: 135.5023, founded: 1915, code: "JP-OS" },
  { id: "kunitachi", name: "Kunitachi College of Music", short: "Kunitachi", city: "Tokyo", country: "Japan", x: 887.6, y: 138.8, lat: 35.6812, lng: 139.4793, founded: 1926, code: "JP-TK" },
  { id: "knua", name: "Korea National University of Arts", short: "K-Arts", city: "Seoul", country: "South Korea", x: 853.3, y: 134.3, lat: 37.4673, lng: 127.0471, founded: 1993, code: "KR-SE" },
  { id: "tnua", name: "Taipei National University of the Arts", short: "TNUA", city: "Taipei", country: "Taiwan", x: 837.3, y: 152.9, lat: 25.1224, lng: 121.4493, founded: 1982, code: "TW-TP" },

  // Middle East & Africa
  { id: "jerusalem", name: "Jerusalem Academy of Music and Dance", short: "JAMD", city: "Jerusalem", country: "Israel", x: 598.1, y: 148.9, lat: 31.7767, lng: 35.2345, founded: 1933, code: "IL-JR" },
  { id: "cairo", name: "Cairo Conservatory of Music", short: "Cairo Cons.", city: "Cairo", country: "Egypt", x: 587.2, y: 153.2, lat: 30.0626, lng: 31.2497, founded: 1959, code: "EG-CA" },
  { id: "stellenbosch", name: "Stellenbosch University Conservatory", short: "SU Cons.", city: "Stellenbosch", country: "South Africa", x: 553.3, y: 314.7, lat: -33.9321, lng: 18.8602, founded: 1905, code: "ZA-ST" },
];

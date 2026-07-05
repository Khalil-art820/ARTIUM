import React, { useState, useEffect, useRef } from "react";
import {
  Search, Send,
  ChevronRight, Check, X, Instagram, Facebook,
  Music2, Users, MessageCircle, ArrowRight, ArrowLeft, Play, Pause, Globe2,
  Volume1, Volume2, VolumeX,
  Pencil, Plus, Trash2, Home, Upload, Eye, EyeOff, ChevronLeft,
} from "lucide-react";
import AMBIENT_AUDIO_SRC from "./assets/ambient.mp3";
import { useAuth } from "./contexts/AuthContext";
import { supabase } from "./lib/supabase";
import { toDbProfile, fromDbProfile } from "./lib/profiles";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

/* ---------------------------------------------------------------- */
/* THEME                                                              */
/* ---------------------------------------------------------------- */
const C = {
  ink: "#FFFFFF",
  inkSoft: "#F6F9FC",
  inkLine: "#E6EBF1",
  parchment: "#FFFFFF",
  parchmentDim: "#F6F9FC",
  parchmentLine: "#E6EBF1",
  ivory: "#0A2540",
  ivoryDim: "#425466",
  inkText: "#0A2540",
  inkTextDim: "#425466",
  brass: "#635BFF",
  brassDim: "rgba(99,91,255,0.10)",
  burgundy: "#DF1B41",
  forest: "#1A9E6E",
};

const FONT_DISPLAY = "'Inter', sans-serif";
const FONT_BODY = "'Inter', sans-serif";
const FONT_MONO = "'ui-monospace', monospace";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

/* ---------------------------------------------------------------- */
/* BACKGROUND MUSIC (original synthesized ambient track)              */
/* ---------------------------------------------------------------- */

/* ---------------------------------------------------------------- */
/* DATA                                                                */
/* ---------------------------------------------------------------- */
const CONSERVATORIES = [
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
  // USA (more)
  { id: "northwestern", name: "Northwestern University Bienen School of Music", short: "Northwestern", city: "Evanston", country: "USA", x: 257.5, y: 122.8, lat: 42.0565, lng: -87.6753, founded: 1895, code: "US-IL" },
  { id: "rice", name: "Rice University Shepherd School of Music", short: "Rice Shepherd", city: "Houston", country: "USA", x: 231.0, y: 155.5, lat: 29.7175, lng: -95.4024, founded: 1974, code: "US-TX" },
  { id: "michigan", name: "University of Michigan School of Music", short: "U-M Music", city: "Ann Arbor", country: "USA", x: 266.0, y: 122.0, lat: 42.2808, lng: -83.7430, founded: 1880, code: "US-MI" },
  { id: "ucla", name: "UCLA Herb Alpert School of Music", short: "UCLA Music", city: "Los Angeles", country: "USA", x: 170.2, y: 143.8, lat: 34.0709, lng: -118.4439, founded: 1960, code: "US-CA" },
  { id: "cincinnati", name: "University of Cincinnati College-Conservatory of Music", short: "CCM", city: "Cincinnati", country: "USA", x: 268.0, y: 128.5, lat: 39.1329, lng: -84.5150, founded: 1867, code: "US-OH" },
  { id: "boston-univ", name: "Boston University College of Fine Arts — Music", short: "BU Music", city: "Boston", country: "USA", x: 302.2, y: 121.5, lat: 42.3505, lng: -71.1054, founded: 1872, code: "US-MA" },
  { id: "carnegie-mellon", name: "Carnegie Mellon University School of Music", short: "CMU Music", city: "Pittsburgh", country: "USA", x: 279.5, y: 126.0, lat: 40.4433, lng: -79.9436, founded: 1912, code: "US-PA" },
  { id: "manhattan-school", name: "Aaron Copland School of Music — Queens College", short: "Copland School", city: "Queens", country: "USA", x: 294.0, y: 125.9, lat: 40.7366, lng: -73.8200, founded: 1937, code: "US-NY" },
  { id: "new-school", name: "The New School — College of Performing Arts", short: "New School", city: "New York", country: "USA", x: 294.3, y: 125.5, lat: 40.7353, lng: -74.0027, founded: 1919, code: "US-NY" },
  { id: "texas", name: "Butler School of Music — UT Austin", short: "UT Austin Music", city: "Austin", country: "USA", x: 224.8, y: 158.0, lat: 30.2849, lng: -97.7341, founded: 1938, code: "US-TX" },
  { id: "florida", name: "University of Florida School of Music", short: "UF Music", city: "Gainesville", country: "USA", x: 261.8, y: 163.5, lat: 29.6516, lng: -82.3248, founded: 1906, code: "US-FL" },
  { id: "north-carolina", name: "UNC School of the Arts — School of Music", short: "UNCSA Music", city: "Winston-Salem", country: "USA", x: 277.0, y: 140.8, lat: 36.0999, lng: -80.2442, founded: 1963, code: "US-NC" },
  { id: "minnesota", name: "University of Minnesota School of Music", short: "UMN Music", city: "Minneapolis", country: "USA", x: 240.5, y: 110.5, lat: 44.9742, lng: -93.2277, founded: 1902, code: "US-MN" },
  { id: "arizona", name: "Arizona State University School of Music", short: "ASU Music", city: "Tempe", country: "USA", x: 185.8, y: 148.0, lat: 33.4255, lng: -111.9400, founded: 1885, code: "US-AZ" },
  { id: "colorado", name: "University of Colorado Boulder College of Music", short: "CU Boulder Music", city: "Boulder", country: "USA", x: 200.0, y: 130.0, lat: 40.0150, lng: -105.2705, founded: 1920, code: "US-CO" },
  { id: "miami", name: "Frost School of Music — University of Miami", short: "Frost School", city: "Coral Gables", country: "USA", x: 263.5, y: 170.0, lat: 25.7209, lng: -80.2784, founded: 1926, code: "US-FL" },
  { id: "vanderbilt", name: "Blair School of Music — Vanderbilt University", short: "Blair School", city: "Nashville", country: "USA", x: 258.5, y: 140.0, lat: 36.1474, lng: -86.8028, founded: 1964, code: "US-TN" },
  { id: "temple", name: "Boyer College of Music and Dance — Temple University", short: "Boyer College", city: "Philadelphia", country: "USA", x: 290.8, y: 127.3, lat: 39.9814, lng: -75.1548, founded: 1962, code: "US-PA" },
  { id: "michigan-state", name: "Michigan State University College of Music", short: "MSU Music", city: "East Lansing", country: "USA", x: 264.8, y: 120.0, lat: 42.7284, lng: -84.4822, founded: 1870, code: "US-MI" },
  { id: "penn-state", name: "Penn State School of Music", short: "Penn State Music", city: "University Park", country: "USA", x: 284.0, y: 124.5, lat: 40.7982, lng: -77.8599, founded: 1929, code: "US-PA" },
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

  // USA (further)
  { id: "illinois", name: "University of Illinois School of Music", short: "UIUC Music", city: "Urbana-Champaign", country: "USA", x: 255.0, y: 127.0, lat: 40.1020, lng: -88.2272, founded: 1895, code: "US-IL" },
  { id: "umd", name: "University of Maryland School of Music", short: "UMD Music", city: "College Park", country: "USA", x: 287.5, y: 130.0, lat: 38.9897, lng: -76.9378, founded: 1960, code: "US-MD" },
  { id: "duke", name: "Duke University Department of Music", short: "Duke Music", city: "Durham", country: "USA", x: 278.0, y: 140.5, lat: 36.0014, lng: -78.9382, founded: 1924, code: "US-NC" },
  { id: "usc-upstate", name: "University of South Carolina School of Music", short: "USC Music", city: "Columbia", country: "USA", x: 272.0, y: 147.0, lat: 33.9969, lng: -81.0298, founded: 1895, code: "US-SC" },
  { id: "pittsburgh", name: "University of Pittsburgh Music Department", short: "Pitt Music", city: "Pittsburgh", country: "USA", x: 279.8, y: 126.5, lat: 40.4443, lng: -79.9601, founded: 1927, code: "US-PA" },
  { id: "louisiana", name: "LSU School of Music", short: "LSU Music", city: "Baton Rouge", country: "USA", x: 242.0, y: 163.0, lat: 30.4133, lng: -91.1800, founded: 1932, code: "US-LA" },
  { id: "oklahoma", name: "University of Oklahoma School of Music", short: "OU Music", city: "Norman", country: "USA", x: 217.5, y: 148.5, lat: 35.2059, lng: -97.4454, founded: 1899, code: "US-OK" },
  { id: "kansas", name: "University of Kansas Murphy Hall — Music", short: "KU Music", city: "Lawrence", country: "USA", x: 230.0, y: 135.0, lat: 38.9543, lng: -95.2558, founded: 1876, code: "US-KS" },
  { id: "iowa", name: "University of Iowa School of Music", short: "UI Music", city: "Iowa City", country: "USA", x: 244.5, y: 122.5, lat: 41.6611, lng: -91.5302, founded: 1855, code: "US-IA" },
  { id: "ohio-state", name: "Ohio State University School of Music", short: "OSU Music", city: "Columbus", country: "USA", x: 270.0, y: 127.0, lat: 40.0003, lng: -83.0153, founded: 1878, code: "US-OH" },
  { id: "byu", name: "Brigham Young University School of Music", short: "BYU Music", city: "Provo", country: "USA", x: 196.0, y: 132.5, lat: 40.2338, lng: -111.6585, founded: 1875, code: "US-UT" },
  { id: "utah", name: "University of Utah School of Music", short: "Utah Music", city: "Salt Lake City", country: "USA", x: 193.5, y: 130.5, lat: 40.7649, lng: -111.8421, founded: 1900, code: "US-UT" },
  { id: "new-mexico", name: "University of New Mexico Department of Music", short: "UNM Music", city: "Albuquerque", country: "USA", x: 197.5, y: 148.0, lat: 35.0844, lng: -106.6504, founded: 1889, code: "US-NM" },
  { id: "georgia", name: "University of Georgia Hugh Hodgson School of Music", short: "UGA Music", city: "Athens", country: "USA", x: 264.0, y: 150.0, lat: 33.9481, lng: -83.3781, founded: 1884, code: "US-GA" },
  { id: "kentucky", name: "University of Kentucky School of Music", short: "UK Music", city: "Lexington", country: "USA", x: 266.0, y: 135.5, lat: 38.0406, lng: -84.5037, founded: 1917, code: "US-KY" },
  { id: "oregon", name: "University of Oregon School of Music", short: "UO Music", city: "Eugene", country: "USA", x: 155.5, y: 115.0, lat: 44.0521, lng: -123.0868, founded: 1886, code: "US-OR" },
  { id: "washington", name: "University of Washington School of Music", short: "UW Music", city: "Seattle", country: "USA", x: 157.5, y: 107.0, lat: 47.6553, lng: -122.3035, founded: 1897, code: "US-WA" },
  { id: "stanford", name: "Stanford University Center for Computer Research in Music", short: "Stanford Music", city: "Stanford", country: "USA", x: 159.0, y: 134.0, lat: 37.4275, lng: -122.1697, founded: 1947, code: "US-CA" },
  { id: "mannes", name: "Mannes School of Music — The New School", short: "Mannes", city: "New York", country: "USA", x: 294.1, y: 125.4, lat: 40.7308, lng: -73.9975, founded: 1916, code: "US-NY" },
  { id: "hartt", name: "Hartt School — University of Hartford", short: "Hartt School", city: "West Hartford", country: "USA", x: 298.5, y: 123.0, lat: 41.7658, lng: -72.7441, founded: 1920, code: "US-CT" },
  { id: "depaul", name: "DePaul University School of Music", short: "DePaul Music", city: "Chicago", country: "USA", x: 257.0, y: 123.5, lat: 41.9241, lng: -87.6547, founded: 1898, code: "US-IL" },
  { id: "purdue", name: "Purdue University School of Music", short: "Purdue Music", city: "West Lafayette", country: "USA", x: 261.0, y: 126.0, lat: 40.4259, lng: -86.9081, founded: 1874, code: "US-IN" },
  { id: "arizona-univ", name: "University of Arizona Fred Fox School of Music", short: "UA Music", city: "Tucson", country: "USA", x: 188.0, y: 153.5, lat: 32.2319, lng: -110.9501, founded: 1891, code: "US-AZ" },
  { id: "san-diego", name: "UC San Diego Department of Music", short: "UCSD Music", city: "San Diego", country: "USA", x: 172.5, y: 150.5, lat: 32.8801, lng: -117.2340, founded: 1967, code: "US-CA" },

  // Canada
  { id: "mcgill", name: "McGill Schulich School of Music", short: "McGill Music", city: "Montreal", country: "Canada", x: 290.5, y: 114.0, lat: 45.5017, lng: -73.5673, founded: 1904, code: "CA-QC" },
  { id: "ubc", name: "UBC School of Music", short: "UBC Music", city: "Vancouver", country: "Canada", x: 158.5, y: 106.0, lat: 49.2827, lng: -123.1207, founded: 1946, code: "CA-BC" },
  { id: "toronto", name: "University of Toronto Faculty of Music", short: "U of T Music", city: "Toronto", country: "Canada", x: 278.5, y: 118.0, lat: 43.6629, lng: -79.3957, founded: 1918, code: "CA-ON" },
  { id: "victoria", name: "University of Victoria School of Music", short: "UVic Music", city: "Victoria", country: "Canada", x: 156.5, y: 107.5, lat: 48.4634, lng: -123.3117, founded: 1963, code: "CA-BC" },
  { id: "laval", name: "Université Laval École de musique", short: "Laval Music", city: "Quebec City", country: "Canada", x: 293.5, y: 112.0, lat: 46.7800, lng: -71.2750, founded: 1937, code: "CA-QC" },

  // UK (further)
  { id: "birmingham", name: "Birmingham Conservatoire", short: "BCU Cons.", city: "Birmingham", country: "UK", x: 496.0, y: 95.5, lat: 52.4862, lng: -1.8904, founded: 1886, code: "UK-BM" },
  { id: "leeds", name: "Royal Birmingham Conservatoire — Leeds Campus", short: "Leeds Music", city: "Leeds", country: "UK", x: 495.5, y: 92.0, lat: 53.8008, lng: -1.5491, founded: 1818, code: "UK-LD" },
  { id: "cardiff", name: "Royal Welsh College of Music & Drama", short: "RWCMD", city: "Cardiff", country: "UK", x: 489.5, y: 97.5, lat: 51.4816, lng: -3.1791, founded: 1949, code: "UK-WL" },
  { id: "wells", name: "Wells Cathedral School", short: "Wells", city: "Wells", country: "UK", x: 490.5, y: 98.8, lat: 51.2094, lng: -2.6434, founded: 909, code: "UK-SM" },
  { id: "guildhall-london", name: "Junior Guildhall School", short: "Junior GSMD", city: "London", country: "UK", x: 500.3, y: 98.5, lat: 51.5210, lng: -0.0950, founded: 1977, code: "UK-LN" },

  // Germany (further)
  { id: "frankfurt", name: "Hochschule für Musik und Darstellende Kunst Frankfurt", short: "HfMDK Frankfurt", city: "Frankfurt", country: "Germany", x: 524.5, y: 100.5, lat: 50.1109, lng: 8.6821, founded: 1878, code: "DE-HE" },
  { id: "freiburg", name: "Hochschule für Musik Freiburg", short: "HfM Freiburg", city: "Freiburg", country: "Germany", x: 519.5, y: 107.5, lat: 47.9990, lng: 7.8421, founded: 1946, code: "DE-BW" },
  { id: "hannover", name: "Hochschule für Musik, Theater und Medien Hannover", short: "HMTM Hannover", city: "Hannover", country: "Germany", x: 527.0, y: 95.5, lat: 52.3759, lng: 9.7320, founded: 1897, code: "DE-NI" },
  { id: "stuttgart", name: "Hochschule für Musik und Darstellende Kunst Stuttgart", short: "HfMDK Stuttgart", city: "Stuttgart", country: "Germany", x: 525.0, y: 103.0, lat: 48.7758, lng: 9.1829, founded: 1857, code: "DE-BW" },
  { id: "leipzig", name: "Hochschule für Musik und Theater Leipzig", short: "HMT Leipzig", city: "Leipzig", country: "Germany", x: 534.0, y: 97.5, lat: 51.3397, lng: 12.3731, founded: 1843, code: "DE-SN" },
  { id: "dresden", name: "Hochschule für Musik Carl Maria von Weber Dresden", short: "HfM Dresden", city: "Dresden", country: "Germany", x: 538.0, y: 98.5, lat: 51.0504, lng: 13.7373, founded: 1856, code: "DE-SN" },
  { id: "saarbrucken", name: "Hochschule für Musik Saar", short: "HfM Saar", city: "Saarbrücken", country: "Germany", x: 518.0, y: 103.5, lat: 49.2354, lng: 7.0042, founded: 1947, code: "DE-SL" },
  { id: "nuremberg", name: "Hochschule für Musik Nürnberg", short: "HfM Nürnberg", city: "Nuremberg", country: "Germany", x: 531.0, y: 103.5, lat: 49.4521, lng: 11.0767, founded: 1804, code: "DE-BY" },
  { id: "rostock", name: "Hochschule für Musik und Theater Rostock", short: "HMT Rostock", city: "Rostock", country: "Germany", x: 535.0, y: 90.0, lat: 54.0887, lng: 12.1403, founded: 1994, code: "DE-MV" },
  { id: "lubeck", name: "Musikhochschule Lübeck", short: "MHL", city: "Lübeck", country: "Germany", x: 530.5, y: 90.5, lat: 53.8655, lng: 10.6866, founded: 1911, code: "DE-SH" },

  // France (further)
  { id: "strasbourg", name: "Conservatoire de Strasbourg", short: "Cons. Strasbourg", city: "Strasbourg", country: "France", x: 520.0, y: 105.5, lat: 48.5734, lng: 7.7521, founded: 1855, code: "FR-67" },
  { id: "bordeaux", name: "Conservatoire de Bordeaux", short: "Cons. Bordeaux", city: "Bordeaux", country: "France", x: 503.5, y: 118.5, lat: 44.8378, lng: -0.5792, founded: 1815, code: "FR-33" },
  { id: "nice", name: "Conservatoire de Nice", short: "Cons. Nice", city: "Nice", country: "France", x: 522.0, y: 117.0, lat: 43.7102, lng: 7.2620, founded: 1877, code: "FR-06" },
  { id: "toulouse", name: "Conservatoire de Toulouse", short: "Cons. Toulouse", city: "Toulouse", country: "France", x: 506.5, y: 121.5, lat: 43.6047, lng: 1.4442, founded: 1816, code: "FR-31" },

  // Italy (further)
  { id: "napoli", name: "Conservatorio San Pietro a Majella", short: "Cons. Napoli", city: "Naples", country: "Italy", x: 540.5, y: 127.0, lat: 40.8518, lng: 14.2681, founded: 1537, code: "IT-NA" },
  { id: "venezia", name: "Conservatorio Benedetto Marcello", short: "Cons. Venezia", city: "Venice", country: "Italy", x: 533.0, y: 113.0, lat: 45.4408, lng: 12.3155, founded: 1876, code: "IT-VE" },
  { id: "torino", name: "Conservatorio Giuseppe Verdi Torino", short: "Cons. Torino", city: "Turin", country: "Italy", x: 519.0, y: 114.5, lat: 45.0703, lng: 7.6869, founded: 1866, code: "IT-TO" },
  { id: "genova", name: "Conservatorio Niccolò Paganini", short: "Cons. Genova", city: "Genoa", country: "Italy", x: 523.0, y: 117.0, lat: 44.4056, lng: 8.9463, founded: 1829, code: "IT-GE" },
  { id: "bologna", name: "Conservatorio G.B. Martini Bologna", short: "Cons. Bologna", city: "Bologna", country: "Italy", x: 530.0, y: 116.0, lat: 44.4949, lng: 11.3426, founded: 1804, code: "IT-BO" },
  { id: "palermo", name: "Conservatorio V. Bellini Palermo", short: "Cons. Palermo", city: "Palermo", country: "Italy", x: 537.0, y: 133.0, lat: 38.1157, lng: 13.3615, founded: 1617, code: "IT-PA" },

  // Spain (further)
  { id: "barcelona", name: "Conservatori Superior de Música del Liceu", short: "Liceu", city: "Barcelona", country: "Spain", x: 503.0, y: 119.5, lat: 41.3851, lng: 2.1734, founded: 1837, code: "ES-CT" },
  { id: "seville", name: "Conservatorio Superior de Música de Sevilla", short: "Cons. Sevilla", city: "Seville", country: "Spain", x: 485.0, y: 133.0, lat: 37.3891, lng: -5.9845, founded: 1933, code: "ES-AN" },
  { id: "valencia", name: "Conservatori Superior de Música Joaquín Rodrigo", short: "Cons. Valencia", city: "Valencia", country: "Spain", x: 499.5, y: 127.0, lat: 39.4699, lng: -0.3763, founded: 1879, code: "ES-VC" },
  { id: "bilbao", name: "Musikene — Centro Superior de Música del País Vasco", short: "Musikene", city: "Bilbao", country: "Spain", x: 492.5, y: 116.0, lat: 43.2630, lng: -2.9350, founded: 2001, code: "ES-PV" },

  // Netherlands & Belgium
  { id: "amsterdam", name: "Conservatorium van Amsterdam", short: "CvA", city: "Amsterdam", country: "Netherlands", x: 512.5, y: 96.0, lat: 52.3676, lng: 4.9041, founded: 1884, code: "NL-NH" },
  { id: "rotterdam", name: "Codarts Rotterdam", short: "Codarts", city: "Rotterdam", country: "Netherlands", x: 511.5, y: 97.5, lat: 51.9225, lng: 4.4792, founded: 1930, code: "NL-ZH" },
  { id: "antwerp", name: "Royal Conservatoire Antwerp", short: "AP Conservatoire", city: "Antwerp", country: "Belgium", x: 512.0, y: 99.0, lat: 51.2194, lng: 4.4025, founded: 1898, code: "BE-AN" },
  { id: "ghent", name: "KASK & Conservatorium Ghent", short: "KASK Cons.", city: "Ghent", country: "Belgium", x: 511.0, y: 99.5, lat: 51.0543, lng: 3.7174, founded: 1835, code: "BE-OV" },

  // Switzerland
  { id: "zurich", name: "Zurich University of the Arts — Music", short: "ZHdK Music", city: "Zurich", country: "Switzerland", x: 524.5, y: 108.0, lat: 47.3769, lng: 8.5417, founded: 1999, code: "CH-ZH" },
  { id: "bern", name: "Hochschule der Künste Bern — Musik", short: "HKB Musik", city: "Bern", country: "Switzerland", x: 520.0, y: 109.5, lat: 46.9480, lng: 7.4474, founded: 1874, code: "CH-BE" },
  { id: "basel", name: "Musik-Akademie Basel — Hochschule für Musik", short: "HfM Basel", city: "Basel", country: "Switzerland", x: 520.5, y: 107.0, lat: 47.5596, lng: 7.5886, founded: 1867, code: "CH-BS" },

  // Scandinavia (further)
  { id: "gothenburg", name: "Academy of Music and Drama Gothenburg", short: "HDK Gothenburg", city: "Gothenburg", country: "Sweden", x: 535.0, y: 83.5, lat: 57.7089, lng: 11.9746, founded: 1971, code: "SE-VG" },
  { id: "malmo", name: "Malmö Academy of Music", short: "Malmö Music", city: "Malmö", country: "Sweden", x: 537.5, y: 86.5, lat: 55.6050, lng: 13.0038, founded: 1907, code: "SE-SK" },
  { id: "aarhus", name: "Royal Academy of Music Aarhus", short: "RAMA", city: "Aarhus", country: "Denmark", x: 529.0, y: 89.5, lat: 56.1629, lng: 10.2039, founded: 1927, code: "DK-MJ" },
  { id: "tampere", name: "Tampere University of Applied Sciences — Music", short: "TAMK Music", city: "Tampere", country: "Finland", x: 563.5, y: 79.5, lat: 61.4978, lng: 23.7610, founded: 1932, code: "FI-PI" },
  { id: "reykjavik", name: "Iceland University of the Arts — Music", short: "LHÍ Music", city: "Reykjavik", country: "Iceland", x: 449.5, y: 63.5, lat: 64.1355, lng: -21.8954, founded: 1999, code: "IS-RV" },

  // Eastern Europe (further)
  { id: "bucharest", name: "National University of Music Bucharest", short: "UNMB", city: "Bucharest", country: "Romania", x: 563.0, y: 112.5, lat: 44.4268, lng: 26.1025, founded: 1864, code: "RO-BU" },
  { id: "sofia", name: "National Academy of Music Pancho Vladigerov", short: "NMA Sofia", city: "Sofia", country: "Bulgaria", x: 555.5, y: 116.5, lat: 42.6977, lng: 23.3219, founded: 1921, code: "BG-SO" },
  { id: "zagreb", name: "Academy of Music Zagreb", short: "MU Zagreb", city: "Zagreb", country: "Croatia", x: 541.5, y: 112.0, lat: 45.8150, lng: 15.9819, founded: 1829, code: "HR-ZG" },
  { id: "ljubljana", name: "Academy of Music Ljubljana", short: "AG Ljubljana", city: "Ljubljana", country: "Slovenia", x: 537.0, y: 111.0, lat: 46.0569, lng: 14.5058, founded: 1919, code: "SI-LJ" },
  { id: "bratislava", name: "Academy of Music and Dramatic Arts Bratislava", short: "VŠMU Bratislava", city: "Bratislava", country: "Slovakia", x: 547.5, y: 106.0, lat: 48.1486, lng: 17.1077, founded: 1949, code: "SK-BA" },
  { id: "vilnius", name: "Lithuanian Academy of Music and Theatre", short: "LMTA", city: "Vilnius", country: "Lithuania", x: 562.5, y: 90.0, lat: 54.6872, lng: 25.2797, founded: 1933, code: "LT-VN" },
  { id: "tallinn", name: "Estonian Academy of Music and Theatre", short: "EAMT", city: "Tallinn", country: "Estonia", x: 563.5, y: 83.0, lat: 59.4370, lng: 24.7536, founded: 1919, code: "EE-TL" },
  { id: "riga", name: "Jāzeps Vītols Latvian Academy of Music", short: "JVLMA", city: "Riga", country: "Latvia", x: 560.5, y: 86.0, lat: 56.9496, lng: 24.1052, founded: 1919, code: "LV-RI" },
  { id: "minsk", name: "Belarusian State Academy of Music", short: "BSAM", city: "Minsk", country: "Belarus", x: 568.0, y: 92.5, lat: 53.9045, lng: 27.5615, founded: 1932, code: "BY-MI" },
  { id: "kyiv", name: "Tchaikovsky National Music Academy of Ukraine", short: "NMAU", city: "Kyiv", country: "Ukraine", x: 574.5, y: 98.5, lat: 50.4501, lng: 30.5234, founded: 1913, code: "UA-KY" },
  { id: "lviv", name: "Mykola Lysenko Lviv National Music Academy", short: "LNMA", city: "Lviv", country: "Ukraine", x: 560.0, y: 101.5, lat: 49.8397, lng: 24.0297, founded: 1939, code: "UA-LV" },
  { id: "baku", name: "Baku Music Academy", short: "BMA", city: "Baku", country: "Azerbaijan", x: 622.5, y: 124.0, lat: 40.4093, lng: 49.8671, founded: 1920, code: "AZ-BA" },
  { id: "tbilisi", name: "Tbilisi State Conservatory", short: "TSC", city: "Tbilisi", country: "Georgia", x: 617.0, y: 120.0, lat: 41.6938, lng: 44.8015, founded: 1917, code: "GE-TB" },
  { id: "yerevan", name: "Komitas State Conservatory of Yerevan", short: "KSCY", city: "Yerevan", country: "Armenia", x: 613.5, y: 122.5, lat: 40.1772, lng: 44.5035, founded: 1921, code: "AM-YE" },

  // Russia (further)
  { id: "nizhny", name: "Nizhny Novgorod State Conservatory", short: "NNSK", city: "Nizhny Novgorod", country: "Russia", x: 619.0, y: 88.5, lat: 56.3287, lng: 44.0020, founded: 1946, code: "RU-52" },
  { id: "kazan", name: "Kazan State Conservatory", short: "KGK", city: "Kazan", country: "Russia", x: 628.5, y: 88.5, lat: 55.7887, lng: 49.1221, founded: 1945, code: "RU-16" },
  { id: "novosibirsk", name: "Novosibirsk State Conservatory", short: "NGK", city: "Novosibirsk", country: "Russia", x: 702.0, y: 91.5, lat: 54.9885, lng: 82.9207, founded: 1956, code: "RU-54" },
  { id: "saratov", name: "Saratov State Conservatory", short: "SGK", city: "Saratov", country: "Russia", x: 617.0, y: 99.5, lat: 51.5924, lng: 46.0342, founded: 1912, code: "RU-64" },
  { id: "ufa", name: "Ufa State Institute of Arts", short: "UGII", city: "Ufa", country: "Russia", x: 637.5, y: 90.5, lat: 54.7348, lng: 55.9578, founded: 1968, code: "RU-02" },

  // Asia (further)
  { id: "wuhan", name: "Wuhan Conservatory of Music", short: "WHCM", city: "Wuhan", country: "China", x: 820.5, y: 148.5, lat: 30.5928, lng: 114.3055, founded: 1953, code: "CN-HB" },
  { id: "tianjin", name: "Tianjin Conservatory of Music", short: "TJCM", city: "Tianjin", country: "China", x: 828.0, y: 130.5, lat: 39.0842, lng: 117.2010, founded: 1958, code: "CN-TJ" },
  { id: "xian", name: "Xi'an Conservatory of Music", short: "XACM", city: "Xi'an", country: "China", x: 808.0, y: 141.0, lat: 34.3416, lng: 108.9398, founded: 1949, code: "CN-SN" },
  { id: "guangzhou", name: "Xinghai Conservatory of Music", short: "XHCM", city: "Guangzhou", country: "China", x: 820.5, y: 158.5, lat: 23.1291, lng: 113.2644, founded: 1957, code: "CN-GD" },
  { id: "hkapa", name: "Hong Kong Academy for Performing Arts", short: "HKAPA", city: "Hong Kong", country: "China", x: 827.0, y: 157.5, lat: 22.3193, lng: 114.1694, founded: 1984, code: "CN-HK" },
  { id: "nagoya", name: "Nagoya University of Arts", short: "NUA", city: "Nagoya", country: "Japan", x: 878.0, y: 139.5, lat: 35.1815, lng: 136.9066, founded: 1966, code: "JP-AI" },
  { id: "toho", name: "Toho Gakuen School of Music", short: "Toho", city: "Tokyo", country: "Japan", x: 886.5, y: 138.0, lat: 35.6197, lng: 139.5393, founded: 1955, code: "JP-TK" },
  { id: "shobi", name: "Shobi University Music", short: "Shobi", city: "Saitama", country: "Japan", x: 888.0, y: 137.0, lat: 35.8617, lng: 139.6455, founded: 1904, code: "JP-SA" },
  { id: "yonsei", name: "Yonsei University College of Music", short: "Yonsei Music", city: "Seoul", country: "South Korea", x: 852.0, y: 133.0, lat: 37.5638, lng: 126.9388, founded: 1947, code: "KR-SE" },
  { id: "ehwa", name: "Ewha Womans University College of Music", short: "Ewha Music", city: "Seoul", country: "South Korea", x: 852.5, y: 133.5, lat: 37.5631, lng: 126.9467, founded: 1925, code: "KR-SE" },
  { id: "jakarta", name: "Institut Seni Indonesia Jakarta", short: "ISI Jakarta", city: "Jakarta", country: "Indonesia", x: 802.5, y: 228.5, lat: -6.2088, lng: 106.8456, founded: 1964, code: "ID-JK" },
  { id: "manila", name: "University of the Philippines College of Music", short: "UP Music", city: "Manila", country: "Philippines", x: 848.0, y: 187.5, lat: 14.5995, lng: 120.9842, founded: 1916, code: "PH-MN" },
  { id: "mumbai", name: "Bhatkhande Music Institute Deemed University", short: "Bhatkhande", city: "Lucknow", country: "India", x: 736.0, y: 163.0, lat: 26.8467, lng: 80.9462, founded: 1926, code: "IN-UP" },
  { id: "delhi", name: "Faculty of Music — Delhi University", short: "DU Music", city: "New Delhi", country: "India", x: 722.5, y: 152.5, lat: 28.6139, lng: 77.2090, founded: 1922, code: "IN-DL" },

  // Latin America
  { id: "buenos-aires", name: "Conservatorio Nacional de Música Buenos Aires", short: "CNM Buenos Aires", city: "Buenos Aires", country: "Argentina", x: 362.5, y: 325.0, lat: -34.6037, lng: -58.3816, founded: 1924, code: "AR-BA" },
  { id: "mexico-city", name: "Conservatorio Nacional de Música de México", short: "CNM México", city: "Mexico City", country: "Mexico", x: 210.0, y: 178.0, lat: 19.4326, lng: -99.1332, founded: 1866, code: "MX-CM" },
  { id: "rio", name: "Escola de Música da UFRJ", short: "UFRJ Música", city: "Rio de Janeiro", country: "Brazil", x: 376.0, y: 286.5, lat: -22.9068, lng: -43.1729, founded: 1848, code: "BR-RJ" },
  { id: "santiago", name: "Conservatorio de Música de la Universidad de Chile", short: "UCH Música", city: "Santiago", country: "Chile", x: 330.5, y: 313.5, lat: -33.4569, lng: -70.6483, founded: 1850, code: "CL-RM" },
  { id: "bogota", name: "Conservatorio Nacional de Música de Colombia", short: "CNM Colombia", city: "Bogotá", country: "Colombia", x: 316.5, y: 237.0, lat: 4.7110, lng: -74.0721, founded: 1882, code: "CO-DC" },
  { id: "lima", name: "Conservatorio Nacional de Música del Perú", short: "CNM Perú", city: "Lima", country: "Peru", x: 310.5, y: 265.5, lat: -12.0464, lng: -77.0428, founded: 1908, code: "PE-LM" },
  { id: "havana", name: "Instituto Superior de Arte La Habana", short: "ISA Habana", city: "Havana", country: "Cuba", x: 252.5, y: 183.0, lat: 23.1136, lng: -82.3666, founded: 1976, code: "CU-LH" },
  { id: "caracas", name: "Academia de Música Juan José Landaeta", short: "Landaeta Caracas", city: "Caracas", country: "Venezuela", x: 330.0, y: 224.5, lat: 10.4806, lng: -66.9036, founded: 1877, code: "VE-CA" },

  // Middle East (further)
  { id: "tel-aviv", name: "Buchmann-Mehta School of Music Tel Aviv", short: "BMSM Tel Aviv", city: "Tel Aviv", country: "Israel", x: 597.5, y: 148.0, lat: 32.0853, lng: 34.7818, founded: 1945, code: "IL-TA" },
  { id: "beirut", name: "Lebanese National Higher Conservatory of Music", short: "LNHCM", city: "Beirut", country: "Lebanon", x: 600.0, y: 148.5, lat: 33.8886, lng: 35.4955, founded: 1929, code: "LB-BA" },
  { id: "amman", name: "National Music Conservatory of Jordan", short: "NMC Jordan", city: "Amman", country: "Jordan", x: 601.0, y: 152.5, lat: 31.9454, lng: 35.9284, founded: 1986, code: "JO-AM" },
  { id: "tehran", name: "University of Tehran Faculty of Music", short: "UT Music Tehran", city: "Tehran", country: "Iran", x: 632.5, y: 138.0, lat: 35.6892, lng: 51.3890, founded: 1939, code: "IR-TE" },
  { id: "istanbul", name: "Istanbul University State Conservatory", short: "İÜDK", city: "Istanbul", country: "Turkey", x: 575.5, y: 121.5, lat: 41.0082, lng: 28.9784, founded: 1936, code: "TR-IS" },
  { id: "ankara", name: "Hacettepe University State Conservatory", short: "HÜ Konservatuvarı", city: "Ankara", country: "Turkey", x: 582.0, y: 125.5, lat: 39.9334, lng: 32.8597, founded: 1936, code: "TR-AN" },

  // Africa & Oceania (further)
  { id: "nairobi", name: "Kenya Music Conservatoire", short: "KMC Nairobi", city: "Nairobi", country: "Kenya", x: 592.5, y: 238.0, lat: -1.2921, lng: 36.8219, founded: 1944, code: "KE-NR" },
  { id: "accra", name: "National Academy of Music Ghana", short: "NAM Ghana", city: "Accra", country: "Ghana", x: 512.5, y: 228.0, lat: 5.6037, lng: -0.1870, founded: 1953, code: "GH-GA" },
  { id: "melbourne", name: "Melbourne Conservatorium of Music", short: "MCM", city: "Melbourne", country: "Australia", x: 912.5, y: 320.5, lat: -37.8136, lng: 144.9631, founded: 1895, code: "AU-VIC" },
  { id: "brisbane", name: "Queensland Conservatorium Griffith University", short: "QCon", city: "Brisbane", country: "Australia", x: 923.5, y: 300.5, lat: -27.4698, lng: 153.0251, founded: 1957, code: "AU-QLD" },
  { id: "auckland", name: "New Zealand School of Music", short: "NZSM", city: "Wellington", country: "New Zealand", x: 956.0, y: 337.5, lat: -41.2865, lng: 174.7762, founded: 2005, code: "NZ-WN" },
];

const TASTE_OPTIONS = [
  "Bach", "Mozart", "Beethoven", "Schubert", "Chopin", "Schumann", "Brahms",
  "Liszt", "Debussy", "Ravel", "Rachmaninoff", "Scriabin", "Prokofiev",
  "Messiaen", "Baroque", "Classical Era", "Romantic Era", "Impressionism", "20th Century",
];

const PALETTE = [C.burgundy, C.forest, "#3B4A6B", "#8A5A2B", "#5B3A66"];
const colorFor = (seed) => {
  const s = String(seed).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTE[s % PALETTE.length];
};
const initials = (name) => name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

const SAMPLE_STUDENTS = [
  { id: "elise", name: "Élise Marchand", instrument: "Piano", conservatoryId: "paris", year: "3rd year", bio: "Drawn to color and light at the keyboard — chasing the perfect pedal half-tone.", tastes: ["Debussy", "Ravel", "Impressionism", "Chopin"], pieces: [{ title: "Images, Book I", composer: "Debussy" }, { title: "Gaspard de la nuit", composer: "Ravel" }], videoLink: "https://instagram.com/elise.piano", top: "Just nailed the voicing in \"Reflets dans l'eau\" — finally sounds like water instead of notes.", flop: "Still wrestling with the tremolo passage in Gaspard, my wrist gives out after a few bars.", online: true },
  { id: "theo", name: "Théo Lambert", instrument: "Piano", conservatoryId: "paris", year: "1st year", bio: "Recovering organist, newly obsessed with counterpoint.", tastes: ["Bach", "Baroque", "Beethoven"], pieces: [{ title: "Goldberg Variations, BWV 988", composer: "Bach" }], videoLink: "", top: "Finished memorizing the Goldberg aria — it finally feels like home.", flop: "Variation 26 is destroying my left hand independence.", online: false },
  { id: "lukas", name: "Lukas Brunner", instrument: "Piano", conservatoryId: "vienna", year: "4th year", bio: "Viennese classicism is home turf, but I'm trying to loosen up rhythmically.", tastes: ["Beethoven", "Schubert", "Classical Era"], pieces: [{ title: "Sonata No. 23 'Appassionata'", composer: "Beethoven" }, { title: "Wanderer Fantasy", composer: "Schubert" }], videoLink: "https://instagram.com/lukas.keys", top: "Played the Appassionata finale up to tempo for the first time.", flop: "The Wanderer Fantasy's octave passages are still sloppy under pressure.", online: true },
  { id: "polina", name: "Polina Sokolova", instrument: "Piano", conservatoryId: "moscow", year: "Masters, 2nd year", bio: "Big hands, bigger chords. Competition season starts in March.", tastes: ["Rachmaninoff", "Scriabin", "Romantic Era"], pieces: [{ title: "Piano Concerto No. 3", composer: "Rachmaninoff" }, { title: "Sonata No. 5", composer: "Scriabin" }], videoLink: "", top: "Got through the first movement cadenza without cracking, for once.", flop: "Stamina is the real issue — my arms give out by the development section.", online: true },
  { id: "maya", name: "Maya Chen", instrument: "Piano", conservatoryId: "juilliard", year: "Final year", bio: "Trying to make Liszt sound inevitable instead of just difficult.", tastes: ["Liszt", "Prokofiev", "Romantic Era", "20th Century"], pieces: [{ title: "Mephisto Waltz No. 1", composer: "Liszt" }, { title: "Sonata No. 7", composer: "Prokofiev" }], videoLink: "https://instagram.com/mayachen.music", top: "Mephisto Waltz finally sounds dangerous instead of just difficult.", flop: "The Prokofiev's toccata movement keeps falling apart past a certain speed.", online: false },
  { id: "daniel", name: "Daniel Osei", instrument: "Piano", conservatoryId: "curtis", year: "2nd year", bio: "Chopin is the reason I started, Brahms is the reason I stayed.", tastes: ["Chopin", "Brahms"], pieces: [{ title: "Ballade No. 1, Op. 23", composer: "Chopin" }, { title: "Handel Variations, Op. 24", composer: "Brahms" }], videoLink: "https://instagram.com/daniel.plays", top: "Played the Ballade in masterclass and it actually went well.", flop: "The fugue at the end of the Handel Variations keeps tripping up my voicing.", online: true },
  { id: "freya", name: "Freya Whitlock", instrument: "Piano", conservatoryId: "rcm", year: "3rd year", bio: "Slowly working my way through Messiaen's bestiary of birdsong.", tastes: ["Debussy", "Messiaen", "Impressionism"], pieces: [{ title: "Vingt Regards (No. 6)", composer: "Messiaen" }], videoLink: "", top: "Cracked the bird calls in 'Regard des oiseaux' — they finally sound free, not mechanical.", flop: "The huge chord clusters are still bruising my hands.", online: false },
  { id: "wei", name: "Wei Zhang", instrument: "Piano", conservatoryId: "shanghai", year: "Masters, 1st year", bio: "Bach in the morning keeps the rest of the day honest.", tastes: ["Bach", "Chopin", "Baroque"], pieces: [{ title: "Italian Concerto, BWV 971", composer: "Bach" }], videoLink: "https://instagram.com/wei.z.piano", top: "Recorded a take of the Italian Concerto I'm actually proud of.", flop: "The third movement's perpetual motion still falls apart past 120bpm.", online: true },
  { id: "haruto", name: "Haruto Sato", instrument: "Piano", conservatoryId: "geidai", year: "4th year", bio: "Looking for practice partners who also hear color in sound.", tastes: ["Debussy", "Ravel", "Liszt"], pieces: [{ title: "Miroirs", composer: "Ravel" }], videoLink: "", top: "Just finished learning all five movements of Miroirs.", flop: "'Une barque sur l'ocean' still feels murky instead of fluid.", online: true },
  { id: "jiwoo", name: "Ji-woo Kang", instrument: "Piano", conservatoryId: "snu", year: "2nd year", bio: "Slow practice evangelist. Ask me about metronome marks.", tastes: ["Rachmaninoff", "Chopin", "Romantic Era"], pieces: [{ title: "24 Preludes, Op. 28", composer: "Chopin" }], videoLink: "https://instagram.com/jiwoo.kg", top: "Performed all 24 Preludes in one sitting for the first time.", flop: "No. 16 in B-flat minor is still too fast for my fingers to stay clean.", online: false },
  { id: "anneliese", name: "Anneliese Voss", instrument: "Piano", conservatoryId: "eisler", year: "3rd year", bio: "The Hammerklavier has humbled me twice now. Third time's the charm.", tastes: ["Bach", "Beethoven", "Brahms", "Baroque"], pieces: [{ title: "Sonata No. 29 'Hammerklavier'", composer: "Beethoven" }], videoLink: "", top: "Made it through the Hammerklavier fugue without stopping, for the first time ever.", flop: "The opening leap still misses about half the time.", online: true },
  { id: "nathan", name: "Nathan Boucher", instrument: "Piano", conservatoryId: "rcmt", year: "1st year", bio: "New to conservatory life, very open to repertoire suggestions.", tastes: ["Chopin", "Schumann", "Romantic Era"], pieces: [{ title: "Carnaval, Op. 9", composer: "Schumann" }], videoLink: "https://instagram.com/nateplayspiano", top: "Just started Carnaval and having a blast with the character pieces.", flop: "Eusebius vs. Florestan — I can't find the right contrast yet.", online: false },
  { id: "isla", name: "Isla Cooper", instrument: "Piano", conservatoryId: "sydney", year: "2nd year", bio: "Trying to find the line between precision and feel.", tastes: ["Ravel", "Debussy", "Prokofiev", "20th Century"], pieces: [{ title: "Sonatine", composer: "Ravel" }], videoLink: "https://instagram.com/isla.c.piano", top: "Finished my end-of-year recital and the Sonatine went better than I'd hoped.", flop: "Still chasing the right touch for the second movement's habanera rhythm.", online: true },
];

const SAMPLE_CONVERSATIONS = {
  daniel: [
    { from: "them", text: "Hey! Caught the clip of your Ballade No. 1 on your profile — that coda is brutal." },
    { from: "me", text: "Thank you. Still a work in progress, the octaves are wearing my hands out." },
    { from: "them", text: "Same with my Handel Variations, the double notes near the end never get easier. What tempo are you taking the presto con fuoco at?" },
  ],
  polina: [
    { from: "them", text: "Are you also preparing for the spring competition season?" },
    { from: "me", text: "Yes — trying to get the second movement of the Rach 3 solid before then." },
    { from: "them", text: "That cadenza is no joke. Which version are you using, the ossia or the original?" },
  ],
};

const INSTRUMENT_OPTIONS = [
  "Piano", "Violin", "Viola", "Cello", "Double Bass", "Voice", "Flute", "Clarinet",
  "Oboe", "Bassoon", "Trumpet", "Horn", "Trombone", "Guitar", "Harp", "Percussion", "Organ", "Cimbalom",
];


// Every account shares one email across both registration paths (Supabase
// enforces this), so a duplicate-email signup error always means someone is
// trying to register twice — once as a piano enthusiast, once as a
// conservatory student (or the same path twice). Give a clear explanation
// instead of Supabase's generic message.
function friendlyAuthError(message) {
  if (/already registered/i.test(message)) {
    return "This email is already registered. You can't sign up as both a piano enthusiast and a conservatory student — try logging in instead.";
  }
  return message;
}

const emptyDraft = () => ({
  id: null,
  email: "", password: "", confirmPassword: "",
  name: "", years: "", instrument: "",
  conservatoryId: null,
  tastes: [],
  pieces: [],
  videoLink: "",
  top: "", flop: "",
  photoUrl: "",
  teaching: { open: false, mode: "", price: "" },
});

/* ---------------------------------------------------------------- */
/* SMALL PIECES                                                       */
/* ---------------------------------------------------------------- */
function Staff({ tone = "dark", gap = 3 }) {
  const c = tone === "dark" ? C.inkLine : C.parchmentLine;
  return (
    <div className="w-full flex flex-col" style={{ gap }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{ height: 1, width: "100%", background: c }} />
      ))}
    </div>
  );
}

function Logo({ tone = "light", size = 20, slogan = false }) {
  const col = tone === "light" ? C.ivory : C.inkText;
  const dim = tone === "light" ? C.ivoryDim : C.inkTextDim;
  const r = size / 2;
  const fontSize = size * 0.62;
  const textY = r + fontSize * 0.38;
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <rect width={size} height={size} rx={size * 0.22} fill={C.brass} />
        <text
          x={r} y={textY}
          textAnchor="middle"
          fontFamily="Inter, sans-serif"
          fontWeight="700"
          fontSize={fontSize}
          fill="white"
        >A</text>
      </svg>
      <span style={{ fontFamily: FONT_DISPLAY, color: col, fontSize: size * 0.9, fontWeight: 600, letterSpacing: -0.3 }}>Artium</span>
      {slogan && (
        <span style={{ fontFamily: FONT_DISPLAY, color: dim, fontSize: size * 0.6, fontWeight: 400, opacity: 0.6 }}>
          — A World Connected by Music
        </span>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-sm transition-colors"
      style={{
        fontFamily: FONT_BODY,
        border: `1px solid ${active ? C.brass : C.inkLine}`,
        background: active ? C.brass : "transparent",
        color: active ? C.inkText : C.ivoryDim,
        fontWeight: active ? 600 : 500,
      }}
    >
      {children}
    </button>
  );
}

function Avatar({ name, id, size = 44, online, photoUrl }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          className="w-full h-full rounded-full object-cover"
          style={{ border: `1px solid ${C.inkLine}` }}
        />
      ) : (
        <div
          className="w-full h-full rounded-full flex items-center justify-center"
          style={{ background: colorFor(id || name), color: C.ivory, fontFamily: FONT_DISPLAY, fontSize: size * 0.36 }}
        >
          {initials(name)}
        </div>
      )}
      {online && (
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-full"
          style={{ width: size * 0.28, height: size * 0.28, background: C.brass, border: `2px solid ${C.ink}` }}
        />
      )}
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled, full, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 ${full ? "w-full" : ""}`}
      style={{
        fontFamily: FONT_BODY, fontWeight: 500, fontSize: 15,
        background: disabled ? "rgba(99,91,255,0.20)" : C.brass,
        color: "#FFFFFF",
        border: "none",
        borderRadius: 6,
        padding: "10px 20px",
        boxShadow: disabled ? "none" : "0 1px 3px rgba(99,91,255,0.25)",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "opacity 0.15s",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children} {Icon && <Icon size={15} />}
    </button>
  );
}

function GhostBtn({ children, onClick, icon: Icon, tone = "light", disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className="inline-flex items-center gap-2"
      style={{
        fontFamily: FONT_BODY, fontWeight: 500, fontSize: 15,
        color: C.ivory,
        background: "#FFFFFF",
        border: `1px solid ${C.inkLine}`,
        borderRadius: 6,
        padding: "9px 18px",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "default" : "pointer",
        transition: "border-color 0.15s",
      }}
    >
      {Icon && <Icon size={15} />} {children}
    </button>
  );
}

function HomeBtn({ onClick }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-sm" style={{ color: C.ivoryDim, fontFamily: FONT_BODY, fontWeight: 500 }}>
      <Home size={15} /> Home
    </button>
  );
}

function MusicBtn({ playing, onToggle, audioRef }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const prevVolume = useRef(1);

  useEffect(() => {
    const el = audioRef && audioRef.current;
    if (!el) return;
    const onTime = () => setCurrentTime(el.currentTime);
    const onLoaded = () => setDuration(el.duration || 0);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onLoaded);
    if (el.duration) setDuration(el.duration);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onLoaded);
    };
  }, [audioRef]);

  function seek(e) {
    const el = audioRef && audioRef.current;
    if (!el || !duration) return;
    el.currentTime = parseFloat(e.target.value);
    setCurrentTime(parseFloat(e.target.value));
  }

  function changeVolume(e) {
    const v = parseFloat(e.target.value);
    setVolume(v);
    setMuted(v === 0);
    prevVolume.current = v > 0 ? v : prevVolume.current;
    const el = audioRef && audioRef.current;
    if (el) el.volume = v;
  }

  function toggleMute() {
    const el = audioRef && audioRef.current;
    if (muted) {
      const restore = prevVolume.current > 0 ? prevVolume.current : 0.7;
      setVolume(restore);
      setMuted(false);
      if (el) el.volume = restore;
    } else {
      prevVolume.current = volume > 0 ? volume : 0.7;
      setVolume(0);
      setMuted(true);
      if (el) el.volume = 0;
    }
  }

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.4 ? Volume1 : Volume2;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggle}
        title={playing ? "Pause music" : "Play music"}
        className="flex items-center justify-center rounded-full shrink-0"
        style={{ width: 30, height: 30, background: playing ? C.brass : "transparent", border: `1px solid ${playing ? C.brass : C.inkLine}` }}
      >
        {playing ? <Pause size={12} color={playing ? C.inkText : C.ivory} /> : <Play size={12} color={C.ivory} />}
      </button>
      <input
        type="range" min="0" max={duration || 100} step="0.5" value={currentTime}
        onChange={seek}
        className="artium-slider"
        style={{ width: 80, accentColor: C.brass, cursor: "pointer" }}
        title="Seek"
      />
      <button onClick={toggleMute} title={muted ? "Unmute" : "Mute"} style={{ color: C.ivoryDim, lineHeight: 0 }}>
        <VolumeIcon size={14} />
      </button>
      <input
        type="range" min="0" max="1" step="0.02" value={volume}
        onChange={changeVolume}
        className="artium-slider"
        style={{ width: 48, accentColor: C.brass, cursor: "pointer" }}
        title="Volume"
      />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* WORLD MAP                                                          */
/* ---------------------------------------------------------------- */
const CONTINENTS = [
  "M0,53.8L14.1,58.3L13.9,59.8L15.7,60.5L15.1,58.6L22.6,59L28.1,61.4L20.8,62.8L20.7,65.3L19.6,65.8L11.2,64.1L10.5,63L4.6,62.9L3.1,62L3.7,61L0.3,61.7L1.6,62.9L0,63.9M1000,64L996.4,65.1L992.8,64.9L998.2,69L997.9,70.8L992.7,70.2L982.4,72.4L974.2,75.8L973.1,77L969.2,75.2L961.9,77.2L960.7,76.3L958,77.4L954.3,77L950,81.2L950.1,82.2L953.3,82.8L952.9,86.5L950.4,86.6L949.2,88.7L950.3,89.8L945.5,91.1L944.5,94L940.4,94.7L939.5,97.3L935.5,99.6L931.8,88.5L933.1,84.9L935.4,83.4L935.6,82.2L939.9,81.6L954.6,73.8L956.9,70.1L953.5,70.4L951.8,72.5L944.8,75.3L942.5,72.1L935.3,73L928.4,77.3L930.7,78.9L920.2,79.8L920.4,77.9L916.1,77.5L912.6,78.8L895,79.1L875.3,90.1L879.7,90.5L881.1,92.1L883.8,92.6L885.6,91.3L888.6,91.5L892.6,94.3L892.7,96.5L890.5,99.1L889.1,106.2L883.9,111.7L874.6,119.1L870.9,120.6L869.2,120.6L867.4,119.4L861,122.8L860.3,125.5L854.3,128.4L853.8,129.8L856.5,131.3L859.6,136L859.6,138.9L858.6,140.3L851.3,142.1L851.6,138.8L850.3,136.1L852.4,135.7L850.5,133.5L848,133.7L846.4,132.6L847.8,131.2L848.1,128.9L845.2,128L836.3,130.6L837.7,129.4L837.2,128.4L839.4,126.7L837.9,125.4L830.6,129.7L827.9,129.8L826.5,131L827.9,132.7L830.2,133.2L830.3,134.3L832.5,135L835.6,133.2L839.9,134.3L840.3,135.6L836.4,136.3L831,140.8L834,142.2L838.6,149L838.6,150.9L836.8,151.6L839.1,153.8L838,157.9L836.5,158.1L829.6,167.3L821.9,171.8L818.8,172.1L817.1,173.2L816.1,172.4L814.6,173.6L807.7,175.3L806.8,178L805.2,178.2L804.5,176.3L805.2,175.3L801.4,174.5L796.4,177.1L794.1,179.5L793.5,181.3L798.2,187.3L802.4,191L803.7,195.7L803.3,200.2L792.1,208L791.1,206.4L791.9,204.7L787.5,202.8L785,198.9L780.1,197.7L780.5,195.7L778,195.7L775.6,206.4L777.4,206.5L779.1,211L786,215.9L787.2,217.6L787.5,222.9L789.5,226.7L787.6,226.9L781.6,222.9L778.3,216.4L778,213.5L773.6,208.6L773.2,210.1L772.6,208.7L774.3,200.8L773.4,199.2L773.6,196.5L769.9,186.7L764.9,189.8L761.6,189L762.6,185.8L762,183.5L759.8,180.5L760.2,179.6L758.5,179.3L756.6,177.2L753.9,171.8L751.4,171.7L750.8,174.2L747.3,173.6L746.9,174.6L741.6,175.1L741.8,177L740.3,178.5L736.3,180.2L728.3,186.5L728.3,187.7L723.1,189.4L722.3,191.3L723,196.8L721.8,199.2L721.8,203.5L720.4,203.7L719.1,205.6L720,206.4L717.4,207.2L715.4,209.6L712.8,207.3L708,197.4L706.8,192.6L704.3,189.1L701.7,175.4L697.7,177L695.7,176.6L692.1,173.6L693.5,172.6L692.6,171.6L687.3,168.8L684.4,165L670.8,165.9L659.4,164.2L658.3,161.1L656.9,160.6L652,162.3L643.1,158.8L639.2,153L637.7,153.4L635.9,152.5L634.9,153.5L633.3,153.4L635.6,159.2L639.3,161.8L639.2,163.7L641.1,166.7L641.7,163.5L643.3,164.1L642.7,167.1L643.9,168.6L650,168.4L656.6,162.5L656.7,166.3L657.9,168L663.1,169.8L666.1,173L662.5,177.8L660.6,178.3L660.3,181.6L657.2,182.5L656.3,184.3L653.5,184.9L653.5,186L645.5,188.1L644.9,190.1L637.7,192.4L635.2,194.2L626.7,196L625,197.5L620.8,197.7L618.3,191.1L618.5,187.1L613.7,180.2L608.7,175.6L608.5,172.3L606.9,169.5L604.1,167.9L602.6,164.6L597.6,158.3L596.2,158.3L597,154.6L594.2,159.3L590.1,153.7L594.7,163.2L599.1,168.9L598.7,171L602.4,173.8L604.1,182.4L606.7,184L609.1,189.3L620.3,198.3L620.2,199.4L618.7,200L622.5,203.3L623.9,203.3L642,199.3L641.8,202.8L637.4,212.6L632.6,219.2L629.3,222.7L619.8,229.3L615.5,234.3L611.8,236.6L608.9,241.9L607.8,246.5L609.6,247.5L608.9,251.7L612.4,257.5L613.3,267.5L609.6,272.7L603.9,274.9L596.6,280.6L596.4,282.4L598.8,286.5L598.5,291.6L590.5,295.7L591.4,297L589.5,303.5L578.4,313.8L571.6,316.7L562.7,316.5L554.5,319L550.7,316.6L549.8,313.3L550.7,312.9L550.6,310.9L542.3,299.2L539.6,286.5L532.8,276.2L532.7,270.4L534.7,264.6L537.9,260.8L538,257.4L535.8,253.4L536.8,251.9L533.1,242.9L524.4,232.8L527.2,222.1L526.1,220.5L524.9,220L523.6,217.8L516.4,219.1L512,214L505.2,214.3L494.5,218L487.1,216.8L479.1,218.9L475,217.6L465.5,211.4L464,210.1L463.2,207.2L458.8,202.2L453.9,198.9L453.6,195.3L451,192.4L454.3,188.8L455.1,183.7L454.8,178.7L452.6,176.3L452.9,174.1L454.8,172L455.6,169.4L458.1,167.3L459.9,162.9L464.9,158.3L467.5,158.1L473.4,153.5L472.7,150.3L474.2,146.8L480.8,142.8L483.5,138.6L494,140.1L504.1,136.5L514.8,136.2L517.4,135.2L523.4,135.6L526.4,134.5L528.4,134.9L528.3,136.1L530.8,135.7L529.4,136.9L530.4,138.8L530,141L528.2,142.3L528.7,143.7L530.2,143.7L531.9,145.3L542.3,147.5L543.6,149.8L553,152.7L555.7,150.8L555.1,148.9L555.9,147.6L559.8,146.1L563.6,146.6L564.5,147.7L569.2,148.5L569.9,149.3L573.6,149.3L580.3,151.1L586,149.4L588,149.7L588.8,150.9L589.4,150.1L593.8,150.9L596,149.4L600,141.5L600.4,138.5L599.4,137.3L600.4,136.3L596.4,136L594.5,137.4L590.3,137.7L588.1,136.4L585.1,136.3L584.4,137.3L582.5,137.6L579.8,136.3L576.8,136.3L573.1,132.4L574.5,130.4L572.7,129.1L575.8,126.7L580.1,126.6L581.2,124.7L586.5,125L593.1,122.6L597.7,122.6L606.5,125.4L612.1,125.2L615.4,123.9L615.8,122.8L615.1,121L601.9,114.4L603.9,114L606.2,111.8L604.6,110.8L608.7,109.2L597.1,111.7L597.3,113.3L601.5,113.8L600.9,114.7L594.1,116.6L592.6,116.1L593.2,114.9L590.1,114.2L593.3,112.8L592.5,112.2L588.2,111.6L588,110.6L585.4,111L582.3,114.9L580.1,115.2L579.3,118.3L576.9,121.2L578.1,123.6L580.5,124.5L580,125.1L576.7,125.2L573.2,127.4L572.4,125.7L569.2,125.4L565.9,126L567.8,127.5L566.4,127.9L564.8,127.9L563.4,126.6L562.9,127.1L564.9,129.8L563.8,130.4L566.7,132.3L566.8,133.8L564.2,133.1L565,134.4L563.3,134.7L564.3,136.9L562.5,136.9L560.2,135.8L558.7,132.1L553.9,127.1L554.3,123.4L544.5,118.8L542.2,116.9L541.4,114.8L539.6,114.4L538.8,115.5L537.9,114.6L538.7,113.5L536.5,113.1L534.2,114L534.1,116L535,117.3L542.1,122.8L544.2,122.8L544.9,123.3L544.1,123.8L551.3,127.3L550.8,128.3L546.9,126.6L545.7,128.3L547.7,129.2L547.4,130.6L546.2,130.7L544.7,132.9L543.6,133.1L544.7,130.4L542.8,127.7L533.6,123.4L529.2,120.3L528.3,117.8L524.7,116.6L518.1,119.8L512.7,119.1L508.6,119.9L508.4,122.9L505.8,124.6L502.3,125.2L499.2,129.5L500.3,131L498.1,133.8L496,134.3L494,136.3L487.9,136.3L485.1,138.1L483.7,137.9L481.9,135.6L475.3,135.8L475.4,132.2L473.5,131L475.6,125.8L475,121.2L473.9,120L477.8,118.2L494.7,119L496.2,117.5L496.7,112.4L491.8,108.4L487.5,107.4L487.2,105.6L490.8,105L495.5,105.7L494.6,102.8L497.3,103.9L503.7,101.9L504.6,99.8L510.6,98.1L513.1,94.3L519.7,92.8L522.6,93.2L524.4,91.9L522.6,88.1L522.5,85.5L523.7,84L529.4,82.5L528.5,84.6L530.3,85.7L526.8,88.2L527.6,90.5L530.4,91.1L530.4,92L534.8,90.8L539.2,92.6L549,89.8L554.6,90.9L555.2,89.8L559.1,89L558.6,84.9L559.9,83.3L562.6,82.4L564.8,84.3L567,84.3L567.9,80.8L565.1,80.2L564.8,78.7L571.8,77.7L577.7,78L580.9,76.6L578,75.4L563.5,77.1L559.2,74.8L559.8,72.3L558.5,70L559.8,68.5L570.5,63.6L570.3,62.5L566.4,61.3L561.6,62L558.9,63.8L559.4,65.4L549.6,69.6L547.6,73.2L552.2,76.5L549.6,79.3L546.7,79.9L544.1,86.6L540.7,86.4L539.2,88.4L536,88.5L530.6,79.6L528.8,78L523.3,81L519.6,81.6L515.7,80.3L513.9,71.6L516.4,70L529.2,65.2L541,56.7L553.3,51.6L564,50.6L568.2,48.5L578.2,48.1L586.9,50L583.3,50.6L586.4,52.2L589.3,51.3L611.9,56.4L614.1,57.6L614.2,59.3L611.2,60.7L606.6,61.3L592.2,59.7L596.7,61.6L597.1,65.4L602.8,66.8L603.2,65.6L601.4,64.5L603.3,63.5L610,65.1L612.3,64.5L610.5,62.6L616.9,60.1L622.1,61.2L623.7,59.4L621.4,57.9L622.7,56.3L620.7,54.8L628.5,55.6L630.1,57L626.5,57.3L626.6,58.8L628.7,59.6L633,59.1L633.7,57.4L649.2,54L651.3,54.2L648.6,55.7L652,56L663.3,54L666.5,55.5L669.7,53.8L666.7,52.3L668.2,51.5L676.4,52.3L690.3,56L692.2,54.7L689.3,52.8L685.9,52.5L686.8,51.3L685.3,48.5L690.4,46.2L692.2,43.8L701.6,44L702.2,45.4L699.6,47.5L701.3,48.3L702.2,50.1L701.6,53.6L704.6,55.2L698,60.5L701.2,60.9L705.3,59.3L708.5,56.8L706.9,55.4L708.2,53.7L705.1,53.5L704.4,52.1L706.7,49.5L703.1,47.4L708,45.7L707.4,43.9L708.8,43.8L710.2,45.2L709.1,47.7L712.1,48.2L710.8,46.3L715.5,45.3L721.3,45.2L726.4,46.6L723.9,44.5L723.6,41.8L741.2,41.1L738.9,39.7L742.1,38L759,35.7L768.5,36L774.8,34.6L779.9,34.7L783.3,32.5L789.9,31.4L794.6,32.3L790.8,32.9L797.1,33.3L797.9,34.5L808.5,34L817,36.2L816.3,37.5L803.9,40.4L811.4,41.4L813.9,40.9L815.4,42.6L821,41.5L829.9,41.9L830.6,43.1L842.2,43.5L842.4,41.6L852.7,42L857.2,43.3L858.5,45L856.8,46.1L860.3,48.1L864.7,49.1L867.4,46.4L871.8,47.6L876.6,46.9L888.5,47.3L886.5,44.9L890.2,43.8L915.3,45.5L917.6,47L924.9,49L941.7,48.9L944,50L943.6,51.8L947.1,52.5L966.2,52.2L971,54.5L974.5,53.6L972.2,52L973.5,50.9L996.1,52.6M0,53.8Z",
  "M248.5,52.4L248.5,55L252.2,53L255.5,54.7L254.7,56.5L257.4,58.3L262.3,54.2L262.4,51.4L270.5,52L274.2,53.3L274.4,54.5L272.3,55.9L274.3,57.2L273.9,58.5L268.5,60.3L264.6,60.7L261.8,59.9L257.4,64.5L254.2,66.2L250.2,66.4L248,67.4L247.9,69.1L244.6,69.4L241.2,71.5L238.2,74.4L237,79.4L241.1,79.8L243.6,84.1L247.5,83.6L263.9,88.7L271.5,89.1L271,91.3L271.9,93.8L273.9,96.7L278,99.1L280.2,98.3L281.7,95.7L280.2,91.6L278.3,90.3L282.7,89.1L287.4,85.5L287.2,83.8L285.3,81.6L281.9,79.7L285.2,77L283,70.7L285,70.1L292.6,71.1L294.9,70.4L301.7,73.8L306.7,74L307.5,79.3L310.1,79.7L312.1,81.2L316.1,79.8L320.6,75.8L329.5,84.4L328.3,86L334.5,88.9L340.7,90.4L341.8,92.6L345.1,93.9L345.3,96.7L336.7,99.5L333.2,101.6L315.6,101.6L309.7,104.6L302.5,110.3L304.8,109.9L309.3,106.6L315.1,104.4L319.3,104.2L321.7,105.4L319.1,107.2L320.9,111.8L324.5,113.1L329.1,112.7L331.9,109.9L332.1,111.7L333.9,112.6L318.4,118.7L316.3,118.5L316.2,116.4L321,114.3L313.5,114.6L314,115.5L305.2,118.4L303.6,120L303.3,121.8L304.2,123.2L305.3,123.2L305,122.3L305.9,122.9L305.7,123.6L295.3,125.4L300.2,125.4L294.6,125.9L293.7,126.6L294.6,126.7L294,128.5L291.9,130.5L290.2,129.1L291.5,131.9L289.1,134.9L289.7,133L288.2,132.1L287.9,130L288,132.7L286.2,132.3L288.1,133.1L289.6,139.1L287.9,141L280.4,144.4L274.1,149.7L274.1,153.2L277.6,161.3L276.7,165.6L274.5,165.6L273,163.9L269.8,158.7L270.4,157L269.6,155.6L266.4,153.1L263.6,154.3L260,152.3L252.3,152.5L251.1,152.9L252.2,155.1L249.6,155.6L245.5,154.2L239.3,154.1L231.7,157.7L229.5,160L230.2,163.9L228.6,168L228.1,172.6L232.5,180.6L237.7,183.6L244.3,182.2L247.9,180.7L249.2,176.3L258.2,174.9L258.8,176.7L256.6,179.8L256,183.3L254.7,182.7L254.6,187.8L253,189.4L263.9,189.1L268.3,191L268.9,193.4L267.2,201.6L271.6,207L273.8,207.5L279,205.4L286.6,207.9L289.8,205.9L290.3,202.9L291.9,201.7L296.1,201.3L300.7,198.2L302.4,199L301.8,200.5L300.1,200.8L301,203.3L299.8,204.8L300.8,206.8L302,206.6L302.7,204.8L301.7,202L305.1,200.9L304.7,199.7L305.7,198.9L306.7,200.7L308.7,200.8L310.6,203L316,202.8L319.8,204.2L321.3,202.8L328.1,202.6L325.8,203.4L326.7,204.6L331,206L331.5,208.1L335.8,209.6L337.5,211.2L337.6,212.5L341.3,214.7L350.1,215.3L353.1,216.2L356.5,219.4L357.5,219.3L359.7,225.1L361.2,225.6L361.3,227.3L359.2,229.4L360,230.2L364.9,230.6L365,233.2L367.2,231.5L375.3,234L376.6,235.5L376.2,236.9L379.4,236.1L384.8,237.4L388.9,237.3L396.6,242.3L401.1,243.2L402.1,244L403.5,248.8L402.4,253L392.6,263.4L390.9,275.7L389.6,280.1L386.7,283.4L386.3,286.1L384,287.2L383.4,288.7L376,289.7L367.6,293.6L365.3,296.1L364.2,303.3L359.2,309.2L354.8,312.4L350.5,317.9L347.4,319.3L343.8,319.1L339.4,318.1L337.7,316.7L337.5,318L341,320.2L340.7,321.9L342.4,323.1L342.3,324.3L339.6,327.6L335.5,329L326.8,329.2L327.4,334L325.7,334.9L322.9,335.2L320.2,334.3L319.1,334.9L319.5,337.5L321.4,338.3L322.9,337.4L323.7,338.8L318.9,341.2L317.9,345.1L315.3,345.1L313.1,346.4L312.3,348.3L315,350.2L317.7,350.7L316.7,353L313.4,354.4L311.6,357.4L308,359.6L308.8,362.3L310.7,363.8L307.1,363.6L303.2,365.2L302.8,367.6L298.5,366.8L291.8,363.6L290,354.4L291.2,351.9L294.1,350L289.9,349.2L292.5,347L293.5,342.7L296.6,343.6L298,338.3L296.1,337.6L295.3,340.8L293.5,340.5L295.3,332.1L296.6,330.3L295.6,325L296.8,324.9L301.6,312.8L301.4,303.8L303,300.6L305.3,284.7L305.1,280.5L304.5,276.9L301.7,275.4L301.5,274.4L288.9,267.4L287.7,265.3L288.2,264.6L278.4,248.4L274.3,245.7L275.2,244.5L273.9,242.1L278.4,236.8L277.8,235.7L276.8,236.9L275.1,235.7L275.2,232.7L276.2,232.3L277.5,228L281,226.5L280.6,225.7L281.6,225.5L282.1,223.3L283.5,223.1L285.8,220.2L284.7,219.6L284.8,212.9L282.7,210.8L282.1,209.4L282.8,208.7L280.2,207L279,207.2L276.4,209.3L277.8,210.7L275.3,211.5L274.8,210L268,208.4L267.7,206.9L264,204.2L263.6,205.6L262.1,204.6L262.1,202.5L261.3,202.2L261.9,201.7L256.5,197L257.5,196.8L257,196L254.2,196.4L246.6,194.4L240.7,190.1L237,188.6L231.8,190L212.5,183.3L207,179L206.3,177.8L207.2,177.5L207.6,175.3L205.5,171.8L198.9,165.7L196.5,164.6L196.4,162.4L188.3,156L185.7,150.3L183.7,149.3L181.2,148.7L181.5,152.9L190,161.9L192.6,167.9L194,168L196.1,170.3L194.4,171.7L193.6,170.1L188.4,166.8L188.1,163.5L180.4,159.2L181.8,159.1L182.9,157L179.1,154.5L174.2,145.5L170.8,143L164.9,141.6L154.5,127L155,122.7L154.1,120.7L155.8,113.7L153.7,106.9L158,107.2L159.5,109.6L160.2,109L158.8,104.8L151,101.2L146,100.1L144.5,97.8L144.9,96.3L141.3,95.2L140.8,93.1L137.5,91.3L137.4,89.9L133.4,88.2L132.6,85.9L129.1,83.9L127.6,81.5L120.5,81.2L111.5,77.8L104,76.5L100.1,76.7L91.4,74.4L88.3,74.9L88.8,76.7L78.6,78.8L78.2,77.3L79.4,74.8L82.4,74L81.6,73.4L72.2,78.3L74.2,79.6L71.6,81.4L65.8,83.3L59.9,86.9L42.3,91L50.5,87.2L54,86.9L61.9,82.9L63.8,79.4L58.2,80.7L56.4,79.4L55.6,80.3L54.6,79L50.1,80.1L50.4,77.6L48.6,76.7L45,77.2L40.7,75.4L40.7,73.9L38.6,72.8L42.9,68.6L47,68.8L53.4,67L51.3,65.4L53.4,64.4L47.9,65.6L41.8,65.3L37.7,64.7L33,62.2L43.1,59.9L45.4,59.9L45,61.1L50.9,61L40.6,56.1L36.8,55.3L38.3,54L43.3,53.9L46.8,52.7L47.4,51.5L50.3,50.3L65.1,47.6L71.3,49.3L77.2,49L77,49.6L81.3,50L101.1,50.7L120.8,53.9L126.6,52.1L130.8,52.4L139.5,50.6L141.4,51.7L143.4,51.1L144.1,49.9L150.7,52.4L154.4,50.7L154.8,52.6L162.6,51.6L179.9,53.9L183.6,55.2L179.7,56.5L184.7,57L194.6,56.3L197.6,57.8L200.6,56.5L197.7,55.4L199.5,54.6L205.1,54.2L210.2,56.2L218.2,57.1L226.5,56.8L226.2,55.2L228.7,54.7L233,55.6L233,58L234.8,56L237,56.1L238.2,53.5L232,50.9L232.2,48.1L235.5,46.2L242,47.7L245.8,50.6L243.3,51.9L248.5,52.4Z",
  "M0,446.5L2.6,445L7.6,445.8L11.3,444.9L15.6,446L19.8,444.8L27.9,444.4L36.1,446.1L60.9,448.2L68.9,447.5L87.4,448.8L102.5,447.3L103.1,446.1L83.2,445.4L80.8,444.4L73.4,443.9L75.9,440.7L75.4,439.7L64.3,437.3L77.5,437L81.5,437.9L93.3,435.3L92.3,434.3L84.6,432.8L68.5,432.1L61,429.4L60.1,426.5L64,427.5L72.9,426.9L75.2,428L79.6,427.8L94.2,425.4L93.1,423.5L93.9,422.6L97.5,422.2L99.1,423L124.4,419.9L167.5,420.3L183.5,418.4L188.1,420.9L190.9,420.2L201.2,422.1L208.7,421.5L220.4,422.4L221.9,421.3L218.7,419.6L215.2,419.4L213.6,418.4L212,415.6L224.6,416.3L228.6,418L232.4,418.1L243.2,417L249.8,417.4L252.1,415.4L254.4,416.6L261.1,416.8L263.4,417.8L273.7,418.7L277,416.9L288.3,419L308.5,416.6L311.2,416L313.5,414.1L309.6,408.2L312.3,405.2L311.8,402.1L313.2,400.9L325,395.2L339.4,391.7L341,392.3L340,393.2L327.7,395.6L326,397.3L327.4,399.2L322.9,400L317.6,403.7L320,405.5L324.5,406.9L328.3,410.7L331.4,417L331,418.3L321.2,422.3L303.9,425.8L285.4,426L286.3,427L295.4,429.1L283.5,430.3L283.3,432.4L290.7,435.1L334.2,440.5L338.3,442.7L361.8,438.9L381.1,439.8L386.7,437.9L420.7,435.3L417.5,433.5L417.5,432.6L401,433.1L400.2,432.1L400.6,430.2L401.9,429.6L419.8,425.9L437.6,424.5L451.3,422L456.4,420.4L457.2,419.4L454.3,418.8L457.1,416.9L465.9,415L471.4,412.1L479.4,413.2L480.9,411.3L487.9,412.6L498.2,412L499.4,413.1L517.4,410.1L521.5,408.6L526.5,408.9L530,411L537.3,408.8L540.9,409L542,409.9L544.3,409L553.5,408.6L559.6,409.1L562.7,410.7L575.3,410.1L588.9,408L594.1,405.1L607.4,408.3L616.6,405.3L629.2,402.8L631.8,403.1L641,400.9L643.9,399.3L651.5,398.2L656.5,398.6L663.2,402L670.6,403.7L673.3,403.8L677.9,402.3L691.4,403.6L693.5,406.9L693.2,408.1L688.4,409.7L688.7,410.7L691.8,410.6L688.7,413.6L694.1,414.7L697.3,414.2L705.2,408.6L715.7,407.5L719.8,404.6L729.9,401.8L741,401.6L744.4,399.2L746.7,401.1L749.1,401.6L766.1,402.2L777,401.9L785.6,397.6L794.9,401.1L806.2,400.5L815.6,398.4L821.1,400.5L832.9,401.9L842.3,399.9L857.8,400.6L874.3,399.2L875.2,396.9L876.9,397.6L879.5,400.7L881.8,401.1L904.1,401L907.3,403.5L913.4,404.8L923.6,406L928.6,405.2L935.6,407.3L942.2,407.9L948.8,410.4L964.7,411L975.6,413.2L970.2,418.2L961.4,420.1L956.2,422.8L954.4,424.8L954.1,426.9L957.6,429.8L962.8,430.1L963.9,431.3L949.3,432.3L943.9,436.9L954.7,440.6L969.1,443L970.6,444.2L981.2,445.7L988.8,445.1L995.2,445.9M0,446.5Z",
  "M898.8,265.2L899.8,267.2L901.6,266.2L903.8,268.3L906.6,278.4L913.5,282.1L915.8,287.1L916.9,286.5L918,287.6L918.7,287.2L919.2,290L924.6,294.6L925.4,296.6L925.3,299.7L926.6,301.8L925.2,309L923.5,313.2L921.4,314.4L917.6,321.2L916.7,325.6L912,326.6L906.4,329.8L902.4,328.2L902.9,326.8L898.9,329.2L890.7,327.2L888.9,325.6L887.7,322.4L883.7,321L884.6,319.8L883.9,317.9L882.5,319.6L880.1,320.1L883,316L882.8,314.1L878.8,317.1L877.7,319.2L875.6,318.1L875.7,316.8L872.5,313.9L873,313.4L864.8,310.5L850.4,312.3L845.1,314.2L843.5,316.6L833,316.8L827.8,319.6L824,319.5L819.5,317.4L819.6,315.9L821.4,315L821.4,310.8L819.6,305.3L814.8,296.7L816,297.8L815.1,295.5L817.3,297.2L815,292.3L817.1,285.6L817.3,287.5L818.5,285.8L824.2,282.9L835.7,280.3L839.6,276.5L839.8,274.1L841.7,271.9L842.9,274.1L844.1,273.6L843.1,272.4L843.9,271.2L845.2,271.7L845.5,269.8L849.1,266.4L850.3,266.7L853,265.3L856.6,268L860.1,268.3L859.5,266.9L862.8,262L868.3,261L868.2,259.7L866.2,258.8L867.7,258.4L875.8,261.3L879.1,260.3L880.4,261.6L877.7,264.1L876.4,268.3L889.5,275.3L891.3,274.4L893.6,268.4L893.1,265L894.8,258.2L895.9,257.3L896.7,258.5L898.7,262.8L898.8,265.2Z",
  "M424.7,16.6L442.1,18.6L437,19.6L412.8,20.4L422.6,20.1L431,21L436.4,20.2L438.7,21.1L435.6,22.6L456.2,20.7L464.5,21.2L466.1,22.3L453.2,24.7L444.3,25.1L450.7,25.2L445.3,28.7L445.4,31.6L448.7,33.3L439.8,34.2L444.9,35.5L445.6,37.7L442.6,37.9L446.2,40.1L440,40.3L443.2,41.4L442.3,42.3L434.5,42.7L438,44.4L438.1,45.5L432.6,44.5L431.1,45.2L438.5,47.4L439.6,49.4L434.6,49.9L429,47.5L430,49.2L426.8,50.5L437.9,50.8L422.9,55L411.7,55.9L405,59.6L389.4,62.7L387,64.3L387,66.1L385.6,67.8L381.1,69.8L382.2,71.8L379.5,76.4L375.6,76.6L371.5,74.5L365.9,74.5L356.6,67.4L354.8,63.4L350.9,61.1L351.9,59.2L350.1,58.3L352.8,55.3L357,54.4L358.7,51.3L351.5,52.9L348.1,52.1L347.9,50.4L349,49L357.3,49.7L350,47.2L344.9,46.9L348,44.5L340.8,39.1L337.2,38.1L337.3,37L329.8,35.5L309.7,35.6L301.7,33.2L314.5,32.3L296.4,30.6L296.8,29.6L317.5,27.1L318.5,26.2L311,25.3L327.1,22.2L326,21L341.1,20L352.7,20.7L360,19.3L376.3,21.3L369.7,19.9L370.1,18.8L379.4,17.3L402.5,16.2L424.7,16.6Z",
  "M0,272.3M996.5,273.5L996.1,272.5L998.4,271.9M0.6,270.9L0,272.3Z",
  "M259.6,43L261.7,44.6L264.3,42.6L271.3,41.5L276.1,44.2L275.7,45.8L283.8,44.1L293.8,46.6L294.2,47.7L299.3,47.1L302.2,48.8L311.3,50.8L314,53.2L308.9,54.4L319.8,56.6L323.8,59L328.2,59.1L327.3,60.9L322.5,63.9L314.7,60.3L311.1,60.7L310.7,62.1L318.6,65.5L320.4,68L319.4,69.8L308.9,67.1L316.2,71.7L302.7,69.2L299.3,68L300.3,67.3L292.1,64.7L292.2,65.5L284.1,65.9L281.8,65L283.6,63.1L294.6,62.7L293.6,61.8L298.2,58L297.4,56.9L292.1,54.8L286.5,53.9L288.3,53.3L280.7,50.7L274.2,51.8L253.7,50.1L251.4,49.2L254.3,48L250.3,48L249.4,45.4L251.6,43.1L254.4,42.1L261.6,41.4L259.6,43Z",
  "M309.7,17.6L323.1,18.1L328.2,18.8L328.1,19.5L312.1,21.7L318.1,21.7L307,24L302.3,26.1L286.4,27.3L290.2,27.6L288.3,28.1L290.6,29.3L278.4,32.7L283.6,33.8L276.2,35.3L251.4,34.6L251.1,33.3L256.2,32.8L254.8,30.9L264,31.8L260.2,30.2L255.7,29.7L262.8,28.1L263.6,27.2L259.7,26.2L258.5,24.9L268.3,25.3L272.6,24.4L256.7,24.2L251.8,23.4L245.6,20.7L262.5,18.8L268.9,19.6L271.1,18.2L279.7,17.6L309.7,17.6Z",
  "M872.6,232.9L873.4,237.1L876.3,238.6L878.6,235.9L881.8,234.4L884.2,234.3L901.6,239.9L905.1,242.5L905.5,244L910.1,245.5L910.8,246.9L908.2,247.2L908.9,248.9L911.3,250.6L913.1,253.3L914.7,253.2L914.6,254.3L918.9,256.3L918.6,257L910.9,255.9L905.7,250.6L902.1,249.5L898,251.1L898.4,253L896.2,253.8L891.8,253.3L889.3,251.2L886.5,250.7L882.3,251.5L883.4,249.4L885.2,248.7L883.1,243.8L875.5,241.4L871.3,239L869.4,240.5L868.8,238.5L866.6,237.2L871.6,236.3L871.4,235.7L867.3,235.7L866.2,234.1L863.7,233.7L862.6,232.4L867.7,230.9L872.2,232L872.6,232.9Z",
  "M827.4,225.3L830.5,227.7L827.3,228L826.4,232.1L823.8,233.8L822.6,240.3L822.2,239.3L819.1,240.5L818,238.9L814.6,238L811.3,238.9L810.3,237.7L806.2,237.5L805.7,234.1L803,231.2L803,226.6L804.6,224.9L806.7,225.7L808.8,225.3L809.4,223.1L813.9,222.1L824.2,212.3L825.4,212.3L826.9,214.7L831.1,216.2L830.9,217.2L829,217.3L829.5,218.6L827.4,219.4L825.9,221.7L827.9,224.2L827.4,225.3Z",
  "M182.9,43.1L181.5,44.3L187.7,43.6L191.5,44.8L194.7,43.5L197.2,44.4L199.5,46.9L200.9,45.8L198.9,43.2L204.1,43.2L207.2,44.3L209.8,48.6L219.5,51L219.2,52.2L214.6,52.4L216.4,53.4L215.5,54.3L205.7,53.2L185.2,54.9L183.7,53.6L177.5,53.2L174.1,51.2L187.7,50.2L172.5,49.7L171,48.8L177.5,47.8L168.3,47.1L172.6,44.2L180,42.6L182.9,43.1Z",
  "M639,264.6L639.9,270.1L639.4,270.9L638.5,269.4L638,270.1L638.3,273.1L630.8,293.7L626.1,295.4L622.3,293.9L620.1,286.4L623.3,281.3L622.1,274.5L623.5,271.4L628.6,270.3L632.5,267.3L633,264.9L634.1,265.2L636.7,260.8L639,264.6Z",
  "M0,47.2M1000,49L996.9,49.1L996.5,48.3M0,47.2Z",
  "M636.4,124.5L637.8,126.3L640,127.1L637.7,127.3L635.7,130.8L636.7,134L641.2,135.8L649.5,135.5L649.7,130.5L647.5,129.6L648.2,127.8L646.4,127.7L647,125.5L649.6,126.2L652,125.3L649.2,122.4L647,123L646.7,124.9L645.8,120.6L642.6,119.8L639.7,116L642.4,116.2L642.5,114.4L647.3,114.3L647.3,110.3L642.2,109.8L636.4,111.4L635.1,112.9L632.4,113.4L629.7,116L632.2,118.4L631.9,120.1L636.4,124.5Z",
  "M793.9,245L790.9,245L785,240.8L775.7,229.5L773.9,225.3L764.9,217.3L764.7,216L770.8,216.6L779.6,224.6L782.4,224.7L788.4,229.7L787.3,231.8L789.9,232.8L791.4,236L793.4,236.2L794.7,237.8L793.9,245Z",
  "M491.7,80.2L488.7,82.9L494.6,82.6L493.8,84.7L491.3,87L494.2,87.1L496.9,90.4L498.8,90.8L501.3,94.7L504.7,95.2L504.3,96.9L502.9,97.6L504,98.9L501.5,100.3L491.8,100.4L490,101.6L487.4,101.3L485.4,102.3L484,101.8L488,99.1L490.5,98.6L486.2,98.2L485.4,97.1L488.3,96.3L486.8,95L487.3,93.3L491.4,93.5L491.8,92L489.9,90.4L486.5,90L485.9,89.3L486.9,88.1L486,87.4L484.5,88.6L484.3,86.2L482.9,84.9L483.9,82.2L486.1,80.2L491.7,80.2Z",
  "M891.6,135.1L890.6,137.1L891,138.4L889.6,140.2L886,141.4L881.2,141.6L877.2,144.5L875.3,143.5L875.2,141.6L863.8,143.4L866.7,145.3L864.8,149.6L863,150.7L861.7,149.7L862.4,147.4L859.5,144.9L862.1,144.1L868.4,139.5L873.9,138.7L876.9,139.2L879.8,134.7L881.6,135.9L887.3,132.3L889,129.2L888.6,126.3L889.7,124.7L892.7,124.3L894.2,127.8L894.1,129.9L891.6,132.4L891.6,135.1Z",
  "M659.8,49.3L649.1,49.2L648.4,48L643.3,47.3L642.9,46L645.8,45.4L645.7,44L651.2,41.8L648.6,41.5L655.3,39.3L654.5,38.1L669.9,35.1L683.9,33.7L689.3,33.4L691.3,34.4L671.1,37.7L662.4,40.1L653.9,45.1L654.5,47.2L659.8,49.3Z",
  "M459.7,60.2L459.1,61.8L462.2,63.6L458.6,65.5L448.2,67.7L436.8,66.5L439.5,65.4L433.5,64.2L438.4,63.7L438.3,62.9L432.4,62.3L434.3,60.7L438.5,60.3L442.8,62L447.1,60.6L450.6,61.4L455.1,60L459.7,60.2Z",
  "M374.6,429.5L378,430.6L379.6,434.5L359.8,437.1L349.5,436.1L350,435L358.4,433.5L364.8,429.5L374.6,429.5Z",
  "M165.4,47.5L158.1,48.8L156.6,47.7L150.2,46.3L155.7,41.7L153,40.1L173.5,40.4L179.1,42.2L168.8,44.7L165.4,46.5L165.4,47.5Z",
  "M258.3,26.4L261.6,27.2L252.7,29.9L247.8,30.1L242,29.8L239,28.7L239.1,27.8L241.3,27.1L236.2,27.2L231.4,25.2L235.2,23.2L238.1,23.1L236.8,22.5L243.3,22.3L246.9,23.7L256.1,24.7L258.3,26.4Z",
  "M237,33L245.5,33.8L247.9,34.6L247.3,35.6L252.3,36.8L274.6,36.5L277.6,37.5L278.2,38.5L272.4,39.8L255.1,39.9L243.3,38.7L242,36.1L239.2,35L230.2,33.9L231.3,32.8L237,33Z",
  "M550.7,26.3L559.8,28.2L552.9,29.2L551.3,31.1L548.9,31.6L547.6,33.7L544.2,33.8L538.2,32.2L540.7,31.3L531.2,28.4L529,26.4L536.6,25.5L538.1,26.4L542.1,26.4L543.1,25.5L547.2,25.4L550.7,26.3Z",
  "M980.6,334.6L981.2,335.6L983.2,334.6L984,335.7L984,336.7L979.7,340.8L980.8,342.1L976.3,343.1L973.9,347.3L970.4,349.2L963,348.1L962.5,347.2L964,345.3L973.7,340L978,334.7L980,333.5L980.6,334.6Z",
  "M847.9,226.4L845.7,228.9L843.6,229.4L833.8,229.4L833.4,231.3L835.9,233.6L837.4,232.4L842.6,231.6L842.4,232.7L841.2,232.4L837.5,234.9L840.1,238.1L839.6,239L842.1,242L842.1,243.6L840.6,244.4L839.5,243.5L840.9,241.4L838.2,242.4L837.5,241.7L837.8,240.7L835.8,239.2L836,236.7L834.2,237.5L834.5,244.1L831.6,243.7L832.4,241.4L831.9,238.9L830.8,238.9L829.9,237.2L833.4,228.6L835.8,226.7L841.5,227.8L844.7,227.7L847.4,225.8L847.9,226.4Z",
  "M344.1,100.5L342.2,102.7L344,101.8L345.9,102.4L344.9,103.3L351.5,104.1L350.6,106L352.5,105.6L353.8,108.5L352.6,110.8L349.5,110.4L350.1,108.3L349.3,108L346.1,110.2L344.5,110.1L346.4,108.9L343.7,108.3L335.4,108.3L334.9,107.6L336.7,106.7L335.5,106L337.8,104.5L340.7,100.4L344.8,98.1L346.1,98.2L344.1,100.5Z",
  "M199.4,35.3L200.5,36.2L205.9,35.9L206.4,37.1L204.7,38.3L184,39.9L183.7,39L189.5,37.9L173,37.8L179.4,34.6L197,37.1L193.1,34.7L195.6,33.7L198.5,34L199.4,35.3Z",
  "M777.6,28.4L771.5,28.7L763.8,28L759.2,27L757.1,25.2L753.3,24.7L760.5,22.9L766.5,22.4L771.9,23.6L778.3,26.1L777.6,28.4Z",
  "M985,322.4L987,325.1L987.1,323.3L988.4,324L988.8,326L991,326.8L992.9,327L994.5,326L995.9,326.3L995.2,328.6L994.4,330.1L992.2,330L991.5,330.8L991.8,331.9L988.9,335.5L986.8,336.5L986.3,335.9L985.1,335.5L986.7,333.4L985.8,332L982.8,331L982.9,330L984.9,329.2L985.4,327.2L985.3,325.5L984.1,323.8L984.2,323.4L980.7,320L979.5,318.2L980.6,318L982.1,319.5L984.2,320.1L985,322.4Z",
  "M309.9,411.3L310.2,412.5L308.9,414.4L302.6,415.3L298.9,415.2L300.3,414.2L293.9,414.9L291.8,414.2L291.6,413.1L296.6,411.8L299.8,411.9L300.6,410.6L300.7,407.6L302.3,406.4L304.9,406L306.3,407L309.9,411.3Z",
  "M311.8,367.6L315.4,369.2L319.3,369.8L318.1,371.1L315.4,371.2L314,370.3L313.1,371.3L310.7,372.1L307.7,371.8L305.7,371.1L302.8,370.7L299.3,369.3L296.4,367.9L292.6,365L294.9,365.6L298.8,367.3L302.5,368.2L303.9,367L304.8,365.3L307.4,364.2L309.4,364.5L311.8,367.6Z",
  "M801.7,247.3L807.1,247.6L807.7,246.5L812.8,247.8L813.8,249.4L818,249.9L821.4,251.4L818.2,252.4L815.2,251.3L809.8,251.2L801.9,249.5L800.8,249.8L795.7,248.8L795.2,247.7L792.7,247.5L794.6,245.1L798,245.2L801.3,246.4L801.7,247.3Z",
  "M899,100.3L901.8,104.8L897.7,104L896,107.7L898.7,110.3L898.6,112.1L896.5,110.6L894.7,112.5L894.2,110.4L894.5,107.9L894.2,105.1L894.8,103.2L894.9,99.8L893.3,97.3L893.6,93.8L896.1,92.6L895,91.4L896.3,91.1L897.9,95.2L897.9,97.7L899,100.3Z",
  "M278.7,171.8L279.8,172.8L282.4,172.5L287.4,175.8L290,176.3L289.8,177L291.9,177.1L294,178.2L293.6,178.8L291.8,179.1L284,179.3L285.9,177.8L284.7,177.2L283,177L282,176.3L281.3,174.8L279.8,174.9L277.2,174.2L276.3,173.7L272.7,173.3L271.8,172.8L272.8,172.2L270.1,172L268.1,173.3L266.9,173.4L266.5,174L265.1,174.3L264,174L265.4,173.3L266,172.3L267.3,171.8L271.5,170.7L276.1,171L278.7,171.8Z",
  "M899.7,117.1L901.7,117.7L903.7,116.6L904.3,119.4L900.2,120.1L897.7,122.7L893.4,120.9L891.8,123.7L888.8,123.8L888.4,121.2L889.8,119.3L892.7,119.1L893.5,115.6L894.4,113.6L897.6,116.3L899.7,117.1Z",
  "M837,182.7L838.7,183.4L839.6,182.8L839.8,183.4L839.4,184.5L840.3,186.3L839.6,188.4L837.9,189.3L837.5,191.3L838.1,193.4L839.6,193.7L840.8,193.4L844.3,194.8L844,196.2L844.9,196.8L844.7,198L842.5,196.7L841.5,195.4L840.8,196.3L839,194.8L836.5,195.1L835.1,194.6L835.2,193.5L836.1,192.9L835.3,192.3L834.9,193.2L833.5,191.7L833.1,190.6L833,188.2L834.1,189L834.4,185L835.3,182.7L837,182.7Z",
  "M481.1,96.4L476.2,98L472.3,97.6L474.5,94.9L473.1,92.3L479,89.1L481.3,89L484.3,90.6L482.8,92.3L483.2,94.2L481.1,96.4Z",
  "M221.2,41.3L224.5,41.8L229.5,41.5L230.2,42.2L227.6,43.5L231.8,44.6L231.3,46.9L226.8,47.9L224.1,47.6L222.2,46.7L215.3,44.7L215.3,43.9L221,44.2L217.9,42.5L221.2,41.3Z",
  "M903,36.9L900.8,38.8L890.6,38.7L886,39.3L880.5,37.7L882,35.9L885.6,35.4L893,35.5L903,36.9Z",
  "M851,208.5L851.5,211.6L850.5,214L849.5,211.4L848.2,212.7L849.1,214.5L848.3,215.7L845.1,214.3L844.3,212.4L845.1,211.2L843.4,210L842.5,211L841.2,210.9L839.1,212.4L838.7,211.6L839.8,209.5L843,207.8L844,208.9L846.1,208.2L846.6,207.1L848.5,207L848.4,205.1L850.6,206.3L851,208.5Z",
  "M570.7,24.5L576.1,25.4L572,26.8L564,27.1L555.8,26.7L555.3,26L551.3,25.9L548.2,24.7L556.8,24L560.9,24.6L563.7,23.9L570.7,24.5Z",
  "M263.4,62.2L264,63.3L265.4,62.9L273.2,65.3L273.5,66.5L275.5,66.3L277.5,67.1L275,68L270.7,67.3L269.1,66.2L266.4,67.5L262.4,68.9L261.5,67.4L257.7,67.6L260.1,66.4L260.5,64.3L261.4,62L263.4,62.2Z",
  "M903.9,334.2L906.6,335.1L910.2,334.3L911.9,334.5L912.1,337.5L911.2,338.4L910.9,340.4L909.9,339.7L908,341.5L905.7,341.3L904,339.1L903.6,337.4L902,335.2L902.1,334L903.9,334.2Z",
  "M241.1,44L238.1,45.9L235,45.8L233.2,43.6L233.3,42.3L234.7,41.2L237.5,40.5L243.3,40.6L248.6,41.3L244.4,43.5L241.1,44Z",
  "M298.4,179.2L300.8,179.6L301.1,179.2L303.3,179.2L305,179.9L305.7,179.8L306.2,180.7L307.7,180.6L307.6,181.4L308.9,181.5L310.2,182.4L309.2,183.5L307.9,182.9L305.7,182.9L305.2,183.4L304.1,183.5L303.7,182.9L302.8,183.3L301.7,185L301,184.6L300.8,183.9L299,183.5L296,183.4L294.7,183.9L293.2,183.1L293.4,182.3L298.1,182.9L299.1,182.3L297.8,181.2L297.8,180.2L296.1,179.8L296.7,179.1L298.4,179.2Z",
  "M226.4,33.9L228.5,35.1L228.6,36.4L227.3,38.3L222.8,38.6L219.8,38.2L219.8,36.7L215.3,36.9L215.1,34.9L218.1,35L222.3,34.1L226.2,34.3L226.4,33.9Z",
  "M177.2,31.6L176.8,33.5L174.7,34.4L172.1,34.5L166.9,35.6L162.5,36L158.7,35.5L163.5,33.6L169.2,31.9L173.4,32L177.2,31.6Z",
  "M725.6,214.2L723.2,214.7L721.9,212.7L721.4,209L722.6,204.9L724.6,206.3L727.2,210.8L726.8,213.4L725.6,214.2Z",
  "M791.9,29.9L776.2,30.9L781.3,27.5L783.6,27.2L792.7,28.8L791.9,29.9Z",
  "M334.5,434.5L332.9,437L327.1,436.7L320.9,436.8L317.4,435.9L315.9,435.1L328.1,435.4L331.6,433.5L334.5,434.5Z",
  "M156.9,106L155.5,106.4L151,105.2L150.1,104.3L147.6,103.4L147.1,102.7L144.3,102.2L143.2,100.8L143.5,100.3L150.7,101.5L153,103.6L155.8,104.6L156.9,106Z",
  "M222.1,29.8L223.1,30.9L218.6,30.6L214,29.8L207.8,29.7L210.5,28.9L207.2,28.3L207,27.3L219.9,28.6L222.1,29.8Z",
  "M57.8,433.2L52.4,433.5L48.8,432.6L45.2,430.9L46.9,429.9L52.1,430.3L57,432L57.8,433.2Z",
  "M287.9,43.2L288.2,43.9L282.2,43.8L279.2,44.1L275.3,42.6L275.5,41.7L276.8,41.5L283.2,41.8L287.9,43.2Z",
  "M922.2,244L920.7,244.2L920.3,244.9L917.3,246.1L915.9,246.1L912,244.7L912.2,243.9L914.7,244.3L916.2,244.1L916.7,242.8L917.1,242.8L917.3,244.1L918.9,243.9L919.7,243.1L921.2,242.2L920.9,240.7L922.6,240.6L923.2,241L923.1,242.4L922.2,244Z",
  "M836.6,171.8L835.4,173.9L833.9,171.7L833.6,169.8L835.3,167.3L837.5,165.4L838.8,166.1L836.6,171.8Z",
  "M225.1,413.8L228.1,414.2L231.1,413.9L232.8,415.3L220,415.3L217.2,414.8L215.8,413.7L217.5,413.3L225.1,413.8Z",
  "M806.5,182.3L804.1,183.5L801.8,182.7L801.7,180.5L803.1,179.3L806.1,178.6L807.7,178.7L808.4,179.7L807.1,180.8L806.5,182.3Z",
  "M234.3,53.4L232.6,54.3L228.8,53.5L226.6,53.8L222.8,52.6L225.2,51.9L227.2,50.7L231.8,51.9L234.3,53.4Z",
  "M543.1,132.3L542.1,134.3L542.5,135.1L541.9,136.4L539.8,135.5L534.5,133.9L534.9,132.6L538.2,132.8L543.1,132.3Z",
  "M525.6,124.7L527.2,126.5L526.9,129.9L525.6,129.7L524.5,130.6L523.4,129.9L523.3,126.8L522.7,125.3L524.2,125.5L525.6,124.7Z",
  "M845.7,255.9L843.3,256.5L842.9,256.2L843.2,255.3L844.4,253.7L847.1,252.7L847.5,252.1L852.7,251.1L853.7,251.5L852.7,252.2L847.5,254L845.7,255.9Z",
  "M642,24.2L635.8,24.7L635.4,25.1L632.2,25.5L629.2,24.9L630.8,24.1L624.6,24L634.2,23.6L634.8,24.2L636.4,23.6L639,23.2L643.1,23.8L642,24.2Z",
  "M240,38.4L238.5,39.4L234.4,39.2L231.1,38.5L232.5,37.4L236.5,36.7L239,37.6L240,38.4Z",
  "M568.7,31L562.5,32.1L557.6,31.5L559.5,30.8L557.8,30L563.6,29.5L564.7,30.5L568.7,31Z",
  "M233.8,30.5L229.7,31.1L227.4,30.5L226.2,29.5L226,28.4L231.2,28.7L234.6,29.6L233.8,30.5Z",
  "M337.4,360.6L339.6,361.7L338.8,362.6L335,363.4L333.8,362.5L331.4,363.7L330,362.5L333.3,361L335.7,361.6L337.4,360.6Z",
  "M857.5,227.1L857.3,229.3L855.9,229.1L855.5,230.6L856.6,232L855.8,232.3L854.7,230.7L853.9,227.4L854.4,225.4L855.4,224.4L855.6,225.8L857.2,226.1L857.5,227.1Z",
  "M964.2,286.6L963.2,287.2L959.6,285.4L956,282.2L955.6,281.4L956.8,281.4L958.4,282.3L964.2,286.6Z",
  "M918.7,38.1L915.5,39.1L911,38.9L905.9,37.9L906.5,37.1L918.7,38.1Z",
  "M874,142.7L874.3,143.6L872.8,145.2L871.6,144.3L870.2,144.9L869.5,146.4L867.7,145.7L867.7,144.5L869.2,143L870.8,143.3L872,142.2L874,142.7Z",
  "M289.3,58.4L286.1,58.5L285.5,57.3L286.6,55.8L289.2,55.5L291.4,56.2L291.4,57.3L291.1,57.6L289.3,58.4Z",
  "M75,84L72.2,85L70.8,84.4L70.4,83.2L74.4,81.9L76.2,82L77.4,82.8L75,84Z",
  "M848.6,198.9L849.4,201.8L847.3,201.1L848,203.5L846.7,204.1L846.6,202.3L845.7,202.2L845.3,200.6L846.9,200.8L846.9,199.9L845.2,197.9L847.8,198L848.6,198.9Z",
  "M193.9,31.4L188.7,32.2L184.6,31.3L186.9,30.5L190.9,30.3L194.9,30.7L193.9,31.4Z",
  "M844.4,203.7L843.4,204.6L842.5,206.2L841.7,206.9L839.9,205.2L841.2,203.8L841.5,202.2L843,202L842.6,203.8L844.7,201.3L844.4,203.7Z",
  "M898.9,42.9L888.5,42.5L891.1,41.5L894.6,41.3L898.6,42.2L898.9,42.9Z",
  "M131.4,91.9L134,91.7L133.2,94.6L135.6,96.6L134.5,96.6L132.8,95.5L131.8,94.3L130.4,93.5L129.9,92.4L130.1,91.6L131.4,91.9Z",
  "M163.3,417.8L166.9,418.2L170.2,417.8L168.6,418.7L166,419.3L162.2,419.1L159.4,418.2L160,417.4L163.3,417.8Z",
  "M862.4,237.9L863.4,239.9L861.1,238.8L855.3,238.7L855.9,237.3L859.4,237.2L862.4,237.9Z",
  "M695.2,357L691,357.2L690.9,355.8L691.5,354.3L693.3,355.1L695.9,355.4L696,355.9L695.2,357Z",
  "M535.2,87.9L533.6,90L530.7,88.5L530.3,87.4L534.4,86.6L535.2,87.9Z",
  "M841.4,250.7L841,252.1L836.8,252.8L833.1,252.5L833.1,251.6L835.3,251.1L837.1,251.8L838.9,251.6L841.4,250.7Z",
  "M0,47.2L0.4,47.1L2.7,47.1L6.7,47.9L6.5,48.2L3.6,48.8L0,49L0,47.2Z",
  "M827.5,250.7L828.5,251.4L830.2,251.2L830.9,252.2L825.8,253.1L824.3,253.1L825.2,251.6L826.8,251.6L827.5,250.7Z",
  "M209.7,42.4L207.3,44.1L202.9,42.3L203.9,41.9L207.6,41.8L209.7,42.4Z",
  "M829.2,206.2L825.5,208.6L826.8,206.8L828.8,205.3L830.5,203.5L832,200.9L832.5,203L830.6,204.4L829.2,206.2Z",
  "M286.4,184.3L285.5,184.8L284,184.4L282.4,183.4L282.7,182.8L283.9,182.7L286.4,183L287.9,183.6L288.3,184.3L286.4,184.3Z",
  "M526.6,122.3L525.6,124.3L524.4,123.7L523.7,122L524.3,121.1L526.1,120.1L526.6,122.3Z",
  "M272.5,69.7L269.3,71.1L267.3,71.1L266.7,70.4L268.8,69.2L272.6,69.2L272.5,69.7Z",
  "M23,67L24.7,67.5L26.4,67.2L28.7,67.9L31.4,68.2L31.2,68.5L29.1,69.1L27,68.5L25.9,68L23.5,68.2L22.8,68L23,67Z",
  "M838.6,199.6L840.2,200.4L842,200.4L841.9,201.5L840.7,202.5L838.9,203.3L838.8,202.1L839,200.8L838.6,199.6Z",
  "M925.4,241.5L924.5,242.2L924,240.7L923.3,239.7L920.5,237.8L918.5,237L919.3,236.4L922.9,238.3L924,239.4L925.1,240.2L925.4,241.5Z",
  "M596,138.8L594.2,139.9L594.5,140.6L591.6,141.7L590.2,141.3L589.6,140.3L591.1,140.2L591.5,139.6L593.5,139.6L596,138.8Z",
  "M995.5,274.3L996.4,275.1L996,276.4L994.3,276.7L992.7,276.4L992.5,275.3L993.5,274.4L994.8,274.7L995.5,274.3Z",
  "M328.3,104.5L327,104.6L323.4,103.8L320.8,102.5L321.7,102.3L325.4,103L328.2,104L328.3,104.5Z",
  "M67.9,181.2L67.5,181.7L66.8,181.3L66.9,180.6L66.5,179.6L66.6,179.4L67.1,178.9L66.9,178.4L67.1,178.2L68.8,178.9L69.3,179.2L70,180.1L69.9,180.3L67.9,181.2Z",
  "M565.8,138.8L567.4,139.6L569.5,139.5L571.6,139.6L571.5,140.1L573,139.8L572.7,140.5L568.7,140.8L568.7,140.3L565.3,139.8L565.8,138.8Z",
  "M933,247.4L932.2,247.7L931,246.7L929.8,245.1L929.2,243.1L929.6,242.9L929.9,243.6L930.7,244.2L932.1,245.8L933.4,246.7L933,247.4Z",
  "M323.2,111L325.2,111.4L327.7,111.3L326.4,112.4L325.4,112.5L321.8,111.4L321.1,110.6L322.2,109.8L323.2,111Z",
  "M835.3,256.2L834.1,256.2L830.5,254.4L833.1,253.9L834.5,254.7L835.5,255.5L835.3,256.2Z",
  "M195.4,29.1L192,29.6L187.4,29.6L187.4,29.3L190.3,28.5L195.4,29.1Z",
  "M317.8,183.4L317.1,184.1L313.4,184.1L313.2,183L313.6,182.7L315.9,182.7L317.3,182.9L317.8,183.4Z",
  "M837.6,196.6L836.8,198.8L835.6,197.5L834.2,195.6L836.6,195.7L837.6,196.6Z",
  "M40.1,76.9L38.4,77.3L36.5,76.8L34.9,76.1L37.6,75.7L39.8,75.9L40.1,76.9Z",
  "M284.6,169.3L283.9,169.4L283.2,167.9L282.2,167.2L282.8,165.6L283.6,165.7L284.6,167.8L284.6,169.3Z",
  "M239.3,31.9L238.1,32L232.9,31.8L232.1,31.1L237.7,31.1L239.7,31.6L239.3,31.9Z",
  "M151.2,417.8L155.5,418.8L150.2,418.4L146.4,417.7L148.5,417.2L151.2,417.8Z",
  "M330.7,204.2L328.4,204.4L327.9,204.2L328.7,203.5L328.7,202.5L330.3,202.2L330.8,202.3L330.7,204.2Z",
  "M853.5,238.8L852.4,239.7L850.5,239.2L850,238.1L852.8,238L853.5,238.8Z",
  "M279.8,71.2L278.7,72.5L277.5,72.3L276.8,71.5L278,70.6L279.1,70.6L279.8,71.2Z",
  "M944.1,251.3L944.2,251.8L942,250.7L940.5,249.8L939.5,249L939.9,248.7L941.2,249.3L943.4,250.5L944.1,251.3Z",
  "M874.2,245.9L872.8,247.6L872.5,245.7L873.6,243.9L874.2,244.7L874.2,245.9Z",
  "M946.8,255.2L945.7,255.3L944,255L943.4,254.6L943.6,253.6L945.4,254L946.4,254.6L946.8,255.2Z",
  "M949.1,254.5L948.7,255L946.6,252.8L946.1,251.3L947,251.3L948,253.3L949.1,254.5Z",
  "M964.2,268.2L964.6,270.2L963.9,269.9L963.3,270L962.9,269.3L962.9,267.4L964.2,268.2Z",
  "M283.8,162.1L280.8,162.5L280.6,161.5L281.9,161.3L283.8,161.4L283.8,162.1Z",
  "M950.3,256.8L951.1,257.7L949.2,257.7L948.1,256.1L949.8,256.7L950.3,256.8Z",
  "M286.1,162L285.6,163.9L285.1,163.5L285.2,162.2L283.9,161.2L283.9,160.9L286.1,162Z",
];

function MapTitle() {
  return (
    <div className="px-5 pt-4 pb-2">
      <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 600, color: C.ivory, letterSpacing: 0.2, lineHeight: 1.4 }}>
        The Artium Network <span style={{ color: C.ivoryDim, fontWeight: 400 }}>— Bridging Musicians Worldwide</span>
      </h3>
    </div>
  );
}

const TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const TILE_ATTRIBUTION = 'Tiles &copy; <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a>';

function consPinIcon({ active, hasStudents, hasTeacher }) {
  const w = active ? 18 : 14;
  const h = Math.round(w * 1.28);
  const pinColor = hasTeacher ? "#C0392B" : hasStudents ? "#27AE60" : "#ffffff";
  const strokeColor = hasTeacher ? "#8B1A1A" : hasStudents ? "#1E8449" : "#aaaaaa";
  const glow = active
    ? `filter:drop-shadow(0 0 6px ${pinColor}99) drop-shadow(0 2px 3px rgba(0,0,0,0.7));`
    : `filter:drop-shadow(0 1px 3px rgba(0,0,0,0.5));`;
  return L.divIcon({
    className: "artium-pin",
    html: `
      <div style="position:relative; width:${w}px; height:${h}px; ${glow}">
        <svg width="${w}" height="${h}" viewBox="0 0 24 30" style="display:block;">
          <path d="M12 0C5.4 0 0 5 0 11.4 0 19.6 12 30 12 30s12-10.4 12-18.6C24 5 18.6 0 12 0z"
            fill="${pinColor}" stroke="${strokeColor}" stroke-width="1.5" />
          <circle cx="12" cy="11.5" r="4" fill="${pinColor === "#ffffff" ? "#1a1a1a" : "white"}" opacity="0.9" />
        </svg>
      </div>
    `,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
  });
}

function WorldMap({ selectedId, onSelect, studentsByCons, height = "100%", interactive = false }) {
  const legend = [
    { color: "#C0392B", label: "Open to teaching" },
    { color: "#27AE60", label: "Has students, not teaching" },
    { color: "#ffffff", label: "No students yet" },
  ];
  const allStudents = Object.values(studentsByCons).flat();
  const totalStudents = allStudents.length;
  const totalTeachers = allStudents.filter(s => s.teaching && s.teaching.open).length;
  return (
    <div className="artium-map" style={{ width: "100%", height, position: "relative" }}>
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        zIndex: 1000, display: "flex", flexDirection: "column", gap: 4,
        background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)",
        borderTop: "1px solid #E6EBF1",
        padding: "6px 12px",
        pointerEvents: "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {legend.map(({ color, label }) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#425466", fontFamily: FONT_BODY, whiteSpace: "nowrap" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, border: `1.5px solid ${color === "#27AE60" ? "#1E8449" : color === "#ffffff" ? "#E6EBF1" : "#8B1A1A"}`, display: "inline-block", flexShrink: 0 }} />
              {label}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, fontFamily: FONT_BODY, color: "#425466" }}>
          <span><span style={{ color: "#0A2540", fontWeight: 700 }}>{totalStudents}</span> students</span>
          <span style={{ width: 1, height: 10, background: "#E6EBF1", display: "inline-block" }} />
          <span><span style={{ color: "#0A2540", fontWeight: 700 }}>{totalTeachers}</span> open to teaching</span>
        </div>
      </div>
      <MapContainer
        center={[24, 14]}
        zoom={2}
        zoomSnap={0.5}
        minZoom={2}
        maxZoom={9}
        maxBounds={[[-85, -200], [85, 200]]}
        maxBoundsViscosity={1}
        scrollWheelZoom={interactive}
        style={{ width: "100%", height: "100%", background: C.ink }}
      >
        <TileLayer url={TILE_URL} attribution="" />
        {CONSERVATORIES.map((cons) => {
          const n = (studentsByCons[cons.id] || []).length;
          const active = selectedId === cons.id;
          return (
            <Marker
              key={cons.id}
              position={[cons.lat, cons.lng]}
              icon={consPinIcon({ active, hasStudents: n > 0, hasTeacher: (studentsByCons[cons.id] || []).some(s => s.teaching && s.teaching.open) })}
              eventHandlers={{ click: () => onSelect(cons.id) }}
            >
              <Tooltip direction="top" offset={[0, -28]}>
                <span style={{ fontFamily: FONT_BODY, fontWeight: 600 }}>{cons.short}</span>
                <br />
                <span style={{ fontFamily: FONT_MONO, fontSize: 11 }}>
                  {cons.city}, {cons.country}{n > 0 ? ` · ${n} student${n === 1 ? "" : "s"}` : ""}
                </span>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* APP                                                                 */
/* ---------------------------------------------------------------- */
const ACCESS_KEY = "artium_access_v1";
const SITE_PASSWORD = "artium2025";

function AccessGate({ onUnlock }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  function attempt() {
    if (value.trim() === SITE_PASSWORD) { onUnlock(); }
    else { setError(true); setValue(""); }
  }
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.inkSoft, fontFamily: FONT_BODY, padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400, background: "#FFFFFF", border: `1px solid ${C.inkLine}`, borderRadius: 12, padding: 40, boxShadow: "0 4px 24px rgba(10,37,64,0.07)" }}>
        <div style={{ marginBottom: 28 }}>
          <Logo size={22} />
          <p style={{ color: C.ivoryDim, fontSize: 14, marginTop: 12 }}>Private beta — enter access key to continue.</p>
        </div>
        <input
          type="password"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(false); }}
          onKeyDown={(e) => e.key === "Enter" && attempt()}
          placeholder="Access key"
          autoComplete="off"
          autoFocus
          style={{ ...inputStyle, boxSizing: "border-box", border: `1px solid ${error ? C.burgundy : C.inkLine}`, marginBottom: 8 }}
        />
        {error && <p style={{ color: C.burgundy, fontSize: 13, marginBottom: 12 }}>Incorrect key — try again.</p>}
        <button
          onClick={attempt}
          style={{ marginTop: 12, width: "100%", background: "#635BFF", color: "#FFFFFF", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
        >Continue</button>
      </div>
    </div>
  );
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem(ACCESS_KEY) === "1");
  const [onlineCount, setOnlineCount] = useState(1);
  const { user: authUser, profile: authProfile, loading: authLoading } = useAuth();
  const [screen, setScreen] = useState("entry");
  const [appTab, setAppTab] = useState("map");
  const [editingProfile, setEditingProfile] = useState(false);
  const [previewOnly, setPreviewOnly] = useState(false);
  const [authError, setAuthError] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  const [students, setStudents] = useState(() => seedTeaching(SAMPLE_STUDENTS));
  const [myProfile, setMyProfile] = useState(null);

  // Returning signed-in user: load their profile and skip straight to the app
  // (conservatory students) or the teacher map (piano-enthusiast learners).
  // Newly-confirmed user (clicked the email link): their profiles row doesn't
  // exist yet — create it now from the draft we stashed in their auth metadata
  // at signup time (stored server-side, so it survives the confirmation link
  // Realtime presence — track how many browser tabs are on the site
  useEffect(() => {
    if (!unlocked) return;
    const channel = supabase.channel("online_users", { config: { presence: { key: crypto.randomUUID() } } });
    channel
      .on("presence", { event: "sync" }, () => {
        setOnlineCount(Object.keys(channel.presenceState()).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ online_at: new Date().toISOString() });
      });
    return () => { supabase.removeChannel(channel); };
  }, [unlocked]);

  // being opened in a different browser/device than the one used to sign up).
  useEffect(() => {
    if (authLoading) return;
    if (authProfile) {
      if (authProfile.role === "learner") {
        setLearnerProfile({ name: authProfile.name, location: authProfile.location });
        setLearnerLoggedOut(false);
        if (["entry", "landing", "login", "confirmEmail", "learnerSignup"].includes(screen)) {
          setScreen("learnerMap");
        }
        return;
      }
      const me = fromDbProfile(authProfile);
      setMyProfile(me);
      setPreviewOnly(false);
      setStudents((arr) => [...arr.filter((s) => s.id !== me.id), me]);
      if (screen === "entry" || screen === "landing" || screen === "login" || screen === "confirmEmail") {
        setSelectedConsId(me.conservatoryId);
        setScreen("app");
        setAppTab("map");
      }
      return;
    }
    if (authUser) {
      const pendingStudent = authUser.user_metadata?.pendingProfile;
      const pendingLearner = authUser.user_metadata?.pendingLearner;
      if (pendingStudent) {
        supabase.from("profiles").insert(toDbProfile(pendingStudent, authUser.id)).then(({ error }) => {
          if (error) { setAuthError(error.message); return; }
          supabase.auth.updateUser({ data: { pendingProfile: null } });
          const me = { id: authUser.id, name: pendingStudent.name, instrument: pendingStudent.instrument, conservatoryId: pendingStudent.conservatoryId, year: pendingStudent.years, bio: pendingStudent.bio, tastes: pendingStudent.tastes, pieces: pendingStudent.pieces, videoLink: pendingStudent.videoLink, top: pendingStudent.top, flop: pendingStudent.flop, photoUrl: pendingStudent.photoUrl, teaching: pendingStudent.teaching, online: true };
          setMyProfile(me);
          setStudents((arr) => [...arr.filter((s) => s.id !== me.id), me]);
          setSelectedConsId(me.conservatoryId);
          setScreen("app");
          setAppTab("map");
        });
      } else if (pendingLearner) {
        supabase.from("profiles").insert({ id: authUser.id, role: "learner", name: pendingLearner.name, location: pendingLearner.location, instrument: pendingLearner.instrument, bio: pendingLearner.motivation, approved: true }).then(({ error }) => {
          if (error) { setAuthError(error.message); return; }
          supabase.auth.updateUser({ data: { pendingLearner: null } });
          setLearnerProfile({ name: pendingLearner.name, location: pendingLearner.location });
          setScreen("learnerMap");
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authProfile, authUser]);

  // Pull in any real conservatory-student signups so they show up on the map
  // alongside the sample data (learner accounts aren't conservatory students).
  useEffect(() => {
    supabase.from("profiles").select("*").eq("approved", true).eq("role", "student").then(({ data, error }) => {
      if (error || !data) return;
      const real = data.map(fromDbProfile);
      const realIds = new Set(real.map((r) => r.id));
      setStudents((arr) => [...arr.filter((s) => !realIds.has(s.id)), ...real]);
    });
  }, []);

  const [learnerProfile, setLearnerProfile] = useState(null);
  const [learnerLoggedOut, setLearnerLoggedOut] = useState(false);
  const [teachRequests, setTeachRequests] = useState({});

  const [draft, setDraft] = useState(emptyDraft());
  const [step, setStep] = useState(0);

  const [selectedConsId, setSelectedConsId] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [profileBack, setProfileBack] = useState("map");

  const [conversations, setConversations] = useState(SAMPLE_CONVERSATIONS);
  const [activeChatId, setActiveChatId] = useState(null);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  const [musicOn, setMusicOn] = useState(false);
  const audioRef = useRef(null);
  function toggleMusic() {
    const el = audioRef.current;
    if (!el) return;
    if (musicOn) {
      el.pause();
      setMusicOn(false);
    } else {
      el.play().catch(() => {});
      setMusicOn(true);
    }
  }

  const studentsByCons = students.reduce((acc, s) => {
    (acc[s.conservatoryId] = acc[s.conservatoryId] || []).push(s);
    return acc;
  }, {});

  function startApply() {
    if (authUser && authProfile?.role === "learner") {
      setAuthError("You're already registered as a piano enthusiast with this account. You can't also sign up as a conservatory student — log out first if you want to create a separate account with a different email.");
      return;
    }
    setDraft(emptyDraft());
    setStep(0);
    setEditingProfile(false);
    setAuthError("");
    setScreen("signup");
  }
  function startLogin() {
    setAuthError("");
    setScreen("login");
  }
  async function handleLogin(email, password) {
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  }
  async function handleLogout() {
    await supabase.auth.signOut();
    setMyProfile(null);
    setStudents((arr) => arr.filter((s) => s.id !== myProfile?.id));
    setScreen("landing");
    setAppTab("map");
  }
  function startPreview() {
    setPreviewOnly(true);
    setScreen("app");
    setAppTab("map");
  }
  function goHome() {
    setScreen("landing");
    setSelectedStudentId(null);
    setAppTab("map");
  }
  function chooseStudent() {
    if (myProfile) { setScreen("app"); setAppTab("map"); return; }
    setScreen("landing");
  }
  function chooseLearner() {
    if (learnerProfile) { setScreen("learnerMap"); return; }
    if (learnerLoggedOut) { startLogin(); return; }
    setLearnerProfile(null); setAuthError(""); setScreen("learnerSignup");
  }
  async function submitLearner({ name, location, email, password, instrument, motivation }) {
    setAuthError("");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { pendingLearner: { name, location, instrument, motivation } } },
    });
    if (error) { setAuthError(friendlyAuthError(error.message)); return; }
    if (data.session && data.user) {
      const { error: insertError } = await supabase.from("profiles").insert({ id: data.user.id, role: "learner", name, location, instrument, bio: motivation, approved: true });
      if (insertError) { setAuthError(insertError.message); return; }
      await supabase.auth.updateUser({ data: { pendingLearner: null } });
      setLearnerProfile({ name, location });
      setLearnerLoggedOut(false);
      setScreen("learnerMap");
    } else {
      setLearnerProfile({ name, location });
      setPendingEmail(email);
      setScreen("confirmEmail");
    }
  }
  function backToEntry() { setScreen("entry"); }
  function sendTeachRequest(teacherId) {
    setTeachRequests((r) => ({ ...r, [teacherId]: "pending" }));
    // No backend yet: simulate the teacher receiving and accepting the request.
    setTimeout(() => {
      setTeachRequests((r) => ({ ...r, [teacherId]: "accepted" }));
      setConversations((c) => (c[teacherId] ? c : { ...c, [teacherId]: [
        { from: "them", text: "Hi! Thanks for reaching out — I'd be glad to teach you. When works for a first lesson?" },
      ] }));
    }, 1600);
  }
  function goToProfile() {
    if (!myProfile) return;
    setScreen("app");
    setAppTab("profile");
    setSelectedStudentId(null);
  }
  function update(partial) { setDraft((d) => ({ ...d, ...partial })); }
  function toggleTaste(t) {
    setDraft((d) => ({ ...d, tastes: d.tastes.includes(t) ? d.tastes.filter((x) => x !== t) : [...d.tastes, t] }));
  }
  async function submitApplication() {
    setAuthError("");
    if (editingProfile) {
      const { error } = await supabase.from("profiles").update(toDbProfile(draft, myProfile.id)).eq("id", myProfile.id);
      if (error) { setAuthError(error.message); return; }
      const updated = { ...myProfile, ...draft };
      setMyProfile(updated);
      setStudents((arr) => arr.map((s) => (s.id === myProfile.id ? updated : s)));
      setScreen("app"); setAppTab("profile");
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: draft.email,
        password: draft.password,
        options: { data: { pendingProfile: draft } },
      });
      if (error) { setAuthError(friendlyAuthError(error.message)); return; }
      if (data.session && data.user) {
        // Email confirmation is off — we already have an active session, insert right away.
        const { error: insertError } = await supabase.from("profiles").insert(toDbProfile(draft, data.user.id));
        if (insertError) { setAuthError(insertError.message); return; }
        await supabase.auth.updateUser({ data: { pendingProfile: null } });
        setDraft((d) => ({ ...d, id: data.user.id }));
        setScreen("pending");
      } else {
        // Email confirmation required — the draft is stored server-side in the
        // user's auth metadata, so it's picked up after confirming on any device.
        setPendingEmail(draft.email);
        setScreen("confirmEmail");
      }
    }
  }
  function simulateApproval() {
    const me = { id: draft.id, name: draft.name || "Your name", instrument: draft.instrument, conservatoryId: draft.conservatoryId, year: draft.years || "Current student", bio: draft.bio, tastes: draft.tastes, pieces: draft.pieces, videoLink: draft.videoLink, top: draft.top, flop: draft.flop, photoUrl: draft.photoUrl, teaching: draft.teaching, online: true };
    setMyProfile(me);
    setStudents((arr) => [...arr.filter((s) => s.id !== me.id), me]);
    setPreviewOnly(false);
    setSelectedConsId(me.conservatoryId);
    setScreen("app"); setAppTab("map");
  }
  function editProfile() {
    setDraft({ ...emptyDraft(), ...myProfile, pieces: myProfile.pieces || [], tastes: myProfile.tastes || [] });
    setStep(0); setEditingProfile(true); setScreen("signup");
  }
  function openStudent(id, from) { setSelectedStudentId(id); setProfileBack(from); }
  function backFromProfile() { setSelectedStudentId(null); setAppTab(profileBack === "chat" ? "messages" : "map"); }
  function openChat(id) {
    setConversations((c) => (c[id] ? c : { ...c, [id]: [] }));
    setActiveChatId(id); setSelectedStudentId(null); setAppTab("messages");
  }
  function sendMessage(text) {
    if (!text.trim() || !activeChatId) return;
    setConversations((c) => ({ ...c, [activeChatId]: [...(c[activeChatId] || []), { from: "me", text }] }));
    const replies = [
      "Completely agree — want to run it together sometime this week?",
      "That's exactly the section I'm stuck on too.",
      "Send me a clip when you've got a take you like.",
      "I usually slow it down to half tempo first, helps a lot.",
      "Let's set up a call and compare fingerings.",
    ];
    setTimeout(() => {
      setConversations((c) => ({ ...c, [activeChatId]: [...(c[activeChatId] || []), { from: "them", text: replies[Math.floor(Math.random() * replies.length)] }] }));
    }, 1400);
  }

  if (!unlocked) return <AccessGate onUnlock={() => { localStorage.setItem(ACCESS_KEY, "1"); setUnlocked(true); }} />;

  return (
    <div style={{ fontFamily: FONT_BODY, background: C.ink, minHeight: "100%", width: "100%" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        .lg-pulse { animation: lgpulse 2.2s ease-out infinite; transform-origin: center; }
        @keyframes lgpulse { 0% { opacity:0.9; transform:scale(0.6);} 100% { opacity:0; transform:scale(2.4);} }
        .lg-fade { animation: lgfade 0.3s ease both; }
        @keyframes lgfade { from { opacity:0; transform:translateY(6px);} to { opacity:1; transform:translateY(0);} }
        .lg-blink { animation: lgblink 1.6s ease-in-out infinite; }
        @keyframes lgblink { 0%,100% { opacity:1;} 50% { opacity:0.25;} }
        .lg-scroll::-webkit-scrollbar { width: 4px; }
        .lg-scroll::-webkit-scrollbar-thumb { background: #E6EBF1; border-radius: 2px; }
        .lg-split-map { display: grid; grid-template-columns: 1fr; }
        .lg-split-chat { display: grid; grid-template-columns: 1fr; }
        @media (min-width: 768px) {
          .lg-split-map { grid-template-columns: 1fr 380px; }
          .lg-split-chat { grid-template-columns: 300px 1fr; }
        }
        @media (max-width: 767px) {
          .lg-split-map > :last-child { max-height: 45vh !important; overflow-y: auto; -webkit-overflow-scrolling: touch; }
        }
        input[type=range].artium-slider { -webkit-appearance: none; appearance: none; height: 2px !important; outline: none; border-radius: 2px; }
        input[type=range].artium-slider::-webkit-slider-thumb { -webkit-appearance: none !important; appearance: none !important; width: 10px !important; height: 10px !important; border-radius: 50% !important; background: #635BFF !important; cursor: pointer !important; border: none !important; }
        input[type=range].artium-slider::-moz-range-thumb { width: 10px !important; height: 10px !important; border-radius: 50% !important; background: #635BFF !important; border: none !important; cursor: pointer !important; }

        .artium-map, .artium-map .leaflet-container { border-radius: inherit; }
        .artium-map .leaflet-tile-pane { filter: saturate(1.05) brightness(1.0) contrast(1.0); }
        .artium-map .leaflet-control-zoom { border: 1px solid #E6EBF1 !important; box-shadow: 0 2px 8px rgba(10,37,64,0.08) !important; border-radius: 8px !important; overflow: hidden; }
        .artium-map .leaflet-control-zoom a { background: #FFFFFF !important; color: #0A2540 !important; border-color: #E6EBF1 !important; font-weight: 600 !important; }
        .artium-map .leaflet-control-zoom a:hover { background: #F6F9FC !important; }
        .artium-map .leaflet-control-attribution { display: none !important; }
        .artium-map .leaflet-tooltip { background: #FFFFFF !important; border: 1px solid #E6EBF1 !important; color: #0A2540 !important; border-radius: 10px !important; box-shadow: 0 4px 20px rgba(10,37,64,0.12) !important; padding: 8px 14px !important; font-family: Inter, sans-serif !important; font-size: 13px !important; }
        .artium-map .leaflet-tooltip-top:before { border-top-color: #E6EBF1 !important; }
        .artium-pin { background: transparent !important; border: none !important; }
      `}</style>

      <audio ref={audioRef} src={AMBIENT_AUDIO_SRC} loop preload="none" />

      {showGuestPrompt && (
        <SignupPromptModal
          onClose={() => setShowGuestPrompt(false)}
          onSignup={() => { setShowGuestPrompt(false); startApply(); }}
        />
      )}

      {screen === "entry" && <EntryGate onLearner={chooseLearner} onStudent={chooseStudent} onLogin={startLogin} learnerProfile={learnerProfile} learnerLoggedOut={learnerLoggedOut} studentLoggedIn={!!myProfile} />}
      {screen === "learnerSignup" && <LearnerSignup onSubmit={submitLearner} onBack={backToEntry} onLogin={startLogin} error={authError} />}
      {screen === "learnerMap" && (
        <LearnerScreen
          learner={learnerProfile}
          teachers={students.filter((s) => s.teaching && s.teaching.open)}
          teachRequests={teachRequests}
          onSendRequest={sendTeachRequest}
          conversations={conversations}
          activeChatId={activeChatId}
          setActiveChatId={setActiveChatId}
          onSend={sendMessage}
          onBack={backToEntry}
          onUpdateProfile={(updates) => setLearnerProfile((p) => ({ ...p, ...updates }))}
          onLogout={async () => { await supabase.auth.signOut(); setLearnerProfile(null); setLearnerLoggedOut(true); setScreen("entry"); }}
          onDeleteAccount={async () => {
            await supabase.rpc("delete_own_account");
            await supabase.auth.signOut();
            setLearnerProfile(null);
            setLearnerLoggedOut(false);
            setScreen("entry");
          }}
          onlineCount={onlineCount}
        />
      )}

      {screen === "landing" && <Landing onApply={startApply} onBack={backToEntry} onPreview={startPreview} onProfile={goToProfile} myProfile={myProfile} musicOn={musicOn} onMusicToggle={toggleMusic} audioRef={audioRef} error={authError} onlineCount={onlineCount} />}
      {screen === "login" && <LoginScreen onSubmit={handleLogin} onBack={goHome} error={authError} />}
      {screen === "signup" && (
        <SignupFlow
          draft={draft} update={update} toggleTaste={toggleTaste} step={step} setStep={setStep}
          editing={editingProfile} onSubmit={submitApplication} authError={authError}
          onCancel={() => setScreen(editingProfile ? "app" : "landing")}
          onHome={goHome}
        />
      )}
      {screen === "confirmEmail" && <ConfirmEmail email={pendingEmail} onLogin={startLogin} onHome={goHome} />}
      {screen === "pending" && <Pending name={draft.name} onApprove={simulateApproval} onHome={goHome} />}
      {screen === "app" && (
        <AppShell
          appTab={appTab} setAppTab={setAppTab} myProfile={myProfile}
          onApply={startApply} onHome={goHome} musicOn={musicOn} onMusicToggle={toggleMusic} audioRef={audioRef}
          onGuestTabClick={() => setShowGuestPrompt(true)} onlineCount={onlineCount}
          onBack={
            selectedStudentId ? backFromProfile :
            appTab === "messages" ? () => setAppTab("map") :
            appTab === "profile" ? () => setAppTab("map") :
            null
          }
          backLabel={
            selectedStudentId ? "Back to conservatory" :
            appTab === "messages" ? "Back to map" :
            appTab === "profile" ? "Back to map" :
            null
          }
        >
          {appTab === "map" && !selectedStudentId && (
            <MapScreen
              students={students} studentsByCons={studentsByCons}
              selectedConsId={selectedConsId} setSelectedConsId={setSelectedConsId}
              onOpenStudent={(id) => openStudent(id, "map")}
              isGuest={!myProfile}
              onGuestClick={() => setShowGuestPrompt(true)}
              onBack={goHome}
            />
          )}
          {appTab === "messages" && !selectedStudentId && (
            <Messages
              students={students} conversations={conversations} activeChatId={activeChatId}
              setActiveChatId={setActiveChatId} onSend={sendMessage}
              onOpenProfile={(id) => openStudent(id, "chat")}
              myProfile={myProfile}
              onBack={() => setAppTab("map")}
            />
          )}
          {appTab === "profile" && !selectedStudentId && myProfile && (
            <MyProfile profile={myProfile} onEdit={editProfile} onLogout={handleLogout} onDeleteAccount={async () => {
              await supabase.rpc("delete_own_account");
              await supabase.auth.signOut();
              setMyProfile(null);
              setStudents((arr) => arr.filter((s) => s.id !== myProfile?.id));
              setLearnerLoggedOut(false);
              setScreen("entry");
              setAppTab("map");
            }} onBack={() => setAppTab("map")} />
          )}
          {selectedStudentId && myProfile && (
            <StudentProfile
              student={students.find((s) => s.id === selectedStudentId)}
              conservatory={CONSERVATORIES.find((c) => c.id === students.find((s) => s.id === selectedStudentId)?.conservatoryId)}
              onBack={backFromProfile}
              onMessage={() => openChat(selectedStudentId)}
              locked={previewOnly}
              onApply={startApply}
            />
          )}
        </AppShell>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* LANDING                                                             */
/* ---------------------------------------------------------------- */
function Landing({ onApply, onBack, onPreview, onProfile, myProfile, musicOn, onMusicToggle, audioRef, error, onlineCount }) {
  return (
    <div style={{ background: "#FFFFFF", color: C.ivory, minHeight: "100vh" }}>
      {/* Nav */}
      <div style={{ borderBottom: `1px solid ${C.inkLine}`, background: "#FFFFFF" }}>
        <div className="max-w-6xl mx-auto px-8" style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Logo size={22} slogan />
          <div className="flex items-center gap-4">
            {onlineCount != null && (
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: C.ivoryDim }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1A9E6E", display: "inline-block" }} />
                <span style={{ color: C.ivory, fontWeight: 600 }}>{onlineCount}</span> online
              </span>
            )}
            <MusicBtn playing={musicOn} onToggle={onMusicToggle} audioRef={audioRef} />
            {myProfile ? (
              <button onClick={onProfile} title="My profile">
                <Avatar name={myProfile.name} id="me" size={36} photoUrl={myProfile.photoUrl} online />
              </button>
            ) : (
              <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm" style={{ color: C.ivoryDim, fontFamily: FONT_BODY, fontWeight: 500 }}>
                <ChevronLeft size={16} /> Back
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: C.inkSoft, borderBottom: `1px solid ${C.inkLine}` }}>
        <div className="max-w-6xl mx-auto px-8 py-20 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.brassDim, borderRadius: 20, padding: "5px 14px", marginBottom: 24 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.brass, display: "inline-block" }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: C.brass }}>For conservatory musicians</span>
            </div>
            <h1 style={{ fontSize: "clamp(36px,5vw,60px)", fontWeight: 700, lineHeight: 1.08, letterSpacing: -1, color: C.ivory, margin: 0 }}>
              Every conservatory.<br />One network.
            </h1>
            <p style={{ color: C.ivoryDim, fontSize: 18, lineHeight: 1.65, marginTop: 20, maxWidth: 460 }}>
              Artium connects students across the world's top conservatories — share repertoire, message peers, find teachers, and earn while you teach.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
              {!myProfile && <PrimaryBtn onClick={onApply} icon={ArrowRight}>Get started free</PrimaryBtn>}
              <GhostBtn onClick={onPreview} icon={Globe2}>Explore the map</GhostBtn>
            </div>
            {error && <p style={{ marginTop: 16, fontSize: 14, color: C.burgundy, lineHeight: 1.5 }}>{error}</p>}
            <p style={{ marginTop: 16, fontSize: 13, color: C.ivoryDim }}>{myProfile ? "You're signed in." : "No credit card required."}</p>
          </div>
          <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${C.inkLine}`, boxShadow: "0 8px 32px rgba(10,37,64,0.10)" }}>
            <div style={{ padding: "14px 18px", background: "#FFFFFF", borderBottom: `1px solid ${C.inkLine}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button onClick={onPreview} style={{ fontSize: 14, fontWeight: 600, color: C.brass, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: FONT_BODY, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Globe2 size={15} /> Explore
              </button>
              <span style={{ fontSize: 12, color: C.ivoryDim }}>200+ conservatories</span>
            </div>
            <WorldMap selectedId={null} onSelect={() => {}} studentsByCons={SAMPLE_STUDENTS.reduce((a, s) => { (a[s.conservatoryId] = a[s.conservatoryId] || []).push(s); return a; }, {})} height={280} />
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-6xl mx-auto px-8 py-20">
        <p style={{ fontSize: 13, fontWeight: 500, color: C.brass, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 }}>How it works</p>
        <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.5, color: C.ivory, marginBottom: 48 }}>Simple, from day one.</h2>
        <div className="grid sm:grid-cols-4 gap-8">
          {[
            { n: "01", t: "Build your profile", d: "Add your conservatory, repertoire, and a performance video to stand out." },
            { n: "02", t: "Join the map", d: "Your pin appears on the global map under your conservatory alongside current students." },
            { n: "03", t: "Connect worldwide", d: "Message students at any conservatory in the world, directly." },
            { n: "04", t: "Earn while you teach", d: "Accept tutoring requests from music enthusiasts and set your own rate." },
          ].map((s) => (
            <div key={s.n} style={{ padding: "24px", background: "#FFFFFF", border: `1px solid ${C.inkLine}`, borderRadius: 10, boxShadow: "0 2px 8px rgba(10,37,64,0.05)" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: C.brass, letterSpacing: 1, marginBottom: 12 }}>{s.n}</p>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.ivory, marginBottom: 8 }}>{s.t}</h3>
              <p style={{ fontSize: 14, color: C.ivoryDim, lineHeight: 1.65 }}>{s.d}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${C.inkLine}`, padding: "20px 0" }}>
        <div className="max-w-6xl mx-auto px-8" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Logo size={18} />
          <p style={{ fontSize: 13, color: C.ivoryDim }}>Beta — for demonstration purposes only.</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* SIGNUP FLOW                                                        */
/* ---------------------------------------------------------------- */
const STEP_LABELS = ["Introduce yourself", "Choose your conservatory", "Your musical voice", "Current repertoire", "Top & Flop", "Teaching", "Review & submit"];

function SignupFlow({ draft, update, toggleTaste, step, setStep, editing, onSubmit, onCancel, onHome, authError }) {
  const [submitting, setSubmitting] = useState(false);
  const labels = editing ? STEP_LABELS : ["Create your account", ...STEP_LABELS];
  const lastStep = labels.length - 1;
  const idx = editing ? step : step - 1;
  const canNext = [
    !editing ? draft.email.trim().length > 3 && draft.password.length >= 6 && draft.password === draft.confirmPassword : null,
    draft.name.trim().length > 1 && !!draft.instrument,
    !!draft.conservatoryId,
    draft.tastes.length >= 3,
    draft.pieces.length >= 1,
    true,
    !draft.teaching.open || !!draft.teaching.mode,
    true,
  ].filter((v) => v !== null)[step];

  async function handleSubmit() {
    setSubmitting(true);
    await onSubmit();
    setSubmitting(false);
  }

  return (
    <div className="min-h-full" style={{ background: C.ink, color: C.ivory }}>
      <div className="max-w-3xl mx-auto px-6 pt-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <Logo slogan />
            <HomeBtn onClick={onHome} />
          </div>
          <button onClick={onCancel} className="text-sm flex items-center gap-1" style={{ color: C.ivoryDim }}><X size={15} /> Cancel</button>
        </div>
        <div className="mt-8 flex items-center gap-4">
          <span style={{ fontFamily: FONT_MONO, color: C.brass, fontSize: 13 }}>Step {ROMAN[step]} of {ROMAN[lastStep]}</span>
          <div className="flex-1 flex gap-1">
            {labels.map((_, i) => (
              <div key={i} className="flex-1 rounded-full" style={{ height: 3, background: i <= step ? C.brass : C.inkLine }} />
            ))}
          </div>
        </div>
        <h2 className="mt-5" style={{ fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 600 }}>{labels[step]}</h2>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 lg-fade" key={step}>
        {!editing && step === 0 && <StepAccount draft={draft} update={update} error={authError} />}
        {idx === 0 && <StepIntro draft={draft} update={update} />}
        {idx === 1 && <StepConservatory draft={draft} update={update} />}
        {idx === 2 && <StepTastes draft={draft} toggleTaste={toggleTaste} />}
        {idx === 3 && <StepPieces draft={draft} update={update} />}
        {idx === 4 && <StepTopFlop draft={draft} update={update} />}
        {idx === 5 && <StepTeaching draft={draft} update={update} />}
        {idx === 6 && <StepReview draft={draft} />}
      </div>

      {step === lastStep && authError && (
        <div className="max-w-3xl mx-auto px-6 pb-4">
          <p className="text-sm" style={{ color: C.burgundy }}>{authError}</p>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-6 pb-12 flex items-center justify-between">
        <button
          onClick={() => (step === 0 ? onCancel() : setStep(step - 1))}
          className="inline-flex items-center gap-2 text-sm"
          style={{ color: C.ivoryDim }}
        >
          <ArrowLeft size={15} /> {step === 0 ? "Cancel" : "Back"}
        </button>
        {step < lastStep ? (
          <PrimaryBtn disabled={!canNext} onClick={() => setStep(step + 1)} icon={ChevronRight}>Continue</PrimaryBtn>
        ) : (
          <PrimaryBtn disabled={submitting} onClick={handleSubmit} icon={editing ? Check : ArrowRight}>
            {submitting ? "Submitting…" : editing ? "Save changes" : "Submit application"}
          </PrimaryBtn>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-5">
      <span className="block mb-1.5" style={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 500, color: C.ivory }}>{label}</span>
      {children}
    </label>
  );
}
const inputStyle = { width: "100%", background: "#FFFFFF", border: `1px solid ${C.inkLine}`, borderRadius: 6, padding: "10px 14px", color: C.ivory, fontFamily: FONT_BODY, fontSize: 15, outline: "none", boxShadow: "0 1px 2px rgba(10,37,64,0.04)" };

function PasswordField({ value, onChange, placeholder, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        style={{ ...inputStyle, paddingRight: 42 }}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete || "off"}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute"
        style={{ right: 12, top: "50%", transform: "translateY(-50%)", color: C.ivoryDim, lineHeight: 0 }}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function PhotoUpload({ name, photoUrl, onChange }) {
  const inputRef = useRef(null);
  function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  }
  return (
    <div className="flex items-center gap-4 mb-7">
      <Avatar name={name || "?"} photoUrl={photoUrl} size={72} />
      <div>
        <button
          type="button"
          onClick={() => inputRef.current && inputRef.current.click()}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
          style={{ fontFamily: FONT_BODY, fontWeight: 600, color: C.ivory, border: `1px solid ${C.inkLine}` }}
        >
          <Upload size={14} /> {photoUrl ? "Change photo" : "Upload photo"}
        </button>
        {photoUrl && (
          <button type="button" onClick={() => onChange("")} className="ml-3 text-sm" style={{ color: C.ivoryDim }}>
            Remove
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <p className="text-xs mt-2" style={{ color: C.ivoryDim, fontFamily: FONT_MONO }}>Optional — JPG or PNG.</p>
      </div>
    </div>
  );
}

function GoogleBtn({ label = "Continue with Google" }) {
  const [loading, setLoading] = useState(false);
  async function handleClick() {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }
  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        background: "#FFFFFF", color: C.ivory, border: `1px solid ${C.inkLine}`,
        borderRadius: 6, padding: "10px 16px", fontSize: 14, fontWeight: 500,
        boxShadow: "0 1px 2px rgba(10,37,64,0.04)",
        cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
      {loading ? "Redirecting…" : label}
    </button>
  );
}

function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0" }}>
      <div style={{ flex: 1, height: 1, background: "#E6EBF1" }} />
      <span style={{ fontSize: 11, fontFamily: FONT_MONO, color: "#8898AA" }}>OR</span>
      <div style={{ flex: 1, height: 1, background: "#E6EBF1" }} />
    </div>
  );
}

function StepAccount({ draft, update, error }) {
  const mismatch = draft.confirmPassword.length > 0 && draft.password !== draft.confirmPassword;
  return (
    <div>
      <p className="text-sm mb-6" style={{ color: C.ivoryDim }}>Create the login you'll use to come back and manage your profile.</p>
      <GoogleBtn label="Sign up with Google" />
      <Divider />
      <Field label="Email">
        <input style={inputStyle} type="email" value={draft.email} onChange={(e) => update({ email: e.target.value })} placeholder="you@example.com" autoComplete="off" />
      </Field>
      <Field label="Password">
        <PasswordField value={draft.password} onChange={(e) => update({ password: e.target.value })} placeholder="At least 6 characters" autoComplete="new-password" />
      </Field>
      <Field label="Confirm password">
        <PasswordField value={draft.confirmPassword} onChange={(e) => update({ confirmPassword: e.target.value })} placeholder="Re-enter your password" autoComplete="new-password" />
      </Field>
      {mismatch && <p className="text-sm" style={{ color: C.burgundy }}>Passwords don't match.</p>}
      {error && <p className="text-sm" style={{ color: C.burgundy }}>{error}</p>}
    </div>
  );
}

function StepIntro({ draft, update }) {
  const linkValid = !draft.videoLink || /instagram\.com|facebook\.com|fb\.com|fb\.watch/i.test(draft.videoLink);
  const instrumentIsOther = draft.instrument && !INSTRUMENT_OPTIONS.includes(draft.instrument);
  const [otherInstrument, setOtherInstrument] = useState(instrumentIsOther);
  return (
    <div>
      <PhotoUpload name={draft.name} photoUrl={draft.photoUrl} onChange={(photoUrl) => update({ photoUrl })} />
      <Field label="Full name">
        <input style={inputStyle} value={draft.name} onChange={(e) => update({ name: e.target.value })} placeholder="Your full name" />
      </Field>
      <Field label="Years at your conservatory">
        <input style={inputStyle} value={draft.years} onChange={(e) => update({ years: e.target.value })} placeholder="e.g. 2nd year, Masters 1st year" />
      </Field>
      <Field label="Which instrument do you play?">
        <div className="flex flex-wrap gap-2">
          {INSTRUMENT_OPTIONS.map((i) => (
            <Chip key={i} active={!otherInstrument && draft.instrument === i} onClick={() => { setOtherInstrument(false); update({ instrument: i }); }}>{i}</Chip>
          ))}
          <Chip active={otherInstrument} onClick={() => { setOtherInstrument(true); update({ instrument: instrumentIsOther ? draft.instrument : "" }); }}>Other</Chip>
        </div>
        {otherInstrument && (
          <input
            className="mt-3"
            style={inputStyle}
            value={draft.instrument}
            onChange={(e) => update({ instrument: e.target.value })}
            placeholder="Tell us what you play"
            autoFocus
          />
        )}
      </Field>
      <div className="mt-2">
        <p className="text-xs mb-3" style={{ fontFamily: FONT_MONO, color: C.ivoryDim, letterSpacing: 0.5 }}>OPTIONAL</p>
        <Field label="Link to a performance video">
          <input style={inputStyle} value={draft.videoLink} onChange={(e) => update({ videoLink: e.target.value })} placeholder="https://instagram.com/... or https://facebook.com/..." />
        </Field>
        <p className="text-xs -mt-4" style={{ color: linkValid ? C.ivoryDim : C.burgundy, fontFamily: FONT_MONO }}>
          {linkValid ? "Instagram or Facebook links only." : "Only Instagram or Facebook links are accepted."}
        </p>
      </div>
    </div>
  );
}

function StepConservatory({ draft, update }) {
  const [q, setQ] = useState("");
  const results = CONSERVATORIES.filter((c) => (c.name + c.city + c.country).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="rounded-2xl overflow-hidden mb-5" style={{ border: `1px solid ${C.inkLine}`, background: C.inkSoft }}>
        <MapTitle />
        <WorldMap selectedId={draft.conservatoryId} onSelect={(id) => update({ conservatoryId: id })} studentsByCons={{}} height={260} />
      </div>
      <div className="relative mb-3">
        <Search size={15} style={{ position: "absolute", left: 14, top: 14, color: C.ivoryDim }} />
        <input style={{ ...inputStyle, paddingLeft: 38 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by school, city, or country" />
      </div>
      <div className="grid sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto lg-scroll pr-1">
        {results.map((c) => (
          <button key={c.id} onClick={() => update({ conservatoryId: c.id })} className="text-left rounded-xl px-4 py-3" style={{ border: `1px solid ${draft.conservatoryId === c.id ? C.brass : C.inkLine}`, background: draft.conservatoryId === c.id ? "rgba(201,162,75,0.1)" : "transparent" }}>
            <p style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14 }}>{c.name}</p>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.ivoryDim, marginTop: 2 }}>{c.city}, {c.country} · est. {c.founded}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepTastes({ draft, toggleTaste }) {
  const [showOther, setShowOther] = useState(false);
  const [otherText, setOtherText] = useState("");
  const customTastes = draft.tastes.filter((t) => !TASTE_OPTIONS.includes(t));
  function addOther() {
    const v = otherText.trim();
    if (!v) return;
    if (!draft.tastes.includes(v)) toggleTaste(v);
    setOtherText("");
  }
  return (
    <div>
      <p className="text-sm mb-5" style={{ color: C.ivoryDim }}>Select at least three — composers and eras you gravitate toward, as a listener or a performer. ({draft.tastes.length} selected)</p>
      <div className="flex flex-wrap gap-2">
        {TASTE_OPTIONS.map((t) => (
          <Chip key={t} active={draft.tastes.includes(t)} onClick={() => toggleTaste(t)}>{t}</Chip>
        ))}
        {customTastes.map((t) => (
          <Chip key={t} active onClick={() => toggleTaste(t)}>{t}</Chip>
        ))}
        <Chip active={showOther} onClick={() => setShowOther((v) => !v)}>Other</Chip>
      </div>
      {showOther && (
        <div className="mt-4 flex items-center gap-2">
          <input
            style={inputStyle}
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOther(); } }}
            placeholder="Type a composer, era, or style, then press Enter"
            autoFocus
          />
          <button onClick={addOther} className="rounded-xl px-4 py-3 flex items-center justify-center shrink-0" style={{ background: C.brass, color: C.inkText }}>
            <Plus size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function StepPieces({ draft, update }) {
  const [title, setTitle] = useState("");
  const [composer, setComposer] = useState("");
  function add() {
    if (!title.trim() || !composer.trim()) return;
    update({ pieces: [...draft.pieces, { title, composer }] });
    setTitle(""); setComposer("");
  }
  function remove(i) { update({ pieces: draft.pieces.filter((_, idx) => idx !== i) }); }
  return (
    <div>
      <p className="text-sm mb-5" style={{ color: C.ivoryDim }}>What are you currently working on in lessons or on your own?</p>
      <div className="grid gap-2 mb-5" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
        <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Piece title" />
        <input style={inputStyle} value={composer} onChange={(e) => setComposer(e.target.value)} placeholder="Composer" />
        <button onClick={add} className="rounded-xl px-4 flex items-center justify-center" style={{ background: C.brass, color: C.inkText }}><Plus size={18} /></button>
      </div>
      <div className="flex flex-col gap-2">
        {draft.pieces.map((p, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ border: `1px solid ${C.inkLine}` }}>
            <div>
              <span style={{ fontFamily: FONT_MONO, color: C.brass, fontSize: 11 }}>No. {i + 1}</span>
              <p style={{ fontWeight: 600, fontSize: 14 }}>{p.title}</p>
              <p style={{ fontSize: 12, color: C.ivoryDim }}>{p.composer}</p>
            </div>
            <button onClick={() => remove(i)}><Trash2 size={15} color={C.ivoryDim} /></button>
          </div>
        ))}
        {draft.pieces.length === 0 && <p className="text-sm" style={{ color: C.ivoryDim }}>Nothing added yet.</p>}
      </div>
    </div>
  );
}

function StepTopFlop({ draft, update }) {
  return (
    <div>
      <p className="text-sm mb-7" style={{ color: C.ivoryDim, lineHeight: 1.6 }}>
        A quick, honest snapshot of where you are right now — the kind of thing only another musician really gets.
      </p>
      <Field label="Top — what's going well right now">
        <textarea
          rows={3}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          value={draft.top}
          onChange={(e) => update({ top: e.target.value })}
          placeholder="Finishing an exam, finally nailing a piece, falling back in love with something you're playing, finishing a composition…"
        />
      </Field>
      <p className="text-xs mb-6 -mt-4" style={{ color: C.ivoryDim, fontFamily: FONT_MONO }}>Whatever's been a win lately, big or small.</p>

      <Field label="Flop — what you're struggling with right now">
        <textarea
          rows={3}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          value={draft.flop}
          onChange={(e) => update({ flop: e.target.value })}
          placeholder="A technical passage that won't cooperate, a piece you can't connect with yet, a wall you keep hitting…"
        />
      </Field>
      <p className="text-xs -mt-4" style={{ color: C.ivoryDim, fontFamily: FONT_MONO }}>Whatever's been hard lately — this isn't graded.</p>
    </div>
  );
}

function StepReview({ draft }) {
  const cons = CONSERVATORIES.find((c) => c.id === draft.conservatoryId);
  return (
    <div className="rounded-2xl p-6" style={{ background: C.parchment, color: C.inkText }}>
      <div className="flex items-center gap-4 mb-5">
        <Avatar name={draft.name || "?"} photoUrl={draft.photoUrl} size={56} />
        <div>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600 }}>{draft.name || "—"}</p>
          <p style={{ fontSize: 13, color: C.inkTextDim }}>{draft.instrument || "—"} · {draft.years || "—"} · {cons ? `${cons.name}, ${cons.city}` : "No conservatory chosen"}</p>
        </div>
      </div>
      <div className="mt-5 grid sm:grid-cols-2 gap-5 text-sm">
        <div>
          <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkTextDim }}>MUSICAL PREFERENCES</p>
          <p className="mt-1">{draft.tastes.join(", ") || "—"}</p>
        </div>
        <div>
          <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkTextDim }}>CURRENT REPERTOIRE</p>
          <p className="mt-1">{draft.pieces.map((p) => p.title).join(", ") || "—"}</p>
        </div>
        <div>
          <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkTextDim }}>TOP</p>
          <p className="mt-1">{draft.top || "—"}</p>
        </div>
        <div>
          <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkTextDim }}>FLOP</p>
          <p className="mt-1">{draft.flop || "—"}</p>
        </div>
        <div>
          <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkTextDim }}>TEACHING</p>
          <p className="mt-1">{draft.teaching.open ? `${teachingModeLabel(draft.teaching.mode)}${draft.teaching.price ? ` · €${draft.teaching.price}/session` : ""}` : "Not offering lessons"}</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* PENDING                                                             */
/* ---------------------------------------------------------------- */
function Pending({ name, onApprove, onHome }) {
  return (
    <div className="min-h-full flex flex-col" style={{ background: C.ink, color: C.ivory }}>
      <div className="px-6 py-4 flex items-center gap-5">
        <Logo size={18} />
        <HomeBtn onClick={onHome} />
      </div>
      <div className="flex-1 flex items-center justify-center px-6">
      <div className="max-w-md text-center lg-fade">
        <div className="mx-auto mb-6 rounded-full flex items-center justify-center lg-blink" style={{ width: 64, height: 64, border: `1px solid ${C.brass}` }}>
          <Music2 color={C.brass} size={26} />
        </div>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 600 }}>Your audition is under review</h2>
        <p className="mt-3 text-sm" style={{ color: C.ivoryDim, lineHeight: 1.6 }}>
          Thank you, {name || "friend"}. A few faculty reviewers check every new profile before a seat is confirmed. This usually takes 1–2 days.
        </p>
        <div className="mt-10 pt-6" style={{ borderTop: `1px dashed ${C.inkLine}` }}>
          <p className="text-xs mb-3" style={{ fontFamily: FONT_MONO, color: C.ivoryDim }}>PROTOTYPE CONTROL — not part of the real product</p>
          <PrimaryBtn onClick={onApprove} icon={ArrowRight}>Simulate acceptance</PrimaryBtn>
        </div>
      </div>
      </div>
    </div>
  );
}

function ConfirmEmail({ email, onLogin, onHome }) {
  return (
    <div className="min-h-full flex flex-col" style={{ background: C.ink, color: C.ivory }}>
      <div className="px-6 py-4 flex items-center gap-5">
        <Logo size={18} />
        <HomeBtn onClick={onHome} />
      </div>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md text-center lg-fade">
          <div className="mx-auto mb-6 rounded-full flex items-center justify-center lg-blink" style={{ width: 64, height: 64, border: `1px solid ${C.brass}` }}>
            <Music2 color={C.brass} size={26} />
          </div>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 600 }}>Check your inbox</h2>
          <p className="mt-3 text-sm" style={{ color: C.ivoryDim, lineHeight: 1.6 }}>
            We sent a confirmation link to <strong style={{ color: C.ivory }}>{email}</strong>. Click it to activate your account — your profile will be created automatically as soon as you do.
          </p>
          <p className="mt-6 text-sm" style={{ color: C.ivoryDim }}>
            Already confirmed? <button onClick={onLogin} style={{ color: C.brass, fontWeight: 600 }}>Log in</button>
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ onSubmit, onBack, error }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function handleSubmit() {
    setSubmitting(true);
    await onSubmit(email, password);
    setSubmitting(false);
  }
  return (
    <div className="min-h-full flex flex-col" style={{ background: C.inkSoft, color: C.ivory }}>
      <div style={{ background: "#FFFFFF", borderBottom: `1px solid ${C.inkLine}`, padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Logo size={20} />
        <HomeBtn onClick={onBack} />
      </div>
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md lg-fade" style={{ background: "#FFFFFF", border: `1px solid ${C.inkLine}`, borderRadius: 12, padding: 40, boxShadow: "0 4px 24px rgba(10,37,64,0.07)" }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.3, marginBottom: 4 }}>Welcome back</h2>
          <p style={{ color: C.ivoryDim, fontSize: 15, marginBottom: 24 }}>Log in to your Artium account.</p>
          <GoogleBtn />
          <Divider />
          <Field label="Email address">
            <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Field label="Password">
            <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
          </Field>
          {error && <p style={{ fontSize: 13, color: C.burgundy, marginBottom: 16 }}>{error}</p>}
          <PrimaryBtn full disabled={submitting || !email || !password} onClick={handleSubmit} icon={ArrowRight}>
            {submitting ? "Logging in…" : "Continue"}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* APP SHELL                                                          */
/* ---------------------------------------------------------------- */
function AppShell({ children, appTab, setAppTab, myProfile, onApply, onHome, musicOn, onMusicToggle, audioRef, onBack, backLabel, onGuestTabClick, onlineCount }) {
  const tabs = [
    { id: "map", label: "Map", icon: Globe2, locked: false },
    { id: "messages", label: "Messages", icon: MessageCircle, locked: !myProfile },
  ];
  return (
    <div className="min-h-full flex flex-col" style={{ background: C.inkSoft, color: C.ivory }}>
      <div className="px-6 flex items-center justify-between gap-4" style={{ height: 60, background: "#FFFFFF", borderBottom: `1px solid ${C.inkLine}` }}>
        <div className="flex items-center gap-4">
          <Logo size={20} />
          <div style={{ width: 1, height: 18, background: C.inkLine }} />
          <HomeBtn onClick={onHome} />
        </div>
        <div className="flex items-center gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => t.locked ? onGuestTabClick() : setAppTab(t.id)}
              className="inline-flex items-center gap-1.5"
              style={{
                fontFamily: FONT_BODY, fontWeight: 500, fontSize: 14,
                background: appTab === t.id ? C.brassDim : "transparent",
                color: appTab === t.id ? C.brass : C.ivoryDim,
                border: "none",
                borderRadius: 6, padding: "6px 14px",
                opacity: t.locked ? 0.5 : 1,
                cursor: t.locked ? "default" : "pointer",
              }}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {onlineCount != null && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.ivoryDim, whiteSpace: "nowrap" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1A9E6E", display: "inline-block", flexShrink: 0 }} />
              <span style={{ color: C.ivory, fontWeight: 600 }}>{onlineCount}</span> online
            </span>
          )}
          <MusicBtn playing={musicOn} onToggle={onMusicToggle} audioRef={audioRef} />
          {!myProfile ? (
            <PrimaryBtn onClick={onApply}>Sign up</PrimaryBtn>
          ) : (
            <button onClick={() => setAppTab("profile")} title="My profile">
              <Avatar name={myProfile.name} id="me" size={32} photoUrl={myProfile.photoUrl} online />
            </button>
          )}
        </div>
      </div>
      {onBack && (
        <div className="px-6 py-3" style={{ borderBottom: `1px solid ${C.inkLine}` }}>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm"
            style={{ color: C.ivory, fontFamily: FONT_BODY, fontWeight: 600 }}
          >
            <ArrowLeft size={16} /> {backLabel || "Back"}
          </button>
        </div>
      )}
      <div className="flex-1">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* MAP SCREEN                                                          */
/* ---------------------------------------------------------------- */
function SignupPromptModal({ onClose, onSignup }) {
  return (
    <div
      className="fixed z-50 flex items-center justify-center"
      style={{ inset: 0, background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-8 max-w-sm w-full mx-4 text-center lg-fade"
        style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, color: C.ivory }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 flex items-center justify-center rounded-full" style={{ width: 56, height: 56, background: C.brass }}>
          <Users size={24} color={C.inkText} />
        </div>
        <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600 }}>Sign up to connect</h3>
        <p className="mt-3 text-sm" style={{ color: C.ivoryDim, lineHeight: 1.6 }}>
          Create your Artium profile to browse pianists, view their repertoire, and message students at conservatories around the world.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <PrimaryBtn onClick={onSignup} icon={ArrowRight}>Sign up — it's free</PrimaryBtn>
          <button onClick={onClose} className="text-sm" style={{ color: C.ivoryDim }}>Not now</button>
        </div>
      </div>
    </div>
  );
}

function MapScreen({ students, studentsByCons, selectedConsId, setSelectedConsId, onOpenStudent, isGuest, onGuestClick, onBack }) {
  const cons = CONSERVATORIES.find((c) => c.id === selectedConsId);
  const roster = selectedConsId ? studentsByCons[selectedConsId] || [] : [];
  return (
    <div className="lg-split-map h-full">
      <div style={{ background: C.inkSoft }}>
        <MapTitle />
        <WorldMap selectedId={selectedConsId} onSelect={setSelectedConsId} studentsByCons={studentsByCons} height={520} interactive />
      </div>
      <div className="lg-scroll overflow-y-auto" style={{ borderLeft: `1px solid ${C.inkLine}`, maxHeight: 600 }}>
        {!cons ? (
          <div className="p-6">
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.ivoryDim }}>{CONSERVATORIES.length} CONSERVATORIES</p>
            <p className="mt-2 text-sm" style={{ color: C.ivoryDim }}>Select a pin on the map to see who's studying there.</p>
            <div className="mt-5 flex flex-col gap-1">
              {CONSERVATORIES.map((c) => (
                <button key={c.id} onClick={() => setSelectedConsId(c.id)} className="text-left px-3 py-2.5 rounded-lg flex items-center justify-between" style={{ border: `1px solid ${C.inkLine}` }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</p>
                    <p style={{ fontSize: 11, color: C.ivoryDim }}>{c.city}, {c.country}</p>
                  </div>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.brass }}>{(studentsByCons[c.id] || []).length}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-6">
            <button onClick={() => setSelectedConsId(null)} className="text-xs flex items-center gap-1 mb-4" style={{ color: C.ivoryDim }}><ArrowLeft size={13} /> All conservatories</button>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.brass }}>{cons.city.toUpperCase()}, {cons.country.toUpperCase()} · EST. {cons.founded}</p>
            <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600, marginTop: 4 }}>{cons.name}</h3>
            <p className="mt-1 text-xs" style={{ color: C.ivoryDim }}>{roster.length} pianist{roster.length === 1 ? "" : "s"} on Artium</p>
            <div className="mt-5 flex flex-col gap-2">
              {roster.length === 0 && <p className="text-sm" style={{ color: C.ivoryDim }}>No students yet from this conservatory.</p>}
              {roster.map((s) => (
                <button
                  key={s.id}
                  onClick={() => isGuest && s.id !== "me" ? onGuestClick() : onOpenStudent(s.id)}
                  className="text-left flex items-center gap-3 p-3 rounded-xl"
                  style={{ border: `1px solid ${C.inkLine}` }}
                >
                  <div style={{ filter: isGuest && s.id !== "me" ? "blur(4px)" : "none", pointerEvents: "none" }}>
                    <Avatar name={s.name} id={s.id} size={40} photoUrl={s.photoUrl} online={s.online} />
                  </div>
                  <div className="min-w-0">
                    <p style={{ fontSize: 13, fontWeight: 600, filter: isGuest && s.id !== "me" ? "blur(5px)" : "none", userSelect: "none" }}>
                      {s.name} {s.id === "me" && <span style={{ color: C.brass }}>(you)</span>}
                    </p>
                    <p style={{ fontSize: 11, color: C.ivoryDim, filter: isGuest && s.id !== "me" ? "blur(4px)" : "none", userSelect: "none" }}>
                      {s.year} · {s.tastes.slice(0, 2).join(", ")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* STUDENT PROFILE                                                     */
/* ---------------------------------------------------------------- */
function videoLinkMeta(url) {
  if (!url) return null;
  const isInstagram = /instagram\.com/i.test(url);
  const isFacebook = /facebook\.com|fb\.com|fb\.watch/i.test(url);
  if (!isInstagram && !isFacebook) return null;
  return { Icon: isInstagram ? Instagram : Facebook, label: isInstagram ? "Instagram" : "Facebook" };
}

function StudentProfile({ student, conservatory, onBack, onMessage, locked, onApply }) {
  if (!student) return null;
  const linkMeta = videoLinkMeta(student.videoLink);
  return (
    <div className="max-w-2xl mx-auto px-6 py-8 lg-fade">
      <div className="flex items-start gap-4">
        <Avatar name={student.name} id={student.id} size={64} photoUrl={student.photoUrl} online={student.online} />
        <div className="flex-1">
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 600 }}>{student.name}</h2>
          <p className="text-sm mt-1" style={{ color: C.ivoryDim }}>{student.instrument ? `${student.instrument} · ` : ""}{student.year} · {conservatory?.name}, {conservatory?.city}</p>
        </div>
      </div>

      <p className="mt-5 text-sm" style={{ color: C.ivoryDim, lineHeight: 1.6 }}>{student.bio}</p>

      {linkMeta ? (
        <a href={student.videoLink} target="_blank" rel="noreferrer" className="mt-6 rounded-2xl flex items-center gap-4 p-4" style={{ border: `1px solid ${C.inkLine}`, textDecoration: "none", color: "inherit" }}>
          <div className="rounded-xl flex items-center justify-center shrink-0" style={{ width: 52, height: 52, background: colorFor(student.id) }}>
            <Play size={20} color={C.ivory} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600 }}>Watch performance on {linkMeta.label}</p>
            <p className="flex items-center gap-1" style={{ fontSize: 11, color: C.ivoryDim }}><linkMeta.Icon size={12} /> Opens in a new tab</p>
          </div>
        </a>
      ) : (
        <p className="mt-6 text-sm" style={{ color: C.ivoryDim }}>No performance video shared.</p>
      )}

      <div className="mt-6 grid sm:grid-cols-2 gap-6">
        <div>
          <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.ivoryDim }}>MUSICAL PREFERENCES</p>
          <div className="flex flex-wrap gap-1.5 mt-2">{student.tastes.map((t) => <span key={t} className="text-xs px-2.5 py-1 rounded-full" style={{ border: `1px solid ${C.inkLine}` }}>{t}</span>)}</div>
        </div>
        <div>
          <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.ivoryDim }}>CURRENT REPERTOIRE</p>
          <div className="flex flex-col gap-1.5 mt-2">
            {student.pieces.map((p, i) => (
              <p key={i} className="text-sm"><span style={{ fontFamily: FONT_MONO, color: C.brass, fontSize: 11 }}>No.{i + 1}</span> {p.title} <span style={{ color: C.ivoryDim }}>— {p.composer}</span></p>
            ))}
          </div>
        </div>
        {student.top && (
          <div>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.ivoryDim }}>TOP</p>
            <p className="text-sm mt-2" style={{ lineHeight: 1.6 }}>{student.top}</p>
          </div>
        )}
        {student.flop && (
          <div>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.ivoryDim }}>FLOP</p>
            <p className="text-sm mt-2" style={{ lineHeight: 1.6 }}>{student.flop}</p>
          </div>
        )}
      </div>

      <div className="mt-10 flex items-center gap-3">
        {locked ? (
          <PrimaryBtn onClick={onApply} icon={ArrowRight}>Sign up to message {student.name.split(" ")[0]}</PrimaryBtn>
        ) : (
          <PrimaryBtn onClick={onMessage} icon={MessageCircle}>Message</PrimaryBtn>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* MY PROFILE                                                         */
/* ---------------------------------------------------------------- */
function MyProfile({ profile, onEdit, onLogout, onDeleteAccount, onBack }) {
  const cons = CONSERVATORIES.find((c) => c.id === profile.conservatoryId);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={profile.name} id="me" size={64} photoUrl={profile.photoUrl} online />
          <div>
            <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 600 }}>{profile.name}</h2>
            <p className="text-sm" style={{ color: C.ivoryDim }}>{profile.instrument ? `${profile.instrument} · ` : ""}{profile.year} · {cons?.name}, {cons?.city}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GhostBtn onClick={onEdit} icon={Pencil}>Edit</GhostBtn>
          {onLogout && <GhostBtn onClick={onLogout}>Log out</GhostBtn>}
          {onDeleteAccount && !confirmDelete && (
            <GhostBtn onClick={() => setConfirmDelete(true)} style={{ color: "#c0392b", borderColor: "#c0392b" }}>Delete account</GhostBtn>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: C.ivoryDim }}>Are you sure?</span>
              <button
                onClick={async () => { setDeleting(true); await onDeleteAccount(); setDeleting(false); }}
                disabled={deleting}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{ background: "#c0392b", color: "#fff", opacity: deleting ? 0.6 : 1 }}
              >{deleting ? "Deleting…" : "Yes, delete"}</button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ border: `1px solid ${C.inkLine}`, color: C.ivoryDim }}
              >Cancel</button>
            </div>
          )}
        </div>
      </div>
      <p className="mt-5 text-sm" style={{ color: C.ivoryDim, lineHeight: 1.6 }}>{profile.bio || "No bio yet."}</p>
      {(() => {
        const linkMeta = videoLinkMeta(profile.videoLink);
        return linkMeta ? (
          <a href={profile.videoLink} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm" style={{ color: C.brass, textDecoration: "none" }}>
            <linkMeta.Icon size={14} /> Performance video on {linkMeta.label}
          </a>
        ) : (
          <p className="mt-5 text-sm" style={{ color: C.ivoryDim }}>No performance video linked yet.</p>
        );
      })()}
      <div className="mt-6 grid sm:grid-cols-2 gap-6">
        <div>
          <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.ivoryDim }}>MUSICAL PREFERENCES</p>
          <div className="flex flex-wrap gap-1.5 mt-2">{(profile.tastes || []).map((t) => <span key={t} className="text-xs px-2.5 py-1 rounded-full" style={{ border: `1px solid ${C.inkLine}` }}>{t}</span>)}</div>
        </div>
        <div>
          <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.ivoryDim }}>CURRENT REPERTOIRE</p>
          <div className="flex flex-col gap-1.5 mt-2">
            {(profile.pieces || []).map((p, i) => <p key={i} className="text-sm"><span style={{ fontFamily: FONT_MONO, color: C.brass, fontSize: 11 }}>No.{i + 1}</span> {p.title} <span style={{ color: C.ivoryDim }}>— {p.composer}</span></p>)}
          </div>
        </div>
        {profile.top && (
          <div>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.ivoryDim }}>TOP</p>
            <p className="text-sm mt-2" style={{ lineHeight: 1.6 }}>{profile.top}</p>
          </div>
        )}
        {profile.flop && (
          <div>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.ivoryDim }}>FLOP</p>
            <p className="text-sm mt-2" style={{ lineHeight: 1.6 }}>{profile.flop}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* MESSAGES                                                            */
/* ---------------------------------------------------------------- */
function Messages({ students, conversations, activeChatId, setActiveChatId, onSend, onOpenProfile, myProfile, onBack }) {
  const ids = Object.keys(conversations);
  const active = students.find((s) => s.id === activeChatId);
  const [text, setText] = useState("");
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [conversations, activeChatId]);

  return (
    <div className="lg-split-chat h-full" style={{ minHeight: 520 }}>
      <div className="lg-scroll overflow-y-auto" style={{ borderRight: `1px solid ${C.inkLine}` }}>
        <div className="px-5 pt-5 pb-2">
          <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.ivoryDim }}>CONVERSATIONS</p>
        </div>
        {ids.length === 0 && <p className="px-5 text-sm" style={{ color: C.ivoryDim }}>Message someone from the map to start a thread.</p>}
        {ids.map((id) => {
          const s = students.find((st) => st.id === id);
          if (!s) return null;
          const last = conversations[id][conversations[id].length - 1];
          return (
            <button key={id} onClick={() => setActiveChatId(id)} className="w-full text-left flex items-center gap-3 px-5 py-3" style={{ background: activeChatId === id ? "rgba(201,162,75,0.08)" : "transparent" }}>
              <Avatar name={s.name} id={s.id} size={38} photoUrl={s.photoUrl} online={s.online} />
              <div className="min-w-0 flex-1">
                <p style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</p>
                <p className="truncate" style={{ fontSize: 11, color: C.ivoryDim }}>{last ? last.text : "Say hello"}</p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col">
        {!active ? (
          <div className="flex-1 flex items-center justify-center"><p style={{ color: C.ivoryDim, fontSize: 13 }}>Select a conversation</p></div>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.inkLine}` }}>
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveChatId(null)} className="text-xs flex items-center gap-1" style={{ color: C.ivoryDim }}><ArrowLeft size={13} /> Back</button>
                <button onClick={() => onOpenProfile(active.id)} className="flex items-center gap-3">
                  <Avatar name={active.name} id={active.id} size={34} photoUrl={active.photoUrl} online={active.online} />
                  <p style={{ fontSize: 14, fontWeight: 600 }}>{active.name}</p>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto lg-scroll px-5 py-4 flex flex-col gap-2">
              {(conversations[active.id] || []).map((m, i) => (
                <div key={i} className="px-4 py-2.5 rounded-2xl text-sm" style={{ maxWidth: "75%", alignSelf: m.from === "me" ? "flex-end" : "flex-start", background: m.from === "me" ? C.brass : C.inkSoft, color: m.from === "me" ? C.inkText : C.ivory, fontWeight: m.from === "me" ? 500 : 400 }}>
                  {m.text}
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div className="px-5 py-4 flex items-center gap-2" style={{ borderTop: `1px solid ${C.inkLine}` }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { onSend(text); setText(""); } }}
                placeholder={`Message ${active.name.split(" ")[0]}…`}
              />
              <button onClick={() => { onSend(text); setText(""); }} className="rounded-full p-3" style={{ background: C.brass }}><Send size={16} color={C.inkText} /></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


/* ---------------------------------------------------------------- */
/* TEACHING + LEARNER MARKETPLACE                                     */
/* ---------------------------------------------------------------- */
function teachingModeLabel(mode) {
  return mode === "online" ? "Online lessons"
    : mode === "physical" ? "In-person lessons"
    : mode === "both" ? "Online & in-person"
    : "—";
}

// Which sample students offer lessons (seeded so the learner map isn't empty).
const TEACHING_SEED = {
  elise:  { open: true, mode: "both",     price: "45" },
  lukas:  { open: true, mode: "physical", price: "40" },
  polina: { open: true, mode: "online",   price: "60" },
  maya:   { open: true, mode: "both",     price: "70" },
  daniel: { open: true, mode: "physical", price: "38" },
  wei:    { open: true, mode: "online",   price: "32" },
  isla:   { open: true, mode: "both",     price: "50" },
};
function seedTeaching(arr) {
  return arr.map((s) => ({
    ...s,
    teaching: TEACHING_SEED[s.id] || { open: false, mode: "", price: "" },
  }));
}

// Pin a teacher at their conservatory's location, nudged a little so people
// at the same school don't land exactly on top of each other.
function teacherPin(student) {
  const cons = CONSERVATORIES.find((c) => c.id === student.conservatoryId);
  if (!cons) return { x: 500, y: 230, cons: null };
  const h = String(student.id).split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const jx = ((h % 7) - 3) * 4;
  const jy = (((h >> 2) % 7) - 3) * 4;
  return { x: cons.x + jx, y: cons.y + jy, cons };
}

/* ---- Student signup: teaching step ---- */
function StepTeaching({ draft, update }) {
  const t = draft.teaching;
  const setT = (partial) => update({ teaching: { ...t, ...partial } });
  return (
    <div>
      <p className="text-sm mb-6" style={{ color: C.ivoryDim, lineHeight: 1.6 }}>
        Artium also connects piano enthusiasts with conservatory students who teach.
        Let learners know whether you're available — and on your terms.
      </p>
      <Field label="Are you open to teaching?">
        <div className="flex flex-wrap gap-2">
          <Chip active={t.open} onClick={() => setT({ open: true })}>Yes, I'd like to teach</Chip>
          <Chip active={!t.open} onClick={() => setT({ open: false, mode: "", price: "" })}>Not right now</Chip>
        </div>
      </Field>
      {t.open && (
        <>
          <Field label="How do you teach?">
            <div className="flex flex-wrap gap-2">
              <Chip active={t.mode === "physical"} onClick={() => setT({ mode: "physical" })}>In person</Chip>
              <Chip active={t.mode === "online"} onClick={() => setT({ mode: "online" })}>Online</Chip>
              <Chip active={t.mode === "both"} onClick={() => setT({ mode: "both" })}>Both</Chip>
            </div>
          </Field>
          <Field label="Price per session (optional)">
            <div className="flex items-center gap-2">
              <span style={{ color: C.ivoryDim, fontSize: 16 }}>€</span>
              <input
                style={{ ...inputStyle, maxWidth: 160 }}
                value={t.price}
                onChange={(e) => setT({ price: e.target.value.replace(/[^0-9]/g, "") })}
                placeholder="e.g. 45"
                inputMode="numeric"
              />
              <span style={{ color: C.ivoryDim, fontSize: 13 }}>per session</span>
            </div>
          </Field>
        </>
      )}
    </div>
  );
}

/* ---- First screen: pick your role ---- */
function EntryGate({ onLearner, onStudent, onLogin, learnerProfile, learnerLoggedOut, studentLoggedIn }) {
  const singleCard = !!learnerProfile || learnerLoggedOut || studentLoggedIn;
  const cardStyle = {
    textAlign: "left", background: "#FFFFFF", border: `1px solid ${C.inkLine}`,
    borderRadius: 12, padding: 32,
    boxShadow: "0 4px 24px rgba(10,37,64,0.07), 0 1px 4px rgba(10,37,64,0.04)",
    cursor: "pointer", transition: "box-shadow 0.2s, transform 0.15s",
  };
  return (
    <div className="min-h-full flex flex-col" style={{ background: C.inkSoft, color: C.ivory }}>
      <div className="max-w-5xl w-full mx-auto px-8 pt-8 pb-4" style={{ borderBottom: `1px solid ${C.inkLine}`, background: "#FFFFFF" }}>
        <Logo size={22} />
      </div>
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-3xl">
          <p style={{ fontSize: 13, fontWeight: 500, color: C.brass, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 }}>Get started</p>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(28px,4vw,44px)", fontWeight: 700, lineHeight: 1.1, color: C.ivory, letterSpacing: -0.5 }}>
            Connect with musicians worldwide.
          </h1>
          <p style={{ color: C.ivoryDim, fontSize: 16, lineHeight: 1.65, marginTop: 14 }}>
            Join the global network of conservatory students and music enthusiasts.
          </p>
          <div className={`mt-10 grid gap-6 ${singleCard ? "" : "md:grid-cols-2"}`}>
            {!studentLoggedIn && (
              <button onClick={onLearner} style={cardStyle}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: C.brassDim, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  <Music2 size={22} color={C.brass} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: C.ivory, marginBottom: 8 }}>Classical music enthusiast</h3>
                <p style={{ color: C.ivoryDim, fontSize: 14, lineHeight: 1.65, marginBottom: 20 }}>
                  Learn from top conservatory musicians. Find a teacher who matches your level, instrument, and taste.
                </p>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: C.brass, fontWeight: 600 }}>
                  {learnerLoggedOut ? "Log in" : "Find a teacher"} <ArrowRight size={14} />
                </span>
              </button>
            )}
            {(!singleCard || studentLoggedIn) && (
              <button onClick={onStudent} style={cardStyle}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: C.brassDim, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  <Users size={22} color={C.brass} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: C.ivory, marginBottom: 8 }}>Conservatory student</h3>
                <p style={{ color: C.ivoryDim, fontSize: 14, lineHeight: 1.65, marginBottom: 20 }}>
                  Connect with students at the world's top conservatories. Share repertoire, culture, and musical ideas.
                </p>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: C.brass, fontWeight: 600 }}>
                  {studentLoggedIn ? "Continue" : "Enter Artium"} <ArrowRight size={14} />
                </span>
              </button>
            )}
          </div>
          <p style={{ textAlign: "center", marginTop: 28, fontSize: 14, color: C.ivoryDim }}>
            {studentLoggedIn
              ? "Logged in as a conservatory student"
              : learnerProfile
              ? <>Logged in as {learnerProfile.name}</>
              : <>Already have an account?{" "}<button onClick={onLogin} style={{ color: C.brass, fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>Log in</button></>
            }
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---- Learner: signup form ---- */
function LearnerSignup({ onSubmit, onBack, onLogin, error }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [instrument, setInstrument] = useState("");
  const [motivation, setMotivation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canGo = name.trim().length > 1 && location.trim().length > 1
    && email.trim().length > 3 && password.length >= 6 && password === confirmPassword
    && instrument.trim().length > 0 && motivation.trim().length > 5;

  async function handleSubmit() {
    setSubmitting(true);
    await onSubmit({ name: name.trim(), location: location.trim(), email: email.trim(), password, instrument: instrument.trim(), motivation: motivation.trim() });
    setSubmitting(false);
  }

  return (
    <div className="min-h-full" style={{ background: C.ink, color: C.ivory }}>
      <div className="max-w-2xl mx-auto px-6 pt-8">
        <div className="flex items-center justify-between">
          <Logo slogan />
          <button onClick={onBack} className="text-sm flex items-center gap-1" style={{ color: C.ivoryDim }}><ArrowLeft size={15} /> Back</button>
        </div>
        <h2 className="mt-10" style={{ fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 600 }}>Find your teacher</h2>
        <p className="mt-3" style={{ color: C.ivoryDim, fontSize: 15, lineHeight: 1.6 }}>
          Tell us a little about you, and we'll show conservatory musicians who give lessons.
        </p>
      </div>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Field label="Full name">
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" autoComplete="off" autoFocus />
        </Field>
        <Field label="Where are you based?">
          <input style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, country" autoComplete="off" />
        </Field>
        <Field label="Email">
          <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="off" />
        </Field>
        <Field label="Password">
          <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
        </Field>
        <Field label="Confirm password">
          <PasswordField value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" autoComplete="new-password" />
        </Field>
        {mismatch && <p className="text-sm mb-4" style={{ color: C.burgundy }}>Passwords don't match.</p>}
        <Field label="Which instrument would you like to learn?">
          <select style={{ ...inputStyle, background: C.inkSoft }} value={instrument} onChange={(e) => setInstrument(e.target.value)}>
            <option value="">Select an instrument…</option>
            {INSTRUMENT_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </Field>
        <Field label="Why do you want to learn, and what are your expectations?">
          <textarea
            style={{ ...inputStyle, resize: "vertical", minHeight: 100, lineHeight: 1.6 }}
            value={motivation}
            onChange={(e) => setMotivation(e.target.value)}
            placeholder="Tell the teacher about your goals, experience level, and what you're hoping to achieve…"
          />
        </Field>
        {error && <p className="text-sm mb-4" style={{ color: C.burgundy }}>{error}</p>}
        <div className="mt-2">
          <PrimaryBtn disabled={!canGo || submitting} onClick={handleSubmit} icon={ArrowRight}>
            {submitting ? "Submitting…" : "Submit"}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

/* ---- Map of teachers (gold pins) ---- */
function TeacherMap({ teachers, selectedId, onSelect, height = 520 }) {
  return (
    <svg viewBox="0 0 1000 460" style={{ width: "100%", height, display: "block" }}>
      <defs>
        <pattern id="lg-dots-t" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="rgba(0,0,0,0.03)" />
        </pattern>
      </defs>
      <rect width="1000" height="460" fill="url(#lg-dots-t)" />
      {[80, 160, 230, 300, 380].map((y) => (
        <line key={y} x1="0" x2="1000" y1={y} y2={y} stroke="rgba(0,0,0,0.03)" strokeWidth="1" />
      ))}
      {CONTINENTS.map((d, i) => (
        <path key={i} d={d} fill={C.parchmentDim} opacity="0.16" stroke={C.parchmentDim} strokeOpacity="0.3" />
      ))}
      {teachers.map((t) => {
        const p = teacherPin(t);
        const active = selectedId === t.id;
        return (
          <g key={t.id} transform={`translate(${p.x},${p.y})`} style={{ cursor: "pointer" }} onClick={() => onSelect(t.id)}>
            {active && <circle r="11" fill="none" stroke={C.brass} strokeWidth="1" className="lg-pulse" />}
            <circle r={active ? 6 : 4.5} fill={C.brass} fillOpacity={active ? 1 : 0.8} stroke={C.ink} strokeWidth="1.2" />
          </g>
        );
      })}
    </svg>
  );
}

/* ---- Learner home: map + request + chat ---- */
function LearnerScreen({ learner, teachers, teachRequests, onSendRequest, conversations, activeChatId, setActiveChatId, onSend, onBack, onUpdateProfile, onLogout, onDeleteAccount, onlineCount }) {
  const [tab, setTab] = useState("teachers");
  const [selectedId, setSelectedId] = useState(null);
  const selected = teachers.find((t) => t.id === selectedId);
  const status = selectedId ? teachRequests[selectedId] : undefined;

  // profile editing state
  const [editName, setEditName] = useState(learner?.name || "");
  const [editLocation, setEditLocation] = useState(learner?.location || "");
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function selectTeacher(id) {
    setSelectedId(id);
    setActiveChatId(id);
  }

  function saveProfile() {
    onUpdateProfile({ name: editName.trim(), location: editLocation.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="min-h-full" style={{ background: C.ink, color: C.ivory }}>
      <div className="max-w-6xl mx-auto px-6 pt-8 flex items-center justify-between">
        <Logo slogan />
        <div className="flex items-center gap-4">
          {onlineCount != null && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontFamily: FONT_MONO, color: "#425466", whiteSpace: "nowrap" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#27AE60", display: "inline-block", flexShrink: 0 }} />
              <span style={{ color: "#0A2540", fontWeight: 700 }}>{onlineCount}</span> online
            </span>
          )}
          <button onClick={onBack} className="text-sm flex items-center gap-1" style={{ color: C.ivoryDim }}><ArrowLeft size={15} /> Back</button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="max-w-6xl mx-auto px-6 pt-5 flex gap-1" style={{ borderBottom: `1px solid ${C.inkLine}` }}>
        {[["teachers", "Find a teacher"], ["profile", "My profile"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className="px-4 py-2 text-sm rounded-t-lg"
            style={{ fontWeight: tab === key ? 600 : 400, color: tab === key ? C.brass : C.ivoryDim, borderBottom: tab === key ? `2px solid ${C.brass}` : "2px solid transparent", background: "transparent" }}>
            {label}
          </button>
        ))}
      </div>
      {tab === "teachers" && <div className="max-w-6xl mx-auto px-6 pt-6 pb-2">
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 600 }}>
          {learner ? `Welcome, ${learner.name.split(" ")[0]}` : "Find a teacher"}
        </h2>
        <p className="mt-1 text-sm" style={{ color: C.ivoryDim }}>
          {teachers.length} conservatory student{teachers.length === 1 ? "" : "s"} offering lessons
          {learner && learner.location ? ` · you're in ${learner.location}` : ""}.
        </p>
      </div>}
      {tab === "profile" && (
        <div className="max-w-lg mx-auto px-6 pt-10 pb-16">
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 600 }}>My profile</h2>
          <p className="mt-1 text-sm" style={{ color: C.ivoryDim }}>Update your name and location.</p>
          <div className="mt-8 flex flex-col gap-5">
            <div>
              <label className="block mb-1.5 text-xs" style={{ fontFamily: FONT_MONO, color: C.ivoryDim }}>FULL NAME</label>
              <input value={editName} onChange={(e) => { setEditName(e.target.value); setSaved(false); }}
                className="w-full rounded-xl px-4 py-3 text-sm"
                style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, color: C.ivory, outline: "none" }}
                placeholder="Your name" />
            </div>
            <div>
              <label className="block mb-1.5 text-xs" style={{ fontFamily: FONT_MONO, color: C.ivoryDim }}>LOCATION</label>
              <input value={editLocation} onChange={(e) => { setEditLocation(e.target.value); setSaved(false); }}
                className="w-full rounded-xl px-4 py-3 text-sm"
                style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, color: C.ivory, outline: "none" }}
                placeholder="City, Country" />
            </div>
            <button onClick={saveProfile} disabled={!editName.trim() || !editLocation.trim()}
              className="w-full rounded-xl py-3 text-sm font-semibold mt-1"
              style={{ background: C.brass, color: C.inkText, opacity: !editName.trim() || !editLocation.trim() ? 0.5 : 1 }}>
              {saved ? "Saved ✓" : "Save changes"}
            </button>
          </div>
          <div className="mt-10 pt-8 flex flex-col gap-3" style={{ borderTop: `1px solid ${C.inkLine}` }}>
            <button onClick={onLogout} className="w-full rounded-xl py-3 text-sm font-semibold"
              style={{ border: `1px solid ${C.inkLine}`, color: C.ivoryDim, background: "transparent" }}>
              Log out
            </button>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)}
                className="w-full rounded-xl py-3 text-sm font-semibold"
                style={{ border: `1px solid ${C.burgundy}`, color: C.burgundy, background: "transparent" }}>
                Delete account
              </button>
            ) : (
              <div className="rounded-xl p-4 flex flex-col gap-3" style={{ border: `1px solid ${C.burgundy}`, background: "rgba(138,54,54,0.08)" }}>
                <p className="text-sm" style={{ color: C.ivory }}>This will permanently delete your account and all your data. Are you sure?</p>
                {deleteError && <p className="text-xs" style={{ color: C.burgundy }}>{deleteError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => { setConfirmDelete(false); setDeleteError(""); }}
                    className="flex-1 rounded-lg py-2 text-sm"
                    style={{ border: `1px solid ${C.inkLine}`, color: C.ivoryDim, background: "transparent" }}>
                    Cancel
                  </button>
                  <button
                    disabled={deleting}
                    onClick={async () => {
                      setDeleting(true);
                      setDeleteError("");
                      try { await onDeleteAccount(); }
                      catch (e) { setDeleteError(e.message || "Something went wrong"); setDeleting(false); setConfirmDelete(false); }
                    }}
                    className="flex-1 rounded-lg py-2 text-sm font-semibold"
                    style={{ background: C.burgundy, color: C.ivory, opacity: deleting ? 0.6 : 1 }}>
                    {deleting ? "Deleting…" : "Yes, delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "teachers" && <div className="max-w-6xl mx-auto px-6 pb-12 lg-split-map">
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.inkLine}`, background: C.inkSoft }}>
          <MapTitle />
          <TeacherMap teachers={teachers} selectedId={selectedId} onSelect={selectTeacher} height={500} />
        </div>
        <div className="lg-scroll overflow-y-auto" style={{ borderLeft: `1px solid ${C.inkLine}`, maxHeight: 560 }}>
          {!selected ? (
            <div className="p-6">
              <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.ivoryDim }}>{teachers.length} TEACHERS</p>
              <p className="mt-2 text-sm" style={{ color: C.ivoryDim }}>Tap a gold pin on the map, or pick someone below.</p>
              <div className="mt-5 flex flex-col gap-2">
                {teachers.map((t) => {
                  const cons = CONSERVATORIES.find((c) => c.id === t.conservatoryId);
                  return (
                    <button key={t.id} onClick={() => selectTeacher(t.id)} className="text-left flex items-center gap-3 p-3 rounded-xl" style={{ border: `1px solid ${C.inkLine}` }}>
                      <Avatar name={t.name} id={t.id} size={40} photoUrl={t.photoUrl} online={t.online} />
                      <div className="min-w-0">
                        <p style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</p>
                        <p style={{ fontSize: 11, color: C.ivoryDim }}>
                          {cons ? cons.city : ""} · {teachingModeLabel(t.teaching.mode)}{t.teaching.price ? ` · €${t.teaching.price}` : ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-6">
              <button onClick={() => setSelectedId(null)} className="text-xs flex items-center gap-1 mb-4" style={{ color: C.ivoryDim }}><ArrowLeft size={13} /> All teachers</button>
              <div className="flex items-center gap-3">
                <Avatar name={selected.name} id={selected.id} size={52} photoUrl={selected.photoUrl} online={selected.online} />
                <div>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600 }}>{selected.name}</p>
                  <p style={{ fontSize: 12, color: C.ivoryDim }}>
                    {selected.instrument ? `${selected.instrument} · ` : ""}{selected.year ? `${selected.year} · ` : ""}
                    {(CONSERVATORIES.find((c) => c.id === selected.conservatoryId) || {}).name}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full text-xs" style={{ border: `1px solid ${C.inkLine}`, color: C.ivoryDim }}>{teachingModeLabel(selected.teaching.mode)}</span>
                {selected.teaching.price && <span className="px-3 py-1 rounded-full text-xs" style={{ border: `1px solid ${C.inkLine}`, color: C.brass }}>€{selected.teaching.price} / session</span>}
              </div>

              {selected.bio && <p className="mt-4 text-sm" style={{ color: C.ivoryDim, lineHeight: 1.6 }}>{selected.bio}</p>}

              {(() => {
                const linkMeta = videoLinkMeta(selected.videoLink);
                return linkMeta ? (
                  <a href={selected.videoLink} target="_blank" rel="noreferrer" className="mt-4 rounded-xl flex items-center gap-3 p-3" style={{ border: `1px solid ${C.inkLine}`, textDecoration: "none", color: "inherit" }}>
                    <div className="rounded-lg flex items-center justify-center shrink-0" style={{ width: 40, height: 40, background: colorFor(selected.id) }}>
                      <Play size={16} color={C.ivory} />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600 }}>Watch performance on {linkMeta.label}</p>
                      <p className="flex items-center gap-1" style={{ fontSize: 10, color: C.ivoryDim }}><linkMeta.Icon size={11} /> Opens in a new tab</p>
                    </div>
                  </a>
                ) : null;
              })()}

              {selected.tastes && selected.tastes.length > 0 && (
                <div className="mt-5">
                  <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.ivoryDim }}>MUSICAL PREFERENCES</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">{selected.tastes.map((t) => <span key={t} className="text-xs px-2.5 py-1 rounded-full" style={{ border: `1px solid ${C.inkLine}` }}>{t}</span>)}</div>
                </div>
              )}

              {selected.pieces && selected.pieces.length > 0 && (
                <div className="mt-5">
                  <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.ivoryDim }}>CURRENT REPERTOIRE</p>
                  <div className="flex flex-col gap-1.5 mt-2">
                    {selected.pieces.map((p, i) => (
                      <p key={i} className="text-sm"><span style={{ fontFamily: FONT_MONO, color: C.brass, fontSize: 11 }}>No.{i + 1}</span> {p.title} <span style={{ color: C.ivoryDim }}>— {p.composer}</span></p>
                    ))}
                  </div>
                </div>
              )}

              {selected.top && (
                <div className="mt-5">
                  <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.ivoryDim }}>TOP</p>
                  <p className="text-sm mt-2" style={{ lineHeight: 1.6 }}>{selected.top}</p>
                </div>
              )}
              {selected.flop && (
                <div className="mt-5">
                  <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.ivoryDim }}>FLOP</p>
                  <p className="text-sm mt-2" style={{ lineHeight: 1.6 }}>{selected.flop}</p>
                </div>
              )}

              {status === "accepted" ? (
                <LearnerChat teacher={selected} messages={conversations[selected.id] || []} onSend={onSend} />
              ) : status === "pending" ? (
                <div className="mt-6 rounded-xl p-4 text-sm" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, color: C.ivoryDim }}>
                  <p className="lg-blink">Request sent — waiting for {selected.name.split(" ")[0]} to accept…</p>
                </div>
              ) : (
                <div className="mt-6">
                  <PrimaryBtn full onClick={() => onSendRequest(selected.id)} icon={Send}>Send teaching request</PrimaryBtn>
                  <p className="mt-2 text-xs" style={{ color: C.ivoryDim }}>
                    {selected.name.split(" ")[0]} receives your request and can accept to start messaging.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>}
    </div>
  );
}

function LearnerChat({ teacher, messages, onSend }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);
  useEffect(() => { if (endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  function submit() { if (!text.trim()) return; onSend(text); setText(""); }
  return (
    <div className="mt-6 rounded-xl overflow-hidden" style={{ border: `1px solid ${C.inkLine}` }}>
      <div className="px-4 py-2.5 text-xs flex items-center gap-2" style={{ background: C.inkSoft, color: C.brass, borderBottom: `1px solid ${C.inkLine}` }}>
        <Check size={13} /> {teacher.name.split(" ")[0]} accepted — you can message now
      </div>
      <div className="lg-scroll overflow-y-auto px-4 py-3 flex flex-col gap-2" style={{ maxHeight: 240 }}>
        {messages.map((m, i) => (
          <div key={i} className="px-3.5 py-2 rounded-2xl text-sm" style={{ maxWidth: "80%", alignSelf: m.from === "me" ? "flex-end" : "flex-start", background: m.from === "me" ? C.brass : C.inkSoft, color: m.from === "me" ? C.inkText : C.ivory }}>
            {m.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="px-3 py-3 flex items-center gap-2" style={{ borderTop: `1px solid ${C.inkLine}` }}>
        <input style={{ ...inputStyle, flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder={`Message ${teacher.name.split(" ")[0]}…`} />
        <button onClick={submit} className="rounded-full p-3" style={{ background: C.brass }}><Send size={16} color={C.inkText} /></button>
      </div>
    </div>
  );
}

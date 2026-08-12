-- Move the roster into the database, so the domain can be checked there.
--
-- Until now the 109 schools and their email domains lived in a JavaScript
-- array in the bundle. Postgres had never heard of Juilliard, so the one
-- question it could not ask was the important one: does this address belong to
-- the school this person picked? It could see that a code had been verified
-- for someone's address, and nothing more — so an applicant who proved an
-- address at their own school could select any other school in the list.
--
-- The roster is data, not code. It lives here now, the send function refuses a
-- mismatch before a code is ever sent, each code records which school it was
-- issued for, and the approval trigger requires that school to be the one on
-- the profile. Three places, all server-side, none of them reachable from a
-- browser.
--
-- Run this in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- 1. The roster
-- ---------------------------------------------------------------------------
create table if not exists conservatories (
  id       text primary key,
  name     text not null,
  short    text not null default '',
  city     text not null default '',
  country  text not null default '',
  lat      double precision,
  lng      double precision,
  domains  text[] not null default '{}'
);

alter table conservatories enable row level security;

-- The list is public — the signup screen shows all of it before anyone has an
-- account. Reading it proves nothing; only writes matter.
drop policy if exists "conservatories read all" on conservatories;
create policy "conservatories read all" on conservatories for select using (true);

drop policy if exists "conservatories admin write" on conservatories;
create policy "conservatories admin write" on conservatories
  for all using (public.is_admin()) with check (public.is_admin());

create index if not exists conservatories_domains_idx on conservatories using gin (domains);

-- Seeded from the array that used to be the only copy. on conflict so this
-- migration can be re-run, and so a domain corrected by hand is not silently
-- reverted by re-running it — name and place refresh, domains do not.
insert into conservatories (id, name, short, city, country, lat, lng, domains) values
  ('juilliard', 'The Juilliard School', 'Juilliard', 'New York', 'USA', 40.7736, -73.9827, array['juilliard.edu']::text[]),
  ('curtis', 'Curtis Institute of Music', 'Curtis', 'Philadelphia', 'USA', 39.9496, -75.1717, array['curtis.edu']::text[]),
  ('nec', 'New England Conservatory', 'NEC', 'Boston', 'USA', 42.3428, -71.0857, array['necmusic.edu']::text[]),
  ('sfcm', 'San Francisco Conservatory of Music', 'SFCM', 'San Francisco', 'USA', 37.7776, -122.4196, array['sfcm.edu']::text[]),
  ('msm', 'Manhattan School of Music', 'MSM', 'New York', 'USA', 40.8116, -73.9465, array['msmnyc.edu']::text[]),
  ('cim', 'Cleveland Institute of Music', 'CIM', 'Cleveland', 'USA', 41.5085, -81.606, array['cim.edu']::text[]),
  ('colburn', 'Colburn School', 'Colburn', 'Los Angeles', 'USA', 34.0549, -118.2426, array['colburnschool.edu']::text[]),
  ('berklee', 'Berklee College of Music', 'Berklee', 'Boston', 'USA', 42.3467, -71.0872, array['berklee.edu']::text[]),
  ('eastman', 'Eastman School of Music', 'Eastman', 'Rochester', 'USA', 43.1566, -77.6088, array['u.rochester.edu']::text[]),
  ('jacobs', 'Jacobs School of Music (Indiana)', 'Jacobs', 'Bloomington', 'USA', 39.1653, -86.5264, array['iu.edu']::text[]),
  ('peabody', 'Peabody Institute (Johns Hopkins)', 'Peabody', 'Baltimore', 'USA', 39.296, -76.6169, array['jhu.edu']::text[]),
  ('oberlin', 'Oberlin Conservatory of Music', 'Oberlin', 'Oberlin', 'USA', 41.2939, -82.2171, array['oberlin.edu']::text[]),
  ('thornton', 'Thornton School of Music (USC)', 'Thornton', 'Los Angeles', 'USA', 34.0224, -118.2851, array['usc.edu']::text[]),
  ('bienen', 'Bienen School of Music (Northwestern)', 'Bienen', 'Evanston', 'USA', 42.0451, -87.6877, array['u.northwestern.edu']::text[]),
  ('rcm', 'Royal College of Music', 'RCM', 'London', 'UK', 51.4991, -0.1774, array['rcm.ac.uk']::text[]),
  ('ram', 'Royal Academy of Music', 'RAM', 'London', 'UK', 51.5237, -0.1585, array['ram.ac.uk']::text[]),
  ('guildhall', 'Guildhall School of Music & Drama', 'GSMD', 'London', 'UK', 51.5197, -0.0937, array['gsmd.ac.uk']::text[]),
  ('rncm', 'Royal Northern College of Music', 'RNCM', 'Manchester', 'UK', 53.4718, -2.235, array['rncm.ac.uk']::text[]),
  ('rcs', 'Royal Conservatoire of Scotland', 'RCS', 'Glasgow', 'UK', 55.866, -4.2547, array['rcs.ac.uk']::text[]),
  ('rbc', 'Royal Birmingham Conservatoire', 'RBC', 'Birmingham', 'UK', 52.4862, -1.8904, array['mail.bcu.ac.uk']::text[]),
  ('trinitylaban', 'Trinity Laban Conservatoire', 'TLM', 'London', 'UK', 51.4826, -0.0077, array['trinitylaban.ac.uk']::text[]),
  ('rwcmd', 'Royal Welsh College of Music & Drama', 'RWCMD', 'Cardiff', 'UK', 51.4837, -3.183, array['rwcmd.ac.uk']::text[]),
  ('eisler', 'Hochschule für Musik Hanns Eisler Berlin', 'Hanns Eisler', 'Berlin', 'Germany', 52.517, 13.396, array['stud.hfm-berlin.de']::text[]),
  ('udk', 'Universität der Künste Berlin', 'UdK', 'Berlin', 'Germany', 52.51, 13.327, array['student.udk-berlin.de']::text[]),
  ('hmtm', 'Hochschule für Musik und Theater München', 'HMTM', 'Munich', 'Germany', 48.1449, 11.571, array['hmtm.de']::text[]),
  ('hmtleipzig', 'HMT Felix Mendelssohn Bartholdy Leipzig', 'HMT Leipzig', 'Leipzig', 'Germany', 51.3397, 12.3731, array['stud.hmt-leipzig.de']::text[]),
  ('hfmtkoeln', 'Hochschule für Musik und Tanz Köln', 'HfMT Köln', 'Cologne', 'Germany', 50.9375, 6.9603, array['hfmt-koeln.de']::text[]),
  ('hmdkstuttgart', 'HMDK Stuttgart', 'HMDK', 'Stuttgart', 'Germany', 48.7758, 9.1829, array['hmdk-stuttgart.de']::text[]),
  ('hfmthamburg', 'HfMT Hamburg', 'HfMT Hamburg', 'Hamburg', 'Germany', 53.5628, 9.9877, array['hfmt-hamburg.de']::text[]),
  ('hfmdetmold', 'Hochschule für Musik Detmold', 'HfM Detmold', 'Detmold', 'Germany', 51.9367, 8.8794, array['hfm-detmold.de']::text[]),
  ('hfmwuerzburg', 'Hochschule für Musik Würzburg', 'HfM Würzburg', 'Würzburg', 'Germany', 49.7913, 9.9534, array['hfm-wuerzburg.de']::text[]),
  ('hfmweimar', 'Hochschule für Musik Franz Liszt Weimar', 'HfM Weimar', 'Weimar', 'Germany', 50.9795, 11.3235, array['hfm-weimar.de']::text[]),
  ('hfmkarlsruhe', 'Hochschule für Musik Karlsruhe', 'HfM Karlsruhe', 'Karlsruhe', 'Germany', 49.0069, 8.4037, array['hfm-karlsruhe.de']::text[]),
  ('hfmdresden', 'HfM Carl Maria von Weber Dresden', 'HfM Dresden', 'Dresden', 'Germany', 51.0504, 13.7373, array['hfmdd.de']::text[]),
  ('mdw', 'mdw – University of Music Vienna', 'mdw', 'Vienna', 'Austria', 48.2082, 16.3738, array['student.mdw.ac.at']::text[]),
  ('mozarteum', 'Mozarteum University Salzburg', 'Mozarteum', 'Salzburg', 'Austria', 47.8095, 13.055, array['stud.moz.ac.at']::text[]),
  ('kug', 'Kunstuniversität Graz', 'KUG', 'Graz', 'Austria', 47.0707, 15.4395, array['student.kug.ac.at']::text[]),
  ('muk', 'MUK Privatuniversität Wien', 'MUK', 'Vienna', 'Austria', 48.2, 16.37, array['muk.ac.at']::text[]),
  ('zhdk', 'Zurich University of the Arts', 'ZHdK', 'Zurich', 'Switzerland', 47.389, 8.517, array['zhdk.ch']::text[]),
  ('basel', 'Musik-Akademie Basel (FHNW)', 'Basel', 'Basel', 'Switzerland', 47.5596, 7.5886, array['students.fhnw.ch']::text[]),
  ('hemgeneve', 'Haute École de Musique de Genève', 'HEM Genève', 'Geneva', 'Switzerland', 46.2044, 6.1432, array['etu.hesge.ch']::text[]),
  ('hemu', 'HEMU Vaud Valais Fribourg', 'HEMU', 'Lausanne', 'Switzerland', 46.5197, 6.6323, array['hemu-cl.ch']::text[]),
  ('hslu', 'Lucerne School of Music', 'HSLU', 'Lucerne', 'Switzerland', 47.0502, 8.3093, array['student.hslu.ch']::text[]),
  ('hkb', 'Bern Academy of the Arts', 'HKB', 'Bern', 'Switzerland', 46.948, 7.4474, array['students.bfh.ch']::text[]),
  ('lugano', 'Conservatorio della Svizzera italiana', 'CSI Lugano', 'Lugano', 'Switzerland', 46.0037, 8.9511, array['conservatorio.ch']::text[]),
  ('cnsmdp', 'Conservatoire de Paris (CNSMDP)', 'CNSMDP', 'Paris', 'France', 48.8894, 2.3889, array['cnsmdp.fr']::text[]),
  ('cnsmdl', 'Conservatoire de Lyon (CNSMDL)', 'CNSMDL', 'Lyon', 'France', 45.764, 4.8357, array['cnsmd-lyon.fr']::text[]),
  ('hear', 'Académie Supérieure de Musique de Strasbourg', 'HEAR', 'Strasbourg', 'France', 48.5734, 7.7521, array['hear.fr']::text[]),
  ('milano', 'Conservatorio Giuseppe Verdi di Milano', 'Cons. Milano', 'Milan', 'Italy', 45.4642, 9.19, array['stud.consmilano.it']::text[]),
  ('santacecilia', 'Conservatorio Santa Cecilia', 'Santa Cecilia', 'Rome', 'Italy', 41.9028, 12.4964, array['studenti.conservatoriosantacecilia.it']::text[]),
  ('marcello', 'Conservatorio Benedetto Marcello', 'B. Marcello', 'Venice', 'Italy', 45.4408, 12.3155, array['studenti.conservatoriomarcello.it']::text[]),
  ('cherubini', 'Conservatorio Luigi Cherubini', 'Cherubini', 'Florence', 'Italy', 43.7696, 11.2558, array['studenti.consfi.it']::text[]),
  ('majella', 'Conservatorio San Pietro a Majella', 'S.P. a Majella', 'Naples', 'Italy', 40.8518, 14.2681, array['studenti.sanpietroamajella.it']::text[]),
  ('torino', 'Conservatorio Giuseppe Verdi di Torino', 'Cons. Torino', 'Turin', 'Italy', 45.0703, 7.6869, array['conservatoriotorino.it']::text[]),
  ('esmuc', 'ESMUC Barcelona', 'ESMUC', 'Barcelona', 'Spain', 41.3684, 2.15, array['esmuc.cat']::text[]),
  ('rcsmm', 'Real Conservatorio Superior de Madrid', 'RCSMM', 'Madrid', 'Spain', 40.409, -3.6929, array['alumno.rcsmm.eu']::text[]),
  ('musikene', 'Musikene', 'Musikene', 'San Sebastián', 'Spain', 43.3183, -1.9812, array['musikene.net']::text[]),
  ('csmaragon', 'Conservatorio Superior de Aragón', 'CSMA', 'Zaragoza', 'Spain', 41.6488, -0.8891, array['alumnos.csmaragon.es']::text[]),
  ('csmvalencia', 'CSM Joaquín Rodrigo Valencia', 'CSM Valencia', 'Valencia', 'Spain', 39.4699, -0.3763, array['csmvalencia.es']::text[]),
  ('cva', 'Conservatorium van Amsterdam', 'CvA', 'Amsterdam', 'Netherlands', 52.388, 4.8979, array['student.ahk.nl']::text[]),
  ('koncon', 'Royal Conservatoire The Hague', 'KC Den Haag', 'The Hague', 'Netherlands', 52.0705, 4.3007, array['student.koncon.nl']::text[]),
  ('codarts', 'Codarts Rotterdam', 'Codarts', 'Rotterdam', 'Netherlands', 51.9244, 4.4777, array['student.codarts.nl']::text[]),
  ('hku', 'Utrecht Conservatory (HKU)', 'HKU', 'Utrecht', 'Netherlands', 52.0907, 5.1214, array['student.hku.nl']::text[]),
  ('kcb', 'Royal Conservatory of Brussels (KCB)', 'KCB', 'Brussels', 'Belgium', 50.841, 4.355, array['student.ehb.be']::text[]),
  ('crb', 'Conservatoire Royal de Bruxelles', 'CRB', 'Brussels', 'Belgium', 50.8405, 4.356, array['student.arts2.be','conservatoire.be']::text[]),
  ('apantwerp', 'Royal Conservatoire Antwerp', 'AP Antwerp', 'Antwerp', 'Belgium', 51.2194, 4.4025, array['student.ap.be']::text[]),
  ('amkrakow', 'Akademia Muzyczna w Krakowie', 'AM Kraków', 'Kraków', 'Poland', 50.0647, 19.945, array['amuz.krakow.pl']::text[]),
  ('amgdansk', 'Akademia Muzyczna w Gdańsku', 'AM Gdańsk', 'Gdańsk', 'Poland', 54.352, 18.6466, array['amuz.gda.pl']::text[]),
  ('ampoznan', 'Akademia Muzyczna w Poznaniu', 'AM Poznań', 'Poznań', 'Poland', 52.4064, 16.9252, array['amuz.edu.pl']::text[]),
  ('amwroclaw', 'Akademia Muzyczna we Wrocławiu', 'AM Wrocław', 'Wrocław', 'Poland', 51.1079, 17.0385, array['amkl.edu.pl']::text[]),
  ('chopin', 'Chopin University of Music (Warsaw)', 'Chopin UM', 'Warsaw', 'Poland', 52.2419, 21.0087, array['chopin.edu.pl']::text[]),
  ('amkatowice', 'Akademia Muzyczna w Katowicach', 'AM Katowice', 'Katowice', 'Poland', 50.2649, 19.0238, array['am.katowice.pl']::text[]),
  ('amlodz', 'Akademia Muzyczna w Łodzi', 'AM Łódź', 'Łódź', 'Poland', 51.7592, 19.456, array['amuz.lodz.pl']::text[]),
  ('zagreb', 'Muzička akademija u Zagrebu', 'MA Zagreb', 'Zagreb', 'Croatia', 45.815, 15.9819, array['student.unizg.hr','muza.unizg.hr']::text[]),
  ('ljubljana', 'Akademija za glasbo Ljubljana', 'AG Ljubljana', 'Ljubljana', 'Slovenia', 46.0569, 14.5058, array['student.uni-lj.si']::text[]),
  ('belgrade', 'Fakultet muzičke umetnosti Beograd', 'FMU Beograd', 'Belgrade', 'Serbia', 44.7866, 20.4489, array['fmu.bg.ac.rs','student.bg.ac.rs']::text[]),
  ('sibelius', 'Sibelius Academy (Uniarts Helsinki)', 'Sibelius', 'Helsinki', 'Finland', 60.1699, 24.9384, array['uniarts.fi']::text[]),
  ('nmh', 'Norwegian Academy of Music', 'NMH', 'Oslo', 'Norway', 59.949, 10.718, array['student.nmh.no']::text[]),
  ('kmh', 'Royal College of Music Stockholm', 'KMH', 'Stockholm', 'Sweden', 59.3626, 18.0645, array['student.kmh.se']::text[]),
  ('dkdm', 'Royal Danish Academy of Music', 'DKDM', 'Copenhagen', 'Denmark', 55.6761, 12.5683, array['dkdm.dk']::text[]),
  ('liszt', 'Liszt Ferenc Academy of Music', 'Liszt Academy', 'Budapest', 'Hungary', 47.5015, 19.0658, array['lisztacademy.hu','student.lisztacademy.hu']::text[]),
  ('hamu', 'HAMU (Academy of Performing Arts Prague)', 'HAMU', 'Prague', 'Czech Republic', 50.0875, 14.4155, array['hamu.cz']::text[]),
  ('schulich', 'Schulich School of Music (McGill)', 'Schulich', 'Montreal', 'Canada', 45.5088, -73.5773, array['mail.mcgill.ca']::text[]),
  ('glenngould', 'The Glenn Gould School (RCM)', 'Glenn Gould', 'Toronto', 'Canada', 43.6702, -79.3903, array['rcmusic.ca']::text[]),
  ('utoronto', 'Faculty of Music (U of Toronto)', 'UofT Music', 'Toronto', 'Canada', 43.6677, -79.3948, array['mail.utoronto.ca']::text[]),
  ('ubc', 'UBC School of Music', 'UBC Music', 'Vancouver', 'Canada', 49.2606, -123.246, array['student.ubc.ca']::text[]),
  ('sydney', 'Sydney Conservatorium of Music', 'Sydney Con', 'Sydney', 'Australia', -33.86, 151.216, array['uni.sydney.edu.au']::text[]),
  ('melbourne', 'Melbourne Conservatorium of Music', 'Melb Con', 'Melbourne', 'Australia', -37.7963, 144.9614, array['student.unimelb.edu.au']::text[]),
  ('queensland', 'Queensland Conservatorium (Griffith)', 'QLD Con', 'Brisbane', 'Australia', -27.4747, 153.0175, array['griffithuni.edu.au']::text[]),
  ('elder', 'Elder Conservatorium (Adelaide)', 'Elder', 'Adelaide', 'Australia', -34.9205, 138.6047, array['student.adelaide.edu.au']::text[]),
  ('nzsm', 'Te Kōkī NZ School of Music', 'NZSM', 'Wellington', 'New Zealand', -41.29, 174.768, array['myvuw.ac.nz']::text[]),
  ('tbilisi', 'Tbilisi State Conservatoire', 'Tbilisi Cons', 'Tbilisi', 'Georgia', 41.697, 44.8, array['tsc.edu.ge','conmusic.ge']::text[]),
  ('yst', 'Yong Siew Toh Conservatory (NUS)', 'YST', 'Singapore', 'Singapore', 1.303, 103.773, array['u.nus.edu','ystmusic.nus.edu.sg']::text[]),
  ('hkapa', 'Hong Kong Academy for Performing Arts', 'HKAPA', 'Hong Kong', 'Hong Kong', 22.281, 114.172, array['stu.hkapa.edu']::text[]),
  ('karts', 'Korea National University of Arts', 'K-ARTS', 'Seoul', 'South Korea', 37.606, 127.045, array['karts.ac.kr']::text[]),
  ('ccom', 'Central Conservatory of Music', 'CCOM', 'Beijing', 'China', 39.9042, 116.4074, array['mail.ccom.edu.cn']::text[]),
  ('shcm', 'Shanghai Conservatory of Music', 'SHCM', 'Shanghai', 'China', 31.21, 121.46, array['student.shcmusic.edu.cn']::text[]),
  ('cairocons', 'Cairo Conservatoire (Academy of Arts)', 'Cairo Cons', 'Cairo', 'Egypt', 30.068, 31.22, array['academyofarts.edu.eg']::text[]),
  ('helwan', 'Faculty of Music Education (Helwan)', 'Helwan', 'Cairo', 'Egypt', 29.8419, 31.3342, array['hq.helwan.edu.eg']::text[]),
  ('berkleeabudhabi', 'Berklee Abu Dhabi', 'Berklee AD', 'Abu Dhabi', 'United Arab Emirates', 24.4539, 54.3773, array['berklee.edu']::text[]),
  ('hima', 'Higher Institute of Musical Arts', 'HIMA', 'Kuwait City', 'Kuwait', 29.3759, 47.9774, array['hima.edu.kw']::text[]),
  ('lnhcm', 'Lebanese National Higher Conservatory', 'LNHCM', 'Beirut', 'Lebanon', 33.8938, 35.5018, array['conservatory.gov.lb']::text[]),
  ('yarmouk', 'National Music Conservatory (Yarmouk)', 'Yarmouk', 'Irbid', 'Jordan', 32.5333, 35.85, array['yu.edu.jo']::text[]),
  ('cnmad', 'National Conservatory of Music (Rabat)', 'CNMAD', 'Rabat', 'Morocco', 34.0209, -6.8416, array['cnmad.ma']::text[]),
  ('isamt', 'Higher Institute of Music (Tunis)', 'ISAMt', 'Tunis', 'Tunisia', 36.8065, 10.1815, array['isamt.u-tunis.tn']::text[]),
  ('uct', 'South African College of Music (UCT)', 'SACM', 'Cape Town', 'South Africa', -33.957, 18.461, array['myuct.ac.za']::text[]),
  ('ufs', 'Odeion School of Music (UFS)', 'Odeion', 'Bloemfontein', 'South Africa', -29.108, 26.187, array['ufs4life.ac.za']::text[]),
  ('stellenbosch', 'Stellenbosch University Music', 'SU Music', 'Stellenbosch', 'South Africa', -33.9321, 18.8602, array['maties.sun.ac.za']::text[]),
  ('wits', 'Wits School of Arts (Music)', 'Wits', 'Johannesburg', 'South Africa', -26.1929, 28.0305, array['students.wits.ac.za']::text[])
on conflict (id) do update
  set name = excluded.name, short = excluded.short, city = excluded.city,
      country = excluded.country, lat = excluded.lat, lng = excluded.lng;

-- ---------------------------------------------------------------------------
-- 2. Which domains a school actually accepts
--
-- Two sources, exactly as the signup screen composes them: the roster above,
-- plus any admin-approved row for the same school. That second part is how a
-- conservatory that changes its email domain gets a new one without a deploy —
-- the request form, approved by hand — and it must count here too, or the
-- server would refuse the very address an admin just accepted.
--
-- Approved rows are matched to a built-in by name, accent- and case-folded,
-- because that is how the client merges them and the two must not disagree.
-- ---------------------------------------------------------------------------
create or replace function public.normalize_conservatory_name(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select btrim(regexp_replace(lower(unaccent_bytea_safe(p)), '\s+', ' ', 'g'));
$$;

-- unaccent is an extension and may not be installed; this keeps the migration
-- self-contained and does the one thing needed — fold the Latin accents that
-- appear in conservatory names.
create or replace function public.unaccent_bytea_safe(p text)
returns text
language sql
immutable
as $$
  select translate(
    coalesce(p, ''),
    'àáâãäåÀÁÂÃÄÅèéêëÈÉÊËìíîïÌÍÎÏòóôõöÒÓÔÕÖùúûüÙÚÛÜçÇñÑýÿÝ',
    'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnNyyY'
  );
$$;

create or replace function public.conservatory_domains(p_id text)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select array_agg(distinct d)
      from (
        -- the roster's own domains
        select lower(unnest(c.domains)) as d
          from conservatories c
         where c.id = p_id

        union all

        -- domains an admin approved for the same school, matched by name
        select lower(unnest(a.domains)) as d
          from approved_conservatories a
          join conservatories c
            on public.normalize_conservatory_name(a.name)
             = public.normalize_conservatory_name(c.name)
         where c.id = p_id

        union all

        -- a school that exists only as an approved row: its id is the uuid
        select lower(unnest(a.domains)) as d
          from approved_conservatories a
         where a.id::text = p_id
      ) all_domains
      where d is not null and d <> ''
    ),
    '{}'::text[]
  );
$$;

revoke all on function public.conservatory_domains(text) from public;
grant execute on function public.conservatory_domains(text) to anon, authenticated;

-- Does this address belong to this school? The one question the database could
-- not answer before. Subdomains count — many schools issue @stud.school.edu.
create or replace function public.email_matches_conservatory(p_email text, p_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from unnest(public.conservatory_domains(p_id)) d
     where lower(split_part(btrim(p_email), '@', 2)) = d
        or lower(split_part(btrim(p_email), '@', 2)) like '%.' || d
  );
$$;

revoke all on function public.email_matches_conservatory(text, text) from public;
grant execute on function public.email_matches_conservatory(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Bind each code to the school it was issued for
--
-- Without this the code proves an address and nothing else, and an applicant
-- could prove their own address and then select a different school. Null is
-- allowed and means the domain-request route, where the school is not on any
-- list yet — and because the trigger below requires a match, null never
-- satisfies it.
-- ---------------------------------------------------------------------------
alter table conservatory_email_codes
  add column if not exists conservatory_id text;

-- ---------------------------------------------------------------------------
-- 4. Approval now requires the code to have been issued for this school
--
-- Replaces the version from 20260812, which asked only whether the address had
-- been verified. Everything else about it is unchanged: admins pass through,
-- learners are not students of anywhere, an edit keeps what the row had, and
-- the columns are overwritten rather than raising — this runs on every signup,
-- and being wrong should cost somebody a review, not cost everybody an account.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_profile_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(nullif(btrim(new.conservatory_email), ''));
  v_proved boolean := false;
begin
  if public.is_admin() then
    return new;
  end if;

  if new.role is distinct from 'student' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.conservatory_id is not distinct from old.conservatory_id
     and lower(coalesce(new.conservatory_email, '')) is not distinct from lower(coalesce(old.conservatory_email, ''))
  then
    new.approved := old.approved;
    new.conservatory_verified := old.conservatory_verified;
    return new;
  end if;

  if v_email is not null and new.conservatory_id is not null then
    -- A code verified for this address AND issued for this school.
    select true into v_proved
      from conservatory_email_codes c
     where c.email = v_email
       and c.conservatory_id = new.conservatory_id
       and c.verified_at is not null
       and c.verified_at > now() - interval '1 day'
     limit 1;

    if not coalesce(v_proved, false) then
      -- The account's own address, verified by Supabase at sign-in — the
      -- Google Workspace case. It still has to belong to the school, which is
      -- the check that used to be impossible here.
      select true into v_proved
        from auth.users u
       where u.id = new.id
         and lower(u.email) = v_email
         and public.email_matches_conservatory(v_email, new.conservatory_id)
       limit 1;
    end if;
  end if;

  new.conservatory_verified := coalesce(v_proved, false);
  new.approved := new.conservatory_verified;

  return new;
end;
$$;

revoke all on function public.enforce_profile_approval() from public;

-- The trigger itself is unchanged from 20260812; re-created so a fresh
-- database gets it from either file.
drop trigger if exists profiles_enforce_approval on profiles;
create trigger profiles_enforce_approval
  before insert or update of approved, conservatory_verified, conservatory_email, conservatory_id
  on profiles
  for each row
  execute function public.enforce_profile_approval();

-- "Graduated" is now "Diploma" in the level-and-year answer. The app already
-- shows the new word for old rows; this updates the stored text to match.
--
-- Run this in the Supabase SQL editor.
update profiles
   set year = regexp_replace(year, '\mGraduated\M', 'Diploma', 'g')
 where year ~ '\mGraduated\M';

ALTER TABLE meetings.academic_years
  DROP CONSTRAINT academic_years_check1,
  DROP CONSTRAINT academic_years_check2,
  ADD CONSTRAINT academic_years_nonoverlapping
    EXCLUDE USING gist (daterange(starts_on, ends_on, '[)') WITH &&);

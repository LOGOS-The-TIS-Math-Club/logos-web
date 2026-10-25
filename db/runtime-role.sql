-- Run as the database owner after migrations, on the verified development target.
-- Grant this group to the application's dedicated Neon login; do not use the owner
-- connection for web requests. No credentials are stored in this file.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='logos_runtime') THEN
   CREATE ROLE logos_runtime NOLOGIN;
 END IF;
END $$;
GRANT USAGE ON SCHEMA people,applications,members,meetings,content,operations TO logos_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA people,applications,members,meetings,content,operations TO logos_runtime;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA operations TO logos_runtime;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA people,applications,members,meetings TO logos_runtime;
GRANT USAGE ON SCHEMA neon_auth TO logos_runtime;
GRANT SELECT ("accountId","idToken","userId","providerId") ON neon_auth.account TO logos_runtime;
-- No provider-managed mutation, schema DDL, owner privileges, or Auth session access.

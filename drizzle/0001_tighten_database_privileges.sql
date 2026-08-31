DO $$
BEGIN
	EXECUTE format(
		'REVOKE CONNECT ON DATABASE %I FROM PUBLIC',
		current_database()
	);
END
$$;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA logos
	GRANT USAGE, SELECT ON SEQUENCES TO logos_runtime;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA logos
	GRANT SELECT ON SEQUENCES TO logos_backup;

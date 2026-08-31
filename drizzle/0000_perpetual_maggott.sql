DO $$
BEGIN
	IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'logos_migration') THEN
		CREATE ROLE logos_migration NOLOGIN;
	END IF;
	IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'logos_runtime') THEN
		CREATE ROLE logos_runtime NOLOGIN;
	END IF;
	IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'logos_backup') THEN
		CREATE ROLE logos_backup NOLOGIN;
	END IF;
	IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'logos_audit') THEN
		CREATE ROLE logos_audit NOLOGIN;
	END IF;
END
$$;
--> statement-breakpoint
GRANT logos_migration TO CURRENT_USER;
--> statement-breakpoint
DO $$
BEGIN
	EXECUTE format(
		'GRANT CONNECT ON DATABASE %I TO logos_migration, logos_runtime, logos_backup',
		current_database()
	);
END
$$;
--> statement-breakpoint
CREATE SCHEMA "logos";
--> statement-breakpoint
CREATE TABLE "logos"."infrastructure_probe" (
	"id" integer PRIMARY KEY NOT NULL,
	"marker" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
REVOKE ALL ON SCHEMA logos FROM PUBLIC;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA logos TO logos_runtime, logos_backup;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE logos.infrastructure_probe TO logos_runtime;
--> statement-breakpoint
GRANT SELECT ON TABLE logos.infrastructure_probe TO logos_backup;
--> statement-breakpoint
GRANT USAGE ON SCHEMA drizzle TO logos_backup;
--> statement-breakpoint
GRANT SELECT ON TABLE drizzle.__drizzle_migrations TO logos_backup;
--> statement-breakpoint
GRANT SELECT ON SEQUENCE drizzle.__drizzle_migrations_id_seq TO logos_backup;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA logos
	GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO logos_runtime;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA logos
	GRANT SELECT ON TABLES TO logos_backup;

-- NOT EXECUTED. Run only with explicit authorization against the verified EMPTY staging database.
-- First apply reviewed repository migrations using a staging-only migration role.
-- Replace the identity and app-role identifiers after the provider audit. No player-data import.
CREATE TABLE breaker_staging_identity (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  isolation_id text NOT NULL
);
INSERT INTO breaker_staging_identity (singleton, isolation_id)
VALUES (true, 'REPLACE_WITH_NEW_STAGING_ISOLATION_UUID');
REVOKE ALL ON breaker_staging_identity FROM PUBLIC;
-- Owner must be a staging migration role, never the application role.
-- GRANT SELECT ON breaker_staging_identity TO approved_staging_application_role;
-- App role: NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS, no owner/migration role membership,
-- no access to production databases. Grant only needed DML on application tables/sequences.

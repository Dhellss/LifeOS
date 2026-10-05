-- Created once, on first initialisation of the Postgres volume.
-- Gives `npm run test:integration` and `npm run test:e2e` a scratch database
-- that is separate from the development one.
CREATE DATABASE lifeos_test;

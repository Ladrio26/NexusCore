-- Renomme la guilde créée par l'ancien système de bots (nom fixe "Nexus Bots").
-- À exécuter une fois sur MySQL / MariaDB.

UPDATE guilds
SET name = 'Dark Titans'
WHERE name = 'Nexus Bots'
LIMIT 1;

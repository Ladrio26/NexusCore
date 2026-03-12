-- Migration : remplacer attack_type 'magic' par 'ranged' (alignement frontend/backend)
SET NAMES utf8mb4;
UPDATE units SET attack_type = 'ranged' WHERE attack_type = 'magic';

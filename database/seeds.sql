-- Données initiales : unités de base (à compléter avec vos vrais seeds)
SET NAMES utf8mb4;

-- Exemple d'unités minimales pour que le bestiaire et la campagne fonctionnent
-- Vous pouvez remplacer / compléter avec vos seeds complets (feu, plante, eau, etc.)

INSERT IGNORE INTO units (id, code, name, rarity, role, attack_type, element, archetype, base_hp, base_attack, base_defense, base_speed, mastery, traits, skill_data, image_url)
VALUES
(1, 'PLACEHOLDER_1', 'Unité test 1', 'common', 'ranged', 'melee', 'water', 'CAC_DPS', 1000, 80, 80, 80, 0, '[]', '{}', NULL),
(2, 'PLACEHOLDER_2', 'Unité test 2', 'uncommon', 'support', 'ranged', 'fire', 'DISTANCE_DPS', 900, 90, 70, 90, 0, '[]', '{}', NULL),
(3, 'PLACEHOLDER_3', 'Unité test 3', 'rare', 'tank', 'melee', 'plant', 'CAC_TANK', 1200, 70, 100, 70, 0, '[]', '{}', NULL);

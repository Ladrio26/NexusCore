-- Seeds : unités support eau (à compléter selon votre jeu de données)
SET NAMES utf8mb4;
INSERT IGNORE INTO units (code, name, rarity, role, attack_type, element, archetype, base_hp, base_attack, base_defense, base_speed, mastery, traits, skill_data, image_url)
VALUES ('WATER_SUPPORT_1', 'Soigneur Eau', 'rare', 'support', 'ranged', 'water', 'DISTANCE_DPS', 950, 70, 75, 85, 10, '[]', '{}', NULL);

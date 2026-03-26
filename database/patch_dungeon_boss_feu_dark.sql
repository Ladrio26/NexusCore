-- Donjon ténèbres : unité boss alignée sur le boss feu (même « famille » : texte avant la virgule = « Boss Feu »).
-- À appliquer une fois sur la base (puis relancer : node scripts/sync-dungeon-water-plant-from-fire.mjs --only=dark).

INSERT INTO units (
  code, name, rarity, role, attack_type, element, archetype,
  base_hp, base_attack, base_defense, base_speed, mastery,
  traits, skill_data, image_url,
  specA_bonus_stat, specB_bonus_stat,
  specA_skill_modifier, specB_skill_modifier,
  specA_passive, specB_passive,
  is_boss
)
SELECT
  'BOSS_FEU_DARK',
  CONCAT(SUBSTRING_INDEX(f.name, ',', 1), ', ', 'Avatar des Ténèbres'),
  f.rarity, f.role, f.attack_type, 'dark', f.archetype,
  f.base_hp, f.base_attack, f.base_defense, f.base_speed, f.mastery,
  f.traits, f.skill_data, f.image_url,
  f.specA_bonus_stat, f.specB_bonus_stat,
  f.specA_skill_modifier, f.specB_skill_modifier,
  f.specA_passive, f.specB_passive,
  1
FROM units f
WHERE f.code = 'BOSS_FEU' AND LOWER(f.element) = 'fire'
LIMIT 1
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  rarity = VALUES(rarity),
  role = VALUES(role),
  attack_type = VALUES(attack_type),
  archetype = VALUES(archetype),
  base_hp = VALUES(base_hp),
  base_attack = VALUES(base_attack),
  base_defense = VALUES(base_defense),
  base_speed = VALUES(base_speed),
  mastery = VALUES(mastery),
  traits = VALUES(traits),
  skill_data = VALUES(skill_data),
  image_url = VALUES(image_url),
  specA_bonus_stat = VALUES(specA_bonus_stat),
  specB_bonus_stat = VALUES(specB_bonus_stat),
  specA_skill_modifier = VALUES(specA_skill_modifier),
  specB_skill_modifier = VALUES(specB_skill_modifier),
  specA_passive = VALUES(specA_passive),
  specB_passive = VALUES(specB_passive),
  is_boss = VALUES(is_boss);

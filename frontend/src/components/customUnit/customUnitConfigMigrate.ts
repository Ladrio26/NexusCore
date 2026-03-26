import type { EffectSlot, SkillBlock } from './effectSlotTypes';
import { clampCooldownModifier, sanitizeModifiersForEffect } from './customUnitTargeting';

export function migrateSkillEffects(
  skill: Record<string, unknown>,
  defaultTarget: string
): EffectSlot[] {
  const fx = skill.effects;
  if (!Array.isArray(fx) || fx.length === 0) return [];

  const first = fx[0];
  if (
    typeof first === 'object' &&
    first !== null &&
    'id' in first &&
    'target' in (first as object)
  ) {
    return (fx as EffectSlot[]).map((e) => {
      const id = String(e.id || '').toUpperCase();
      const mods = Array.isArray(e.modifiers)
        ? e.modifiers.map((m) => String(m).toUpperCase()).filter((m) => m !== 'CD_MINUS_1')
        : [];
      return {
        id,
        target: String(e.target || defaultTarget).toUpperCase(),
        modifiers: sanitizeModifiersForEffect(id, mods, String(e.target || defaultTarget).toUpperCase())
      };
    });
  }

  const legacyTarget = String(skill.target || defaultTarget).toUpperCase();
  const legacyMods = Array.isArray(skill.modifiers)
    ? (skill.modifiers as string[]).map((m) => String(m).toUpperCase())
    : [];

  return fx
    .map((e, i) => {
      const id = typeof e === 'string' ? e : (e as { id?: string }).id;
      const sid = String(id || '').toUpperCase();
      if (!sid) return null;
      const rowT =
        typeof e === 'object' && e !== null && 'target' in e
          ? String((e as { target: string }).target || legacyTarget).toUpperCase()
          : legacyTarget;
      const rowModsRaw =
        typeof e === 'object' && e !== null && Array.isArray((e as { modifiers?: string[] }).modifiers)
          ? (e as { modifiers: string[] }).modifiers.map((m) => String(m).toUpperCase())
          : i === 0
            ? [...legacyMods]
            : [];
      const rowMods = rowModsRaw.filter((m) => m !== 'CD_MINUS_1');
      return { id: sid, target: rowT, modifiers: sanitizeModifiersForEffect(sid, rowMods, rowT) } as EffectSlot;
    })
    .filter((x): x is EffectSlot => x !== null);
}

export function migrateSkillBlock(
  raw: object,
  defaultTarget: string,
  slotCount: number
): Partial<SkillBlock> {
  const rows = migrateSkillEffects(raw as Record<string, unknown>, defaultTarget);
  const effects: EffectSlot[] = [];
  for (let i = 0; i < slotCount; i++) {
    effects.push(rows[i] || { id: '', target: defaultTarget, modifiers: [] });
  }
  const o = raw as Record<string, unknown>;
  return {
    effects,
    cooldownModifier: clampCooldownModifier(Number(o.cooldownModifier ?? 0)),
    type: o.type as SkillBlock['type'],
    passiveTrigger: o.passiveTrigger as string | undefined
  };
}

# Audit : heals, shields et effets similaires

## 1. Types d’events générés par le moteur

Le moteur (core) produit des **events bruts** (state.events) puis `buildBattleLog` les convertit en entrées **normalisées** avec un `type` issu de `BattleEventType` (battleEvents.js). Le front reçoit ce battleLog et, dans `processLog`, utilise `type.toLowerCase()`.

| Type normalisé (backend) | Origine moteur | Description |
|---------------------------|----------------|--------------|
| **DAMAGE** | `ev.type === 'attack'` + `ev.finalDamage` | Dégâts (attaque de base ou compétence) |
| **HEAL** | (1) Skill effet HEAL via `effectsResultsByTarget` ; (2) SYNERGY_TRIGGER LIFESTEAL ; (3) SYNERGY_TRIGGER SELF_REGEN | Soin (compétence, lifesteal, régénération Druides) |
| **SHIELD** | (1) Skill SHIELD_SELF ; (2) Skill effet SHIELD dans `effectsResultsByTarget` | Bouclier (compétence ou effet) |
| **DEATH** | `ev.type === 'unit_ko' \|\| 'ko'` | Unité KO |
| **BUFF_APPLY** | Skill APPLY_BUFF dans effectsResultsByTarget | Application d’un buff |
| **BUFF_TICK** / **BUFF_REMOVE** | tickStatuses() | Tick / suppression de buff |
| **DEBUFF_APPLY** / **DEBUFF_TICK** / **DEBUFF_REMOVE** | Skill APPLY_DEBUFF + tickStatuses | Débuffs |
| **STRIP** | Skill effet STRIP | Retrait de buff(s) |
| **RESURRECT** | Skill RESURRECT ou passive SELF_RESURRECT | Résurrection |
| **SYNERGY_TRIGGER** | Synergies (DRUIDS, ARCANISTS, LIFESTEAL, etc.) | Déclenchement de synergie (souvent suivi d’un HEAL ou SHIELD dédié) |

**Non émis par le moteur :**

- **shield_break** : la consommation du bouclier par les dégâts est gérée en interne (état `target.shield`) mais aucun event dédié « shield_break » n’est poussé dans le log.
- **lifesteal** / **regeneration** en tant que type : ce sont des **sous-cas de HEAL**. Le moteur émet un event **SYNERGY_TRIGGER** puis un event **HEAL** avec `meta.synergyType` (ex. LIFESTEAL, DRUIDS). Il n’existe pas de type `LIFESTEAL` ou `REGENERATION` dans BattleEventType.

---

## 2. Tableau : Event type vs moteur / log texte / animation / state

| Event Type (front) | Appliqué moteur | Log texte | Animation | State mis à jour |
|--------------------|-----------------|-----------|-----------|------------------|
| **damage** | ✓ applyDamage + setUnitHp | ✓ « X inflige Y dégâts à Z » | ✓ animateAttack + showFloatingText(-X rouge) | ✓ updateHP (battlefieldHp, jauge) ; KO → dead + opacity |
| **heal** | ✓ HEAL (skill) : applyHeal + setUnitHp ; LIFESTEAL/SELF_REGEN : setUnitHp + HEAL entry | ✓ « X soigne Y pour Z PV » | ✓ showFloatingText(+X vert) | ✓ updateHP (battlefieldHp, jauge) |
| **skill_heal** | Même chose que heal (backend n’émet que HEAL) | ✓ même branche que heal | ✓ idem | ✓ idem |
| **shield** | ✓ SHIELD (skill / effet) : applyShield ; SHIELD_SELF + effets SHIELD | ✓ « X accorde un bouclier de Y à Z » | ✓ showFloatingText(+Y 🛡 bleu) + addShieldOverlay (surcouche bleutée) | ⚠️ Affichage visuel uniquement (pas de state « shield » côté front) |
| **shield_break** | ✗ Non émis | ✗ Non géré | ✗ | ✗ |
| **lifesteal** | ✓ (émet HEAL avec meta.synergyType) | ✓ via type **heal** (texte générique « soigne … PV ») | ✓ idem heal | ✓ updateHP |
| **regeneration** | ✓ (émet HEAL avec meta.synergyType + hpAfter) | ✓ via type **heal** | ✓ idem heal | ✓ updateHP (meta.hpAfter si présent) |
| **death** / **ko** | ✓ unit_ko / ko | ✓ « Z est KO » | ✓ classe .dead + opacity 0.3 | ✓ updateHP(0) + deadUnits |
| **buff_apply** | ✓ APPLY_BUFF | ✓ « X confère … » / « X ➜ Y : 🔺 … » | ✓ showFloatingText + addStatusEffect | ✓ icône buff (duration) |
| **buff_tick** / **buff_remove** | ✓ tickStatuses | — (pas de ligne log dédiée) | ✓ updateStatusDuration / removeBuff | ✓ visuel icônes |
| **debuff_apply** / **debuff_tick** / **debuff_remove** | ✓ APPLY_DEBUFF + tickStatuses | ✓ « X confère … » / « X ➜ Y : 🔻 … » | ✓ showFloatingText + addStatusEffect / removeBuff | ✓ icônes debuff |
| **strip** | ✓ STRIP | ✓ « X retire Y buff(s) à Z » | ✓ retrait d’icônes buff | ✓ visuel buff-container |

Légende :

- **Appliqué moteur** : l’effet est bien calculé et appliqué (HP, shield, buffs, etc.) et une entrée correspondante est ajoutée au battleLog.
- **Log texte** : une ligne lisible apparaît dans la colonne des logs (équipe A/B).
- **Animation** : floating text et/ou overlay (shield, attack).
- **State mis à jour** : `battlefieldHp`, `deadUnits`, jauge HP, icônes buff/debuff, overlay bouclier.

---

## 3. Vérification StageModal (processLog)

- **damage** : oui (pushLog, animateAttack, showFloatingText, updateHP).
- **heal** / **skill_heal** : oui (pushLog, showFloatingText, updateHP avec meta.hpAfter si présent).
- **shield** : oui (pushLog, showFloatingText « +Y 🛡 », addShieldOverlay).
- **lifesteal** / **regeneration** : gérés **indirectement** via l’event **HEAL** (pas de case `lifesteal` ou `regeneration` ; le texte reste « soigne … PV »).
- **shield_break** : pas de case ; le moteur n’émet pas cet event.
- **buff_apply**, **debuff_apply**, **buff_tick**, **buff_remove**, **debuff_tick**, **debuff_remove**, **strip** : gérés comme indiqué dans le tableau.

---

## 4. Synthèse

| Critère | Statut |
|--------|--------|
| Moteur applique heal / shield / regen / lifesteal | ✓ |
| Chaque action pertinente génère un event (HEAL/SHIELD/DAMAGE/…) dans battleLog | ✓ |
| StageModal interprète heal, shield, damage, buffs, debuffs, strip | ✓ |
| Visuels : heal (+XXX vert, jauge HP), shield (surcouche bleue + 🛡) | ✓ |
| shield_break | ✗ Non émis par le moteur, non géré en log/visuel |
| Libellés spécifiques « Vol de vie » / « Régénération » | Optionnel (actuellement tout en « soigne … PV ») |

Conclusion : la chaîne moteur → battleLog → StageModal est fonctionnelle pour **damage**, **heal** (y compris lifesteal et régénération), **shield**, buffs et debuffs. La seule absence notable est **shield_break** (non implémenté côté moteur et front).

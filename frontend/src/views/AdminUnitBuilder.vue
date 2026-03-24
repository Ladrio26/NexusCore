<template>
  <section class="admin-unit-builder admin-fullwidth dense-mode">
    <p v-if="!schema" class="status">Chargement du schéma...</p>
    <template v-else>
      <div class="admin-layout">
        <!-- Colonne gauche : liste unités -->
        <aside class="admin-sidebar">
          <div class="existing-units-section section">
            <h3>Unités</h3>
            <div class="existing-units-filters">
              <label>Rareté
                <select v-model="unitFilterRarity" class="unit-filter-select">
                  <option value="">Toutes</option>
                  <option v-for="r in schema.rarities" :key="r" :value="r">{{ r }}</option>
                </select>
              </label>
              <label>Élément
                <select v-model="unitFilterElement" class="unit-filter-select">
                  <option value="">Tous</option>
                  <option v-for="e in schema.elements" :key="e" :value="e">{{ e }}</option>
                </select>
              </label>
              <label>Rôle
                <select v-model="unitFilterRole" class="unit-filter-select">
                  <option value="">Tous</option>
                  <option v-for="r in schema.roles" :key="r" :value="r">{{ r }}</option>
                </select>
              </label>
            </div>
            <div class="existing-units-toolbar">
              <input v-model="unitSearch" type="text" placeholder="Rechercher..." class="unit-search" />
              <button type="button" class="nx-btn" @click="loadUnits" :disabled="loadingUnits">Rafraîchir</button>
            </div>
            <p v-if="loadingUnits" class="status">Chargement...</p>
            <div v-else class="unit-list">
              <button
                v-for="u in filteredExistingUnits"
                :key="u?.id ?? u?.code"
                type="button"
                class="unit-row"
                :class="{ selected: form.id === u.id }"
                @click="loadUnitIntoForm(u)"
              >
                <span class="unit-row-name">{{ u.name }}</span>
                <span class="unit-row-meta">{{ u.rarity }}<template v-if="u.is_boss"> · Boss</template></span>
                <span class="unit-row-extra">—</span>
              </button>
            </div>
            <div class="existing-units-actions">
              <button type="button" class="nx-btn nx-btn-secondary" @click="resetForm">Nouvelle unité</button>
              <span v-if="form.id" class="editing-badge">Édition : {{ form.name || form.code }}</span>
            </div>
          </div>
        </aside>

        <!-- Colonne droite : formulaire -->
        <div class="admin-main">
          <div class="card nx-panel">
            <h2 class="nx-title">Admin — Unités</h2>

            <!-- SECTION 1 - Infos Unité -->
            <div class="section">
              <h3>1. Infos unité</h3>
              <div class="unit-info-grid">
                <label>Nom <input v-model="form.name" type="text" /></label>
                <label>Rareté
                  <select v-model="form.rarity" @change="onRarityChangeForBaseStats">
                    <option v-for="r in schema.rarities" :key="r" :value="r">{{ r }}</option>
                  </select>
                </label>
                <label>Élément
                  <select v-model="form.element">
                    <option v-for="e in schema.elements" :key="e" :value="e">{{ e }}</option>
                  </select>
                </label>
                <label>Rôle
                  <select v-model="form.role" @change="onRoleSelectChange">
                    <option v-for="r in schema.roles" :key="r" :value="r">{{ r }}</option>
                  </select>
                </label>
                <label>Attack type
                  <select v-model="form.attack_type">
                    <option v-for="a in schema.attack_types" :key="a" :value="a">{{ a }}</option>
                  </select>
                </label>
                <label>Archetype
                  <select v-model="form.archetype">
                    <option v-for="a in schema.archetypes" :key="a" :value="a">{{ a }}</option>
                  </select>
                </label>
                <label>Base HP <input v-model.number="form.base_hp" type="number" min="0" /></label>
                <label>Base ATK <input v-model.number="form.base_attack" type="number" min="0" /></label>
                <label>Base DEF <input v-model.number="form.base_defense" type="number" min="0" /></label>
                <label>Base SPEED <input v-model.number="form.base_speed" type="number" min="0" /></label>
                <label>{{ toStatFr('mastery') }} <input v-model.number="form.mastery" type="number" min="0" /></label>
              </div>
              <p class="unit-image-help base-stats-autofill-hint">
                Stats de base (HP, ATK, DEF, vitesse, maîtrise) : préremplies au niveau 1 dès que la
                <strong>rareté</strong> et le <strong>rôle</strong> sont choisis (tableau de référence).
              </p>
              <div class="unit-info-traits">
                <label>Traits (multi)
                  <select v-model="form.traits" multiple size="2">
                    <option v-for="t in schema.traits" :key="t" :value="t">{{ toTraitFr(t) }}</option>
                  </select>
                </label>
              </div>
              <label class="unit-boss-flag">
                <input v-model="form.is_boss" type="checkbox" />
                <span><strong>Unité boss</strong> — réservée campagne / donjons : pas au sanctuaire, pas dans le bestiaire, pas dans les tirages (portails, portail de guilde, PvP PNJ).</span>
              </label>
            </div>

            <div v-if="showNoyauSection" class="section">
              <h3>1.b Noyau</h3>
              <p class="unit-image-help">
                Les unités epic, legendary et mythic ont obligatoirement un noyau.
              </p>
              <div class="form-grid">
                <label class="field-required">Stat ciblée
                  <select v-model="form.noyau_stat" required>
                    <option value="">— Choisir —</option>
                    <option v-for="opt in noyauStatOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </label>
                <label class="field-required">Bonus %
                  <input v-model.number="form.noyau_percent" type="number" min="1" step="1" required />
                </label>
                <label>Description
                  <input :value="generatedNoyauDescription" type="text" readonly />
                </label>
              </div>
            </div>

            <!-- Image unité (sélection depuis personnages/) -->
            <div class="section section-unit-image">
              <h3>Image de l'unité</h3>
              <div class="unit-image-upload">
                <div v-if="currentUnitImageUrl" class="unit-image-preview-wrap">
                  <img :src="currentUnitImageUrl" alt="" class="unit-image-preview" />
                </div>
                <div v-else class="unit-image-placeholder">Aucune image (affichage par défaut selon le nom)</div>
                <div class="form-row compact single">
                  <label>Rechercher une image
                    <input v-model.trim="unitImageSearch" type="text" placeholder="Ex: Alpha, Luna, Tsuna..." />
                  </label>
                </div>
                <div class="form-row compact single">
                  <label>Image du dossier `personnages/`
                    <select v-model="form.image_url">
                      <option :value="null">Aucune image explicite</option>
                      <option v-for="asset in filteredUnitImageAssets" :key="asset.path" :value="asset.path">
                        {{ asset.filename }}
                      </option>
                    </select>
                  </label>
                </div>
                <div class="unit-image-actions">
                  <button type="button" class="nx-btn" :disabled="!filteredUnitImageAssets.length" @click="selectFirstMatchingImage">
                    Choisir la première image filtrée
                  </button>
                  <button
                    v-if="form.image_url"
                    type="button"
                    class="nx-btn nx-btn-danger"
                    @click="clearSelectedImage"
                  >
                    Retirer l'image explicite
                  </button>
                  <button type="button" class="nx-btn nx-btn-secondary" @click="loadUnitImageAssets">
                    Rafraîchir la liste
                  </button>
                </div>
                <p class="unit-image-help">
                  Les fichiers proviennent de `personnages/`. Si aucune image explicite n'est choisie, l'app retombe sur le nom de l'unité.
                </p>
              </div>
            </div>

            <!-- SECTION 2 - Compétences -->
            <div class="section section-skill-base">
              <h3>2. Compétences</h3>
              <div class="form-row compact single">
                <label>Description sort principal
                  <textarea v-model="form.description.skill" rows="1" placeholder="Ex: Inflige des dégâts."></textarea>
                </label>
              </div>
              <div class="skill-add-row">
                <button type="button" class="nx-btn" @click="addSkill">Ajouter une compétence</button>
                <button type="button" class="nx-btn nx-btn-secondary" title="Passif permanent DEBUFF_IMMUNITY (immunité débuffs, STRIP, −ATB, etc.)" @click="addDebuffImmunityPassive">
                  + Passif immunisation débuffs
                </button>
              </div>
              <div v-for="(sk, skIdx) in form.skills" :key="'sk-' + (sk.id || skIdx)" class="skill-card" :class="{ 'skill-targeted-by-spec': skillIdsTargetedBySpecs.has((sk.id ?? '').toString().trim()) }">
                <div v-if="skillIdsTargetedBySpecs.has((sk.id ?? '').toString().trim())" class="spec-target-warning">⚠ Spé utilise cet ID.</div>
                <div class="skill-card-header">
                  <span class="skill-card-id">ID {{ (sk.id ?? '').toString().slice(0, 12) }}</span>
                  <span class="skill-card-type">
                    <select v-model="sk.type" @change="onFormSkillTypeChange(sk)">
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="PASSIVE">PASSIVE</option>
                    </select>
                  </span>
                  <span class="skill-card-cd" v-if="sk.type === 'ACTIVE'">CD <input v-model.number="sk.cd_actions" type="number" min="0" class="input-inline" /></span>
                  <span class="skill-card-cd" v-else>CD <input v-model.number="sk.cooldown" type="number" min="0" class="input-inline" /></span>
                  <button type="button" class="nx-btn nx-btn-danger" @click="removeSkill(skIdx)">Suppr.</button>
                </div>
                <div class="skill-card-body">
                  <template v-if="sk.type === 'PASSIVE'">
                    <label>Type de passif
                      <select
                        :value="isPermanentPassiveSkill(sk) ? 'immunity' : 'triggered'"
                        @change="onPassiveModeChange(sk, ($event.target as HTMLSelectElement).value)"
                      >
                        <option value="triggered">Déclenché (trigger + effets)</option>
                        <option value="immunity">Permanent — DEBUFF_IMMUNITY (immunité débuffs / effets négatifs)</option>
                      </select>
                    </label>
                    <p v-if="isPermanentPassiveSkill(sk)" class="unit-image-help passive-permanent-hint">
                      <strong>DEBUFF_IMMUNITY</strong> : pas de trigger ni d’effets ici — le moteur immunise contre débuffs,
                      STRIP, réduction d’ATB, plafond CD, vol de stats, etc. (pas les dégâts/soins bruts).
                    </p>
                    <template v-if="!isPermanentPassiveSkill(sk)">
                      <label>Trigger
                        <select v-model="sk.trigger">
                          <option value="">—</option>
                          <option v-for="t in passiveTriggerOptions" :key="t" :value="t">{{ t }}</option>
                        </select>
                      </label>
                    </template>
                    <template v-else>
                      <label>Kind permanent
                        <select v-model="sk.passiveKind">
                          <option v-for="k in passivePermanentKindOptions" :key="k" :value="k">{{ k }}</option>
                        </select>
                      </label>
                    </template>
                  </template>
                  <label v-if="sk.type === 'ACTIVE' || sk.type === 'PASSIVE'" class="skill-desc">
                    Description
                    <input
                      v-model="sk.description"
                      type="text"
                      placeholder="Optionnel — affichée dans le bestiaire / la collection (surtout si plusieurs compétences)"
                    />
                  </label>
                </div>
                <button
                  v-if="!(sk.type === 'PASSIVE' && isPermanentPassiveSkill(sk))"
                  type="button"
                  class="nx-btn nx-btn-small"
                  @click="addSkillEffect(skIdx)"
                >
                  + Effet
                </button>
                <div v-if="!(sk.type === 'PASSIVE' && isPermanentPassiveSkill(sk))" class="effects-grid">
                  <div v-for="(eff, effIdx) in sk.effects" :key="'sk-' + skIdx + '-e-' + effIdx" class="effect-block effect-block-spec">
              <div class="effect-header">
                <span>Effet {{ effIdx + 1 }}</span>
                <button type="button" class="nx-btn nx-btn-danger" @click="removeSkillEffect(skIdx, effIdx)">Supprimer</button>
              </div>
              <label>Type
                <select v-model="eff.type">
                  <option v-for="t in effectTypes" :key="t" :value="t">{{ t }}</option>
                </select>
              </label>
              <template v-if="eff.type && schema.SUPPORTED_EFFECTS[eff.type]">
                <template v-for="key in effectFieldsForEffect(eff)" :key="key">
                  <label v-if="isRequiredOneOfForEffect(eff, key)" class="field-required">
                    {{ key }} (un parmi requis){{ fieldHint(key, eff) }}
                    <input v-if="isNumberField(key)" v-model.number="eff[key]" type="number" step="any" :placeholder="fieldPlaceholder(key, eff)" />
                    <input v-else v-model="eff[key]" type="text" />
                  </label>
                  <label v-else>
                    {{ key }}{{ fieldHint(key, eff) }}
                    <select v-if="key === 'target'" v-model="eff.target">
                      <option value=""></option>
                      <option v-for="t in schema.VALID_TARGETS" :key="t" :value="t">{{ t }}</option>
                    </select>
                    <select v-else-if="key === 'stat'" v-model="eff.stat">
                      <option value=""></option>
                      <option v-for="s in stealableStats" :key="s" :value="s">{{ s }}</option>
                    </select>
                    <select v-else-if="key === 'buffType'" v-model="eff.buffType">
                      <option value=""></option>
                      <option v-for="b in buffOnlyTypes" :key="b" :value="b">{{ b }}</option>
                    </select>
                    <select v-else-if="key === 'debuffType'" v-model="eff.debuffType">
                      <option value=""></option>
                      <option v-for="d in schema.DEBUFF_TYPES" :key="d" :value="d">{{ d }}</option>
                    </select>
                    <select v-else-if="key === 'scaleMetric'" v-model="eff.scaleMetric">
                      <option value="">removedCount (défaut)</option>
                      <option value="removedCount">removedCount — CLEANSE / STRIP (champ removed)</option>
                      <option value="effectiveDamage">effectiveDamage — dégâts de l’effet référencé</option>
                    </select>
                    <input v-else-if="isNumberField(key)" v-model.number="eff[key]" type="number" step="any" :placeholder="fieldPlaceholder(key, eff)" />
                    <input v-else v-model="eff[key]" type="text" />
                  </label>
                </template>
                <p v-if="eff.type === 'APPLY_BUFF' && buffFixedLabel(eff.buffType)" class="effect-fixed-value-msg">{{ buffFixedLabel(eff.buffType) }}</p>
                <p v-if="eff.type === 'APPLY_DEBUFF' && debuffFixedLabel(eff.debuffType)" class="effect-fixed-value-msg">{{ debuffFixedLabel(eff.debuffType) }}</p>
                <p v-if="['ATB_UP', 'REDUCE_ATB'].includes(String(eff.type ?? '').toUpperCase())" class="effect-fixed-value-msg">
                  <strong>Barre ATB liée :</strong> <code>ATB_UP</code> ou <code>REDUCE_ATB</code> avec <code>percent</code> fixe et/ou
                  <code>scaleFromEffectIndex</code> + <code>percentPerRemoved</code> (même logique).
                  <code>removedCount</code> = débuffs retirés (CLEANSE) ou buffs retirés (STRIP) sur la <strong>même cible</strong>.
                  Fonctionne aussi sur un <strong>passif</strong> qui a <strong>plusieurs effets</strong> dans l’ordre (indices = cet ordre).
                  Ex. STRIP puis <code>REDUCE_ATB</code> pour rogner l’ATB selon les buffs stripés.
                </p>
                <p v-if="String(eff.type ?? '').toUpperCase() === 'HEAL'" class="effect-fixed-value-msg">
                  <strong>Soin lié :</strong> après un CLEANSE, <code>valuePerRemoved</code> × nombre de débuffs retirés (même cible) s’ajoute au soin
                  (flat PV). <code>scaleFromEffectIndex</code> pointe vers l’effet CLEANSE.
                </p>
                <p v-if="String(eff.type ?? '').toUpperCase() === 'DAMAGE'" class="effect-fixed-value-msg">
                  <strong>Dégâts liés :</strong> après un STRIP, <code>valuePerRemoved</code> × buffs retirés = dégâts plats bonus (même cible).
                </p>
                <p
                  v-if="String(eff.type ?? '').toUpperCase() === 'APPLY_BUFF' && ['SHIELD', 'REGEN', 'DOT', 'ANTI_BUFF'].includes(String(eff.buffType ?? '').toUpperCase())"
                  class="effect-fixed-value-msg"
                >
                  <strong>Bonus lié CLEANSE / STRIP :</strong> SHIELD &amp; REGEN : +<code>valuePerRemoved</code> × métrique au bouclier / soin par tour.
                  DOT : +<code>valuePerRemoved</code> × STRIP = stacks supplémentaires. ANTI_BUFF : bonus de <code>remainingActions</code> (tours) × strip.
                  Pour les bonus CLEANSE, garder <code>scaleMetric</code> = <code>removedCount</code> (défaut).
                </p>
              </template>
                  </div>
                </div>
                <!-- PREVIEW FINAL SKILL -->
                <div v-if="sk?.id && finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.final" class="preview-final-skill">
              <h5>PREVIEW FINAL SKILL</h5>
              <div class="preview-final-grid">
                <div class="preview-row">
                  <span class="preview-label">ID</span>
                  <span :class="{ 'modified-by-spec': finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.modifiedKeys?.has('id') }">{{ finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.final?.id }}</span>
                  <span v-if="finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.modifiedKeys?.has('id')" class="badge-spec">(modifié par spécialisation)</span>
                </div>
                <div class="preview-row">
                  <span class="preview-label">Type</span>
                  <span>{{ finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.final?.type }}</span>
                </div>
                <template v-if="finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.final?.type === 'PASSIVE'">
                  <div
                    v-if="(finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.final?.passiveKind ?? '').toString().trim()"
                    class="preview-row"
                  >
                    <span class="preview-label">passiveKind</span>
                    <span :class="{ 'modified-by-spec': finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.modifiedKeys?.has('passiveKind') }">{{ finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.final?.passiveKind }}</span>
                    <span v-if="finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.modifiedKeys?.has('passiveKind')" class="badge-spec">(modifié par spécialisation)</span>
                  </div>
                  <div class="preview-row">
                    <span class="preview-label">Trigger</span>
                    <span :class="{ 'modified-by-spec': finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.modifiedKeys?.has('trigger') }">{{ finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.final?.trigger ?? '—' }}</span>
                    <span v-if="finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.modifiedKeys?.has('trigger')" class="badge-spec">(modifié par spécialisation)</span>
                  </div>
                  <div class="preview-row">
                    <span class="preview-label">Cooldown</span>
                    <span :class="{ 'modified-by-spec': finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.modifiedKeys?.has('cooldown') }">{{ finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.final?.cooldown ?? 0 }}</span>
                    <span v-if="finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.modifiedKeys?.has('cooldown')" class="badge-spec">(modifié par spécialisation)</span>
                  </div>
                </template>
                <template v-else>
                  <div class="preview-row">
                    <span class="preview-label">cd_actions</span>
                    <span :class="{ 'modified-by-spec': finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.modifiedKeys?.has('cd_actions') }">{{ finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.final?.cd_actions ?? 0 }}</span>
                    <span v-if="finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.modifiedKeys?.has('cd_actions')" class="badge-spec">(modifié par spécialisation)</span>
                  </div>
                </template>
                <div class="preview-row preview-row-effects">
                  <span class="preview-label">Effets</span>
                  <span :class="{ 'modified-by-spec': finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.modifiedKeys?.has('effects') }">
                    {{ (finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.final?.effects ?? []).length }} effet(s)
                  </span>
                  <span v-if="finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.modifiedKeys?.has('effects')" class="badge-spec">(modifié par spécialisation)</span>
                </div>
                <ul v-if="(finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.final?.effects ?? []).length" class="preview-effects-list">
                  <li v-for="(e, i) in finalSkillPreviews[(sk?.id ?? '').toString().trim()]?.final?.effects" :key="i">{{ e.type ?? '?' }}</li>
                </ul>
                </div>
              </div>
            </div>
            </div>

            <!-- SECTION 3 - Spécialisations -->
            <div class="section">
              <h3>3. Spécialisations</h3>
              <div class="spec-top-row form-grid">
          <label>Spec A bonus stat
            <select v-model="form.specA_bonus_stat">
              <option value="">—</option>
              <option value="maxHp">maxHp</option>
              <option value="attack">attack</option>
              <option value="defense">defense</option>
              <option value="speed">speed</option>
              <option value="mastery">mastery</option>
            </select>
          </label>
          <label>Spec B bonus stat
            <select v-model="form.specB_bonus_stat">
              <option value="">—</option>
              <option value="maxHp">maxHp</option>
              <option value="attack">attack</option>
              <option value="defense">defense</option>
              <option value="speed">speed</option>
              <option value="mastery">mastery</option>
            </select>
          </label>
        </div>
        <div class="form-row compact">
          <label>Desc. Spec A <input v-model="form.description.specA" type="text" placeholder="Optionnel" /></label>
          <label>Desc. Spec B <input v-model="form.description.specB" type="text" placeholder="Optionnel" /></label>
        </div>
        <div class="spec-grid">
        <div class="spec-modifier-block section-spec-a">
          <span class="section-badge section-badge-a">Spécialisation A</span>
          <h4>Spec A — Modification de compétence</h4>
          <div v-if="form.specA_skill_modifier.targetSkillId && !form.skills.some(s => (s.id ?? '').toString().trim() === form.specA_skill_modifier.targetSkillId.trim())" class="errors spec-validation-msg">⚠ Cette spécialisation cible une compétence inexistante.</div>
          <div v-if="(form.specA_skill_modifier.modify?.effects?.length || typeof form.specA_skill_modifier.modify?.cd_actions === 'number' || typeof form.specA_skill_modifier.modify?.cooldown === 'number' || (form.specA_skill_modifier.modify?.trigger ?? '').trim() || (form.specA_skill_modifier.modify?.passiveKind ?? '').trim()) && !form.specA_skill_modifier.targetSkillId?.trim()" class="errors spec-validation-msg">⚠ Spécialisation sans compétence ciblée : choisir une compétence ou vider les modifications.</div>
          <label>Compétence ciblée
            <select v-model="form.specA_skill_modifier.targetSkillId">
              <option value="">—</option>
              <option v-for="(sk, skI) in form.skills" :key="sk?.id ?? skI" :value="sk?.id ?? ''">
                {{ skillLabel(sk) }}
              </option>
            </select>
          </label>
          <div v-if="form.specA_skill_modifier.targetSkillId" class="spec-prefill-actions">
            <span v-if="specA_prefilledFromBase" class="badge-prefilled">Base copiée depuis la compétence</span>
            <button type="button" class="nx-btn nx-btn-small" @click="fillSpecModifyFromSkill('A')">Préremplir depuis la compétence</button>
          </div>
          <template v-if="form.specA_skill_modifier.targetSkillId">
            <div v-if="form.skills.find(s => s.id === form.specA_skill_modifier.targetSkillId)?.type === 'ACTIVE'">
              <label>Modifier cooldown (cd_actions)
                <input type="number" v-model.number="form.specA_skill_modifier.modify.cd_actions" />
              </label>
            </div>
            <div v-else>
              <label>Modifier passiveKind (permanent)
                <select v-model="form.specA_skill_modifier.modify.passiveKind">
                  <option value="">— (inchangé)</option>
                  <option v-for="k in passivePermanentKindOptions" :key="'A-pk-' + k" :value="k">{{ k }}</option>
                </select>
              </label>
              <label>Modifier trigger
                <select v-model="form.specA_skill_modifier.modify.trigger">
                  <option value=""></option>
                  <option v-for="t in passiveTriggerOptions" :key="t" :value="t">{{ t }}</option>
                </select>
              </label>
              <label>Modifier cooldown
                <input type="number" v-model.number="form.specA_skill_modifier.modify.cooldown" />
              </label>
            </div>
          </template>
          <h5>Effets de la spécialisation</h5>
          <button type="button" class="nx-btn" @click="addSpecEffect('A')">Ajouter un effet</button>
          <div v-for="(eff, idx) in form.specA_skill_modifier.modify.effects" :key="'A-' + idx" class="effect-block effect-block-spec">
            <div class="effect-header">
              <span>Effet {{ idx + 1 }}</span>
              <div class="effect-actions">
                <button type="button" class="nx-btn nx-btn-small" @click="moveSpecEffect('A', idx, 'up')" :disabled="idx === 0">Monter</button>
                <button type="button" class="nx-btn nx-btn-small" @click="moveSpecEffect('A', idx, 'down')" :disabled="idx >= (form.specA_skill_modifier.modify.effects?.length ?? 0) - 1">Descendre</button>
                <button type="button" class="nx-btn nx-btn-small" @click="duplicateSpecEffect('A', idx)">Dupliquer</button>
                <button type="button" class="nx-btn nx-btn-danger" @click="removeSpecEffect('A', idx)">Supprimer</button>
              </div>
            </div>
            <label>Type
              <select v-model="eff.type">
                <option v-for="t in effectTypes" :key="t" :value="t">{{ t }}</option>
              </select>
            </label>
            <template v-if="eff.type && schema.SUPPORTED_EFFECTS[eff.type]">
              <template v-for="key in effectFieldsForEffect(eff)" :key="key">
                <label v-if="isRequiredOneOfForEffect(eff, key)" class="field-required">
                  {{ key }} (un parmi requis){{ fieldHint(key, eff) }}
                  <input v-if="isNumberField(key)" v-model.number="eff[key]" type="number" step="any" :placeholder="fieldPlaceholder(key, eff)" />
                  <input v-else v-model="eff[key]" type="text" />
                </label>
                <label v-else>
                  {{ key }}{{ fieldHint(key, eff) }}
                  <select v-if="key === 'target'" v-model="eff.target">
                    <option value=""></option>
                    <option v-for="t in schema.VALID_TARGETS" :key="t" :value="t">{{ t }}</option>
                  </select>
                  <select v-else-if="key === 'stat'" v-model="eff.stat">
                    <option value=""></option>
                    <option v-for="s in stealableStats" :key="s" :value="s">{{ s }}</option>
                  </select>
                  <select v-else-if="key === 'buffType'" v-model="eff.buffType">
                    <option value=""></option>
                    <option v-for="b in buffOnlyTypes" :key="b" :value="b">{{ b }}</option>
                  </select>
                  <select v-else-if="key === 'debuffType'" v-model="eff.debuffType">
                    <option value=""></option>
                    <option v-for="d in schema.DEBUFF_TYPES" :key="d" :value="d">{{ d }}</option>
                  </select>
                  <select v-else-if="key === 'scaleMetric'" v-model="eff.scaleMetric">
                    <option value="">removedCount (défaut)</option>
                    <option value="removedCount">removedCount — CLEANSE / STRIP</option>
                    <option value="effectiveDamage">effectiveDamage — dégâts effet réf.</option>
                  </select>
                  <input v-else-if="isNumberField(key)" v-model.number="eff[key]" type="number" step="any" :placeholder="fieldPlaceholder(key, eff)" />
                  <input v-else v-model="eff[key]" type="text" />
                </label>
              </template>
              <p v-if="eff.type === 'APPLY_BUFF' && buffFixedLabel(eff.buffType)" class="effect-fixed-value-msg">{{ buffFixedLabel(eff.buffType) }}</p>
              <p v-if="eff.type === 'APPLY_DEBUFF' && debuffFixedLabel(eff.debuffType)" class="effect-fixed-value-msg">{{ debuffFixedLabel(eff.debuffType) }}</p>
              <p v-if="['ATB_UP', 'REDUCE_ATB', 'HEAL', 'DAMAGE'].includes(String(eff.type ?? '').toUpperCase())" class="effect-fixed-value-msg">
                Chaînage : indices = ordre dans <strong>cette liste spé</strong>. Même schéma que la compétence de base (CLEANSE → soin/buffs ATB ; STRIP → dégâts/REDUCE_ATB/DOT…).
              </p>
              <p
                v-if="String(eff.type ?? '').toUpperCase() === 'APPLY_BUFF' && ['SHIELD', 'REGEN', 'DOT', 'ANTI_BUFF'].includes(String(eff.buffType ?? '').toUpperCase())"
                class="effect-fixed-value-msg"
              >
                Buffs débuffs chaînés : indices = cette liste spé.
              </p>
            </template>
          </div>
        </div>
        <div class="spec-modifier-block section-spec-b">
          <span class="section-badge section-badge-b">Spécialisation B</span>
          <h4>Spec B — Modification de compétence</h4>
          <div v-if="form.specB_skill_modifier.targetSkillId && !form.skills.some(s => (s.id ?? '').toString().trim() === form.specB_skill_modifier.targetSkillId.trim())" class="errors spec-validation-msg">⚠ Cette spécialisation cible une compétence inexistante.</div>
          <div v-if="(form.specB_skill_modifier.modify?.effects?.length || typeof form.specB_skill_modifier.modify?.cd_actions === 'number' || typeof form.specB_skill_modifier.modify?.cooldown === 'number' || (form.specB_skill_modifier.modify?.trigger ?? '').trim() || (form.specB_skill_modifier.modify?.passiveKind ?? '').trim()) && !form.specB_skill_modifier.targetSkillId?.trim()" class="errors spec-validation-msg">⚠ Spécialisation sans compétence ciblée : choisir une compétence ou vider les modifications.</div>
          <label>Compétence ciblée
            <select v-model="form.specB_skill_modifier.targetSkillId">
              <option value="">—</option>
              <option v-for="(sk, skI) in form.skills" :key="sk?.id ?? skI" :value="sk?.id ?? ''">
                {{ skillLabel(sk) }}
              </option>
            </select>
          </label>
          <div v-if="form.specB_skill_modifier.targetSkillId" class="spec-prefill-actions">
            <span v-if="specB_prefilledFromBase" class="badge-prefilled">Base copiée depuis la compétence</span>
            <button type="button" class="nx-btn nx-btn-small" @click="fillSpecModifyFromSkill('B')">Préremplir depuis la compétence</button>
          </div>
          <template v-if="form.specB_skill_modifier.targetSkillId">
            <div v-if="form.skills.find(s => s.id === form.specB_skill_modifier.targetSkillId)?.type === 'ACTIVE'">
              <label>Modifier cooldown (cd_actions)
                <input type="number" v-model.number="form.specB_skill_modifier.modify.cd_actions" />
              </label>
            </div>
            <div v-else>
              <label>Modifier passiveKind (permanent)
                <select v-model="form.specB_skill_modifier.modify.passiveKind">
                  <option value="">— (inchangé)</option>
                  <option v-for="k in passivePermanentKindOptions" :key="'B-pk-' + k" :value="k">{{ k }}</option>
                </select>
              </label>
              <label>Modifier trigger
                <select v-model="form.specB_skill_modifier.modify.trigger">
                  <option value=""></option>
                  <option v-for="t in passiveTriggerOptions" :key="t" :value="t">{{ t }}</option>
                </select>
              </label>
              <label>Modifier cooldown
                <input type="number" v-model.number="form.specB_skill_modifier.modify.cooldown" />
              </label>
            </div>
          </template>
          <h5>Effets de la spécialisation</h5>
          <button type="button" class="nx-btn" @click="addSpecEffect('B')">Ajouter un effet</button>
          <div v-for="(eff, idx) in form.specB_skill_modifier.modify.effects" :key="'B-' + idx" class="effect-block effect-block-spec">
            <div class="effect-header">
              <span>Effet {{ idx + 1 }}</span>
              <div class="effect-actions">
                <button type="button" class="nx-btn nx-btn-small" @click="moveSpecEffect('B', idx, 'up')" :disabled="idx === 0">Monter</button>
                <button type="button" class="nx-btn nx-btn-small" @click="moveSpecEffect('B', idx, 'down')" :disabled="idx >= (form.specB_skill_modifier.modify.effects?.length ?? 0) - 1">Descendre</button>
                <button type="button" class="nx-btn nx-btn-small" @click="duplicateSpecEffect('B', idx)">Dupliquer</button>
                <button type="button" class="nx-btn nx-btn-danger" @click="removeSpecEffect('B', idx)">Supprimer</button>
              </div>
            </div>
            <label>Type
              <select v-model="eff.type">
                <option v-for="t in effectTypes" :key="t" :value="t">{{ t }}</option>
              </select>
            </label>
            <template v-if="eff.type && schema.SUPPORTED_EFFECTS[eff.type]">
              <template v-for="key in effectFieldsForEffect(eff)" :key="key">
                <label v-if="isRequiredOneOfForEffect(eff, key)" class="field-required">
                  {{ key }} (un parmi requis){{ fieldHint(key, eff) }}
                  <input v-if="isNumberField(key)" v-model.number="eff[key]" type="number" step="any" :placeholder="fieldPlaceholder(key, eff)" />
                  <input v-else v-model="eff[key]" type="text" />
                </label>
                <label v-else>
                  {{ key }}{{ fieldHint(key, eff) }}
                  <select v-if="key === 'target'" v-model="eff.target">
                    <option value=""></option>
                    <option v-for="t in schema.VALID_TARGETS" :key="t" :value="t">{{ t }}</option>
                  </select>
                  <select v-else-if="key === 'stat'" v-model="eff.stat">
                    <option value=""></option>
                    <option v-for="s in stealableStats" :key="s" :value="s">{{ s }}</option>
                  </select>
                  <select v-else-if="key === 'buffType'" v-model="eff.buffType">
                    <option value=""></option>
                    <option v-for="b in buffOnlyTypes" :key="b" :value="b">{{ b }}</option>
                  </select>
                  <select v-else-if="key === 'debuffType'" v-model="eff.debuffType">
                    <option value=""></option>
                    <option v-for="d in schema.DEBUFF_TYPES" :key="d" :value="d">{{ d }}</option>
                  </select>
                  <select v-else-if="key === 'scaleMetric'" v-model="eff.scaleMetric">
                    <option value="">removedCount (défaut)</option>
                    <option value="removedCount">removedCount — CLEANSE / STRIP</option>
                    <option value="effectiveDamage">effectiveDamage — dégâts effet réf.</option>
                  </select>
                  <input v-else-if="isNumberField(key)" v-model.number="eff[key]" type="number" step="any" :placeholder="fieldPlaceholder(key, eff)" />
                  <input v-else v-model="eff[key]" type="text" />
                </label>
              </template>
              <p v-if="eff.type === 'APPLY_BUFF' && buffFixedLabel(eff.buffType)" class="effect-fixed-value-msg">{{ buffFixedLabel(eff.buffType) }}</p>
              <p v-if="eff.type === 'APPLY_DEBUFF' && debuffFixedLabel(eff.debuffType)" class="effect-fixed-value-msg">{{ debuffFixedLabel(eff.debuffType) }}</p>
              <p v-if="['ATB_UP', 'REDUCE_ATB', 'HEAL', 'DAMAGE'].includes(String(eff.type ?? '').toUpperCase())" class="effect-fixed-value-msg">
                Chaînage : indices = ordre dans <strong>cette liste spé</strong>.
              </p>
              <p
                v-if="String(eff.type ?? '').toUpperCase() === 'APPLY_BUFF' && ['SHIELD', 'REGEN', 'DOT', 'ANTI_BUFF'].includes(String(eff.buffType ?? '').toUpperCase())"
                class="effect-fixed-value-msg"
              >
                Buffs débuffs chaînés : indices = cette liste spé.
              </p>
            </template>
          </div>
        </div>
            </div>
            </div>

            <!-- SECTION 4 - Validation & Sauvegarde -->
            <div class="section">
              <h3>4. Validation & Sauvegarde</h3>
        <div v-if="hasInvalidSpecializations" class="errors">
          <div class="error-item">⚠ Spécialisation invalide : cible inexistante ou modifications sans compétence ciblée.</div>
        </div>
        <div v-if="validationErrors.length" class="errors">
          <div v-for="(e, i) in validationErrors" :key="i" class="error-item">{{ e }}</div>
        </div>
        <div v-if="createMessage" class="message" :class="createSuccess ? 'success' : 'error'">{{ createMessage }}</div>
        <div class="actions">
          <button type="button" class="nx-btn" @click="validate" :disabled="loading">Valider</button>
          <template v-if="form.id">
            <button type="button" class="nx-btn" :disabled="!isValid || hasInvalidSkills || hasInvalidSpecializations || hasNoyauRequiredInvalid || loading" @click="updateUnit">Mettre à jour</button>
            <button type="button" class="nx-btn nx-btn-danger" :disabled="loading" @click="deleteUnit">Supprimer</button>
          </template>
          <button v-else type="button" class="nx-btn" :disabled="!isValid || hasInvalidSkills || hasInvalidSpecializations || hasNoyauRequiredInvalid || loading" @click="createUnit">Créer unité</button>
          <button type="button" class="nx-btn" @click="simulate" :disabled="loading">Simulation rapide</button>
        </div>

        <!-- Preview JSON -->
        <details class="preview-details">
          <summary>Preview JSON</summary>
          <pre>{{ previewJson }}</pre>
        </details>

        <!-- Debug: JSON final (skill_data après spé) -->
        <div class="debug-panel">
          <button type="button" class="nx-btn nx-btn-secondary" @click="showFinalJsonPanel = !showFinalJsonPanel">
            {{ showFinalJsonPanel ? 'Masquer' : 'Afficher' }} JSON final
          </button>
        <details v-if="showFinalJsonPanel" open class="preview-details preview-final-details">
            <summary>skill_data après application des spécialisations</summary>
            <pre class="preview-final-json">{{ finalSkillDataJson }}</pre>
          </details>
        </div>
            </div>

            <!-- Simulation result -->
            <div v-if="simulationResult" class="simulation-result">
              <h4>Résultat simulation</h4>
              <pre>{{ simulationResult }}</pre>
            </div>
          </div>
        </div>
      </div>
      <transition name="floating-save">
        <div v-if="showFloatingActionBar" class="floating-save-bar">
          <button
            type="button"
            class="nx-btn floating-save-btn"
            :disabled="loading || hasInvalidSkills || hasInvalidSpecializations || hasNoyauRequiredInvalid"
            @click="validateAndSave"
          >
            Valider + Sauvegarder
          </button>
        </div>
      </transition>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import api from '../api';
import { normalizeSkillDescription } from '../utils/skillDescription';
import { getUnitImageUrl } from '../utils/unitImage';
import { toTraitFr, toStatFr } from '../utils/i18nFr';

/** Doit rester aligné avec `SUPPORTED_TRIGGERS` (backend) : fusionné au schéma API pour que l’UI affiche tout même si le serveur renvoie encore une liste ancienne. */
const CANONICAL_PASSIVE_TRIGGERS: string[] = [
  'ON_ATTACK',
  'ON_HIT',
  'ON_DEATH',
  'ON_KILL',
  'ON_ACTION_START',
  'ON_ACTION_END',
  'ON_RECEIVE_DAMAGE',
  'ON_DEAL_DAMAGE',
  'ON_COMBAT_START',
  'ON_ENEMY_KO',
  'ON_ALLY_KO',
  'ON_ALLY_RECEIVE_DAMAGE',
  'ON_ENEMY_TURN_START',
  'ALWAYS'
];

const schema = ref<Record<string, any> | null>(null);
const loading = ref(false);
const loadingUnits = ref(false);
const validationErrors = ref<string[]>([]);
const isValid = ref(false);
const createMessage = ref('');
const createSuccess = ref(false);
const simulationResult = ref('');
const existingUnits = ref<Array<{ id: number; code: string; name: string; rarity: string; skill_data?: any; [k: string]: any }>>([]);
const unitImageAssets = ref<Array<{ filename: string; path: string }>>([]);
const unitImageSearch = ref('');
const unitSearch = ref('');
const unitFilterRarity = ref('');
const unitFilterElement = ref('');
const unitFilterRole = ref('');
const showFinalJsonPanel = ref(false);
const specA_prefilledFromBase = ref(false);
const specB_prefilledFromBase = ref(false);
const isLoadingUnitIntoForm = ref(false);
const showFloatingActionBar = ref(false);

type ActiveSkill = { id: string; type: 'ACTIVE'; cd_actions: number; description?: string; effects: Record<string, any>[] };
type PassiveSkill = {
  id: string;
  type: 'PASSIVE';
  trigger: string;
  /** Texte affiché (bestiaire / collection) quand plusieurs compétences — comme pour l’ACTIVE. */
  description?: string;
  /** Passif permanent : immunisation (débuffs, STRIP, −ATB, max CD, vol stat). Pas de trigger ni effets requis. */
  passiveKind?: string;
  cooldown?: number;
  effects: Record<string, any>[];
};
type FormSkill = ActiveSkill | PassiveSkill;

type SpecSkillModifier = {
  targetSkillId: string;
  modify: {
    effects?: Record<string, any>[];
    cd_actions?: number;
    trigger?: string;
    cooldown?: number;
    passiveKind?: string;
  };
};

type NoyauStat = 'maxHp' | 'attack' | 'defense' | 'speed' | 'mastery';

function deepClone<T>(x: T): T {
  if (x === undefined || x === null) return x;
  return JSON.parse(JSON.stringify(x)) as T;
}

/** Préremplit spec.modify depuis la compétence ciblée (clone, ne modifie pas le skill original). */
function fillSpecModifyFromSkill(spec: 'A' | 'B') {
  const mod = spec === 'A' ? form.value.specA_skill_modifier : form.value.specB_skill_modifier;
  const targetId = (mod?.targetSkillId ?? '').toString().trim();
  if (!targetId) {
    if (spec === 'A') specA_prefilledFromBase.value = false;
    else specB_prefilledFromBase.value = false;
    return;
  }
  const skills = (form.value.skills || []).filter((s): s is NonNullable<typeof s> => s != null);
  const skill = skills.find((s) => (s?.id ?? '').toString().trim() === targetId);
  if (!skill) return;
  const modify = {
    cooldown: skill.type === 'PASSIVE' ? ((skill as { cooldown?: number }).cooldown ?? undefined) : undefined,
    trigger: skill.type === 'PASSIVE' ? ((skill as { trigger?: string }).trigger ?? undefined) : undefined,
    passiveKind: skill.type === 'PASSIVE' ? ((skill as { passiveKind?: string }).passiveKind ?? undefined) : undefined,
    cd_actions: skill.type === 'ACTIVE' ? ((skill as { cd_actions?: number }).cd_actions ?? undefined) : undefined,
    effects: deepClone(skill.effects) ?? []
  };
  if (spec === 'A') {
    form.value.specA_skill_modifier = { ...form.value.specA_skill_modifier, modify: { ...modify } };
    specA_prefilledFromBase.value = true;
  } else {
    form.value.specB_skill_modifier = { ...form.value.specB_skill_modifier, modify: { ...modify } };
    specB_prefilledFromBase.value = true;
  }
}

/** Kind permanent reconnu (schéma API ou repli). */
function isPermanentPassiveKindString(pk: string): boolean {
  const u = String(pk ?? '').trim().toUpperCase();
  if (!u) return false;
  const fromSchema = schema.value?.PASSIVE_KINDS_PERMANENT as string[] | undefined;
  const list = fromSchema && fromSchema.length > 0 ? fromSchema.map((x) => String(x).toUpperCase()) : ['DEBUFF_IMMUNITY'];
  return list.includes(u);
}

function isPermanentPassiveSkill(s: FormSkill | Record<string, any> | null | undefined): boolean {
  if (!s || s.type !== 'PASSIVE') return false;
  return isPermanentPassiveKindString(String((s as PassiveSkill).passiveKind ?? ''));
}

/** Applique un modificateur de spé sur une copie de skill. Ne modifie jamais l'original. */
function applySpecModifierFrontend(
  skill: Record<string, any>,
  specModifier: SpecSkillModifier | undefined | null
): Record<string, any> | null {
  if (!specModifier || !(specModifier.targetSkillId ?? '').toString().trim()) return null;
  const targetId = (specModifier.targetSkillId ?? '').toString().trim();
  if ((skill.id ?? '').toString().trim() !== targetId) return null;
  const modify = specModifier.modify && typeof specModifier.modify === 'object' ? specModifier.modify : null;
  if (!modify) return null;
  const clone = JSON.parse(JSON.stringify(skill));
  if (typeof modify.cd_actions === 'number' && clone.type === 'ACTIVE') clone.cd_actions = modify.cd_actions;
  if (typeof modify.trigger === 'string') clone.trigger = modify.trigger.trim();
  if (typeof modify.cooldown === 'number') clone.cooldown = modify.cooldown;
  if (typeof modify.passiveKind === 'string') {
    const pk = modify.passiveKind.trim();
    if (pk) (clone as { passiveKind?: string }).passiveKind = pk;
    else delete (clone as { passiveKind?: string }).passiveKind;
  }
  if (Array.isArray(modify.effects)) clone.effects = modify.effects;
  if (clone.type === 'PASSIVE' && isPermanentPassiveKindString(String((clone as { passiveKind?: string }).passiveKind ?? ''))) {
    delete clone.trigger;
    clone.effects = [];
  }
  return clone;
}

function generateSkillId(): string {
  return `skill_${Math.random().toString(36).slice(2, 10)}`;
}

/** Bascule passif : déclenché vs passif permanent (schéma). */
function onPassiveModeChange(sk: FormSkill, mode: string) {
  if (sk.type !== 'PASSIVE') return;
  const p = sk as PassiveSkill;
  if (mode === 'immunity') {
    const fromSchema = schema.value?.PASSIVE_KINDS_PERMANENT as string[] | undefined;
    p.passiveKind = (fromSchema && fromSchema.length > 0 ? fromSchema[0] : null) || 'DEBUFF_IMMUNITY';
    p.trigger = '';
    p.effects = [];
  } else {
    delete (p as { passiveKind?: string }).passiveKind;
    if (p.trigger === undefined) p.trigger = '';
    if (!Array.isArray(p.effects)) p.effects = [];
  }
}

/** Quand on change ACTIVE ↔ PASSIVE sur une ligne compétence. */
function onFormSkillTypeChange(sk: FormSkill) {
  if (sk.type === 'PASSIVE') {
    const p = sk as PassiveSkill;
    if (p.trigger === undefined) p.trigger = '';
    if (p.cooldown === undefined) p.cooldown = 0;
    delete (p as { cd_actions?: number }).cd_actions;
    if (p.description === undefined) p.description = '';
    if (!Array.isArray(p.effects)) p.effects = [];
  } else {
    const a = sk as ActiveSkill;
    if (a.cd_actions === undefined) a.cd_actions = 3;
    delete (a as { trigger?: string }).trigger;
    delete (a as { cooldown?: number }).cooldown;
    delete (a as { passiveKind?: string }).passiveKind;
    if (!Array.isArray(a.effects)) a.effects = [];
    if (a.description === undefined) a.description = '';
  }
}

function getDefaultForm() {
  return {
    id: null as number | null,
    name: '',
    code: '',
    rarity: 'common',
    element: 'fire',
    role: 'tank',
    attack_type: 'melee',
    archetype: 'CAC_TANK',
    base_hp: 1000,
    base_attack: 80,
    base_defense: 90,
    base_speed: 90,
    mastery: 0,
    has_noyau: false,
    noyau_stat: 'attack' as NoyauStat,
    noyau_percent: 10,
    traits: [] as string[],
    description: { skill: '', specA: '', specB: '' },
    skills: [{ id: generateSkillId(), type: 'ACTIVE', cd_actions: 3, description: '', effects: [] }] as FormSkill[],
    specA_bonus_stat: '',
    specB_bonus_stat: '',
    specA_skill_modifier: { targetSkillId: '', modify: { effects: [] as Record<string, any>[] } } as SpecSkillModifier,
    specB_skill_modifier: { targetSkillId: '', modify: { effects: [] as Record<string, any>[] } } as SpecSkillModifier,
    image_url: null as string | null,
    /** Boss : réservé campagne / donjons — pas sanctuaire, bestiaire, tirages. */
    is_boss: false
  };
}

const form = ref(getDefaultForm());
const currentUnitImageUrl = computed(() => getUnitImageUrl({ name: form.value.name, image_url: form.value.image_url }));
const noyauStatOptions: Array<{ value: NoyauStat; label: string }> = [
  { value: 'maxHp', label: toStatFr('maxHp') },
  { value: 'attack', label: toStatFr('attack') },
  { value: 'defense', label: toStatFr('defense') },
  { value: 'speed', label: toStatFr('speed') },
  { value: 'mastery', label: toStatFr('mastery') }
];
const generatedNoyauDescription = computed(() => {
  const r = String(form.value.rarity ?? '').toLowerCase();
  const hasNoyauByRarity = ['epic', 'legendary', 'mythic'].includes(r);
  if (!form.value.has_noyau && !hasNoyauByRarity) return '';
  const label = noyauStatOptions.find((opt) => opt.value === form.value.noyau_stat)?.label ?? toStatFr(form.value.noyau_stat);
  const percent = Math.max(0, Number(form.value.noyau_percent) || 0);
  return `+${percent}% ${label}`;
});

/** Afficher la section noyau uniquement pour epic, legendary, mythic. */
const showNoyauSection = computed(() =>
  ['epic', 'legendary', 'mythic'].includes(String(form.value.rarity ?? '').toLowerCase())
);

/** Invalide si epic/legendary/mythic mais noyau incomplet. */
const hasNoyauRequiredInvalid = computed(() => {
  if (!showNoyauSection.value) return false;
  const stat = (form.value.noyau_stat ?? '').toString().trim();
  const percent = Number(form.value.noyau_percent);
  return !stat || !(percent > 0);
});

/** Stats niveau 1 par rôle + rareté (tableau référence Nexus Core). Clé rôle = valeur formulaire (ranged = DPS). */
type BaseStatRow = { hp: number; atk: number; def: number; speed: number; mastery: number };
const BASE_STATS_LEVEL1: Record<string, Record<string, BaseStatRow>> = {
  support: {
    common: { hp: 900, atk: 100, def: 70, speed: 100, mastery: 0 },
    uncommon: { hp: 950, atk: 114, def: 75, speed: 103, mastery: 0 },
    rare: { hp: 1000, atk: 128, def: 80, speed: 106, mastery: 20 },
    epic: { hp: 1050, atk: 142, def: 90, speed: 109, mastery: 50 },
    legendary: { hp: 1150, atk: 156, def: 95, speed: 112, mastery: 100 },
    mythic: { hp: 1250, atk: 170, def: 100, speed: 115, mastery: 150 }
  },
  tank: {
    common: { hp: 1000, atk: 80, def: 90, speed: 90, mastery: 0 },
    uncommon: { hp: 1100, atk: 94, def: 98, speed: 92, mastery: 0 },
    rare: { hp: 1200, atk: 108, def: 106, speed: 94, mastery: 20 },
    epic: { hp: 1300, atk: 122, def: 114, speed: 96, mastery: 50 },
    legendary: { hp: 1400, atk: 136, def: 122, speed: 98, mastery: 100 },
    mythic: { hp: 1500, atk: 150, def: 130, speed: 100, mastery: 150 }
  },
  /** Rôle « ranged » dans l’admin = DPS du tableau. */
  ranged: {
    common: { hp: 750, atk: 110, def: 60, speed: 100, mastery: 0 },
    uncommon: { hp: 800, atk: 125, def: 66, speed: 102, mastery: 0 },
    rare: { hp: 850, atk: 140, def: 72, speed: 104, mastery: 20 },
    epic: { hp: 900, atk: 155, def: 78, speed: 106, mastery: 50 },
    legendary: { hp: 1000, atk: 170, def: 84, speed: 108, mastery: 100 },
    mythic: { hp: 1100, atk: 190, def: 90, speed: 110, mastery: 150 }
  },
  assassin: {
    common: { hp: 900, atk: 120, def: 70, speed: 95, mastery: 0 },
    uncommon: { hp: 950, atk: 136, def: 76, speed: 97, mastery: 0 },
    rare: { hp: 1000, atk: 152, def: 82, speed: 99, mastery: 20 },
    epic: { hp: 1050, atk: 168, def: 88, speed: 101, mastery: 50 },
    legendary: { hp: 1150, atk: 184, def: 94, speed: 103, mastery: 100 },
    mythic: { hp: 1250, atk: 200, def: 100, speed: 105, mastery: 150 }
  }
};

function normalizeRoleKeyForBaseStats(role: string): keyof typeof BASE_STATS_LEVEL1 | null {
  const r = String(role ?? '').toLowerCase().trim();
  if (r === 'frontline') return 'tank';
  if (r === 'backline') return 'support';
  if (r in BASE_STATS_LEVEL1) return r as keyof typeof BASE_STATS_LEVEL1;
  return null;
}

/** Préremplit HP / ATK / DEF / vitesse / maîtrise selon rareté + rôle (hors chargement d’unité existante). */
function applyBaseStatsFromRoleRarity() {
  if (isLoadingUnitIntoForm.value) return;
  const roleKey = normalizeRoleKeyForBaseStats(form.value.role);
  const rarityKey = String(form.value.rarity ?? '').toLowerCase().trim();
  if (!roleKey || !rarityKey) return;
  const row = BASE_STATS_LEVEL1[roleKey]?.[rarityKey];
  if (!row) return;
  form.value.base_hp = row.hp;
  form.value.base_attack = row.atk;
  form.value.base_defense = row.def;
  form.value.base_speed = row.speed;
  form.value.mastery = row.mastery;
}

/** Auto-remplit attack_type et archetype selon le rôle. */
function onRoleChange() {
  if (isLoadingUnitIntoForm.value) return;
  const role = String(form.value.role ?? '').toLowerCase();
  const map: Record<string, { attack_type: string; archetype: string }> = {
    tank: { attack_type: 'melee', archetype: 'CAC_TANK' },
    assassin: { attack_type: 'melee', archetype: 'CAC_DPS' },
    support: { attack_type: 'ranged', archetype: 'DISTANCE' },
    ranged: { attack_type: 'ranged', archetype: 'DISTANCE' }
  };
  const mapped = map[role];
  if (mapped) {
    form.value.attack_type = mapped.attack_type;
    form.value.archetype = mapped.archetype;
  }
}

function onRoleSelectChange() {
  onRoleChange();
  applyBaseStatsFromRoleRarity();
}

function onRarityChangeForBaseStats() {
  applyBaseStatsFromRoleRarity();
}

const filteredUnitImageAssets = computed(() => {
  const q = unitImageSearch.value.trim().toLowerCase();
  if (!q) return unitImageAssets.value;
  return unitImageAssets.value.filter((asset) => asset.filename.toLowerCase().includes(q));
});

function clearSelectedImage() {
  form.value.image_url = null;
}

function selectFirstMatchingImage() {
  const first = filteredUnitImageAssets.value[0];
  if (first) {
    form.value.image_url = first.path;
  }
}

watch(
  () => form.value.specA_skill_modifier?.targetSkillId,
  () => {
    if (isLoadingUnitIntoForm.value) return;
    const id = (form.value.specA_skill_modifier?.targetSkillId ?? '').toString().trim();
    if (!id) {
      specA_prefilledFromBase.value = false;
      return;
    }
    fillSpecModifyFromSkill('A');
  }
);
watch(
  () => form.value.specB_skill_modifier?.targetSkillId,
  () => {
    if (isLoadingUnitIntoForm.value) return;
    const id = (form.value.specB_skill_modifier?.targetSkillId ?? '').toString().trim();
    if (!id) {
      specB_prefilledFromBase.value = false;
      return;
    }
    fillSpecModifyFromSkill('B');
  }
);

/** Types d'effets (schéma API ; liste de repli inclut CLEANSE). */
const effectTypes = computed(() => {
  const fromSchema = schema.value ? Object.keys(schema.value.SUPPORTED_EFFECTS || {}) : [];
  if (fromSchema.length === 0) {
    return [
      'DAMAGE', 'HEAL', 'APPLY_BUFF', 'APPLY_DEBUFF', 'STRIP', 'CLEANSE', 'REDUCE_ATB', 'ATB_UP',
      'RESET_SKILL_COOLDOWN', 'SET_SKILL_COOLDOWN_MAX', 'CD_UP', 'CD_DOWN', 'STEAL_STAT', 'RESURRECT'
    ];
  }
  if (!fromSchema.includes('CLEANSE')) return [...fromSchema, 'CLEANSE'].sort();
  return fromSchema;
});

/** Options pour le trigger des passifs : union schéma API + liste canonique (évite liste périmée si le backend n’a pas été redémarré). */
const passiveTriggerOptions = computed(() => {
  const fromSchema = schema.value?.SUPPORTED_TRIGGERS as string[] | undefined;
  const fromApi = Array.isArray(fromSchema)
    ? fromSchema.map((t) => String(t ?? '').trim()).filter(Boolean)
    : [];
  const merged = new Set<string>([...CANONICAL_PASSIVE_TRIGGERS, ...fromApi]);
  const rank = new Map(CANONICAL_PASSIVE_TRIGGERS.map((t, i) => [t, i]));
  return [...merged].sort((a, b) => {
    const ra = rank.has(a) ? (rank.get(a) as number) : 1000;
    const rb = rank.has(b) ? (rank.get(b) as number) : 1000;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b, 'en');
  });
});

/** Passifs permanents documentés (schéma API). */
const passivePermanentKindOptions = computed(() => {
  const fromSchema = schema.value?.PASSIVE_KINDS_PERMANENT as string[] | undefined;
  if (fromSchema && fromSchema.length > 0) return fromSchema;
  return ['DEBUFF_IMMUNITY'] as string[];
});

/** Types de buff uniquement (exclut les debuffs) pour le select buffType quand type = APPLY_BUFF. */
const buffOnlyTypes = computed(() => {
  const buf = schema.value?.BUFF_TYPES as string[] | undefined;
  const deb = schema.value?.DEBUFF_TYPES as string[] | undefined;
  if (!buf || !Array.isArray(buf)) return [];
  if (!deb || !Array.isArray(deb)) return buf;
  const debSet = new Set(deb.map((d: string) => String(d).toUpperCase()));
  return buf.filter((b: string) => !debSet.has(String(b).toUpperCase()));
});

const stealableStats = computed(() => {
  const stats = schema.value?.STEALABLE_STATS as string[] | undefined;
  return Array.isArray(stats) && stats.length > 0 ? stats : ['attack', 'defense', 'speed', 'mastery'];
});

const filteredExistingUnits = computed(() => {
  let list = existingUnits.value;
  const rarity = (unitFilterRarity.value ?? '').trim();
  const element = (unitFilterElement.value ?? '').trim();
  const role = (unitFilterRole.value ?? '').trim();
  if (rarity) list = list.filter((u) => String(u.rarity ?? '').toLowerCase() === rarity.toLowerCase());
  if (element) list = list.filter((u) => String(u.element ?? '').toLowerCase() === element.toLowerCase());
  if (role) {
    list = list.filter((u) => {
      const uRole = String(u.role ?? '').toLowerCase();
      const r = role.toLowerCase();
      if (uRole === r) return true;
      if (r === 'tank' && (uRole === 'frontline' || uRole === 'tank')) return true;
      if (r === 'support' && (uRole === 'backline' || uRole === 'support')) return true;
      return false;
    });
  }
  const q = (unitSearch.value || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter((u) => (u.name || '').toLowerCase().includes(q) || (u.code || '').toLowerCase().includes(q));
});

function skillLabel(sk: FormSkill): string {
  if (!sk) return '—';
  const id = (sk.id ?? '').toString().trim() || '?';
  const typeStr = sk.type === 'PASSIVE' ? 'PASSIVE' : 'ACTIVE';
  const n = Array.isArray(sk.effects) ? sk.effects.length : 0;
  const eff = n === 1 ? 'effet' : 'effets';
  if (sk.type === 'PASSIVE') {
    if (isPermanentPassiveSkill(sk)) {
      const pk = (sk as PassiveSkill).passiveKind ?? '?';
      return `${id} — ${typeStr} — ${pk} (permanent) — ${n} ${eff}`;
    }
    const trigger = (sk as PassiveSkill).trigger ?? '—';
    const cd = (sk as PassiveSkill).cooldown ?? 0;
    return `${id} — ${typeStr} — ${trigger} — CD ${cd} — ${n} ${eff}`;
  }
  const cd = (sk as ActiveSkill).cd_actions ?? 0;
  return `${id} — ${typeStr} — CD ${cd} — ${n} ${eff}`;
}

/** Preview finale par skill (base → +specA → +specB), avec clés modifiées. */
const finalSkillPreviews = computed(() => {
  const skills = form.value.skills || [];
  const specA = form.value.specA_skill_modifier as SpecSkillModifier;
  const specB = form.value.specB_skill_modifier as SpecSkillModifier;
  const out: Record<string, { final: Record<string, any>; modifiedKeys: Set<string> }> = {};
  for (const sk of skills) {
    const id = (sk.id ?? '').toString().trim();
    if (!id) continue;
    let base = JSON.parse(JSON.stringify(sk));
    const modifiedKeys = new Set<string>();
    const applyAndDiff = (spec: SpecSkillModifier | undefined | null) => {
      const next = applySpecModifierFrontend(base, spec);
      if (next) {
        if (Array.isArray(next.effects) && Array.isArray(base.effects) && next.effects !== base.effects) modifiedKeys.add('effects');
        if (next.cd_actions !== base.cd_actions) modifiedKeys.add('cd_actions');
        if (next.trigger !== base.trigger) modifiedKeys.add('trigger');
        if (next.cooldown !== base.cooldown) modifiedKeys.add('cooldown');
        if ((next as { passiveKind?: string }).passiveKind !== (base as { passiveKind?: string }).passiveKind) {
          modifiedKeys.add('passiveKind');
        }
        base = next;
      }
    };
    applyAndDiff(specA);
    applyAndDiff(specB);
    out[id] = { final: base, modifiedKeys };
  }
  return out;
});

const skillIdsTargetedBySpecs = computed(() => {
  const ids = new Set<string>();
  const a = (form.value.specA_skill_modifier as SpecSkillModifier)?.targetSkillId?.trim();
  const b = (form.value.specB_skill_modifier as SpecSkillModifier)?.targetSkillId?.trim();
  if (a) ids.add(a);
  if (b) ids.add(b);
  return ids;
});

const hasInvalidSpecializations = computed(() => {
  const skills = form.value.skills || [];
  const skillIds = new Set((skills || []).map((s) => (s.id ?? '').toString().trim()).filter(Boolean));
  const specA = form.value.specA_skill_modifier as SpecSkillModifier;
  const specB = form.value.specB_skill_modifier as SpecSkillModifier;
  const hasContent = (spec: SpecSkillModifier) => {
    if (!spec?.modify) return false;
    const m = spec.modify;
    return (
      (Array.isArray(m.effects) && m.effects.length > 0) ||
      typeof m.cd_actions === 'number' ||
      typeof m.cooldown === 'number' ||
      (typeof m.trigger === 'string' && (m.trigger ?? '').trim() !== '') ||
      (typeof m.passiveKind === 'string' && (m.passiveKind ?? '').trim() !== '')
    );
  };
  if (hasContent(specA) && !specA.targetSkillId?.trim()) return true;
  if (hasContent(specB) && !specB.targetSkillId?.trim()) return true;
  if (specA.targetSkillId?.trim() && !skillIds.has(specA.targetSkillId.trim())) return true;
  if (specB.targetSkillId?.trim() && !skillIds.has(specB.targetSkillId.trim())) return true;
  return false;
});

const hasInvalidSkills = computed(() => {
  const list = form.value.skills || [];
  if (list.length === 0) return true;
  const skillsInvalid = list.some((s) => {
    if (s.type === 'ACTIVE') return !Array.isArray(s.effects);
    if (!Array.isArray(s.effects)) return true;
    if (isPermanentPassiveSkill(s)) return false;
    return !(s as PassiveSkill).trigger?.trim() || s.effects.length === 0;
  });

  const hasSpecContent = (spec: SpecSkillModifier | undefined | null) => {
    if (!spec || !spec.modify) return false;
    const m = spec.modify;
    return !!(
      (Array.isArray(m.effects) && m.effects.length > 0) ||
      typeof m.cd_actions === 'number' ||
      typeof m.cooldown === 'number' ||
      (typeof m.trigger === 'string' && m.trigger.trim()) ||
      (typeof m.passiveKind === 'string' && m.passiveKind.trim())
    );
  };

  const specA = form.value.specA_skill_modifier as SpecSkillModifier | undefined;
  const specB = form.value.specB_skill_modifier as SpecSkillModifier | undefined;

  if (hasSpecContent(specA) && !specA?.targetSkillId) return true;
  if (hasSpecContent(specB) && !specB?.targetSkillId) return true;

  return skillsInvalid;
});

function effectFields(type: string): string[] {
  const s = schema.value?.SUPPORTED_EFFECTS?.[type];
  if (!s) return [];
  const requiredOneOf = s.requiredOneOf || [];
  const required = s.required || [];
  const optional = s.optional || [];
  return [...new Set([...requiredOneOf, ...required, ...optional])];
}

/** Champs affichés selon le type d’effet ; pour APPLY_BUFF, dépend de buffType (dynamique). */
function effectFieldsForEffect(eff: Record<string, unknown>): string[] {
  const type = (eff?.type ?? '').toString().toUpperCase();
  if (type === 'ATB_UP' || type === 'REDUCE_ATB') {
    return ['target', 'percent', 'scaleFromEffectIndex', 'percentPerRemoved', 'scaleMetric', 'chance'];
  }
  if (type === 'HEAL') {
    return ['target', 'value', 'percentMaxHp', 'percentMaxHpCaster', 'scaleFromEffectIndex', 'valuePerRemoved', 'scaleMetric', 'chance'];
  }
  if (type === 'DAMAGE') {
    return ['target', 'mult', 'percentMaxHp', 'percentMaxHpCaster', 'count', 'missingHpScaling', 'scaleFromEffectIndex', 'valuePerRemoved', 'scaleMetric', 'chance'];
  }
  if (type === 'APPLY_DEBUFF') return ['debuffType', 'remainingActions', 'target', 'chance'];
  if (type !== 'APPLY_BUFF') return effectFields(type);
  const buffType = (eff?.buffType ?? '').toString().toUpperCase();
  const fixedValues = schema.value?.BUFF_FIXED_VALUES as Record<string, number> | undefined;
  const chain = ['scaleFromEffectIndex', 'valuePerRemoved', 'scaleMetric', 'chance'] as const;
  if (buffType === 'SHIELD') return ['buffType', 'remainingActions', 'target', 'value', 'percentMaxHp', 'percentMaxHpCaster', ...chain];
  if (buffType === 'REGEN') return ['buffType', 'remainingActions', 'target', 'value', 'percentMaxHp', 'percentMaxHpCaster', ...chain];
  if (buffType === 'DOT') return ['buffType', 'remainingActions', 'target', 'value', ...chain];
  if (buffType === 'ANTI_BUFF') return ['buffType', 'remainingActions', 'target', 'value', ...chain];
  if (buffType === 'LIFESTEAL') return ['buffType', 'remainingActions', 'target', 'value'];
  if (fixedValues && Object.prototype.hasOwnProperty.call(fixedValues, buffType)) return ['buffType', 'remainingActions', 'target'];
  return ['buffType', 'remainingActions', 'target'];
}

/** Un parmi requis : schéma standard ou SHIELD (value / percentMaxHp / percentMaxHpCaster). */
function isRequiredOneOfForEffect(eff: Record<string, unknown>, key: string): boolean {
  const type = (eff?.type ?? '').toString().toUpperCase();
  if (type === 'APPLY_DEBUFF') return false;
  const bt = (eff?.buffType ?? '').toString().toUpperCase();
  if (type === 'APPLY_BUFF' && bt === 'SHIELD' && ['value', 'percentMaxHp', 'percentMaxHpCaster', 'scaleFromEffectIndex'].includes(key)) return true;
  if (type === 'APPLY_BUFF' && bt === 'REGEN' && ['value', 'percentMaxHp', 'percentMaxHpCaster', 'scaleFromEffectIndex'].includes(key)) return true;
  if (type === 'HEAL' && ['value', 'percentMaxHp', 'percentMaxHpCaster', 'scaleFromEffectIndex'].includes(key)) return true;
  if (type === 'DAMAGE' && ['mult', 'percentMaxHp', 'percentMaxHpCaster', 'scaleFromEffectIndex'].includes(key)) return true;
  return isRequiredOneOf(type, key);
}

function isRequiredOneOf(type: string, key: string): boolean {
  const s = schema.value?.SUPPORTED_EFFECTS?.[type];
  return !!(s?.requiredOneOf && s.requiredOneOf.includes(key));
}

/** Message studio pour buff à valeur fixe (ex. "ATK_UP → +50% attaque"). */
function buffFixedLabel(buffType: string | undefined): string {
  if (!buffType) return '';
  const labels = schema.value?.BUFF_FIXED_LABELS as Record<string, string> | undefined;
  const val = schema.value?.BUFF_FIXED_VALUES as Record<string, number> | undefined;
  if (labels && labels[buffType]) return `Valeur fixe : ${labels[buffType]}`;
  if (val && val[buffType] != null) return `Valeur fixe : ${(val[buffType]! > 0 ? '+' : '') + (val[buffType]! * 100)}%`;
  return '';
}

/** Message studio pour débuff à valeur fixe (ex. "DEF_DOWN → -30% défense"). */
function debuffFixedLabel(debuffType: string | undefined): string {
  if (!debuffType) return '';
  const d = (debuffType ?? '').toString().toUpperCase();
  const fix: Record<string, string> = { ATK_DOWN: '-30% attaque', DEF_DOWN: '-30% défense', SLOW: '-20% vitesse', BLIND: '25% chance de rater' };
  return fix[d] ? `Valeur fixe : ${fix[d]}` : '';
}

function isNumberField(key: string): boolean {
  const numKeys = ['mult', 'percentMaxHp', 'percentMaxHpCaster', 'value', 'percent', 'remainingActions', 'count', 'percentHp', 'flatHp', 'chance', 'missingHpScaling', 'scaleFromEffectIndex', 'percentPerRemoved', 'valuePerRemoved'];
  return numKeys.includes(key);
}

/** Indication de format pour les champs chance / percent / value (LIFESTEAL) dans les labels. */
function fieldHint(key: string, eff?: Record<string, unknown>): string {
  if (key === 'chance') return ' (0–1 ou 1–100 ; ex. 0.25 ou 25 = 25%)';
  if (['percent', 'percentMaxHp', 'percentMaxHpCaster', 'percentHp'].includes(key)) return ' (0.1 ou 10 = 10%)';
  if (key === 'missingHpScaling') return ' (bonus max à PV très bas, ex. 0.5 = +50% max)';
  if (key === 'value' && (eff?.buffType ?? '').toString().toUpperCase() === 'LIFESTEAL') return ' (0–1, ex. 0.2 = 20% vampirisme)';
  if (key === 'value' && ['CD_UP', 'CD_DOWN'].includes(String(eff?.type ?? '').toUpperCase())) {
    return ' (tours de recharge à ajouter ou retirer, entier ≥ 1)';
  }
  const et = String(eff?.type ?? '').toUpperCase();
  const eb = String(eff?.buffType ?? '').toUpperCase();
  if (key === 'scaleFromEffectIndex' && (et === 'ATB_UP' || et === 'REDUCE_ATB' || et === 'HEAL' || et === 'DAMAGE' || ['SHIELD', 'REGEN', 'DOT', 'ANTI_BUFF'].includes(eb))) {
    return ' (0 = 1er effet ; index < n° de cet effet)';
  }
  if (key === 'percentPerRemoved' && (et === 'ATB_UP' || et === 'REDUCE_ATB')) {
    return ' (% barre ATB par unité : 0.05 ou 5 = 5 % ; removedCount = CLEANSE/STRIP)';
  }
  if (key === 'valuePerRemoved') {
    if (et === 'HEAL') return ' (PV bonus par débuff retiré si CLEANSE ; même cible)';
    if (et === 'DAMAGE') return ' (dégâts plats bonus par buff retiré si STRIP)';
    if (eb === 'SHIELD' || eb === 'REGEN') return ' (flat bonus : CLEANSE typ.)';
    if (eb === 'DOT') return ' (stacks en plus par buff stripé ; STRIP)';
    if (eb === 'ANTI_BUFF') return ' (tours de durée en plus par buff stripé)';
  }
  if (key === 'scaleMetric') return ' (défaut removedCount = champ removed de l’effet cible)';
  return '';
}

/** Placeholder pour les champs chance / percent / value (LIFESTEAL). */
function fieldPlaceholder(key: string, eff?: Record<string, unknown>): string {
  if (key === 'chance') return 'ex. 0.25 ou 25 pour 25%';
  if (['percent', 'percentMaxHp', 'percentMaxHpCaster', 'percentHp'].includes(key)) return 'ex. 0.1 ou 10 pour 10%';
  if (key === 'missingHpScaling') return 'ex. 0.5 pour +50% dégâts max';
  if (key === 'value' && (eff?.buffType ?? '').toString().toUpperCase() === 'LIFESTEAL') return 'ex. 0.2 pour 20%';
  if (key === 'value' && ['CD_UP', 'CD_DOWN'].includes(String(eff?.type ?? '').toUpperCase())) return 'ex. 2';
  return '';
}

function addSkill() {
  form.value.skills.push({ id: generateSkillId(), type: 'ACTIVE', cd_actions: 3, description: '', effects: [] });
}

/** Passif permanent DEBUFF_IMMUNITY (unit builder + moteur). */
function addDebuffImmunityPassive() {
  const id = generateSkillId();
  const p: PassiveSkill = {
    id,
    type: 'PASSIVE',
    passiveKind: 'DEBUFF_IMMUNITY',
    trigger: '',
    cooldown: 0,
    effects: [],
    description: ''
  };
  form.value.skills.push(p);
}

function removeSkill(idx: number) {
  form.value.skills.splice(idx, 1);
}

function addSkillEffect(skillIdx: number) {
  const sk = form.value.skills[skillIdx];
  if (!sk) return;
  if (!sk.effects) sk.effects = [];
  sk.effects.push({ type: 'DAMAGE' });
}

function removeSkillEffect(skillIdx: number, effectIdx: number) {
  const sk = form.value.skills[skillIdx];
  if (sk?.effects) sk.effects.splice(effectIdx, 1);
}

function addSpecEffect(spec: 'A' | 'B') {
  const mod = (spec === 'A' ? form.value.specA_skill_modifier : form.value.specB_skill_modifier) as SpecSkillModifier;
  if (!mod.modify) mod.modify = {};
  if (!mod.modify.effects) mod.modify.effects = [];
  mod.modify.effects.push({ type: 'DAMAGE' });
}

function removeSpecEffect(spec: 'A' | 'B', idx: number) {
  const mod = (spec === 'A' ? form.value.specA_skill_modifier : form.value.specB_skill_modifier) as SpecSkillModifier;
  if (mod.modify?.effects) mod.modify.effects.splice(idx, 1);
}

function duplicateSpecEffect(spec: 'A' | 'B', idx: number) {
  const mod = (spec === 'A' ? form.value.specA_skill_modifier : form.value.specB_skill_modifier) as SpecSkillModifier;
  if (!mod.modify?.effects || idx < 0 || idx >= mod.modify.effects.length) return;
  const copy = JSON.parse(JSON.stringify(mod.modify.effects[idx]));
  mod.modify.effects.splice(idx + 1, 0, copy);
}

function moveSpecEffect(spec: 'A' | 'B', idx: number, direction: 'up' | 'down') {
  const mod = (spec === 'A' ? form.value.specA_skill_modifier : form.value.specB_skill_modifier) as SpecSkillModifier;
  const arr = mod.modify?.effects;
  if (!arr || idx < 0) return;
  const next = direction === 'up' ? idx - 1 : idx + 1;
  if (next < 0 || next >= arr.length) return;
  [arr[idx], arr[next]] = [arr[next], arr[idx]];
}

/** Normalise un effet pour l'UI : APPLY_DEBUFF conservé ; APPLY_BUFF avec buffType débuff → APPLY_DEBUFF + debuffType. */
function normalizeEffectForForm(e: any): any {
  if (!e || typeof e !== 'object') return e;
  const out = { ...e };
  const type = String(e.type ?? '').toUpperCase();
  if (type === 'APPLY_DEBUFF') {
    out.debuffType = e.debuffType ?? e.debuff ?? e.buffType;
    if (out.buffType !== undefined) delete out.buffType;
    if (out.debuff !== undefined) delete out.debuff;
  } else if (type === 'APPLY_BUFF') {
    const bt = (e.buffType ?? '').toString().toUpperCase();
    const debuffTypes = (schema.value?.DEBUFF_TYPES as string[]) ?? ['ATK_DOWN', 'DEF_DOWN', 'SLOW', 'SILENCE', 'STUN', 'BLIND', 'PROVOKE', 'ANTI_HEAL', 'ANTI_SHIELD', 'ANTI_BUFF', 'DOT'];
    if (debuffTypes.includes(bt)) {
      out.type = 'APPLY_DEBUFF';
      out.debuffType = e.buffType;
      delete out.buffType;
    }
  }
  return normalizeEffectDecimals(out) as any;
}

/** Normalise une valeur décimale : "0,1" → 0.1 pour envoi API / affichage. */
function normalizeDecimalValue(val: unknown): number | string | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string') {
    const s = val.trim().replace(/,/g, '.');
    const n = parseFloat(s);
    if (!Number.isNaN(n)) return n;
  }
  return val as string | number;
}

/** Applique la normalisation virgule → point sur les champs numériques d'un effet. */
function normalizeEffectDecimals(obj: Record<string, unknown>): Record<string, unknown> {
  const keys = ['value', 'percent', 'chance', 'percentMaxHp', 'percentMaxHpCaster', 'percentHp', 'mult', 'count', 'missingHpScaling'];
  const out = { ...obj };
  for (const k of keys) {
    if (out[k] !== undefined && out[k] !== null) {
      const n = normalizeDecimalValue(out[k]);
      if (n !== undefined) out[k] = n;
    }
  }
  return out;
}

/** Payload clean : jamais envoyer APPLY_DEBUFF, toujours APPLY_BUFF + buffType ; normalise virgule → point. */
function sanitizeEffectForPayload(e: any): any {
  if (!e || typeof e !== 'object') return e;
  const type = String(e.type ?? '').toUpperCase();
  let out: any;
  if (type === 'APPLY_DEBUFF') {
    const { debuffType, debuff, ...rest } = e;
    out = { ...rest, type: 'APPLY_BUFF', buffType: debuffType ?? debuff ?? rest.buffType };
  } else {
    out = { ...e };
  }
  return normalizeEffectDecimals(out) as any;
}

/** Convertit l'ancien format (skill_data.skill + skill_data.passives) en skill_data.skills[]. */
function normalizeSkills(skillData: any): FormSkill[] {
  if (!skillData || typeof skillData !== 'object') return [{ id: generateSkillId(), type: 'ACTIVE', cd_actions: 3, description: '', effects: [] }];
  if (Array.isArray(skillData.skills) && skillData.skills.length > 0) {
    return skillData.skills.map((s: any) => {
      const type = (s.type === 'PASSIVE' ? 'PASSIVE' : 'ACTIVE') as 'ACTIVE' | 'PASSIVE';
      const pk = typeof s.passiveKind === 'string' ? s.passiveKind.trim() : '';
      const base: FormSkill = {
        id: (typeof s.id === 'string' && s.id.trim()) ? s.id : generateSkillId(),
        type,
        effects: Array.isArray(s.effects) ? s.effects.map(normalizeEffectForForm) : []
      } as FormSkill;
      if (type === 'PASSIVE') {
        const p = base as PassiveSkill;
        p.trigger = s.trigger ?? '';
        p.cooldown = s.cooldown ?? 0;
        p.description = typeof s.description === 'string' ? s.description : '';
        if (pk) p.passiveKind = pk;
        if (pk && isPermanentPassiveKindString(pk)) {
          p.trigger = '';
          p.effects = [];
        }
      } else {
        const a = base as ActiveSkill;
        a.cd_actions = s.cd_actions ?? 3;
        a.description = s.description ?? '';
      }
      return base;
    });
  }
  const out: FormSkill[] = [];
  const skill = skillData.skill ?? skillData;
  if (skill && typeof skill === 'object' && (skill.effects?.length || skill.cd_actions != null)) {
    out.push({
      id: generateSkillId(),
      type: 'ACTIVE',
      cd_actions: skill.cd_actions ?? 3,
      description: (skillData.description?.skill ?? '') as string,
      effects: Array.isArray(skill.effects) ? skill.effects.map(normalizeEffectForForm) : []
    });
  }
  const innerSkill = skillData.skill ?? skillData;
  const rawPassives = Array.isArray(skillData.passives) ? skillData.passives : (Array.isArray(innerSkill?.passives) ? innerSkill.passives : []);
  for (const p of rawPassives) {
    if (!p || typeof p !== 'object') continue;
    const pk = typeof p.passiveKind === 'string' ? p.passiveKind.trim() : '';
    const trigger = (p.trigger ?? p.type ?? '').toString();
    if (!trigger && !pk) continue;
    const row: PassiveSkill = {
      id: generateSkillId(),
      type: 'PASSIVE',
      trigger: trigger || '',
      cooldown: typeof p.cooldown === 'number' ? p.cooldown : (p.cd_actions ?? 0),
      description: typeof p.description === 'string' ? p.description : '',
      effects: Array.isArray(p.effects) ? p.effects.map(normalizeEffectForForm) : (p.effect ? [normalizeEffectForForm(p.effect)] : [])
    };
    if (pk) {
      row.passiveKind = pk;
      if (isPermanentPassiveKindString(pk)) {
        row.trigger = '';
        row.effects = [];
      }
    }
    out.push(row);
  }
  if (out.length === 0) out.push({ id: generateSkillId(), type: 'ACTIVE', cd_actions: 3, description: '', effects: [] });
  return out;
}

const previewJson = computed(() => {
  const payload = buildPayload();
  return JSON.stringify(payload, null, 2);
});

/** skill_data après application des deux spécialisations (comme en combat). */
const finalSkillDataJson = computed(() => {
  const skills = (form.value.skills || []).map((s) => JSON.parse(JSON.stringify(s)));
  const specA = form.value.specA_skill_modifier as SpecSkillModifier;
  const specB = form.value.specB_skill_modifier as SpecSkillModifier;
  for (let i = 0; i < skills.length; i++) {
    let s = skills[i];
    const nextA = applySpecModifierFrontend(s, specA);
    if (nextA) s = nextA;
    const nextB = applySpecModifierFrontend(s, specB);
    if (nextB) s = nextB;
    skills[i] = s;
  }
  return JSON.stringify(
    {
      skill_data: {
        skills,
        description: form.value.description ?? { skill: '', specA: '', specB: '' }
      }
    },
    null,
    2
  );
});

/** Comparaison 3 colonnes : Base | Après Spé A | Après Spé A+B (par skill). */
const comparisonThreeCols = computed(() => {
  const skills = (form.value.skills || []).filter((s): s is NonNullable<typeof s> => s != null);
  const specA = form.value.specA_skill_modifier as SpecSkillModifier;
  const specB = form.value.specB_skill_modifier as SpecSkillModifier;
  return skills.map((sk) => {
    const id = (sk?.id ?? '').toString().trim();
    const base = JSON.parse(JSON.stringify(sk));
    let afterA = JSON.parse(JSON.stringify(sk));
    const appliedA = applySpecModifierFrontend(afterA, specA);
    if (appliedA) afterA = appliedA;
    const afterB = finalSkillPreviews.value[id]?.final ?? afterA;
    return { id, base, afterA, afterB };
  });
});

function computePowerScoreFromSkills(skills: Record<string, any>[]): number {
  const atk = Number(form.value.base_attack ?? 80);
  const hp = Number(form.value.base_hp ?? 1000);
  const def = Number(form.value.base_defense ?? 80);
  const mastery = Number(form.value.mastery ?? 0);
  let avgMult = 1;
  let cdSum = 0;
  let cdCount = 0;
  for (const s of skills) {
    for (const e of s.effects ?? []) {
      if (String(e?.type ?? '').toUpperCase() === 'DAMAGE') {
        const m = Number(e.mult ?? e.value ?? 1);
        avgMult = avgMult === 1 ? m : (avgMult + m) / 2;
      }
    }
    if (String(s.type ?? '').toUpperCase() === 'ACTIVE') {
      cdSum += Number(s.cd_actions ?? 3);
      cdCount += 1;
    }
  }
  const offense = atk * avgMult;
  const survie = hp * (1 + def / 100);
  const cdMean = cdCount > 0 ? cdSum / cdCount : 3;
  const tempo = 100 / Math.max(cdMean, 0.5);
  return offense * 1.2 + survie * 0.8 + tempo * 0.5 + mastery * 0.3;
}

const powerScoreBase = computed(() => computePowerScoreFromSkills(form.value.skills || []));
const skillsAfterA = computed(() => {
  const skills = (form.value.skills || []).map((s) => {
    const applied = applySpecModifierFrontend(JSON.parse(JSON.stringify(s)), form.value.specA_skill_modifier as SpecSkillModifier);
    return applied ?? JSON.parse(JSON.stringify(s));
  });
  return skills;
});
const powerScoreAfterA = computed(() => computePowerScoreFromSkills(skillsAfterA.value));
const powerScoreAfterB = computed(() => computePowerScoreFromSkills((form.value.skills || []).filter((s): s is NonNullable<typeof s> => s != null).map((s) => finalSkillPreviews.value[(s?.id ?? '').toString().trim()]?.final ?? s)));

const powerScoreVsRarity = computed(() => {
  const score = powerScoreAfterB.value;
  const rarity = (form.value.rarity ?? 'common').toString().toLowerCase();
  const same = existingUnits.value.filter((u) => String(u.rarity ?? '').toLowerCase() === rarity);
  if (same.length === 0) return null;
  const avg = same.reduce((acc, u) => {
    const sd = u.skill_data;
    const skills = Array.isArray(sd?.skills) ? sd.skills : [];
    return acc + computePowerScoreFromSkills(skills);
  }, 0) / same.length;
  if (avg === 0) return null;
  const pct = ((score - avg) / avg) * 100;
  return { avg, pct };
});

const dpsBySkill = computed(() => {
  const atk = Number(form.value.base_attack ?? 80);
  return (form.value.skills || [])
    .filter((s): s is NonNullable<typeof s> => s != null)
    .map((sk) => {
      const preview = finalSkillPreviews.value[(sk?.id ?? '').toString().trim()]?.final ?? sk;
      const id = (sk?.id ?? '').toString().trim() || '?';
      if (preview?.type === 'PASSIVE') {
        const freq = 0.2;
        const val = (preview.effects ?? []).reduce((s: number, e: any) => s + Number(e.value ?? e.mult ?? 0), 0) / Math.max((preview.effects ?? []).length, 1);
        return { id, dps: freq * val, label: 'Passive (estim.)' };
      }
      const cd = Math.max(Number(preview?.cd_actions ?? 3), 1);
      let mult = 1;
      for (const e of preview?.effects ?? []) {
        if (String(e?.type ?? '').toUpperCase() === 'DAMAGE') {
          mult = Number(e.mult ?? e.value ?? 1);
          break;
        }
      }
      const dps = (atk * mult) / cd;
      return { id, dps, label: `${dps.toFixed(0)} / tour` };
    });
});

const impactSpecA = computed(() => {
  const base = powerScoreBase.value;
  if (base === 0) return 0;
  return ((powerScoreAfterA.value - base) / base) * 100;
});
const impactSpecB = computed(() => {
  const afterA = powerScoreAfterA.value;
  if (afterA === 0) return 0;
  return ((powerScoreAfterB.value - afterA) / afterA) * 100;
});
const impactTotal = computed(() => {
  const base = powerScoreBase.value;
  if (base === 0) return 0;
  return ((powerScoreAfterB.value - base) / base) * 100;
});

const CC_WEIGHTS: Record<string, number> = {
  SLOW: 6,
  SILENCE: 6,
  REMOVEBUFF: 8,
  REDUCE_COOLDOWN: 10,
  REDUCE_ATB: 5,
  STRIP: 7,
  CD_UP: 6,
  CD_DOWN: 4,
  SET_SKILL_COOLDOWN_MAX: 5,
  RESET_SKILL_COOLDOWN: 6,
  STEAL_STAT: 6
};
const controlIndex = computed(() => {
  const skills = form.value.skills || [];
  let sum = 0;
  for (const s of skills) {
    for (const e of s.effects ?? []) {
      const t = String(e?.type ?? '').toUpperCase().replace(/\s/g, '_');
      sum += CC_WEIGHTS[t] ?? 0;
    }
  }
  return Math.min(100, Math.round(sum));
});

const radarData = computed(() => {
  const atk = Number(form.value.base_attack ?? 80);
  const hp = Number(form.value.base_hp ?? 1000);
  const def = Number(form.value.base_defense ?? 80);
  const skills = form.value.skills || [];
  let dpsNorm = 0;
  let burst = 0;
  let hasScaling = false;
  for (const s of skills) {
    const p = finalSkillPreviews.value[(s.id ?? '').toString().trim()]?.final ?? s;
    if (p.type === 'ACTIVE') {
      const cd = Math.max(Number(p.cd_actions ?? 3), 1);
      for (const e of p.effects ?? []) {
        if (String(e?.type ?? '').toUpperCase() === 'DAMAGE') {
          const m = Number(e.mult ?? e.value ?? 1);
          dpsNorm += (atk * m) / cd / 100;
          burst = Math.max(burst, m);
        }
        const et = String(e?.type ?? '').toUpperCase();
        if (['APPLY_BUFF', 'ATB_UP', 'REDUCE_ATB', 'HEAL', 'DAMAGE'].includes(et)) hasScaling = true;
      }
    }
  }
  const tankiness = (hp * (1 + def / 100)) / 2000;
  const cc = controlIndex.value / 100;
  return {
    dps: Math.min(1, dpsNorm),
    tankiness: Math.min(1, tankiness),
    control: cc,
    burst: Math.min(1, burst / 3),
    scaling: hasScaling ? 0.7 : 0.2
  };
});

const miniSimulatorResult = computed(() => {
  const atk = Number(form.value.base_attack ?? 80);
  const hp = Number(form.value.base_hp ?? 1000);
  const def = Number(form.value.base_defense ?? 80);
  const rarity = (form.value.rarity ?? 'common').toString().toLowerCase();
  const sameRarity = existingUnits.value.filter((u) => String(u.rarity ?? '').toLowerCase() === rarity);
  const avgEnemyHp = sameRarity.length
    ? sameRarity.reduce((s, u) => s + Number(u.base_hp ?? 1000), 0) / sameRarity.length
    : 1000;
  const avgEnemyAtk = sameRarity.length
    ? sameRarity.reduce((s, u) => s + Number(u.base_attack ?? 80), 0) / sameRarity.length
    : 80;
  let dmgPerTurn = 0;
  for (const sk of form.value.skills || []) {
    const p = finalSkillPreviews.value[(sk.id ?? '').toString().trim()]?.final ?? sk;
    if (p.type === 'ACTIVE') {
      const cd = Math.max(Number(p.cd_actions ?? 3), 1);
      for (const e of p.effects ?? []) {
        if (String(e?.type ?? '').toUpperCase() === 'DAMAGE') {
          dmgPerTurn += (atk * Number(e.mult ?? e.value ?? 1)) / cd;
          break;
        }
      }
    }
  }
  if (dmgPerTurn <= 0) dmgPerTurn = atk / 3;
  const damageTakenPerTurn = avgEnemyAtk * (1 - def / (def + 100));
  const turnsToKill = avgEnemyHp / Math.max(dmgPerTurn, 1);
  const turnsToDie = hp / Math.max(damageTakenPerTurn, 1);
  const winrate = turnsToKill <= turnsToDie ? 50 + Math.min(25, (turnsToDie / Math.max(turnsToKill, 0.1) - 1) * 20) : 50 - Math.min(25, (turnsToKill / Math.max(turnsToDie, 0.1) - 1) * 20);
  return { turnsToKill: turnsToKill.toFixed(1), winrate: Math.round(Math.min(100, Math.max(0, winrate))) };
});

const studioWarnings = computed(() => {
  const w: string[] = [];
  const score = powerScoreAfterB.value;
  const rarity = (form.value.rarity ?? 'common').toString().toLowerCase();
  const same = existingUnits.value.filter((u) => String(u.rarity ?? '').toLowerCase() === rarity);
  if (same.length > 0) {
    const avg = same.reduce((acc, u) => {
      const sd = u.skill_data;
      const skills = Array.isArray(sd?.skills) ? sd.skills : [];
      return acc + computePowerScoreFromSkills(skills);
    }, 0) / same.length;
    if (avg > 0 && score > avg * 1.15) w.push('Outlier (+15% vs moyenne rareté)');
  }
  for (const sk of form.value.skills ?? []) {
    const p = finalSkillPreviews.value[(sk.id ?? '').toString().trim()]?.final ?? sk;
    for (const e of p.effects ?? []) {
      const m = Number(e.mult ?? e.value ?? 0);
      if (m > 2.5) {
        w.push('Burst élevé (mult > 2.5)');
        break;
      }
    }
    if (sk.type === 'ACTIVE') {
      const cd = Number(sk.cd_actions ?? 3);
      let mult = 0;
      for (const e of sk.effects ?? []) {
        if (String(e?.type ?? '').toUpperCase() === 'DAMAGE') mult = Math.max(mult, Number(e.mult ?? e.value ?? 0));
      }
      if (cd < 2 && mult > 1.5) w.push('Combo dangereux (CD < 2 + mult > 1.5)');
    }
  }
  return [...new Set(w)];
});

async function loadSchema() {
  try {
    const { data } = await api.get('/admin/effects-schema');
    schema.value = data;
  } catch (e: any) {
    if (e.response?.status === 403) return;
    schema.value = {};
  }
}

async function loadUnitImageAssets() {
  try {
    const { data } = await api.get('/admin/unit-image-assets');
    unitImageAssets.value = Array.isArray(data.assets) ? data.assets : [];
  } catch (e: any) {
    if (e.response?.status === 403) return;
    unitImageAssets.value = [];
  }
}

async function loadUnits() {
  loadingUnits.value = true;
  try {
    const { data } = await api.get('/admin/units');
    existingUnits.value = data.units || [];
  } catch (e: any) {
    if (e.response?.status === 403) return;
    existingUnits.value = [];
  } finally {
    loadingUnits.value = false;
  }
}

function loadUnitIntoForm(unit: { id: number; code: string; name: string; rarity: string; skill_data?: any; [k: string]: any }) {
  isLoadingUnitIntoForm.value = true;
  const sd = unit.skill_data;
  const desc = sd && typeof sd === 'object' ? sd.description : null;
  const noyau = sd && typeof sd === 'object' ? (sd.noyau as { effects?: Array<{ stat?: NoyauStat; percent?: number }> } | null) : null;
  const noyauEffect = Array.isArray(noyau?.effects) ? noyau.effects[0] : null;
  const role = unit.role === 'frontline' ? 'tank' : unit.role === 'backline' ? 'support' : (unit.role || 'tank');
  const element = unit.element === 'neutral' ? 'plant' : (unit.element || 'fire');
  form.value = {
    id: unit.id,
    name: unit.name || '',
    code: unit.code || '',
    rarity: unit.rarity || 'common',
    element: element,
    role: role,
    attack_type: unit.attack_type || 'melee',
    archetype: unit.archetype || 'CAC_TANK',
    base_hp: Number(unit.base_hp) ?? 1000,
    base_attack: Number(unit.base_attack) ?? 80,
    base_defense: Number(unit.base_defense) ?? 80,
    base_speed: Number(unit.base_speed) ?? 90,
    mastery: Number(unit.mastery) ?? 0,
    has_noyau: !!noyauEffect,
    noyau_stat: (noyauEffect?.stat && ['maxHp', 'attack', 'defense', 'speed', 'mastery'].includes(String(noyauEffect.stat))
      ? noyauEffect.stat
      : 'attack') as NoyauStat,
    noyau_percent: Math.max(1, Number(noyauEffect?.percent) || 10),
    image_url: (unit.image_url && String(unit.image_url).trim()) || null,
    traits: Array.isArray(unit.traits) ? [...unit.traits] : [],
    description: {
      skill: normalizeSkillDescription((desc?.skill ?? '') as string),
      specA: normalizeSkillDescription((desc?.specA ?? '') as string),
      specB: normalizeSkillDescription((desc?.specB ?? '') as string)
    },
    skills: normalizeSkills(sd),
    specA_bonus_stat: unit.specA_bonus_stat ?? '',
    specB_bonus_stat: unit.specB_bonus_stat ?? '',
    specA_skill_modifier: (() => {
      const raw = unit.specA_skill_modifier as any;
      const base: SpecSkillModifier = { targetSkillId: '', modify: {} };
      if (raw && typeof raw === 'object') {
        if (typeof raw.targetSkillId === 'string') base.targetSkillId = raw.targetSkillId;
        const m = raw.modify && typeof raw.modify === 'object' ? raw.modify : raw;
        const modify: SpecSkillModifier['modify'] = {};
        if (Array.isArray(m.effects)) {
          modify.effects = JSON.parse(JSON.stringify(m.effects));
        }
        if (typeof m.cd_actions === 'number') {
          modify.cd_actions = m.cd_actions;
        }
        if (typeof m.cooldown === 'number') {
          modify.cooldown = m.cooldown;
        }
        if (typeof m.trigger === 'string') {
          modify.trigger = m.trigger;
        }
        if (typeof m.passiveKind === 'string' && m.passiveKind.trim()) {
          modify.passiveKind = m.passiveKind.trim();
        }
        base.modify = modify;
      } else {
        base.modify = { effects: [] };
      }
      if (!base.modify) base.modify = {};
      if (!base.modify.effects) base.modify.effects = [];
      return base;
    })(),
    specB_skill_modifier: (() => {
      const raw = unit.specB_skill_modifier as any;
      const base: SpecSkillModifier = { targetSkillId: '', modify: {} };
      if (raw && typeof raw === 'object') {
        if (typeof raw.targetSkillId === 'string') base.targetSkillId = raw.targetSkillId;
        const m = raw.modify && typeof raw.modify === 'object' ? raw.modify : raw;
        const modify: SpecSkillModifier['modify'] = {};
        if (Array.isArray(m.effects)) {
          modify.effects = JSON.parse(JSON.stringify(m.effects));
        }
        if (typeof m.cd_actions === 'number') {
          modify.cd_actions = m.cd_actions;
        }
        if (typeof m.cooldown === 'number') {
          modify.cooldown = m.cooldown;
        }
        if (typeof m.trigger === 'string') {
          modify.trigger = m.trigger;
        }
        if (typeof m.passiveKind === 'string' && m.passiveKind.trim()) {
          modify.passiveKind = m.passiveKind.trim();
        }
        base.modify = modify;
      } else {
        base.modify = { effects: [] };
      }
      if (!base.modify) base.modify = {};
      if (!base.modify.effects) base.modify.effects = [];
      return base;
    })(),
    is_boss: Number((unit as { is_boss?: boolean | number }).is_boss) === 1 || (unit as { is_boss?: boolean }).is_boss === true
  };
  specA_prefilledFromBase.value = false;
  specB_prefilledFromBase.value = false;
  nextTick(() => { isLoadingUnitIntoForm.value = false; });
}

function resetForm() {
  form.value = getDefaultForm();
  createMessage.value = '';
  specA_prefilledFromBase.value = false;
  specB_prefilledFromBase.value = false;
}

async function updateUnit() {
  if (!form.value.id) return;
  createMessage.value = '';
  loading.value = true;
  try {
    const payload = buildPayload();
    const { data } = await api.put(`/admin/units/${form.value.id}`, payload);
    createSuccess.value = true;
    createMessage.value = `Unité mise à jour (id: ${data.id}, code: ${data.code})`;
    await loadUnits();
    const updated = existingUnits.value.find((u) => u.id === form.value.id);
    if (updated) loadUnitIntoForm(updated);
  } catch (e: any) {
    if (e.response?.status === 403) return;
    createSuccess.value = false;
    createMessage.value = e.response?.data?.errors?.join(', ') || e.response?.data?.message || e.message || 'Erreur';
  } finally {
    loading.value = false;
  }
}

async function deleteUnit() {
  if (!form.value.id) return;
  const name = form.value.name || form.value.code || `#${form.value.id}`;
  if (!confirm(`Supprimer l'unité « ${name} » ? Les joueurs qui la possèdent la perdront.`)) return;
  loading.value = true;
  createMessage.value = '';
  try {
    await api.delete(`/admin/units/${form.value.id}`);
    createSuccess.value = true;
    createMessage.value = `Unité supprimée (${name})`;
    resetForm();
    await loadUnits();
  } catch (e: any) {
    if (e.response?.status === 403) return;
    createSuccess.value = false;
    createMessage.value = e.response?.data?.message || e.message || 'Erreur';
  } finally {
    loading.value = false;
  }
}

async function validate() {
  await runValidation();
}

async function runValidation(): Promise<boolean> {
  validationErrors.value = [];
  isValid.value = false;
  loading.value = true;
  createMessage.value = '';
  try {
    const payload = buildPayload();
    const { data } = await api.post('/admin/validate-unit', payload);
    if (data.valid) {
      isValid.value = true;
      validationErrors.value = [];
      return true;
    }
    isValid.value = false;
    validationErrors.value = data.errors || [];
    return false;
  } catch (e: any) {
    if (e.response?.status !== 403) {
      validationErrors.value = [e.response?.data?.message || e.message || 'Erreur validation'];
    }
    return false;
  } finally {
    loading.value = false;
  }
}

async function validateAndSave() {
  const valid = await runValidation();
  if (!valid) return;
  if (form.value.id) {
    await updateUnit();
  } else {
    await createUnit();
  }
}

function buildPayload() {
  const skills = (form.value.skills || []).map((s) => {
    const effects = (s.effects ?? []).map(sanitizeEffectForPayload);
    if (s.type === 'ACTIVE') {
      return {
        id: s.id,
        type: 'ACTIVE',
        cd_actions: s.cd_actions ?? 0,
        description: (s as ActiveSkill).description ?? '',
        effects
      };
    }
    const p = s as PassiveSkill;
    if (isPermanentPassiveSkill(p)) {
      return {
        id: p.id,
        type: 'PASSIVE',
        passiveKind: p.passiveKind,
        cooldown: p.cooldown ?? 0,
        effects: [],
        description: p.description ?? ''
      };
    }
    return {
      id: s.id,
      type: 'PASSIVE',
      trigger: p.trigger,
      cooldown: p.cooldown ?? 0,
      effects,
      description: p.description ?? ''
    };
  }).filter((sk) => {
    if (!Array.isArray(sk.effects)) return false;
    if (sk.type === 'ACTIVE') return true;
    if (isPermanentPassiveSkill(sk as FormSkill)) return true;
    const p = sk as PassiveSkill;
    return !!(p.trigger && p.trigger.trim() && sk.effects.length > 0);
  });

  function buildSpecPayload(spec: SpecSkillModifier | undefined | null) {
    if (!spec || !spec.modify) return null;
    const m = spec.modify;
    const hasContent =
      (Array.isArray(m.effects) && m.effects.length > 0) ||
      typeof m.cd_actions === 'number' ||
      typeof m.cooldown === 'number' ||
      (typeof m.trigger === 'string' && m.trigger.trim()) ||
      (typeof m.passiveKind === 'string' && m.passiveKind.trim());
    if (!hasContent) return null;
    if (!spec.targetSkillId) return null;
    const payload: any = { targetSkillId: spec.targetSkillId, modify: {} as any };
    if (Array.isArray(m.effects) && m.effects.length > 0) {
      payload.modify.effects = m.effects.map((eff: any) => sanitizeEffectForPayload(eff));
    }
    if (typeof m.cd_actions === 'number') {
      payload.modify.cd_actions = m.cd_actions;
    }
    if (typeof m.cooldown === 'number') {
      payload.modify.cooldown = m.cooldown;
    }
    if (typeof m.trigger === 'string' && m.trigger.trim()) {
      payload.modify.trigger = m.trigger.trim();
    }
    if (typeof m.passiveKind === 'string' && m.passiveKind.trim()) {
      payload.modify.passiveKind = m.passiveKind.trim();
    }
    return payload;
  }

  const specA = buildSpecPayload(form.value.specA_skill_modifier as SpecSkillModifier);
  const specB = buildSpecPayload(form.value.specB_skill_modifier as SpecSkillModifier);
  const rarity = String(form.value.rarity ?? '').toLowerCase();
  const hasNoyauByRarity = ['epic', 'legendary', 'mythic'].includes(rarity);
  const noyau = hasNoyauByRarity
    ? {
        description: generatedNoyauDescription.value,
        effects: [{
          stat: form.value.noyau_stat,
          percent: Math.max(1, Number(form.value.noyau_percent) || 0)
        }]
      }
    : undefined;
  return {
    name: form.value.name,
    code: form.value.code || undefined,
    rarity: form.value.rarity,
    element: form.value.element,
    role: form.value.role,
    attack_type: form.value.attack_type,
    archetype: form.value.archetype,
    base_hp: form.value.base_hp,
    base_attack: form.value.base_attack,
    base_defense: form.value.base_defense,
    base_speed: form.value.base_speed,
    mastery: form.value.mastery,
    image_url: form.value.image_url || undefined,
    traits: form.value.traits,
    description: form.value.description ?? { skill: '', specA: '', specB: '' },
    skills,
    noyau,
    specA_bonus_stat: form.value.specA_bonus_stat || undefined,
    specB_bonus_stat: form.value.specB_bonus_stat || undefined,
    specA_skill_modifier: specA,
    specB_skill_modifier: specB,
    is_boss: !!form.value.is_boss
  };
}

async function createUnit() {
  createMessage.value = '';
  loading.value = true;
  try {
    const payload = buildPayload();
    const { data } = await api.post('/admin/create-unit', payload);
    createSuccess.value = true;
    createMessage.value = `Unité créée (id: ${data.id}, code: ${data.code})`;
  } catch (e: any) {
    if (e.response?.status === 403) return;
    createSuccess.value = false;
    createMessage.value = e.response?.data?.errors?.join(', ') || e.response?.data?.message || e.message || 'Erreur';
  } finally {
    loading.value = false;
  }
}

async function simulate() {
  simulationResult.value = '';
  loading.value = true;
  try {
    const payload = buildPayload();
    const { data } = await api.post('/admin/simulate-unit', payload);
    simulationResult.value = JSON.stringify(
      { battleLog: data.battleLog, summary: data.summary },
      null,
      2
    );
  } catch (e: any) {
    if (e.response?.status === 403) return;
    simulationResult.value = 'Erreur: ' + (e.response?.data?.message || e.message);
  } finally {
    loading.value = false;
  }
}

function handleFloatingBarScroll() {
  showFloatingActionBar.value = window.scrollY > 120;
}

onMounted(() => {
  loadSchema();
  loadUnits();
  loadUnitImageAssets();
  handleFloatingBarScroll();
  window.addEventListener('scroll', handleFloatingBarScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleFloatingBarScroll);
});
</script>

<style scoped>
.admin-unit-builder {
  padding: 0 20px;
  margin: 0;
}
.admin-unit-builder.admin-fullwidth {
  max-width: 100%;
  padding: 0 20px;
}

.admin-layout {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 20px;
  align-items: start;
}
@media (max-width: 900px) {
  .admin-layout {
    grid-template-columns: 1fr;
  }
  .admin-sidebar {
    position: static;
  }
}
.admin-sidebar {
  position: sticky;
  top: 20px;
}
.admin-main {
  min-width: 0;
}
.admin-main .card.nx-panel {
  padding: 16px;
}

.section {
  padding: 16px;
  margin-bottom: 16px;
  background: rgba(30, 41, 59, 0.35);
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.2);
}
.section-skill-base {
  background: rgba(15, 23, 42, 0.5);
}
.skill-add-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.unit-info-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}
.unit-info-grid label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}
.unit-info-traits {
  grid-column: 1 / -1;
}
.unit-info-traits label {
  font-size: 12px;
  margin-bottom: 2px;
}
.unit-info-traits select {
  min-height: 52px;
}

.unit-boss-flag {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-top: 12px;
  font-size: 12px;
  line-height: 1.35;
  max-width: 720px;
  color: rgba(226, 232, 240, 0.9);
}
.unit-boss-flag input {
  margin-top: 3px;
  flex-shrink: 0;
}

.section-unit-image .unit-image-upload {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section-unit-image .unit-image-preview-wrap {
  width: 120px;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.2);
}
.section-unit-image .unit-image-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.section-unit-image .unit-image-placeholder {
  color: var(--nx-muted, #94a3b8);
  font-size: 13px;
}
.section-unit-image .unit-image-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.section-unit-image .unit-image-help {
  color: var(--nx-muted, #94a3b8);
  font-size: 13px;
}

.form-grid,
.spec-top-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.form-row {
  margin-bottom: 12px;
}
.form-row.compact {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.form-row.compact.single {
  grid-template-columns: 1fr;
}
.form-grid label,
.form-row label,
.spec-top-row label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}
.checkbox-inline {
  display: inline-flex !important;
  flex-direction: row !important;
  align-items: center;
  gap: 8px !important;
}
.form-grid input,
.form-grid select,
.form-row input,
.form-row select,
.form-row textarea {
  padding: 6px 8px;
  font-size: 13px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.8);
  color: #e2e8f0;
}
.form-row textarea {
  min-height: 40px;
  resize: vertical;
}

.skill-card {
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 10px;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.2);
}
.skill-card-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.skill-card-id {
  font-size: 11px;
  color: #94a3b8;
  font-family: monospace;
}
.skill-card-type select,
.skill-card-cd .input-inline {
  padding: 4px 6px;
  font-size: 12px;
}
.skill-card-body {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}
.skill-card-body label {
  font-size: 12px;
}
.skill-desc {
  grid-column: 1 / -1;
}
.effects-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 8px;
}
.effect-block {
  grid-column: span 1;
  min-width: 0;
}

.form-grid .span-2 {
  grid-column: span 2;
}

.spec-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}
.spec-modifier-block {
  min-width: 0;
}
.section-spec-a {
  border-left: 4px solid #22c55e;
  position: relative;
  padding-left: 1rem;
}
.section-spec-b {
  border-left: 4px solid #a855f7;
  position: relative;
  padding-left: 1rem;
}
.section-badge {
  position: absolute;
  top: 0.5rem;
  right: 1rem;
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
}
.section-badge-a {
  background: rgba(34, 197, 94, 0.25);
  color: #86efac;
}
.section-badge-b {
  background: rgba(168, 85, 247, 0.25);
  color: #e9d5ff;
}
.preview-final-skill {
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.15);
}
.preview-final-skill h5 {
  margin: 0 0 0.75rem 0;
  font-size: 0.9rem;
  color: #94a3b8;
}
.preview-final-grid {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.preview-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}
.preview-label {
  min-width: 100px;
  color: #94a3b8;
}
.modified-by-spec {
  color: #86efac;
  font-weight: 500;
}
.badge-spec {
  font-size: 0.75rem;
  color: #86efac;
  font-style: italic;
}
.preview-effects-list {
  margin: 0.5rem 0 0 1rem;
  padding-left: 1rem;
  font-size: 0.85rem;
  color: #cbd5e1;
}
.spec-target-warning {
  font-size: 0.85rem;
  color: #fbbf24;
  margin-bottom: 0.5rem;
}
.skill-targeted-by-spec {
  border-color: rgba(251, 191, 36, 0.4);
}
.spec-validation-msg {
  margin-bottom: 0.5rem;
}
.effect-actions {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}
.nx-btn-small {
  padding: 0.2rem 0.4rem;
  font-size: 0.8rem;
}
.debug-panel {
  margin-top: 1rem;
}
.preview-final-details summary {
  cursor: pointer;
  margin-bottom: 0.5rem;
}
.preview-final-json {
  font-size: 0.75rem;
  overflow: auto;
  max-height: 400px;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-all;
}
.spec-modifier-block {
  margin: 0;
  padding: 12px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.2);
}
.spec-modifier-block h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
}
.spec-modifier-block h5 {
  margin: 8px 0 6px 0;
  font-size: 12px;
}
.spec-prefill-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 6px 0 8px 0;
}
.badge-prefilled {
  font-size: 11px;
  color: #94a3b8;
  font-style: italic;
  padding: 2px 6px;
  background: rgba(148, 163, 184, 0.15);
  border-radius: 4px;
}
.effect-block-spec {
  margin-top: 0.75rem;
}
.effect-block {
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}
.effect-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}
.effect-block label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}
.effect-fixed-value-msg {
  font-size: 0.85rem;
  color: #94a3b8;
  margin: 0.25rem 0 0.5rem;
}
.field-required {
  color: #fbbf24;
}
.errors {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 8px;
  padding: 0.75rem;
  margin-bottom: 1rem;
}
.error-item {
  color: #fca5a5;
  font-size: 0.9rem;
}
.message {
  padding: 0.5rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}
.message.success {
  background: rgba(34, 197, 94, 0.2);
  color: #86efac;
}
.message.error {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
}
.actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.nx-btn-danger {
  padding: 0.25rem 0.5rem;
  font-size: 0.85rem;
}
.floating-save-bar {
  position: fixed;
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
  z-index: 60;
  padding: 10px 12px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(34, 211, 238, 0.28);
  box-shadow: 0 16px 40px rgba(2, 8, 23, 0.45);
  backdrop-filter: blur(10px);
}
.floating-save-btn {
  min-width: 220px;
}
.floating-save-enter-active,
.floating-save-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.floating-save-enter-from,
.floating-save-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}
.preview-details {
  margin-top: 1rem;
}
.preview-details pre {
  font-size: 0.75rem;
  overflow: auto;
  max-height: 300px;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}
.simulation-result {
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.9);
  border-radius: 8px;
}
.simulation-result pre {
  font-size: 0.8rem;
  overflow: auto;
  max-height: 400px;
}
.admin-main h3 {
  margin-top: 0;
  margin-bottom: 8px;
  font-size: 14px;
}
.admin-main .section:not(:first-child) h3 {
  margin-top: 0;
}

.dense-mode label {
  font-size: 12px;
  margin-bottom: 2px;
}
.dense-mode h2 {
  font-size: 16px;
  margin-bottom: 8px;
}
.dense-mode h3 {
  font-size: 14px;
  margin-bottom: 8px;
}

.existing-units-section h3 {
  margin-top: 0;
  margin-bottom: 8px;
}
.existing-units-filters {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}
.existing-units-filters label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: #94a3b8;
}
.unit-filter-select {
  padding: 5px 6px;
  font-size: 12px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.8);
  color: #e2e8f0;
}
.existing-units-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}
.unit-search {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  font-size: 13px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.8);
  color: #e2e8f0;
}
.unit-list {
  max-height: 280px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.unit-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 13px;
  text-align: left;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 6px;
  color: #e2e8f0;
  cursor: pointer;
  transition: background 0.15s;
}
.unit-row:hover {
  background: rgba(30, 41, 59, 0.8);
}
.unit-row.selected {
  border-color: #60a5fa;
  background: rgba(59, 130, 246, 0.15);
}
.unit-row-name {
  flex: 1;
  min-width: 0;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.unit-row-meta {
  font-size: 12px;
  color: #94a3b8;
  flex-shrink: 0;
}
.unit-row-extra {
  font-size: 11px;
  color: #64748b;
}
.existing-units-actions {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.editing-badge {
  font-size: 12px;
  color: #94a3b8;
}
.nx-btn-secondary {
  background: rgba(71, 85, 105, 0.6);
  color: #e2e8f0;
}
.nx-btn-secondary:hover:not(:disabled) {
  background: rgba(71, 85, 105, 0.9);
}

.studio-section {
  margin-top: 2rem;
  padding: 1.5rem;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.2);
}
.studio-section h3 {
  margin-top: 1rem;
  margin-bottom: 0.75rem;
}
.studio-section h3:first-child {
  margin-top: 0;
}
.comparison-three-cols {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.comparison-col {
  padding: 1rem;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 8px;
}
.comparison-col h4 {
  margin: 0 0 0.75rem 0;
  font-size: 0.95rem;
  color: #94a3b8;
}
.comparison-skill {
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
  font-size: 0.85rem;
}
.comparison-skill:last-child {
  border-bottom: none;
}
.comparison-field {
  margin: 0.25rem 0;
}
.comparison-field .label {
  color: #94a3b8;
  margin-right: 0.5rem;
}
.old-value {
  color: #64748b;
  text-decoration: line-through;
  margin-right: 0.35rem;
}
.new-value {
  color: #86efac;
  font-weight: 500;
}
.studio-stats {
  margin-bottom: 1rem;
}
.power-score-line {
  font-size: 1.05rem;
  margin: 0.5rem 0;
}
.power-score-vs {
  color: #94a3b8;
  font-size: 0.9rem;
  margin: 0.25rem 0;
}
.impact-line {
  margin: 0.35rem 0;
  font-size: 0.95rem;
}
.impact-low {
  color: #94a3b8;
}
.badge-impact {
  font-size: 0.75rem;
  margin-left: 0.5rem;
  padding: 0.15rem 0.4rem;
  background: rgba(148, 163, 184, 0.2);
  border-radius: 4px;
  color: #94a3b8;
}
.dps-list {
  margin: 0.5rem 0 1rem 0;
  padding-left: 1.5rem;
}
.dps-list li {
  margin: 0.25rem 0;
}
.control-index-line {
  margin: 0.5rem 0 1rem 0;
}
.radar-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 0.5rem 0 1rem 0;
  font-size: 0.9rem;
  color: #94a3b8;
}
.studio-warnings {
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
}
.studio-warnings ul {
  margin: 0.5rem 0 0 1rem;
  padding: 0;
}
.warning-outlier {
  color: #fca5a5;
  font-size: 0.9rem;
  margin: 0.25rem 0;
}
</style>

<template>
  <section class="team-builder team-builder-page">
    <div class="team-builder-bg" aria-hidden="true" />
    <div class="team-builder-layout" :class="{ 'units-panel-hidden': !showUnitsPanel }">
      <div class="mobile-units-toggle" @click="showUnitsPanel = !showUnitsPanel">
        <span>{{ showUnitsPanel ? 'Masquer les unités' : 'Afficher les unités' }}</span>
        <span class="toggle-icon" aria-hidden="true">{{ showUnitsPanel ? '▼' : '▲' }}</span>
      </div>
      <div class="collection-area nexus-panel nx-panel">
        <div class="collection-header">
          <div class="collection-search">
            <input
              id="unitSearch"
              v-model.trim="searchQuery"
              type="text"
              class="nexus-input search-input-enhanced"
              placeholder="🔍 Rechercher par nom, élément ou trait..."
              autocomplete="off"
            />
            <select
              v-model="selectedEffectFilter"
              class="effect-filter-select-enhanced"
              title="Filtrer par buff/débuff/effet"
            >
              <option value="">✨ Tous les effets</option>
              <option v-for="opt in EFFECT_FILTER_OPTIONS" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="view-controls">
            <button 
              type="button"
              class="view-toggle-btn"
              :class="{ active: viewMode === 'grid' }"
              @click="viewMode = 'grid'"
              title="Vue grille"
            >
              ⊞
            </button>
            <button 
              type="button"
              class="view-toggle-btn"
              :class="{ active: viewMode === 'list' }"
              @click="viewMode = 'list'"
              title="Vue liste"
            >
              ☰
            </button>
          </div>
        </div>
        <div class="collection-columns" :class="'view-mode-' + viewMode">
          <div class="unit-column" id="cacColumn">
            <h2 class="unit-column-title-enhanced">⚔️ Corps à Corps <span class="unit-count-badge">{{ collectionCAC.length }}</span></h2>
            <div v-if="loading" class="loading">Chargement...</div>
            <div v-else class="unit-list" :class="'unit-list-' + viewMode" id="cacUnits">
          <div
            v-for="unit in collectionCAC"
            :key="unit.user_unit_id"
            class="unit-card nx-card unit-card-clickable unit-card-collection"
            :class="[
              'rarity-' + (unit.rarity || 'common'),
              'element-' + (unit.element || 'neutral'),
              { 'fatigue-high': (unit.fatigue ?? 0) > 50 },
              { selected: selectedUnitId === unit.user_unit_id }
            ]"
            :title="collectionUnitHoverTitle(unit)"
            @click="addUnitToTeam(unit)"
          >
            <div class="rarity-bar" :class="'rarity-' + (unit.rarity || 'common')" aria-hidden="true" />
            <div class="unit-card-header">
              <div class="unit-name">{{ unit.name }}</div>
              <label class="favorite-checkbox" title="Favori" @click.stop>
                <input type="checkbox" :checked="favoriteIds.has(unit.user_unit_id)" @change="toggleFavorite(unit.user_unit_id)" />
                <span class="favorite-star">★</span>
              </label>
            </div>
            <div class="unit-meta">
              <span class="level">Niv.{{ unit.level ?? 1 }}</span>
              <span class="badge nx-badge power">P{{ unit.power_level ?? 1 }}</span>
              <span class="badge nx-badge element" :class="'element-' + (unit.element || 'neutral')">{{ elementLabel(unit.element) }}</span>
              <span class="badge nx-badge archetype" :class="archetypeClass(unit)">{{ archetypeLabel(unit) }}</span>
              <span v-if="(unit.ascension_count ?? 0) > 0" class="badge nx-badge ascended" title="Ascension">↑</span>
              <span v-if="unit.role" class="unit-role-tag" :title="unit.role">{{ unit.role }}</span>
            </div>
            <template v-for="sk in [unitSkillPanel(unit)]" :key="'sk-cac-' + unit.user_unit_id">
              <div class="unit-skill-block">
                <div class="unit-skill-panel-head">
                  <span class="unit-skill-panel-label">Compétence</span>
                  <span class="unit-mastery-tag" title="Maîtrise">✦ {{ unit.mastery ?? 0 }}</span>
                </div>
                <p v-if="sk.baseText" class="unit-skill-desc">{{ sk.baseText }}</p>
                <p v-else-if="sk.fullText" class="unit-skill-desc">{{ sk.fullText }}</p>
                <p v-if="isSpecializedCollectionUnit(unit)" class="unit-spec-desc">
                  <strong>Spécialisation {{ String(unit.specialization).toUpperCase() }}</strong>
                  <template v-if="sk.specText">
                    <span class="unit-spec-dash"> — </span>{{ sk.specText }}
                  </template>
                </p>
              </div>
            </template>
            <div class="unit-stats unit-stats-collection">
              <span title="PV">❤ {{ unit.maxHp ?? unit.base_hp ?? '—' }}</span>
              <span title="Attaque">⚔ {{ unit.attack ?? unit.base_attack ?? '—' }}</span>
              <span title="Défense">🛡 {{ unit.defense ?? unit.base_defense ?? '—' }}</span>
              <span title="Vitesse">⚡ {{ (unit.fatigue ?? 0) > 0 ? effectiveSpeed(unit) : (unit.speed ?? unit.base_speed ?? '—') }}</span>
              <span v-if="(unit.fatigue ?? 0) > 0" class="speed-fatigue-hint" :title="'Vitesse réduite de ' + speedReductionPercent(unit) + '% en combat (fatigue)'"> (−{{ speedReductionPercent(unit) }}%)</span>
            </div>
            <div class="fatigue-row">
              <div class="fatigue-bar" :class="{ 'fatigue-red': (unit.fatigue ?? 0) > 50 }">
                <div class="fatigue-fill" :style="{ width: Math.min(100, (unit.fatigue ?? 0)) + '%' }" />
              </div>
              <span class="fatigue-pct-collection" :title="'Fatigue ' + (unit.fatigue ?? 0) + '%'">{{ unit.fatigue ?? 0 }}%</span>
              <span v-if="(unit.fatigue ?? 0) > 70" class="fatigue-icon" title="Fatigue élevée">⚠</span>
            </div>
            <div v-if="traitsList(unit).length" class="traits">{{ traitsList(unit).map(toTraitFr).join(', ') }}</div>
          </div>
            </div>
          </div>

          <div class="unit-column" id="distanceColumn">
            <h2 class="unit-column-title-enhanced">🏹 Distance <span class="unit-count-badge">{{ collectionDistance.length }}</span></h2>
            <div v-if="loading" class="loading">Chargement...</div>
            <div v-else class="unit-list" :class="'unit-list-' + viewMode" id="distanceUnits">
          <div
            v-for="unit in collectionDistance"
            :key="unit.user_unit_id"
            class="unit-card nx-card unit-card-clickable unit-card-collection"
            :class="[
              'rarity-' + (unit.rarity || 'common'),
              'element-' + (unit.element || 'neutral'),
              { 'fatigue-high': (unit.fatigue ?? 0) > 50 },
              { selected: selectedUnitId === unit.user_unit_id }
            ]"
            :title="collectionUnitHoverTitle(unit)"
            @click="addUnitToTeam(unit)"
          >
            <div class="rarity-bar" :class="'rarity-' + (unit.rarity || 'common')" aria-hidden="true" />
            <div class="unit-card-header">
              <div class="unit-name">{{ unit.name }}</div>
              <label class="favorite-checkbox" title="Favori" @click.stop>
                <input type="checkbox" :checked="favoriteIds.has(unit.user_unit_id)" @change="toggleFavorite(unit.user_unit_id)" />
                <span class="favorite-star">★</span>
              </label>
            </div>
            <div class="unit-meta">
              <span class="level">Niv.{{ unit.level ?? 1 }}</span>
              <span class="badge nx-badge power">P{{ unit.power_level ?? 1 }}</span>
              <span class="badge nx-badge element" :class="'element-' + (unit.element || 'neutral')">{{ elementLabel(unit.element) }}</span>
              <span class="badge nx-badge archetype" :class="archetypeClass(unit)">{{ archetypeLabel(unit) }}</span>
              <span v-if="(unit.ascension_count ?? 0) > 0" class="badge nx-badge ascended" title="Ascension">↑</span>
              <span v-if="unit.role" class="unit-role-tag" :title="unit.role">{{ unit.role }}</span>
            </div>
            <template v-for="sk in [unitSkillPanel(unit)]" :key="'sk-dist-' + unit.user_unit_id">
              <div class="unit-skill-block">
                <div class="unit-skill-panel-head">
                  <span class="unit-skill-panel-label">Compétence</span>
                  <span class="unit-mastery-tag" title="Maîtrise">✦ {{ unit.mastery ?? 0 }}</span>
                </div>
                <p v-if="sk.baseText" class="unit-skill-desc">{{ sk.baseText }}</p>
                <p v-else-if="sk.fullText" class="unit-skill-desc">{{ sk.fullText }}</p>
                <p v-if="isSpecializedCollectionUnit(unit)" class="unit-spec-desc">
                  <strong>Spécialisation {{ String(unit.specialization).toUpperCase() }}</strong>
                  <template v-if="sk.specText">
                    <span class="unit-spec-dash"> — </span>{{ sk.specText }}
                  </template>
                </p>
              </div>
            </template>
            <div class="unit-stats unit-stats-collection">
              <span title="PV">❤ {{ unit.maxHp ?? unit.base_hp ?? '—' }}</span>
              <span title="Attaque">⚔ {{ unit.attack ?? unit.base_attack ?? '—' }}</span>
              <span title="Défense">🛡 {{ unit.defense ?? unit.base_defense ?? '—' }}</span>
              <span title="Vitesse">⚡ {{ (unit.fatigue ?? 0) > 0 ? effectiveSpeed(unit) : (unit.speed ?? unit.base_speed ?? '—') }}</span>
              <span v-if="(unit.fatigue ?? 0) > 0" class="speed-fatigue-hint" :title="'Vitesse réduite de ' + speedReductionPercent(unit) + '% en combat (fatigue)'"> (−{{ speedReductionPercent(unit) }}%)</span>
            </div>
            <div class="fatigue-row">
              <div class="fatigue-bar" :class="{ 'fatigue-red': (unit.fatigue ?? 0) > 50 }">
                <div class="fatigue-fill" :style="{ width: Math.min(100, (unit.fatigue ?? 0)) + '%' }" />
              </div>
              <span class="fatigue-pct-collection" :title="'Fatigue ' + (unit.fatigue ?? 0) + '%'">{{ unit.fatigue ?? 0 }}%</span>
              <span v-if="(unit.fatigue ?? 0) > 70" class="fatigue-icon" title="Fatigue élevée">⚠</span>
            </div>
            <div v-if="traitsList(unit).length" class="traits">{{ traitsList(unit).map(toTraitFr).join(', ') }}</div>
          </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Preset Builder -->
      <div class="preset-column nexus-panel nx-panel builder-zone builder-zone-wrap" id="presetBuilder">
        <div class="builder-zone-halo" aria-hidden="true" />
        <div class="preset-builder-body">
        <div class="panel-header builder-header">
          <h2 class="panel-title nx-title">Équipe <span class="team-count">{{ teamUnits.length }}/{{ MAX_TEAM_UNITS }}</span></h2>
          <div class="power-badge power-badge-epic nx-glow-blue">
            <span class="label">POWER</span>
            <span class="value">{{ displayedPower.toLocaleString('fr-FR') }}</span>
          </div>
        </div>
        <div class="presets-row">
          <div class="preset-select-group">
            <select
              id="preset-select"
              v-model.number="selectedPresetIndex"
              class="nexus-select"
              @change="onPresetChange"
            >
              <template v-if="presetList.length === 0">
                <option :value="1">Nouveau preset</option>
              </template>
              <option v-else v-for="p in presetList" :key="p.preset_index" :value="p.preset_index">
                {{ (p.preset_name || '').trim() || ('Preset ' + p.preset_index) }}
              </option>
            </select>
          </div>
          <div class="preset-actions">
            <input
              v-model="presetNameForSelected"
              type="text"
              class="nexus-input preset-name-input"
              :placeholder="selectedPresetIndex != null ? 'Preset ' + selectedPresetIndex : 'Nom du preset'"
              maxlength="64"
              @blur="savePresetName(selectedPresetIndex!)"
            />
            <button
              type="button"
              class="nexus-btn primary nx-btn"
              :title="'Enregistrer les slots dans le preset ' + selectedPresetIndex"
              @click="overwritePreset(selectedPresetIndex!)"
            >
              Sauvegarder
            </button>
            <button
              v-if="selectedPresetIndex != null && presetList.some((p) => p.preset_index === selectedPresetIndex)"
              type="button"
              class="nexus-btn danger nx-btn nx-btn-danger nx-glow-red"
              :title="'Supprimer le preset ' + selectedPresetIndex"
              @click="deletePreset(selectedPresetIndex)"
            >
              Supprimer
            </button>
            <button
              v-if="presetList.length < PRESET_MAX"
              type="button"
              class="nexus-btn secondary nx-btn"
              title="Créer un nouveau preset"
              @click="createPreset"
            >
              Créer un Preset
            </button>
          </div>
        </div>
        <!-- dropMessage: affichage visuel désactivé, logique et console conservées -->
        <div class="slots-section">
          <div class="team-section-title">CAC</div>
          <div class="team-slots slots-row preset-row">
            <div
              v-for="(slot, idx) in frontSlots"
              :key="'f-' + idx + '-' + (slot?.user_unit_id ?? 'e')"
              class="team-slot preset-slot nx-slot slot slot-energy"
              :class="{ empty: !slot, 'slot-just-added': isSlotJustAdded('front', idx) }"
              @click="slot ? removeFromSlot('front', idx) : null"
            >
              <Transition name="slot-fill">
              <div
                v-if="slot"
                class="slot-unit slot-unit-clickable"
                :class="[
                  'rarity-' + (slot.rarity || 'common'),
                  { 'slot-unit-has-image': getUnitImageUrl(slot) }
                ]"
                :style="unitCardBgStyle(slot)"
                @mouseenter="hoveredTeamUnit = slot"
                @mouseleave="hoveredTeamUnit = null"
              >
                <span class="slot-name">{{ slot.name }}</span>
                <span class="slot-meta">
                  <span class="badge nx-badge element" :class="'element-' + (slot.element || 'neutral')">{{ elementLabel(slot.element) }}</span>
                  Niv.{{ slot.level }}
                  <span v-if="(slot.ascension_count ?? 0) > 0" class="badge nx-badge ascended">↑</span>
                </span>
                <div v-if="slotSkillSnippet(slot)" class="slot-skill-snippet" :title="unitSkillDisplayText(slot)">{{ slotSkillSnippet(slot) }}</div>
                <div class="slot-stats-compact" aria-label="Stats rapides">
                  <span title="PV">❤ {{ slot.maxHp ?? slot.base_hp ?? '—' }}</span>
                  <span title="Attaque">⚔ {{ slot.attack ?? slot.base_attack ?? '—' }}</span>
                  <span title="Défense">🛡 {{ slot.defense ?? slot.base_defense ?? '—' }}</span>
                  <span title="Vitesse">⚡ {{ (slot.fatigue ?? 0) > 0 ? effectiveSpeed(slot) : (slot.speed ?? slot.base_speed ?? '—') }}</span>
                  <span v-if="(slot.mastery ?? 0) > 0" title="Maîtrise">✦ {{ slot.mastery }}</span>
                </div>
                <div class="slot-fatigue">
                  <div class="fatigue-bar mini" :class="{ 'fatigue-red': (slot.fatigue ?? 0) > 50 }">
                    <div class="fatigue-fill" :style="{ width: Math.min(100, (slot.fatigue ?? 0)) + '%' }" />
                  </div>
                  <span class="slot-fatigue-pct" :title="'Fatigue ' + (slot.fatigue ?? 0) + '%'">{{ slot.fatigue ?? 0 }}%</span>
                  <span v-if="(slot.fatigue ?? 0) > 70" class="fatigue-icon">⚠</span>
                </div>
              </div>
              <div v-else class="slot-empty">—</div>
              </Transition>
            </div>
          </div>
        </div>
        <div class="slots-section">
          <div class="team-section-title">Distance</div>
          <div class="team-slots slots-row preset-row">
            <div
              v-for="(slot, idx) in backSlots"
              :key="'b-' + idx + '-' + (slot?.user_unit_id ?? 'e')"
              class="team-slot preset-slot nx-slot slot slot-energy"
              :class="{ empty: !slot, 'slot-just-added': isSlotJustAdded('back', idx) }"
              @click="slot ? removeFromSlot('back', idx) : null"
            >
              <Transition name="slot-fill">
              <div
                v-if="slot"
                class="slot-unit slot-unit-clickable"
                :class="[
                  'rarity-' + (slot.rarity || 'common'),
                  { 'slot-unit-has-image': getUnitImageUrl(slot) }
                ]"
                :style="unitCardBgStyle(slot)"
                @mouseenter="hoveredTeamUnit = slot"
                @mouseleave="hoveredTeamUnit = null"
              >
                <span class="slot-name">{{ slot.name }}</span>
                <span class="slot-meta">
                  <span class="badge nx-badge element" :class="'element-' + (slot.element || 'neutral')">{{ elementLabel(slot.element) }}</span>
                  Niv.{{ slot.level }}
                  <span v-if="(slot.ascension_count ?? 0) > 0" class="badge nx-badge ascended">↑</span>
                </span>
                <div v-if="slotSkillSnippet(slot)" class="slot-skill-snippet" :title="unitSkillDisplayText(slot)">{{ slotSkillSnippet(slot) }}</div>
                <div class="slot-stats-compact" aria-label="Stats rapides">
                  <span title="PV">❤ {{ slot.maxHp ?? slot.base_hp ?? '—' }}</span>
                  <span title="Attaque">⚔ {{ slot.attack ?? slot.base_attack ?? '—' }}</span>
                  <span title="Défense">🛡 {{ slot.defense ?? slot.base_defense ?? '—' }}</span>
                  <span title="Vitesse">⚡ {{ (slot.fatigue ?? 0) > 0 ? effectiveSpeed(slot) : (slot.speed ?? slot.base_speed ?? '—') }}</span>
                  <span v-if="(slot.mastery ?? 0) > 0" title="Maîtrise">✦ {{ slot.mastery }}</span>
                </div>
                <div class="slot-fatigue">
                  <div class="fatigue-bar mini" :class="{ 'fatigue-red': (slot.fatigue ?? 0) > 50 }">
                    <div class="fatigue-fill" :style="{ width: Math.min(100, (slot.fatigue ?? 0)) + '%' }" />
                  </div>
                  <span class="slot-fatigue-pct" :title="'Fatigue ' + (slot.fatigue ?? 0) + '%'">{{ slot.fatigue ?? 0 }}%</span>
                  <span v-if="(slot.fatigue ?? 0) > 70" class="fatigue-icon">⚠</span>
                </div>
              </div>
              <div v-else class="slot-empty">—</div>
              </Transition>
            </div>
          </div>
        </div>
        </div>

        <div
          v-if="hoveredTeamUnit"
          class="unit-tooltip"
          :class="{ 'unit-tooltip-has-image': getUnitImageUrl(hoveredTeamUnit) }"
          :style="unitCardBgStyle(hoveredTeamUnit)"
        >
          <div class="tooltip-title">
            {{ hoveredTeamUnit.name }} (Nv.{{ hoveredTeamUnit.level ?? 1 }})
          </div>
          <div class="tooltip-meta">
            {{ elementLabel(hoveredTeamUnit.element) }}
            · Fatigue {{ hoveredTeamUnit.fatigue ?? 0 }}%
            <span v-if="hoveredTeamUnit.specialization"> · Spé. {{ String(hoveredTeamUnit.specialization).toUpperCase() }}</span>
          </div>
          <div class="tooltip-stats">
            <div>PV max : {{ hoveredTeamUnit.maxHp ?? hoveredTeamUnit.base_hp ?? '—' }}</div>
            <div>ATQ : {{ hoveredTeamUnit.attack ?? hoveredTeamUnit.base_attack ?? '—' }}</div>
            <div>DEF : {{ hoveredTeamUnit.defense ?? hoveredTeamUnit.base_defense ?? '—' }}</div>
            <div>
              VIT : {{ (hoveredTeamUnit.fatigue ?? 0) > 0 ? effectiveSpeed(hoveredTeamUnit) : (hoveredTeamUnit.speed ?? hoveredTeamUnit.base_speed ?? '—')
              }}{{ (hoveredTeamUnit.fatigue ?? 0) > 0 ? ` (−${speedReductionPercent(hoveredTeamUnit)}% fatigue)` : '' }}
            </div>
            <div v-if="(hoveredTeamUnit.mastery ?? 0) > 0">Maîtrise : {{ hoveredTeamUnit.mastery }}</div>
          </div>
          <div v-if="traitsList(hoveredTeamUnit).length" class="tooltip-traits">
            Traits : {{ traitsList(hoveredTeamUnit).map(toTraitFr).join(', ') }}
          </div>
          <div v-if="hoveredUnitSkillPanel.baseText" class="tooltip-skill-block">
            <div class="tooltip-skill-label">Compétence</div>
            <div class="tooltip-skill">{{ hoveredUnitSkillPanel.baseText }}</div>
          </div>
          <div
            v-else-if="hoveredUnitSkillPanel.fullText"
            class="tooltip-skill-block"
          >
            <div class="tooltip-skill-label">Compétence</div>
            <div class="tooltip-skill">{{ hoveredUnitSkillPanel.fullText }}</div>
          </div>
          <div
            v-if="hoveredUnitSkillPanel.specText && hoveredTeamUnit.specialization"
            class="tooltip-spec-block"
          >
            <div class="tooltip-skill-label">Spécialisation {{ String(hoveredTeamUnit.specialization).toUpperCase() }}</div>
            <div class="tooltip-skill">{{ hoveredUnitSkillPanel.specText }}</div>
          </div>
        </div>

        <!-- Noyau actif (un seul par équipe) -->
        <div v-if="teamNoyaux.length > 0" class="noyau-block">
          <h3>Noyau actif</h3>
          <div class="noyau-options">
            <label class="noyau-option">
              <input type="radio" :value="0" v-model.number="selectedNoyauIndex" />
              <span>Aucun</span>
            </label>
            <label
              v-for="(n, idx) in teamNoyaux"
              :key="idx"
              class="noyau-option"
            >
              <input type="radio" :value="idx + 1" v-model.number="selectedNoyauIndex" />
              <span>{{ n.description }}</span>
            </label>
          </div>
        </div>

        <!-- Traits d'équipe : actifs mis en avant, puis grille complète -->
        <div class="traits-team-section">
          <h3 class="traits-section-title">Traits de l'équipe</h3>
          <div v-if="activeTeamTraits.length" class="traits-active-strip">
            <span class="traits-active-label">Actifs</span>
            <div class="traits-active-chips">
              <span
                v-for="trait in activeTeamTraits"
                :key="'a-' + trait.name"
                class="trait-chip-active"
                @mouseenter="onTraitCardEnter(trait.name, $event)"
                @mouseleave="hoveredTrait = null; hoveredTraitTarget = null"
                @click="onTraitCardEnter(trait.name, $event)"
              >
                {{ toTraitFr(trait.name) }}
                <span class="trait-chip-count">{{ trait.count }}</span>
              </span>
            </div>
          </div>
          <p v-else class="traits-none-hint">Aucun palier actif — ajoutez des unités partageant un trait.</p>
          <div class="traits-container">
            <div
              v-for="trait in traitsDisplayOrdered"
              :key="trait.name"
              class="trait-card"
              :class="[trait.frameTierClass, { 'trait-card-active': trait.isActive }]"
              @mouseenter="onTraitCardEnter(trait.name, $event)"
              @mouseleave="hoveredTrait = null; hoveredTraitTarget = null"
              @click="onTraitCardEnter(trait.name, $event)"
            >
              <span class="trait-card-content" :class="{ inactive: !trait.isActive, zero: trait.count === 0 }">
                <div class="trait-name">
                  {{ toTraitFr(trait.name) }}
                </div>
                <div class="trait-level">
                  {{ trait.progressNum }} / {{ trait.progressDen }}
                </div>
              </span>
            </div>
          </div>
        </div>

        <!-- Bulle d'info des traits (Teleport pour ne pas être coupée par le conteneur) -->
        <Teleport to="body">
          <Transition name="trait-tooltip-fade">
            <div
              v-if="hoveredTrait"
              class="trait-tooltip trait-tooltip-fixed"
              :style="traitTooltipStyle"
            >
              <div class="tooltip-title">
                {{ toTraitFr(hoveredTrait) }}
              </div>
              <div
                v-for="level of getTraitDetails(hoveredTrait).levels"
                :key="level"
                class="tooltip-level"
                :class="{ active: (traitDisplay.find(t => t.name === hoveredTrait)?.count ?? 0) >= level }"
              >
                {{ level }} unités :
                {{ getTraitDetails(hoveredTrait).effects[level] }}
              </div>
            </div>
          </Transition>
        </Teleport>

        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
        <p v-if="saved" class="saved">Équipe enregistrée.</p>
      </div>
    </div>

  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import api from '../api';
import {
  getUnitSkillDisplayText,
  getUnitSkillBaseText,
  getUnitSpecializationText,
  normalizeSkillDescription
} from '../utils/skillDescription';
import { getUnitImageUrl } from '../utils/unitImage';
import { toTraitFr, resolveTraitFromSearch } from '../utils/i18nFr';

const SLOT_COUNT = 5;
const MAX_TEAM_UNITS = 6;

type CollectionUnit = {
  user_unit_id: number;
  name: string;
  rarity: string;
  level: number;
  fatigue: number;
  power_level?: number;
  power_openings?: number;
  ascension_count?: number;
  specialization?: string | null;
  archetype: string;
  element?: string;
  traits?: string[] | unknown;
  role?: string;
  attack_type?: string;
  code?: string;
  base_hp?: number;
  base_attack?: number;
  base_defense?: number;
  base_speed?: number;
  maxHp?: number;
  attack?: number;
  defense?: number;
  speed?: number;
  mastery?: number;
  skill_data?: Record<string, unknown> | string | null;
  basic_targeting?: string;
  skill_targeting?: string;
};

/** Règles de focus (aligné avec le backend). */
const TARGETING_RULES = [
  'NO_FOCUS',
  'LOWEST_HP',
  'HIGHEST_HP',
  'LOWEST_PERCENT_HP',
  'HIGHEST_PERCENT_HP',
  'LOWEST_ATK',
  'HIGHEST_ATK',
  'LOWEST_DEF',
  'HIGHEST_DEF',
  'LOWEST_SPEED',
  'HIGHEST_SPEED',
  'MOST_BUFFS',
  'RANDOM'
];

/**
 * True si la compétence de l'unité a au moins un effet avec target ENEMY_SINGLE
 * (auquel cas le focus compétence du team builder est utilisé).
 */
function skillUsesEnemySingle(slot: CollectionUnit): boolean {
  const raw = slot.skill_data;
  if (raw == null) return false;
  const data = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
  if (!data || typeof data !== 'object') return false;
  let activeSkill: Record<string, unknown> | null = null;
  if (Array.isArray(data.skills) && data.skills.length > 0) {
    activeSkill = data.skills.find((s: Record<string, unknown>) => String(s?.type ?? '').toUpperCase() === 'ACTIVE') ?? null;
  } else if (data.skill && typeof data.skill === 'object') {
    activeSkill = data.skill as Record<string, unknown>;
  }
  if (!activeSkill || !Array.isArray(activeSkill.effects)) return false;
  return (activeSkill.effects as Record<string, unknown>[]).some(
    (e: Record<string, unknown>) => String(e?.target ?? '').toUpperCase() === 'ENEMY_SINGLE'
  );
}

/** Vitesse effective en combat (réduite par la fatigue). 1 fatigue = 1% de réduction. */
function effectiveSpeed(unit: { speed?: number; base_speed?: number; fatigue?: number }): number {
  const speed = unit.speed ?? unit.base_speed ?? 0;
  const fatigue = Math.min(100, Math.max(0, unit.fatigue ?? 0));
  const factor = 1 - 0.01 * fatigue;
  return Math.max(1, Math.round(speed * factor));
}

/** Pourcentage de réduction de vitesse par la fatigue (affichage). 1 fatigue = 1%. */
function speedReductionPercent(unit: { fatigue?: number }): number {
  return Math.min(100, Math.round(unit.fatigue ?? 0));
}

function targetingLabel(rule: string): string {
  const labels: Record<string, string> = {
    NO_FOCUS: 'Pas de focus',
    LOWEST_HP: 'PV les plus bas',
    HIGHEST_HP: 'PV les plus hauts',
    LOWEST_PERCENT_HP: '% PV le plus bas',
    HIGHEST_PERCENT_HP: '% PV le plus haut',
    LOWEST_ATK: 'ATQ la plus basse',
    HIGHEST_ATK: 'ATQ la plus haute',
    LOWEST_DEF: 'DEF la plus basse',
    HIGHEST_DEF: 'DEF la plus haute',
    LOWEST_SPEED: 'VIT la plus basse',
    HIGHEST_SPEED: 'VIT la plus haute',
    MOST_BUFFS: 'Plus de buffs',
    RANDOM: 'Aléatoire'
  };
  return labels[rule] ?? rule;
}

/**
 * power = (maxHp*0.25) + (attack*1.2) + (defense*1) + (speed*1.5) + (mastery*0.8)
 * Si ascended : power *= 1.15
 * power *= (1 - fatigue/200)
 */
function computeUnitPower(unit: CollectionUnit): number {
  const maxHp = unit.maxHp ?? unit.base_hp ?? 0;
  const attack = unit.attack ?? unit.base_attack ?? 0;
  const defense = unit.defense ?? unit.base_defense ?? 0;
  const speed = unit.speed ?? unit.base_speed ?? 0;
  const mastery = unit.mastery ?? 0;
  let power =
    maxHp * 0.25 +
    attack * 1.2 +
    defense * 1 +
    speed * 1.5 +
    mastery * 0.8;
  if ((unit.ascension_count ?? 0) > 0) power *= 1.15;
  const fatigue = Math.min(100, Math.max(0, unit.fatigue ?? 0));
  power *= 1 - fatigue / 200;
  return Math.round(power);
}

const loading = ref(true);
const collection = ref<CollectionUnit[]>([]);
const collectionMap = ref<Map<number, CollectionUnit>>(new Map());
const frontSlots = ref<(CollectionUnit | null)[]>(Array(SLOT_COUNT).fill(null));
const backSlots = ref<(CollectionUnit | null)[]>(Array(SLOT_COUNT).fill(null));
const dropMessage = ref('');
const dropMessageType = ref<'error' | 'ok'>('error');
const dropMessageTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const saved = ref(false);
const errorMessage = ref('');
const PRESET_MAX = 15;
interface PresetItem {
  preset_index: number;
  preset_name: string | null;
  front_slots: number[];
  back_slots: number[];
  selected_noyau_index?: number;
}
const presetList = ref<PresetItem[]>([]);
const selectedPresetIndex = ref<number | null>(1);
const presetNameForSelected = computed({
  get() {
    const idx = selectedPresetIndex.value;
    if (idx == null) return '';
    const p = presetList.value.find((x) => x.preset_index === idx);
    return (p?.preset_name ?? '') || '';
  },
  set(v: string) {
    const idx = selectedPresetIndex.value;
    if (idx == null) return;
    const p = presetList.value.find((x) => x.preset_index === idx);
    if (p) p.preset_name = v;
  }
});
/** Dernier preset sélectionné dans la liste (pour n'appeler loadPreset que lors d'un vrai changement, pas après un clic Sauvegarder). */
const lastSelectedPresetIndex = ref<number>(1);
/** Juste après une sauvegarde réussie : ne pas afficher d'erreur si le rechargement du même preset échoue (spurious @change). */
const justSavedPresetIndex = ref<number | null>(null);
/** Index du noyau actif : 0 = Aucun, 1+ = index dans teamNoyaux */
const selectedNoyauIndex = ref<number>(0);

const FAVORITES_KEY = 'nexus_team_favorites';
const favoriteIds = ref<Set<number>>(new Set());
const searchQuery = ref('');
const selectedEffectFilter = ref<string>('');
const selectedUnitId = ref<number | null>(null);
const showUnitsPanel = ref(true);
const lastAddedSlot = ref<{ row: 'front' | 'back'; idx: number } | null>(null);
const displayedPower = ref(0);
const viewMode = ref<'grid' | 'list'>('grid');

function isSlotJustAdded(row: 'front' | 'back', idx: number): boolean {
  const s = lastAddedSlot.value;
  return s !== null && s.row === row && s.idx === idx;
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as number[];
      favoriteIds.value = new Set(Array.isArray(arr) ? arr.filter((x) => Number.isInteger(x)) : []);
    }
  } catch {
    favoriteIds.value = new Set();
  }
}

function toggleFavorite(userUnitId: number) {
  const next = new Set(favoriteIds.value);
  if (next.has(userUnitId)) next.delete(userUnitId);
  else next.add(userUnitId);
  favoriteIds.value = next;
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
}

function traitsList(unit: CollectionUnit): string[] {
  const t = unit.traits;
  if (Array.isArray(t)) return t as string[];
  if (typeof t === 'string') try { return JSON.parse(t) as string[]; } catch { return []; }
  return [];
}

/** Options pour le filtre déroulant buff/débuff/effet (clé → libellé FR). */
const EFFECT_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'DOT', label: 'DOT (dégâts dans le temps)' },
  { value: 'REGEN', label: 'Régénération' },
  { value: 'HEAL', label: 'Soin' },
  { value: 'ATK_UP', label: 'Bonus attaque' },
  { value: 'ATK_DOWN', label: 'Malus attaque' },
  { value: 'DEF_UP', label: 'Bonus défense' },
  { value: 'DEF_DOWN', label: 'Malus défense' },
  { value: 'SPEED_UP', label: 'Bonus vitesse' },
  { value: 'SPD_UP', label: 'Bonus vitesse (SPD)' },
  { value: 'SLOW', label: 'Ralentissement' },
  { value: 'SPEED_DOWN', label: 'Malus vitesse' },
  { value: 'SHIELD', label: 'Bouclier' },
  { value: 'IMMUNITY', label: 'Immunité' },
  { value: 'STUN', label: 'Étourdissement' },
  { value: 'SILENCE', label: 'Silence' },
  { value: 'BLIND', label: 'Aveuglement' },
  { value: 'PROVOKE', label: 'Provocation' },
  { value: 'ANTI_HEAL', label: 'Anti-soin' },
  { value: 'ANTI_SHIELD', label: 'Anti-bouclier' },
  { value: 'ANTI_BUFF', label: 'Anti-buff' },
  { value: 'ATB_UP', label: 'Bonus ATB' },
  { value: 'ATB_DOWN', label: 'Malus ATB' },
  { value: 'DEFEND', label: 'Protection' },
  { value: 'SPEED', label: 'Vitesse (générique)' }
];

/** Extrait les types de buff/debuff que l'unité peut appliquer (compétences + passifs). */
function getUnitBuffDebuffTypes(unit: CollectionUnit): Set<string> {
  const out = new Set<string>();
  const raw = unit.skill_data;
  if (raw == null) return out;
  const data = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
  if (!data || typeof data !== 'object') return out;

  function collectFromEffects(effects: unknown[]) {
    if (!Array.isArray(effects)) return;
    for (const e of effects) {
      if (!e || typeof e !== 'object') continue;
      const eff = e as Record<string, unknown>;
      const type = String(eff.type ?? '').toUpperCase();
      if (type === 'APPLY_BUFF') {
        const bt = String(eff.buffType ?? eff.buff ?? '').toUpperCase();
        if (bt && bt !== 'APPLY_BUFF') out.add(bt);
      } else if (type === 'APPLY_DEBUFF') {
        const dt = String(eff.debuffType ?? eff.debuff ?? eff.buffType ?? eff.buff ?? '').toUpperCase();
        if (dt && dt !== 'APPLY_DEBUFF') out.add(dt);
      } else if (type === 'HEAL' || type === 'HEALS') {
        out.add('HEAL');
      }
    }
  }

  const skills = Array.isArray(data.skills) ? data.skills : [];
  for (const s of skills) {
    if (s && typeof s === 'object' && Array.isArray((s as Record<string, unknown>).effects)) {
      collectFromEffects((s as Record<string, unknown>).effects as unknown[]);
    }
  }
  if (data.skill && typeof data.skill === 'object' && Array.isArray((data.skill as Record<string, unknown>).effects)) {
    collectFromEffects((data.skill as Record<string, unknown>).effects as unknown[]);
  }
  if (data.basic && typeof data.basic === 'object' && Array.isArray((data.basic as Record<string, unknown>).effects)) {
    collectFromEffects((data.basic as Record<string, unknown>).effects as unknown[]);
  }
  return out;
}

function elementLabel(el: string | undefined): string {
  const map: Record<string, string> = { water: 'Eau', fire: 'Feu', plant: 'Plante', light: 'Lumière', dark: 'Ténèbres', neutral: 'Neutre' };
  return map[(el || 'neutral').toLowerCase()] || el || '—';
}

function archetypeLabel(unit: CollectionUnit): string {
  const a = (unit.archetype || '').toUpperCase();
  return a === 'CAC_TANK' || a === 'CAC_DPS' ? 'CAC' : 'Distance';
}

function archetypeClass(unit: CollectionUnit): string {
  const a = (unit.archetype || '').toUpperCase();
  return a === 'CAC_TANK' || a === 'CAC_DPS' ? 'archetype-cac' : 'archetype-distance';
}

function parseSkillData(skillData: CollectionUnit['skill_data']): Record<string, unknown> | null {
  if (skillData == null) return null;
  if (typeof skillData === 'object') return skillData as Record<string, unknown>;
  if (typeof skillData === 'string') {
    try { return JSON.parse(skillData) as Record<string, unknown>; } catch { return null; }
  }
  return null;
}

/** Texte compétence : entrées skills[] + spé A/B si besoin (pas description.skill générique). */
function unitSkillDisplayText(unit: CollectionUnit): string {
  const data = parseSkillData(unit.skill_data);
  return getUnitSkillDisplayText(data, unit.specialization ?? null);
}

type UnitSkillPanel = { baseText: string; fullText: string; specText: string };

/** Base + spé séparées pour l’affichage (évite de dupliquer la ligne spé). */
function unitSkillPanel(unit: CollectionUnit): UnitSkillPanel {
  const data = parseSkillData(unit.skill_data);
  const spec = unit.specialization ?? null;
  const baseText = data ? getUnitSkillBaseText(data) : '';
  const fullText = data ? getUnitSkillDisplayText(data, null) : '';
  const specText = data ? getUnitSpecializationText(data, spec) : '';
  return { baseText, fullText, specText };
}

/** Une ligne pour les slots preset (texte complet au survol / tooltip). */
function slotSkillSnippet(unit: CollectionUnit): string {
  const t = unitSkillDisplayText(unit).replace(/\s*\n+\s*/g, ' ').trim();
  if (!t) return '';
  const max = 96;
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function unitTooltip(unit: CollectionUnit): string {
  const parts = [unit.name, `Niv.${unit.level ?? 1}`, `P${unit.power_level ?? 1}`, archetypeLabel(unit), unit.role ?? ''];
  const traits = traitsList(unit);
  if (traits.length) parts.push('Traits: ' + traits.map(toTraitFr).join(', '));
  if ((unit.fatigue ?? 0) > 50) parts.push('Fatigue élevée (XP /2)');
  return parts.filter(Boolean).join(' · ');
}

/** Unité avec choix de branche A/B (affiche la ligne spé même si le texte spec est vide). */
function isSpecializedCollectionUnit(unit: CollectionUnit): boolean {
  const s = String(unit.specialization ?? '').trim().toUpperCase();
  return s === 'A' || s === 'B';
}

/** Tooltip au survol : description complète compétence + spécialisation si applicable. */
function collectionUnitHoverTitle(unit: CollectionUnit): string {
  const sk = unitSkillPanel(unit);
  const lines: string[] = [];
  const skillBody = sk.baseText || sk.fullText;
  if (skillBody) lines.push('Compétence : ' + skillBody);
  if (isSpecializedCollectionUnit(unit)) {
    const specLabel = 'Spécialisation ' + String(unit.specialization).toUpperCase();
    lines.push(sk.specText ? specLabel + ' : ' + sk.specText : specLabel);
  }
  return lines.length ? lines.join('\n\n') : unitTooltip(unit);
}

function unitCardBgStyle(unit: CollectionUnit): Record<string, string> {
  const url = getUnitImageUrl(unit);
  if (!url) return {};
  return {
    '--unit-bg-image': `url(${url})`
  };
}

function setDropMessage(msg: string, type: 'error' | 'ok') {
  if (dropMessageTimer.value) clearTimeout(dropMessageTimer.value);
  dropMessage.value = msg;
  dropMessageType.value = type;
  console.log(`[TeamBuilder] ${type}:`, msg);
  dropMessageTimer.value = setTimeout(() => {
    dropMessage.value = '';
    dropMessageTimer.value = null;
  }, 2500);
}

function canPlaceInFront(unit: CollectionUnit): boolean {
  const a = (unit.archetype || '').toUpperCase();
  return a === 'CAC_TANK' || a === 'CAC_DPS';
}

function canPlaceInBack(unit: CollectionUnit): boolean {
  return String(unit.archetype || '').toUpperCase().startsWith('DISTANCE');
}

/** Clic sur une unité de la collection : l'ajouter dans la première case disponible (front ou back selon archétype). */
function addUnitToTeam(unit: CollectionUnit) {
  if (teamUnitIds.value.has(unit.user_unit_id)) {
    setDropMessage('Cette unité est déjà dans l\'équipe.', 'error');
    return;
  }
  if (teamUnits.value.length >= MAX_TEAM_UNITS) {
    setDropMessage(`Maximum ${MAX_TEAM_UNITS} unités dans l'équipe.`, 'error');
    return;
  }
  selectedUnitId.value = unit.user_unit_id;
  setTimeout(() => { selectedUnitId.value = null; }, 150);

  if (canPlaceInFront(unit)) {
    const idx = frontSlots.value.findIndex((s) => !s);
    if (idx === -1) {
      setDropMessage('Ligne Front (CAC) complète.', 'error');
      return;
    }
    frontSlots.value = frontSlots.value.map((s, i) => (i === idx ? unit : s));
    lastAddedSlot.value = { row: 'front', idx };
    setTimeout(() => { lastAddedSlot.value = null; }, 400);
    setDropMessage(unit.name + ' ajouté (Front).', 'ok');
    nextTick(() => window.dispatchEvent(new Event('resize')));
    return;
  }
  if (canPlaceInBack(unit)) {
    const idx = backSlots.value.findIndex((s) => !s);
    if (idx === -1) {
      setDropMessage('Ligne Back (Distance) complète.', 'error');
      return;
    }
    backSlots.value = backSlots.value.map((s, i) => (i === idx ? unit : s));
    lastAddedSlot.value = { row: 'back', idx };
    setTimeout(() => { lastAddedSlot.value = null; }, 400);
    setDropMessage(unit.name + ' ajouté (Back).', 'ok');
    nextTick(() => window.dispatchEvent(new Event('resize')));
    return;
  }
  setDropMessage('Type d\'unité non géré (CAC ou Distance).', 'error');
}

/** Clic sur une unité dans l'équipe : la retirer du preset. */
function removeFromSlot(row: 'front' | 'back', idx: number) {
  if (row === 'front') {
    frontSlots.value = frontSlots.value.map((s, i) => (i === idx ? null : s));
  } else {
    backSlots.value = backSlots.value.map((s, i) => (i === idx ? null : s));
  }
  setDropMessage('Unité retirée.', 'ok');
  nextTick(() => window.dispatchEvent(new Event('resize')));
}

/** Sauvegarde du focus (attaque ou skill) pour une unité. */
async function saveTargeting(slot: CollectionUnit, field: 'basic_targeting' | 'skill_targeting', value: string) {
  const payload = field === 'basic_targeting' ? { basic_targeting: value } : { skill_targeting: value };
  try {
    await api.patch(`/team/user-units/${slot.user_unit_id}/targeting`, payload);
    slot[field] = value;
    const col = collectionMap.value.get(slot.user_unit_id);
    if (col) col[field] = value;
    errorMessage.value = '';
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { message?: string; error?: string }; status?: number }; message?: string };
    const data = ax?.response?.data;
    const status = ax?.response?.status;
    if (data?.message) {
      errorMessage.value = data.message;
    } else if (status === 401) {
      errorMessage.value = 'Session expirée, reconnectez-vous.';
    } else if (status === 404) {
      errorMessage.value = 'Unité introuvable.';
    } else {
      errorMessage.value = (ax?.message as string) || 'Erreur sauvegarde focus';
    }
  }
}

const teamUnits = computed(() => {
  const list: CollectionUnit[] = [];
  for (const u of frontSlots.value) if (u) list.push(u);
  for (const u of backSlots.value) if (u) list.push(u);
  return list;
});

const teamUnitIds = computed(() => new Set(teamUnits.value.map((u) => u.user_unit_id)));

/** Noyaux distincts (par description) des unités de l'équipe */
const teamNoyaux = computed(() => {
  const seen = new Set<string>();
  const out: { description: string }[] = [];
  for (const unit of teamUnits.value) {
    const data = unit.skill_data;
    const noyau = data && typeof data === 'object' && data !== null && 'noyau' in data
      ? (data as { noyau?: { description?: string } }).noyau
      : null;
    if (!noyau || typeof noyau !== 'object' || !noyau.description) continue;
    const desc = normalizeSkillDescription(String(noyau.description));
    if (!desc || seen.has(desc)) continue;
    seen.add(desc);
    out.push({ description: desc });
  }
  return out;
});

const collectionNotInTeam = computed(() =>
  collection.value.filter((u) => !teamUnitIds.value.has(u.user_unit_id))
);

/** Collection hors équipe avec favoris en tête. */
const collectionNotInTeamSorted = computed(() => {
  const list = collectionNotInTeam.value;
  const fav: CollectionUnit[] = [];
  const rest: CollectionUnit[] = [];
  for (const u of list) {
    if (favoriteIds.value.has(u.user_unit_id)) fav.push(u);
    else rest.push(u);
  }
  return [...fav, ...rest];
});

/** Collection filtrée par la barre de recherche (nom, élément, trait FR) et par le filtre effet (liste déroulante). */
const collectionFiltered = computed(() => {
  let list = collectionNotInTeamSorted.value;

  // Filtre par effet (buff/débuff) via la liste déroulante
  const effectFilter = selectedEffectFilter.value.trim();
  if (effectFilter) {
    list = list.filter((u) => getUnitBuffDebuffTypes(u).has(effectFilter));
  }

  // Filtre par recherche texte (nom, élément, trait)
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return list;
  const traitKeyFromFr = resolveTraitFromSearch(q);
  return list.filter((u) => {
    const nameMatch = (u.name || '').toLowerCase().includes(q);
    const elementMatch = (elementLabel(u.element) || '').toLowerCase().includes(q) || (u.element || '').toLowerCase().includes(q);
    const traits = traitsList(u);
    const traitMatch =
      (traitKeyFromFr && traits.includes(traitKeyFromFr)) ||
      traits.some((t) => t.toLowerCase().includes(q)) ||
      traits.some((t) => toTraitFr(t).toLowerCase().includes(q));
    return nameMatch || elementMatch || traitMatch;
  });
});

/** Unités CAC (hors équipe, filtrées) — pour la colonne CAC. */
const collectionCAC = computed(() =>
  collectionFiltered.value.filter((u) => canPlaceInFront(u))
);

/** Unités Distance (hors équipe, filtrées) — pour la colonne Distance. */
const collectionDistance = computed(() =>
  collectionFiltered.value.filter((u) => canPlaceInBack(u))
);

const totalPower = computed(() => {
  return teamUnits.value.reduce((sum, u) => sum + computeUnitPower(u), 0);
});

/** Animation compteur POWER (watch après totalPower pour éviter "before initialization") */
watch(totalPower, (next) => {
  const from = displayedPower.value;
  const to = Math.round(next);
  if (from === to) return;
  const duration = 400;
  const start = performance.now();
  function tick(now: number) {
    const elapsed = now - start;
    const t = Math.min(1, elapsed / duration);
    const easeOut = 1 - (1 - t) * (1 - t);
    displayedPower.value = Math.round(from + (to - from) * easeOut);
    if (t < 1) requestAnimationFrame(tick);
    else displayedPower.value = to;
  }
  requestAnimationFrame(tick);
}, { immediate: true });

const averageFatigue = computed(() => {
  const units = teamUnits.value;
  if (!units.length) return 0;
  const sum = units.reduce((s, u) => s + (u.fatigue ?? 0), 0);
  return sum / units.length;
});

const activeSynergies = computed(() => {
  const counts = new Map<string, number>();
  for (const u of teamUnits.value) {
    for (const t of traitsList(u)) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  const levels: Record<string, number> = {};
  for (const [trait, count] of counts.entries()) {
    let lvl = 0;
    if (count >= 6) lvl = 6;
    else if (count >= 4) lvl = 4;
    else if (count >= 2) lvl = 2;
    if (lvl > 0) levels[trait] = lvl;
  }
  return levels;
});

type SynergyTier = { level: number; effect: string };

const SYNERGY_TIERS: Record<string, SynergyTier[]> = {
  GUARDIANS: [
    {
      level: 2,
      effect: 'Toute l’équipe gagne 10 % de Défense en plus pour toute la durée du combat.'
    },
    {
      level: 4,
      effect: 'Au début du combat, chaque unité en première ligne reçoit un bouclier égal à 12 % de ses PV max.'
    },
    {
      level: 6,
      effect: 'Les dégâts subis par l’équipe sont réduits de 10 % jusqu’à la fin du combat.'
    }
  ],
  BERSERKERS: [
    {
      level: 2,
      effect: 'L’attaque de toute l’équipe est augmentée de 10 % pour la durée du combat.'
    },
    {
      level: 4,
      effect: 'Lorsqu’un Berserker inflige des dégâts, il récupère immédiatement 5 % de ces dégâts en PV.'
    },
    {
      level: 6,
      effect: 'Après avoir utilisé une compétence, le Berserker voit sa prochaine attaque de base infliger 50 % de dégâts en plus ; l’effet ne s’applique qu’une fois par compétence.'
    }
  ],
  EXECUTIONERS: [
    {
      level: 2,
      effect: 'Les Bourreaux infligent 10 % de dégâts en plus aux ennemis dont les PV sont déjà sous la moitié.'
    },
    {
      level: 4,
      effect: 'Sur les ennemis à moins de 30 % de leurs PV, les dégâts des Bourreaux sont encore augmentés, pour environ 32 % de bonus au total.'
    },
    {
      level: 6,
      effect: 'Chaque fois qu’un Bourreau met un ennemi K.O., il gagne 40 points d’ATB.'
    }
  ],
  ARCANISTS: [
    {
      level: 2,
      effect: 'La Maîtrise de toute l’équipe est augmentée de 10 % pour le combat.'
    },
    {
      level: 4,
      effect: 'Chaque fois qu’un Arcaniste utilise une compétence, il se protège avec un bouclier valant 8 % de ses PV max.'
    },
    {
      level: 6,
      effect: 'Le temps de recharge de toutes les compétences de l’équipe est réduit d’une action, sans jamais descendre en dessous d’une action.'
    }
  ],
  DRUIDS: [
    {
      level: 2,
      effect: 'L’équipe bénéficie de 5 % de PV max en plus et commence le combat avec la barre de vie à ce nouveau maximum.'
    },
    {
      level: 4,
      effect: 'À la fin de chacune de ses actions, le Druide se soigne pour 3 % de ses PV max.'
    },
    {
      level: 6,
      effect: 'Toutes les deux actions d’une unité alliée, un de ses malus est dissipé en priorité : cécité, silence, ralentissement, anti-soin, anti-bouclier, etc.'
    }
  ],
  TACTICIANS: [
    {
      level: 2,
      effect: 'La Vitesse de toute l’équipe est augmentée de 5 % pour le combat.'
    },
    {
      level: 4,
      effect: 'Dès qu’un allié joue sa toute première action de la bataille, l’unité la plus lente de votre équipe (encore en vie) reçoit 30 points d’ATB. Une seule fois par combat.'
    },
    {
      level: 6,
      effect: 'Au tout début du combat, avant le premier tour, chaque membre de l’équipe reçoit 20 points d’ATB en bonus.'
    }
  ]
};

function synergyTiersFor(trait: string, level: number): SynergyTier[] {
  const tiers = SYNERGY_TIERS[trait] || [];
  return tiers.filter((t) => t.level <= level);
}

/** Config des traits : paliers et effets (pour tooltip et affichage) */
const TRAIT_CONFIG: Record<string, { levels: number[]; effects: Record<number, string> }> = {};
for (const trait of Object.keys(SYNERGY_TIERS)) {
  const tiers = SYNERGY_TIERS[trait] || [];
  const levels = tiers.map((t) => t.level).sort((a, b) => a - b);
  const effects: Record<number, string> = {};
  for (const t of tiers) effects[t.level] = t.effect;
  TRAIT_CONFIG[trait] = { levels, effects };
}

function getTraitDetails(traitName: string): { name: string; levels: number[]; effects: Record<number, string> } {
  const config = TRAIT_CONFIG[traitName];
  if (!config) return { name: traitName, levels: [], effects: {} };
  return {
    name: traitName,
    levels: config.levels,
    effects: config.effects
  };
}

/** Tous les traits du jeu (clés de SYNERGY_TIERS) */
const ALL_TRAITS = Object.keys(SYNERGY_TIERS);

/** Compte des traits présents dans l'équipe */
const traitCounts = computed(() => {
  const counts: Record<string, number> = {};
  for (const unit of teamUnits.value) {
    for (const trait of traitsList(unit)) {
      counts[trait] = (counts[trait] || 0) + 1;
    }
  }
  return counts;
});

const hoveredTrait = ref<string | null>(null);
const hoveredTraitTarget = ref<HTMLElement | null>(null);
const hoveredTeamUnit = ref<CollectionUnit | null>(null);

const hoveredUnitSkillPanel = computed((): UnitSkillPanel => {
  const u = hoveredTeamUnit.value;
  if (!u) return { baseText: '', fullText: '', specText: '' };
  return unitSkillPanel(u);
});

function onTraitCardEnter(traitName: string, e: MouseEvent) {
  hoveredTrait.value = traitName;
  hoveredTraitTarget.value = e.currentTarget as HTMLElement;
}

/** Style de position pour la bulle trait (évite d'être coupée, reste dans l'écran sur mobile) */
const traitTooltipStyle = computed(() => {
  const el = hoveredTraitTarget.value;
  if (!el) return {};
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const padding = 12;
  const tooltipWidth = Math.min(320, vw - padding * 2);

  // Horizontal : centrer sur l'élément mais rester dans la viewport
  const centerX = rect.left + rect.width / 2;
  const minCenter = padding + tooltipWidth / 2;
  const maxCenter = vw - padding - tooltipWidth / 2;
  const left = Math.max(minCenter, Math.min(maxCenter, centerX));

  // Vertical : au-dessus par défaut, en dessous si pas assez de place en haut
  const estimatedHeight = 150;
  const spaceAbove = rect.top;
  const spaceBelow = vh - rect.bottom;
  const above = spaceAbove >= estimatedHeight || spaceAbove >= spaceBelow;
  const style: Record<string, string> = {
    position: 'fixed',
    left: `${left}px`,
    transform: 'translateX(-50%)',
    maxWidth: `calc(100vw - ${padding * 2}px)`
  };
  if (above) {
    // Ne pas dépasser le haut de l'écran (top >= padding)
    const desiredBottom = vh - rect.top + 10;
    const maxBottom = vh - estimatedHeight - padding;
    style.bottom = `${Math.min(desiredBottom, maxBottom)}px`;
  } else {
    style.top = `${rect.bottom + 10}px`;
  }
  return style;
});

/** Progression affichée : 0/2, 1/2 → 2/4, 3/4 → 4/6, 5/6, 6/6 (prochain palier de synergie). */
function traitProgressFraction(count: number): { num: number; den: number } {
  const c = Math.max(0, Math.min(6, count));
  if (c < 2) return { num: c, den: 2 };
  if (c < 4) return { num: c, den: 4 };
  return { num: c, den: 6 };
}

/** Cadre coloré selon le plus haut palier atteint : 2 vert, 4 bleu, 6 jaune. */
function traitFrameTierClass(count: number): string {
  if (count >= 6) return 'trait-frame-tier-6';
  if (count >= 4) return 'trait-frame-tier-4';
  if (count >= 2) return 'trait-frame-tier-2';
  return 'trait-frame-tier-0';
}

/** Liste affichable : tous les traits avec count, paliers et statut actif */
const traitDisplay = computed(() => {
  const counts = traitCounts.value;
  return ALL_TRAITS.map((trait) => {
    const tiers = SYNERGY_TIERS[trait] || [];
    const thresholds = tiers.map((t) => t.level).sort((a, b) => a - b);
    const count = counts[trait] || 0;
    const firstThreshold = thresholds[0] ?? 0;
    const isActive = count >= firstThreshold;
    const { num, den } = traitProgressFraction(count);
    return {
      name: trait,
      count,
      thresholds,
      isActive,
      progressNum: num,
      progressDen: den,
      frameTierClass: traitFrameTierClass(count)
    };
  });
});

/** Traits dont l'équipe a au moins un palier actif (lisibles en un coup d'œil). */
const activeTeamTraits = computed(() =>
  traitDisplay.value.filter((t) => t.isActive && t.count > 0)
);

/** Grille des traits : actifs en premier, puis par nom. */
const traitsDisplayOrdered = computed(() => {
  const list = [...traitDisplay.value];
  list.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return toTraitFr(a.name).localeCompare(toTraitFr(b.name), 'fr');
  });
  return list;
});

async function loadCollection() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const { data } = await api.get('/collection');
    type Row = Record<string, unknown> & { user_unit_id?: unknown; level?: unknown; fatigue?: unknown; ascension_count?: unknown };
    const units = (data.units || []).map((u: Record<string, unknown>): Row => ({
      ...u,
      user_unit_id: Number(u.user_unit_id),
      level: Number(u.level ?? 1),
      fatigue: Number(u.fatigue ?? 0),
      ascension_count: Number(u.ascension_count ?? 0)
    }));
    units.sort((a: Row, b: Row) => (Number(b.level ?? 1)) - (Number(a.level ?? 1)));
    collection.value = units;
    const map = new Map<number, CollectionUnit>();
    for (const u of units) map.set(u.user_unit_id, u);
    collectionMap.value = map;
  } catch (err: unknown) {
    const ax = err as { response?: { status?: number; data?: { message?: string } } };
    const msg = ax?.response?.data?.message || (ax?.response?.status === 503 ? 'Service temporairement indisponible.' : 'Impossible de charger la collection.');
    errorMessage.value = msg;
    collection.value = [];
    collectionMap.value = new Map();
  } finally {
    loading.value = false;
  }
}

async function loadTeam() {
  try {
    const { data } = await api.get('/team');
    const front = (data.frontlineSlots || []).slice(0, SLOT_COUNT);
    const back = (data.backlineSlots || []).slice(0, SLOT_COUNT);
    const map = collectionMap.value;
    const pad = <T>(arr: T[], len: number): (T | null)[] =>
      [...arr, ...Array(Math.max(0, len - arr.length)).fill(null)].slice(0, len);
    frontSlots.value = pad(front.map((id: number) => map.get(id) ?? null), SLOT_COUNT);
    backSlots.value = pad(back.map((id: number) => map.get(id) ?? null), SLOT_COUNT);
  } catch {
    frontSlots.value = Array(SLOT_COUNT).fill(null);
    backSlots.value = Array(SLOT_COUNT).fill(null);
  }
}

/** Charge les unités d'un preset dans le builder (clear + inject). À appeler une fois la collection chargée. */
function loadPresetIntoBuilder(presetIndex: number, presets: { preset_index: number; front_slots?: number[]; back_slots?: number[]; selected_noyau_index?: number }[]) {
  const p = presets.find((x) => x.preset_index === presetIndex);
  const map = collectionMap.value;
  if (!map.size) return;
  const frontIds = (p?.front_slots || []).slice(0, SLOT_COUNT);
  const backIds = (p?.back_slots || []).slice(0, SLOT_COUNT);
  frontSlots.value = [...frontIds.map((id: number) => map.get(id) ?? null), ...Array(Math.max(0, SLOT_COUNT - frontIds.length)).fill(null)].slice(0, SLOT_COUNT);
  backSlots.value = [...backIds.map((id: number) => map.get(id) ?? null), ...Array(Math.max(0, SLOT_COUNT - backIds.length)).fill(null)].slice(0, SLOT_COUNT);
  selectedNoyauIndex.value = (p && typeof p.selected_noyau_index === 'number')
    ? Math.max(0, p.selected_noyau_index)
    : 0;
}

async function loadPreset(index: number) {
  const list = presetList.value;
  const p = list.find((x) => x.preset_index === index);
  if (!p) {
    frontSlots.value = Array(SLOT_COUNT).fill(null);
    backSlots.value = Array(SLOT_COUNT).fill(null);
    setDropMessage('Nouveau preset (vide).', 'ok');
    return;
  }
  try {
    loadPresetIntoBuilder(index, list);
    const frontIds = (p?.front_slots || []).slice(0, SLOT_COUNT);
    const backIds = (p?.back_slots || []).slice(0, SLOT_COUNT);
    setDropMessage(frontIds.length || backIds.length ? 'Preset ' + index + ' chargé.' : 'Preset ' + index + ' (vide) chargé.', 'ok');
  } catch {
    if (justSavedPresetIndex.value === index) {
      justSavedPresetIndex.value = null;
      return;
    }
    setDropMessage('Impossible de charger le preset.', 'error');
  }
}

function onPresetChange() {
  const idx = selectedPresetIndex.value;
  if (idx == null || idx < 1 || idx > PRESET_MAX) return;
  if (idx === lastSelectedPresetIndex.value) return;
  lastSelectedPresetIndex.value = idx;
  loadPreset(idx);
}

async function refetchPresets() {
  try {
    const { data } = await api.get('/team/presets');
    presetList.value = (data.presets || []).map((p: PresetItem) => ({
      preset_index: p.preset_index,
      preset_name: p.preset_name ?? null,
      front_slots: p.front_slots || [],
      back_slots: p.back_slots || [],
      selected_noyau_index: p.selected_noyau_index ?? 0
    }));
  } catch {
    presetList.value = [];
  }
}

function savePresetName(index: number) {
  const p = presetList.value.find((x) => x.preset_index === index);
  const name = ((p?.preset_name ?? '') || '').trim().slice(0, 64);
  api.patch(`/team/presets/${index}`, { preset_name: name || null }).catch(() => setDropMessage('Erreur sauvegarde du nom.', 'error'));
}

function overwritePreset(index: number) {
  const front = frontSlots.value.map((u) => u?.user_unit_id).filter((id): id is number => id != null);
  const back = backSlots.value.map((u) => u?.user_unit_id).filter((id): id is number => id != null);
  const p = presetList.value.find((x) => x.preset_index === index);
  const name = ((p?.preset_name ?? '') || '').trim().slice(0, 64) || null;
  api.post('/team/presets/save', { preset_index: index, preset_name: name, front_slots: front, back_slots: back, selected_noyau_index: selectedNoyauIndex.value }).then(() => {
    setDropMessage('Preset ' + index + ' mis à jour.', 'ok');
    justSavedPresetIndex.value = index;
    refetchPresets();
    setTimeout(() => { justSavedPresetIndex.value = null; }, 800);
  }).catch(() => setDropMessage('Erreur sauvegarde preset.', 'error'));
}

async function deletePreset(index: number) {
  const idx = index;
  const wasSelected = selectedPresetIndex.value === idx;
  try {
    await api.delete(`/team/presets/${idx}`);
    await refetchPresets();
    if (wasSelected) {
      frontSlots.value = Array(SLOT_COUNT).fill(null);
      backSlots.value = Array(SLOT_COUNT).fill(null);
      if (presetList.value.length > 0) {
        selectedPresetIndex.value = presetList.value[0].preset_index;
        lastSelectedPresetIndex.value = selectedPresetIndex.value;
        loadPresetIntoBuilder(selectedPresetIndex.value, presetList.value);
      } else {
        selectedPresetIndex.value = 1;
        lastSelectedPresetIndex.value = 1;
      }
    }
    setDropMessage('Preset ' + idx + ' supprimé.', 'ok');
  } catch {
    setDropMessage('Erreur suppression preset.', 'error');
  }
}

async function createPreset() {
  const used = new Set(presetList.value.map((p) => p.preset_index));
  let nextIndex = 1;
  for (let i = 1; i <= PRESET_MAX; i++) {
    if (!used.has(i)) {
      nextIndex = i;
      break;
    }
  }
  try {
    await api.post('/team/presets/save', {
      preset_index: nextIndex,
      preset_name: null,
      front_slots: [],
      back_slots: [],
      selected_noyau_index: 0
    });
    await refetchPresets();
    selectedPresetIndex.value = nextIndex;
    lastSelectedPresetIndex.value = nextIndex;
    frontSlots.value = Array(SLOT_COUNT).fill(null);
    backSlots.value = Array(SLOT_COUNT).fill(null);
    setDropMessage('Nouveau preset ' + nextIndex + ' créé.', 'ok');
  } catch {
    setDropMessage('Erreur création preset.', 'error');
  }
}

async function saveTeam() {
  errorMessage.value = '';
  const front = frontSlots.value.map((u) => u?.user_unit_id).filter((id): id is number => id != null);
  const back = backSlots.value.map((u) => u?.user_unit_id).filter((id): id is number => id != null);
  try {
    await api.post('/team/update', {
      name: 'Équipe principale',
      mode: 'ranked',
      frontlineSlots: front,
      backlineSlots: back,
      isDefault: true
    });
    saved.value = true;
    setTimeout(() => (saved.value = false), 2000);
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { details?: string[]; message?: string } } };
    const data = ax.response?.data;
    if (Array.isArray(data?.details) && data.details.length) {
      errorMessage.value = data.details.join('\n');
    } else if (data?.message) {
      errorMessage.value = data.message;
    } else {
      errorMessage.value = 'Erreur lors de l\'enregistrement.';
    }
  }
}

async function initTeamBuilder() {
  loadFavorites();
  try {
    await loadCollection();
    await loadTeam();
    await refetchPresets();
    const list = presetList.value;
    if (list.length > 0) {
      const idx = selectedPresetIndex.value;
      const valid = idx != null && list.some((p) => p.preset_index === idx);
      if (!valid) {
        selectedPresetIndex.value = list[0].preset_index;
        lastSelectedPresetIndex.value = selectedPresetIndex.value;
      } else {
        lastSelectedPresetIndex.value = idx!;
      }
      if (collectionMap.value.size > 0) {
        loadPresetIntoBuilder(selectedPresetIndex.value!, list);
      }
    } else {
      selectedPresetIndex.value = 1;
      lastSelectedPresetIndex.value = 1;
    }
  } catch {
    if (!errorMessage.value) errorMessage.value = 'Impossible de charger les données.';
  }
}

onMounted(() => {
  initTeamBuilder();
});
</script>

<style scoped>
.team-builder-page {
  position: relative;
  width: 100%;
  padding: 6px 10px;
  min-height: 80vh;
}

.team-builder-bg {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 80% 60% at 70% 40%, rgba(0, 255, 200, 0.04) 0%, transparent 50%);
  pointer-events: none;
}

.builder-zone-wrap {
  position: relative;
}

.builder-zone-halo {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 120%;
  height: 120%;
  background: radial-gradient(ellipse 70% 70% at 50% 50%, rgba(0, 255, 200, 0.06) 0%, transparent 65%);
  pointer-events: none;
}

.team-builder-page h2,
.team-builder-page h3 {
  margin: 5px 0 4px;
}

.team-builder-layout {
  display: grid;
  grid-template-columns: 2fr 1.3fr;
  gap: 6px;
  height: calc(100vh - 60px);
  padding: 6px;
  align-items: stretch;
}

@media (max-width: 1400px) {
  .unit-list-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }
}

@media (max-width: 1200px) {
  .team-builder-layout {
    grid-template-columns: 1fr;
  }
  .team-builder-layout .preset-column {
    grid-column: 1;
  }
  .unit-list-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }
  .collection-columns.view-mode-list {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .team-builder-layout {
    height: auto;
    min-height: calc(100vh - 60px);
    grid-template-rows: auto auto 1fr;
  }
  .team-builder-layout.units-panel-hidden .collection-area {
    display: none !important;
  }
  .collection-header {
    flex-direction: column;
    align-items: stretch;
  }
  .collection-search {
    flex-direction: column;
  }
  .search-input-enhanced,
  .effect-filter-select-enhanced {
    width: 100%;
    min-width: 0;
  }
  .view-controls {
    justify-content: center;
  }
  .unit-list-grid {
    grid-template-columns: 1fr;
  }
  .collection-columns {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .unit-stats {
    grid-template-columns: 1fr;
    gap: 6px;
  }
}

.mobile-units-toggle {
  display: none;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(0, 255, 200, 0.1);
  border: 1px solid rgba(0, 255, 200, 0.3);
  border-radius: 10px;
  color: #a5f3fc;
  font-size: 0.85rem;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s, border-color 0.2s;
}
.mobile-units-toggle:hover {
  background: rgba(0, 255, 200, 0.18);
  border-color: rgba(0, 255, 200, 0.45);
}
.mobile-units-toggle .toggle-icon {
  font-size: 0.75rem;
  opacity: 0.9;
}

@media (max-width: 768px) {
  .mobile-units-toggle {
    display: flex;
    grid-column: 1 / -1;
  }
}

.collection-area {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.collection-header {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
  flex-shrink: 0;
  align-items: center;
  flex-wrap: wrap;
}

.collection-search {
  flex: 1;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}

.search-input-enhanced {
  flex: 1;
  min-width: 220px;
  padding: 12px 16px;
  border-radius: 12px;
  background: linear-gradient(145deg, rgba(15, 28, 43, 0.95), rgba(10, 20, 35, 0.95));
  border: 2px solid rgba(0, 255, 200, 0.2);
  color: #f8fafc;
  font-size: 1rem;
  outline: none;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.search-input-enhanced:focus {
  border-color: rgba(0, 255, 200, 0.5);
  box-shadow: 0 0 0 4px rgba(0, 255, 200, 0.1), 0 4px 16px rgba(0, 0, 0, 0.4);
  transform: translateY(-1px);
}

.search-input-enhanced::placeholder {
  color: #64748b;
  font-size: 0.95rem;
}

.effect-filter-select-enhanced {
  min-width: 220px;
  max-width: 300px;
  padding: 12px 16px;
  padding-right: 40px;
  border-radius: 12px;
  background-color: #0f172a;
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M2.5 4.5L6 8l3.5-3.5'/%3E%3C/svg%3E"),
    linear-gradient(145deg, rgba(15, 28, 43, 0.95), rgba(10, 20, 35, 0.95));
  background-repeat: no-repeat, no-repeat;
  background-position: right 14px center, 0 0;
  background-size: 12px 12px, 100% 100%;
  border: 2px solid rgba(0, 255, 200, 0.2);
  color: #f8fafc;
  font-size: 0.95rem;
  cursor: pointer;
  outline: none;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  /* Évite fond/texte blanc natif (Chrome / certains OS) dans la liste déroulante */
  color-scheme: dark;
  -webkit-appearance: none;
  appearance: none;
}

.effect-filter-select-enhanced option,
.effect-filter-select-enhanced optgroup {
  background-color: #0f172a;
  color: #f1f5f9;
}

.effect-filter-select-enhanced:focus,
.effect-filter-select-enhanced:hover {
  border-color: rgba(0, 255, 200, 0.5);
  box-shadow: 0 0 0 4px rgba(0, 255, 200, 0.1), 0 4px 16px rgba(0, 0, 0, 0.4);
  transform: translateY(-1px);
}

.view-controls {
  display: flex;
  gap: 6px;
  background: rgba(15, 23, 42, 0.6);
  padding: 4px;
  border-radius: 10px;
  border: 1px solid rgba(0, 255, 200, 0.15);
}

.view-toggle-btn {
  padding: 8px 14px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid transparent;
  color: #94a3b8;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.2s ease;
  line-height: 1;
}

.view-toggle-btn:hover {
  background: rgba(0, 255, 200, 0.1);
  color: #00ffc8;
}

.view-toggle-btn.active {
  background: rgba(0, 255, 200, 0.2);
  border-color: rgba(0, 255, 200, 0.4);
  color: #00ffc8;
  box-shadow: 0 0 12px rgba(0, 255, 200, 0.2);
}

.collection-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* Mode grille : CAC + Distance côte à côte sur grand écran pour moins de défilement */
@media (min-width: 900px) {
  .collection-columns.view-mode-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 12px;
  }
}

@media (max-width: 899px) {
  .collection-columns.view-mode-grid {
    grid-template-columns: 1fr;
  }
}

.unit-column {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  background: rgba(5, 10, 20, 0.3);
  border-radius: 12px;
  padding: 10px;
  border: 1px solid rgba(0, 255, 200, 0.1);
}

.unit-column-title-enhanced {
  font-size: 1.15rem;
  font-weight: 800;
  color: #f8fafc;
  margin: 0 0 10px 0;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 8px;
  border-bottom: 2px solid rgba(0, 255, 200, 0.2);
}

.unit-count-badge {
  font-size: 0.85rem;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 20px;
  background: rgba(0, 255, 200, 0.15);
  color: #00ffc8;
  border: 1px solid rgba(0, 255, 200, 0.3);
}

.unit-list {
  overflow-y: auto;
  padding-right: 8px;
  flex: 1;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 255, 200, 0.3) rgba(15, 23, 42, 0.5);
}

.unit-list::-webkit-scrollbar {
  width: 10px;
}

.unit-list::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.5);
  border-radius: 10px;
}

.unit-list::-webkit-scrollbar-thumb {
  background: rgba(0, 255, 200, 0.3);
  border-radius: 10px;
  border: 2px solid rgba(15, 23, 42, 0.5);
}

.unit-list::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 255, 200, 0.5);
}

.unit-list-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
  align-content: start;
}

.unit-list-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.nexus-panel {
  background: rgba(10, 15, 30, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  backdrop-filter: blur(12px);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
  padding: 6px 8px;
}

.preset-column {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-height: 0;
}

/* Bloc preset (slots + en-tête) : flux normal pour que noyau / traits ne passent pas sous un calque sticky */
.preset-builder-body {
  flex-shrink: 0;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(0, 255, 200, 0.1);
  margin-bottom: 8px;
}

.panel-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.panel-title {
  font-size: 1.2rem;
  font-weight: 800;
  color: #f8fafc;
  margin: 0;
}

.panel-sub {
  font-size: 0.8rem;
  color: rgba(203, 213, 225, 0.85);
  margin: 2px 0 0;
}

.power-badge {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(0, 255, 255, 0.08);
  border: 1px solid rgba(0, 255, 255, 0.18);
}

.power-badge-epic {
  padding: 7px 11px;
  border-radius: 12px;
  background: linear-gradient(145deg, rgba(0, 255, 200, 0.15), rgba(0, 200, 255, 0.08));
  border: 1px solid rgba(0, 255, 200, 0.35);
  box-shadow: 0 0 25px rgba(0, 255, 200, 0.2);
  animation: powerGlow 2.5s ease-in-out infinite alternate;
}

@keyframes powerGlow {
  from { box-shadow: 0 0 20px rgba(0, 255, 200, 0.15); }
  to { box-shadow: 0 0 30px rgba(0, 255, 200, 0.3); }
}

.power-badge .label {
  font-size: 0.65rem;
  letter-spacing: 1px;
  opacity: 0.8;
  color: rgba(203, 213, 225, 0.9);
}

.power-badge-epic .label {
  font-size: 0.75rem;
  letter-spacing: 2px;
  color: rgba(0, 255, 200, 0.95);
}

.power-badge .value {
  font-size: 1.4rem;
  font-weight: 900;
  color: rgba(0, 255, 255, 0.9);
}

.power-badge-epic .value {
  font-size: 1.45rem;
  font-weight: 900;
  background: linear-gradient(90deg, #00ff9e, #00c8ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 1px;
}

.nexus-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #f8fafc;
  outline: none;
  font-size: 0.9rem;
}

.nexus-input:focus {
  border-color: rgba(0, 255, 255, 0.35);
  box-shadow: 0 0 0 3px rgba(0, 255, 255, 0.1);
}

.nexus-input::placeholder {
  color: #64748b;
}


.nexus-select,
.preset-select-group select {
  padding: 8px 10px;
  border-radius: 10px;
  background-color: #111827;
  border: 1px solid #374151;
  color: #ffffff;
  font-size: 0.85rem;
  outline: none;
  color-scheme: dark;
}

.nexus-select:focus,
.preset-select-group select:focus {
  outline: none;
  border-color: #22d3ee;
}

.preset-select-group select option {
  background-color: #111827;
  color: #ffffff;
}

.nexus-btn {
  padding: 8px 12px;
  border-radius: 12px;
  font-weight: 800;
  font-size: 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: #f8fafc;
  transition: 160ms ease;
  cursor: pointer;
}

.nexus-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
}

.nexus-btn.primary {
  border-color: rgba(0, 255, 255, 0.25);
  background: rgba(0, 255, 255, 0.08);
  color: rgba(0, 255, 255, 0.95);
}

.nexus-btn.danger {
  border-color: rgba(255, 0, 100, 0.25);
  background: rgba(255, 0, 100, 0.08);
  color: #fca5a5;
}

.unit-list-grid .unit-card.unit-card-collection {
  margin-bottom: 0;
  padding: 8px 10px;
  gap: 5px;
  font-size: 0.82rem;
  min-height: 0;
}

.unit-list-grid .unit-card.unit-card-collection .unit-name {
  font-size: 0.92rem;
  line-height: 1.2;
}

.unit-list-grid .unit-card.unit-card-collection .unit-meta {
  font-size: 0.72rem;
  gap: 4px;
  margin-top: 1px;
}

.unit-list-grid .unit-card.unit-card-collection .unit-stats-collection {
  padding: 4px 6px;
  font-size: 0.76rem;
  gap: 3px 6px;
}

.unit-list-grid .unit-card.unit-card-collection .unit-skill-block {
  flex: 1 1 auto;
  min-height: 0;
  font-size: 0.88rem;
  padding: 6px 8px;
  line-height: 1.42;
}

.unit-list-grid .unit-card.unit-card-collection .unit-skill-panel-head {
  margin-bottom: 4px;
}

.unit-list-grid .unit-card.unit-card-collection .unit-skill-panel-label {
  font-size: 0.58rem;
}

.unit-list-grid .unit-card.unit-card-collection .unit-mastery-tag {
  font-size: 0.72rem;
}

.unit-list-grid .unit-card.unit-card-collection .unit-skill-desc {
  font-size: 0.88rem;
  line-height: 1.42;
}

.unit-list-grid .unit-card.unit-card-collection .unit-spec-desc {
  margin-top: 6px;
  padding-top: 6px;
  font-size: 0.82rem;
}

.unit-list-grid .unit-card.unit-card-collection .traits {
  font-size: 0.68rem;
  padding: 4px 6px;
  max-height: 2.8em;
  overflow-y: auto;
  line-height: 1.3;
}

.unit-list-list .unit-card.unit-card-collection {
  padding: 8px 10px;
  gap: 5px;
}

.unit-list-list .unit-card {
  margin-bottom: 0;
}

.unit-card {
  position: relative;
  overflow: hidden;
  padding: 14px 16px;
  border-radius: 14px;
  font-size: 0.9rem;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(8px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.unit-card.unit-card-has-image::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: var(--unit-bg-image);
  background-size: contain;
  background-position: right bottom;
  background-repeat: no-repeat;
  opacity: 0.35;
  pointer-events: none;
  z-index: 0;
}

.unit-card.unit-card-has-image .rarity-bar,
.unit-card.unit-card-has-image .unit-card-header,
.unit-card.unit-card-has-image .unit-meta,
.unit-card.unit-card-has-image .unit-stats,
.unit-card.unit-card-has-image .unit-skill,
.unit-card.unit-card-has-image .fatigue-row,
.unit-card.unit-card-has-image .traits {
  position: relative;
  z-index: 1;
}

/* Collection (gauche) : pas d'image de fond — lisibilité max pour théorycraft */
.unit-card.unit-card-collection {
  background: rgba(15, 23, 42, 0.92);
  border-width: 2px;
  gap: 5px;
  padding: 8px 10px;
}

.unit-card.unit-card-collection .rarity-bar,
.unit-card.unit-card-collection .unit-card-header,
.unit-card.unit-card-collection .unit-meta,
.unit-card.unit-card-collection .unit-skill-block,
.unit-card.unit-card-collection .unit-stats,
.unit-card.unit-card-collection .unit-skill,
.unit-card.unit-card-collection .fatigue-row,
.unit-card.unit-card-collection .traits {
  position: relative;
  z-index: 1;
}

/* Collection : compacter l’en-tête / stats / fatigue pour laisser la place à la description de compétence */
.unit-card.unit-card-collection .rarity-bar {
  height: 3px;
}

.unit-card.unit-card-collection .unit-card-header {
  gap: 0.4rem;
}

.unit-card.unit-card-collection .favorite-star {
  font-size: 1.05rem;
}

.unit-card.unit-card-collection .unit-name {
  font-size: 0.92rem;
  line-height: 1.2;
}

.unit-card.unit-card-collection .unit-meta {
  font-size: 0.72rem;
  gap: 4px;
  margin-top: 1px;
}

.unit-card.unit-card-collection .badge {
  padding: 2px 6px;
  font-size: 0.68rem;
  border-radius: 4px;
}

.unit-card.unit-card-collection .badge.element {
  font-size: 0.62rem;
  letter-spacing: 0.03em;
}

.unit-card.unit-card-collection .unit-role-tag {
  padding: 1px 5px;
  font-size: 0.62rem;
  max-width: 7rem;
}

.unit-card.unit-card-collection .unit-skill-block {
  flex: 1 1 auto;
  min-height: 0;
}

.unit-card.unit-card-collection .unit-stats {
  padding: 4px 6px;
  gap: 3px 6px;
  font-size: 0.76rem;
  margin-top: 0;
}

.unit-card.unit-card-collection .fatigue-row {
  gap: 5px;
  margin-top: 0;
}

.unit-card.unit-card-collection .fatigue-bar {
  height: 5px;
}

.unit-card.unit-card-collection .fatigue-pct-collection {
  font-size: 0.68rem;
}

.unit-card.unit-card-collection .fatigue-icon {
  font-size: 0.75rem;
}

.unit-card.unit-card-collection .traits {
  font-size: 0.68rem;
  padding: 4px 6px;
  max-height: 2.8em;
  overflow-y: auto;
  line-height: 1.3;
}

.unit-stats-collection {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  font-size: 0.92rem;
  color: #e2e8f0;
}

.unit-skill-block {
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(99, 102, 241, 0.22);
  font-size: 0.86rem;
}

.unit-skill-panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.unit-skill-panel-label {
  color: #94a3b8;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.65rem;
  letter-spacing: 0.07em;
}

.unit-skill-desc,
.unit-spec-desc {
  margin: 0;
  color: #e0e7ff;
  line-height: 1.45;
  white-space: pre-line;
}

.unit-spec-desc {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(165, 180, 252, 0.2);
  color: #c7d2fe;
  font-size: 0.92em;
}

.unit-spec-dash {
  font-weight: 400;
  color: #94a3b8;
}

.unit-mastery-tag {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  color: #c4b5fd;
  font-weight: 700;
  font-size: 0.82rem;
}

.unit-role-tag {
  max-width: 100%;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(51, 65, 85, 0.75);
  border: 1px solid rgba(148, 163, 184, 0.35);
  color: #cbd5e1;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fatigue-pct-collection {
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  color: #cbd5e1;
  font-weight: 700;
  min-width: 2.5em;
  text-align: right;
}

.rarity-bar {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 5px;
  border-radius: 14px 14px 0 0;
  animation: rarityBarShift 2s ease-in-out infinite;
  box-shadow: 0 2px 8px currentColor;
}

.rarity-bar.rarity-common { background: linear-gradient(90deg, #78716c, #a8a29e); }
.rarity-bar.rarity-uncommon { background: linear-gradient(90deg, #22c55e, #4ade80); }
.rarity-bar.rarity-rare { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
.rarity-bar.rarity-epic { background: linear-gradient(90deg, #a855f7, #c084fc); }
.rarity-bar.rarity-legendary { background: linear-gradient(90deg, #eab308, #fde047); }
.rarity-bar.rarity-mythic { background: linear-gradient(90deg, #dc2626, #f87171); }

@keyframes rarityBarShift {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}

.unit-card {
  position: relative;
  border: 2px solid rgba(148, 163, 184, 0.5);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.unit-card-clickable {
  cursor: pointer;
}

.unit-card-clickable:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 255, 200, 0.15);
  z-index: 10;
}

.unit-card.element-light:hover,
.unit-card.element-lumiere:hover {
  box-shadow: 0 0 20px rgba(234, 179, 8, 0.5);
}
.unit-card.element-dark:hover,
.unit-card.element-tenebres:hover {
  box-shadow: 0 0 20px rgba(88, 28, 135, 0.5);
}
.unit-card.element-water:hover {
  border-color: rgba(14, 165, 233, 0.8);
  box-shadow: 0 0 20px rgba(14, 165, 233, 0.35), 0 8px 24px rgba(0, 0, 0, 0.4);
}

.unit-card.element-fire:hover {
  border-color: rgba(239, 68, 68, 0.8);
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.35), 0 8px 24px rgba(0, 0, 0, 0.4);
}

.unit-card.element-plant:hover {
  border-color: rgba(34, 197, 94, 0.8);
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.35), 0 8px 24px rgba(0, 0, 0, 0.4);
}

.unit-card.element-neutral:hover {
  border-color: rgba(148, 163, 184, 0.7);
  box-shadow: 0 0 16px rgba(148, 163, 184, 0.25), 0 8px 24px rgba(0, 0, 0, 0.4);
}

.unit-card.selected {
  animation: cardFlash 0.15s ease;
  border-color: rgba(0, 255, 200, 0.9);
  box-shadow: 0 0 24px rgba(0, 255, 200, 0.5);
}

@keyframes cardFlash {
  0% { filter: brightness(1); }
  50% { filter: brightness(1.4); }
  100% { filter: brightness(1); }
}

.unit-card.selected::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 16px;
  border: 2px solid rgba(0, 255, 200, 0.6);
  animation: borderPulse 0.6s ease-in-out infinite alternate;
  pointer-events: none;
}

@keyframes borderPulse {
  from { opacity: 0.6; box-shadow: 0 0 12px rgba(0, 255, 200, 0.3); }
  to { opacity: 1; box-shadow: 0 0 20px rgba(0, 255, 200, 0.5); }
}

.unit-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0;
}

.favorite-checkbox {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  flex-shrink: 0;
}

.favorite-checkbox input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.favorite-star {
  font-size: 1.4rem;
  color: rgba(148, 163, 184, 0.4);
  transition: all 0.2s ease;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.favorite-checkbox:hover .favorite-star {
  color: rgba(234, 179, 8, 0.7);
  transform: scale(1.1);
}

.favorite-checkbox input:checked + .favorite-star {
  color: #eab308;
  filter: drop-shadow(0 0 8px #eab308);
  transform: scale(1.1);
}

.unit-card.fatigue-high {
  border-color: rgba(239, 68, 68, 0.8);
  background: rgba(239, 68, 68, 0.08);
}

.unit-card.rarity-common { border-color: #78716c; }
.unit-card.rarity-uncommon { border-color: #22c55e; }
.unit-card.rarity-rare { border-color: #3b82f6; }
.unit-card.rarity-epic { border-color: #a855f7; }
.unit-card.rarity-legendary { border-color: #eab308; }
.unit-card.rarity-mythic { border-color: #dc2626; }

.unit-name {
  font-weight: 700;
  font-size: 1.1rem;
  color: #f8fafc;
  letter-spacing: 0.3px;
}

.unit-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 0;
  font-size: 0.85rem;
  color: #94a3b8;
  flex-wrap: wrap;
}

.badge {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.3px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.badge.ascended {
  background: linear-gradient(135deg, #eab308, #f59e0b);
  color: #1f2937;
}

.badge.element { 
  font-weight: 700; 
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.5px;
}
.badge.element-water { 
  background: linear-gradient(135deg, #0ea5e9, #06b6d4); 
  color: #fff; 
  box-shadow: 0 0 12px rgba(14, 165, 233, 0.4);
}
.badge.element-fire { 
  background: linear-gradient(135deg, #ef4444, #dc2626); 
  color: #fff; 
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
}
.badge.element-plant { 
  background: linear-gradient(135deg, #22c55e, #16a34a); 
  color: #fff; 
  box-shadow: 0 0 12px rgba(34, 197, 94, 0.4);
}
.badge.element-light,
.badge.element-lumiere { 
  background: linear-gradient(135deg, #eab308, #f59e0b); 
  color: #1f2937; 
  box-shadow: 0 0 12px rgba(234, 179, 8, 0.4);
}
.badge.element-dark,
.badge.element-tenebres { 
  background: linear-gradient(135deg, #581c87, #7e22ce); 
  color: #fff; 
  box-shadow: 0 0 12px rgba(88, 28, 135, 0.4);
}
.badge.element-neutral { 
  background: linear-gradient(135deg, #78716c, #57534e); 
  color: #fff; 
}
.badge.archetype { font-weight: 700; }
.badge.archetype-cac { 
  background: linear-gradient(135deg, #ea580c, #dc2626); 
  color: #fff; 
}
.badge.archetype-distance { 
  background: linear-gradient(135deg, #0891b2, #0e7490); 
  color: #fff; 
}
.badge.spec-A { 
  background: linear-gradient(135deg, #3b82f6, #2563eb); 
  color: #fff; 
}
.badge.spec-B { 
  background: linear-gradient(135deg, #8b5cf6, #7c3aed); 
  color: #fff; 
}
.badge.power { 
  background: linear-gradient(135deg, #ca8a04, #a16207); 
  color: #fff8db; 
  font-weight: 800;
}
.badge.ascended {
  background: linear-gradient(135deg, #eab308, #f59e0b, #fb923c);
  color: #1f2937;
  font-weight: 800;
  animation: ascendedGlow 2s ease-in-out infinite alternate;
}

@keyframes ascendedGlow {
  from { box-shadow: 0 0 8px rgba(234, 179, 8, 0.4); }
  to { box-shadow: 0 0 16px rgba(234, 179, 8, 0.6); }
}
.unit-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 12px;
  font-size: 0.95rem;
  color: #cbd5e1;
  margin-top: 0;
  padding: 10px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.unit-stats span { 
  white-space: nowrap;
  font-weight: 600;
}
.unit-skill {
  font-size: 0.9rem;
  color: #e0e7ff;
  margin-top: 0;
  font-style: italic;
  white-space: pre-line;
  line-height: 1.5;
  padding: 8px 10px;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 8px;
  border-left: 3px solid rgba(99, 102, 241, 0.5);
}
.unit-skill.unit-spec {
  color: #a5b4fc;
  font-size: 0.85rem;
  margin-top: 0;
}

.fatigue-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 0;
}

.fatigue-bar {
  flex: 1;
  height: 8px;
  background: rgba(30, 41, 59, 0.9);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
}

.fatigue-bar.mini {
  width: 48px;
  flex: none;
}

.fatigue-bar.fatigue-red .fatigue-fill {
  background: linear-gradient(90deg, #dc2626, #f87171);
}

.fatigue-icon {
  color: #f87171;
  font-size: 0.9rem;
}
.speed-fatigue-hint {
  font-size: 0.75em;
  color: #94a3b8;
  margin-left: 2px;
}

.fatigue-fill {
  height: 100%;
  background: linear-gradient(to right, #22c55e, #facc15, #ef4444);
  border-radius: 2px;
  transition: width 0.2s ease;
}

.fatigue-indicator {
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background: rgba(30, 41, 59, 0.8);
  margin-top: 4px;
}

.fatigue-indicator .fatigue-fill {
  height: 6px;
}

.traits {
  font-size: 0.85rem;
  color: #94a3b8;
  margin-top: 0;
  padding: 8px 10px;
  background: rgba(0, 255, 200, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(0, 255, 200, 0.15);
  line-height: 1.5;
}

.builder-zone {
  display: flex;
  flex-direction: column;
}

.team-count {
  font-weight: 700;
  font-size: 0.9rem;
  color: rgba(203, 213, 225, 0.9);
  margin-left: 4px;
}

.fatigue-avg {
  font-size: 0.85rem;
  color: #94a3b8;
  margin-bottom: 0.75rem;
}

.presets-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.preset-name-input {
  width: 7rem;
  max-width: 10rem;
}

.preset-select-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.preset-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.drop-message {
  padding: 8px 10px;
  border-radius: 10px;
  margin-bottom: 10px;
  font-size: 0.85rem;
}

.drop-message.error {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
}

.drop-message.ok {
  background: rgba(34, 197, 94, 0.2);
  color: #86efac;
}

.slots-section {
  margin-bottom: 7px;
}

.team-section-title {
  font-size: 15px;
  font-weight: 600;
  color: #e5e7eb;
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}

.preset-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.team-slots {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.preset-slot {
  min-height: 0;
  padding: 5px;
  border-radius: 10px;
  margin-bottom: 4px;
}

.team-slot {
  min-height: 88px;
  height: auto;
  border-radius: 10px;
  padding: 7px;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.03);
  transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.slot-energy {
  background: linear-gradient(145deg, rgba(0, 255, 200, 0.04), rgba(0, 0, 0, 0.2));
  border: 1px solid rgba(0, 255, 200, 0.2);
  animation: slotContour 3s ease-in-out infinite;
}

.slot-energy::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 15px;
  padding: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 255, 200, 0.35), transparent);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0.8;
  pointer-events: none;
}

@keyframes slotContour {
  0%, 100% { box-shadow: 0 0 12px rgba(0, 255, 200, 0.1); }
  50% { box-shadow: 0 0 20px rgba(0, 255, 200, 0.2); }
}

.slot-energy.slot-just-added::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 14px;
  background: radial-gradient(circle at center, rgba(0, 255, 200, 0.4) 0%, transparent 70%);
  animation: slotRipple 0.4s ease-out forwards;
  pointer-events: none;
}

@keyframes slotRipple {
  from { transform: scale(0.5); opacity: 1; }
  to { transform: scale(1.5); opacity: 0; }
}

.slot {
  min-height: 0;
  border-radius: 14px;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  padding: 6px;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.slot.empty {
  border-style: dashed;
}

.slot-fill-enter-active,
.slot-fill-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.slot-fill-enter-from,
.slot-fill-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.slot-fill-enter-to,
.slot-fill-leave-from {
  opacity: 1;
  transform: scale(1);
}

.slot-unit {
  position: relative;
  border-radius: 10px;
  padding: 5px 6px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.2);
}

.slot-unit.slot-unit-has-image::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-image: var(--unit-bg-image);
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  opacity: 0.28;
  pointer-events: none;
  filter: saturate(1.05) contrast(1.04);
}

.slot-unit.slot-unit-has-image::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(180deg, rgba(2, 6, 23, 0.28) 0%, rgba(2, 6, 23, 0.72) 100%);
  pointer-events: none;
}

.slot-unit.slot-unit-has-image .slot-name,
.slot-unit.slot-unit-has-image .slot-meta,
.slot-unit.slot-unit-has-image .slot-stats-compact,
.slot-unit.slot-unit-has-image .slot-fatigue,
.slot-unit.slot-unit-has-image .slot-targeting {
  position: relative;
  z-index: 1;
  text-shadow: 0 1px 2px rgba(2, 6, 23, 0.85);
}

.slot-unit-clickable {
  cursor: pointer;
}

.slot-unit-clickable:hover {
  filter: brightness(1.1);
}

.slot-unit.rarity-common { border-color: #78716c; }
.slot-unit.rarity-uncommon { border-color: #22c55e; }
.slot-unit.rarity-rare { border-color: #3b82f6; }
.slot-unit.rarity-epic { border-color: #a855f7; }
.slot-unit.rarity-legendary { border-color: #eab308; }
.slot-unit.rarity-mythic { border-color: #dc2626; }

.slot-name {
  display: block;
  font-weight: 700;
  font-size: 0.72rem;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
  font-size: 0.7rem;
  color: rgba(203, 213, 225, 0.85);
  margin-top: 2px;
}

.slot-meta .badge {
  font-size: 0.65rem;
  padding: 0.05rem 0.25rem;
}

.slot-skill-snippet {
  margin-top: 3px;
  font-size: 0.62rem;
  line-height: 1.25;
  color: rgba(199, 210, 254, 0.92);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.slot-stats-compact {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px 6px;
  margin-top: 4px;
  font-size: 0.65rem;
  line-height: 1.25;
  color: #e2e8f0;
  font-variant-numeric: tabular-nums;
}

.slot-fatigue {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  margin-top: 2px;
}

.slot-fatigue-pct {
  font-size: 0.62rem;
  color: rgba(148, 163, 184, 0.95);
  font-variant-numeric: tabular-nums;
  min-width: 2.2em;
}

.slot-targeting {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.slot-targeting .targeting-select {
  flex: 1;
  min-width: 0;
  font-size: 0.7rem;
  padding: 2px 4px;
}

.focus-select {
  width: 100%;
  margin-top: 6px;
  padding: 4px;
  font-size: 12px;
}

.slot-empty {
  color: rgba(148, 163, 184, 0.6);
  font-size: 0.85rem;
  text-align: center;
  padding: 0;
}

.noyau-block {
  position: relative;
  z-index: 2;
  margin-top: 4px;
  padding: 10px 12px;
  background: rgba(30, 41, 59, 0.88);
  border-radius: 10px;
  border: 1px solid rgba(0, 255, 200, 0.22);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
}

.noyau-block h3 {
  margin: 0 0 8px 0;
  font-size: 0.9rem;
  color: #94a3b8;
}

.noyau-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.noyau-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  color: #e2e8f0;
}

.noyau-option input {
  margin: 0;
}

.noyau-option span {
  flex: 1;
}

.unit-tooltip {
  position: fixed;
  overflow: hidden;
  position: fixed;
  bottom: 40px;
  right: 40px;
  width: 280px;

  background: linear-gradient(180deg, #0b1a2a, #091523);
  border-radius: 12px;
  padding: 14px;

  box-shadow: 0 0 25px rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(100, 180, 255, 0.3);

  z-index: 3000;
}

.unit-tooltip.unit-tooltip-has-image::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: var(--unit-bg-image);
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  opacity: 0.24;
  pointer-events: none;
}

.unit-tooltip.unit-tooltip-has-image::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(9, 21, 35, 0.2) 0%, rgba(9, 21, 35, 0.82) 100%);
  pointer-events: none;
}

.unit-tooltip.unit-tooltip-has-image .tooltip-title,
.unit-tooltip.unit-tooltip-has-image .tooltip-meta,
.unit-tooltip.unit-tooltip-has-image .tooltip-stats,
.unit-tooltip.unit-tooltip-has-image .tooltip-traits,
.unit-tooltip.unit-tooltip-has-image .tooltip-skill,
.unit-tooltip.unit-tooltip-has-image .tooltip-skill-block,
.unit-tooltip.unit-tooltip-has-image .tooltip-spec-block {
  position: relative;
  z-index: 1;
  text-shadow: 0 1px 2px rgba(2, 6, 23, 0.92);
}

.unit-tooltip .tooltip-title {
  font-weight: 700;
  font-size: 15px;
  margin-bottom: 8px;
  color: #3aa3ff;
}

.unit-tooltip .tooltip-meta {
  font-size: 12px;
  opacity: 0.85;
  margin-bottom: 6px;
}

.unit-tooltip .tooltip-stats {
  font-size: 13px;
  margin-bottom: 8px;
}

.unit-tooltip .tooltip-stats > div {
  margin-bottom: 2px;
}

.unit-tooltip .tooltip-traits {
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 6px;
}

.unit-tooltip .tooltip-skill-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #94a3b8;
  margin-bottom: 4px;
}

.unit-tooltip .tooltip-skill-block,
.unit-tooltip .tooltip-spec-block {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.unit-tooltip .tooltip-skill {
  font-size: 12px;
  white-space: pre-line;
  color: #e0e7ff;
}

.unit-tooltip .tooltip-spec-block .tooltip-skill {
  color: #c7d2fe;
}

.unit-tooltip .tooltip-spec {
  font-size: 11px;
  color: #a5b4fc;
  margin-top: 6px;
  padding-top: 4px;
  border-top: 1px solid rgba(165, 180, 252, 0.2);
}

.traits-team-section {
  margin-top: 6px;
}

.traits-section-title {
  margin: 0 0 8px 0;
  font-size: 0.88rem;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.03em;
}

.traits-active-strip {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(52, 211, 153, 0.35);
}

.traits-active-label {
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6ee7b7;
}

.traits-active-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.trait-chip-active {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(6, 78, 59, 0.55);
  border: 1px solid rgba(52, 211, 153, 0.55);
  color: #ecfdf5;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: default;
}

.trait-chip-active:hover {
  border-color: rgba(110, 231, 183, 0.85);
  box-shadow: 0 0 12px rgba(52, 211, 153, 0.25);
}

.trait-chip-count {
  font-variant-numeric: tabular-nums;
  font-size: 0.72rem;
  opacity: 0.9;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.35);
}

.traits-none-hint {
  margin: 0 0 10px 0;
  font-size: 0.8rem;
  color: #64748b;
  line-height: 1.4;
}

.traits-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 5px;
  margin-top: 0;
  padding-right: 2px;
}

.trait-card.trait-card-active {
  border-color: rgba(52, 211, 153, 0.45);
  box-shadow: 0 0 10px rgba(52, 211, 153, 0.12);
}

.trait-card {
  position: relative;
  padding: 5px 8px;
  border-radius: 8px;
  background: rgba(20, 30, 50, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

/** Paliers atteints : encadrement (2 vert, 4 bleu, 6 jaune) */
.trait-card.trait-frame-tier-0 {
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: none;
}
.trait-card.trait-frame-tier-2 {
  border: 2px solid rgba(34, 197, 94, 0.8);
  box-shadow: 0 0 12px rgba(34, 197, 94, 0.28);
}
.trait-card.trait-frame-tier-4 {
  border: 2px solid rgba(59, 130, 246, 0.88);
  box-shadow: 0 0 14px rgba(59, 130, 246, 0.38);
}
.trait-card.trait-frame-tier-6 {
  border: 2px solid rgba(250, 204, 21, 0.92);
  box-shadow: 0 0 16px rgba(250, 204, 21, 0.42);
}

.trait-card-content.inactive {
  opacity: 0.6;
}

.trait-card-content.zero {
  opacity: 0.45;
}

.trait-tooltip {
  width: 320px;
  max-width: min(320px, 90vw);
  z-index: 500;
  opacity: 1 !important;
  background: linear-gradient(180deg, #0b1a2a, #091523);
  backdrop-filter: blur(4px);
  border-radius: 10px;
  padding: 12px;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(100, 180, 255, 0.3);
}

@media (max-width: 768px) {
  .trait-tooltip {
    width: auto;
    max-width: calc(100vw - 24px);
    max-height: 60vh;
    overflow-y: auto;
  }
}

.trait-tooltip .tooltip-level {
  white-space: normal;
  word-wrap: break-word;
}

.trait-tooltip-fixed {
  /* Position fournie par traitTooltipStyle (fixed au-dessus de la carte) */
}

.trait-tooltip-fade-enter-active,
.trait-tooltip-fade-leave-active {
  transition: opacity 0.15s ease;
}
.trait-tooltip-fade-enter-from,
.trait-tooltip-fade-leave-to {
  opacity: 0;
}

.tooltip-title {
  font-weight: 700;
  margin-bottom: 8px;
  color: #3aa3ff;
}

.tooltip-level {
  font-size: 13px;
  opacity: 0.6;
  margin-bottom: 4px;
}

.tooltip-level.active {
  opacity: 1;
  color: #00e0ff;
  font-weight: 600;
}

.trait-name {
  font-weight: 600;
}

.trait-level {
  font-size: 12px;
  opacity: 0.9;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.synergies-block {
  margin-top: 12px;
  padding: 10px 12px;
  background: rgba(30, 41, 59, 0.6);
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.25);
}

.synergies-block h3 {
  margin: 0 0 0.5rem 0;
  font-size: 0.85rem;
  color: #94a3b8;
}

.synergy-entry {
  padding: 0.4rem 0.5rem;
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(148, 163, 184, 0.4);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.synergy-badge {
  border-radius: 10px;
  padding: 0.5rem 0.65rem;
  animation: synergySubtle 3s ease-in-out infinite alternate;
}

.synergy-BERSERKERS { border-color: rgba(34, 197, 94, 0.5); box-shadow: 0 0 12px rgba(34, 197, 94, 0.2); }
.synergy-GUARDIANS { border-color: rgba(59, 130, 246, 0.5); box-shadow: 0 0 12px rgba(59, 130, 246, 0.2); }
.synergy-EXECUTIONERS { border-color: rgba(239, 68, 68, 0.5); box-shadow: 0 0 12px rgba(239, 68, 68, 0.2); }
.synergy-ARCANISTS { border-color: rgba(168, 85, 247, 0.5); box-shadow: 0 0 12px rgba(168, 85, 247, 0.2); }
.synergy-DRUIDS { border-color: rgba(34, 197, 94, 0.45); box-shadow: 0 0 12px rgba(34, 197, 94, 0.18); }
.synergy-TACTICIANS { border-color: rgba(0, 255, 200, 0.5); box-shadow: 0 0 12px rgba(0, 255, 200, 0.2); }

@keyframes synergySubtle {
  from { filter: brightness(1); }
  to { filter: brightness(1.05); }
}

.synergy-entry + .synergy-entry {
  margin-top: 0.35rem;
}

.synergy-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.25rem;
}

.synergy-trait {
  font-size: 0.85rem;
  font-weight: 700;
  text-shadow: 0 0 10px currentColor;
}

.synergy-level {
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: rgba(0, 255, 200, 0.15);
  color: #7dd3fc;
  font-weight: 600;
}

.synergy-tiers {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.synergy-tier {
  display: flex;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: #e5e7eb;
}

.synergy-tier-badge {
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.15);
  color: #7dd3fc;
  font-size: 0.7rem;
}

.synergy-effect {
  flex: 1;
}

.actions {
  margin-top: 1rem;
}

.btn-save {
  padding: 0.6rem 1.25rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(to right, #3b82f6, #6366f1);
  color: white;
  font-weight: 600;
  cursor: pointer;
}

.btn-save:hover {
  filter: brightness(1.1);
}

.saved {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #4ade80;
}

.error {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #f97373;
  white-space: pre-line;
}

.loading {
  padding: 10px 0;
  color: rgba(203, 213, 225, 0.8);
  font-size: 0.9rem;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: rgba(15, 23, 42, 0.98);
  border-radius: 1rem;
  padding: 1.5rem;
  border: 1px solid rgba(148, 163, 184, 0.4);
  min-width: 280px;
}

.modal h3 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
}

.modal-presets {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.modal-presets button {
  flex: 1;
  padding: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.5);
  background: rgba(30, 41, 59, 0.8);
  color: #e5e7eb;
  cursor: pointer;
}

.modal-presets button:hover {
  background: rgba(56, 189, 248, 0.2);
  border-color: #38bdf8;
}

.modal-close {
  width: 100%;
  padding: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.5);
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
}
</style>

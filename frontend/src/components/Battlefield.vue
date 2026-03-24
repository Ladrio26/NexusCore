<template>
  <div class="battlefield-outer">
    <div class="team-label team-label-enemy">{{ enemyTeamLabel }}</div>
    <!-- ENEMY BACK -->
    <div class="battle-row enemy-back">
      <div
        v-for="u in enemiesBack.slice(0, 5)"
        :key="u.id"
        :id="`unit-${u.combatIndex ?? u.id}`"
        :data-unit-id="u.id"
        class="unit-slot"
        :class="{
          'unit-ko': u.isDead,
          'unit-active': activeUnitId === u.id,
          'unit-targetable': isTargetable(u.id),
          'unit-target-selected': selectedTargetId != null && String(selectedTargetId) === String(u.id)
        }"
        @mouseenter="$emit('unit-hover', u)"
        @mouseleave="$emit('unit-hover', null)"
        @click="onUnitTap(u)"
        @touchend="onUnitTap(u, $event)"
      >
        <UnitCircle
          :ref="(el) => registerUnitRef(u.id, el)"
          :unit="u"
          row-position="bottom"
        />
        <div class="float-container" />
      </div>
    </div>
    <!-- ENEMY FRONT -->
    <div class="battle-row enemy-front">
      <div
        v-for="u in enemiesFront.slice(0, 5)"
        :key="u.id"
        :id="`unit-${u.combatIndex ?? u.id}`"
        :data-unit-id="u.id"
        class="unit-slot"
        :class="{
          'unit-ko': u.isDead,
          'unit-active': activeUnitId === u.id,
          'unit-targetable': isTargetable(u.id),
          'unit-target-selected': selectedTargetId != null && String(selectedTargetId) === String(u.id)
        }"
        @mouseenter="$emit('unit-hover', u)"
        @mouseleave="$emit('unit-hover', null)"
        @click="onUnitTap(u)"
        @touchend="onUnitTap(u, $event)"
      >
        <UnitCircle
          :ref="(el) => registerUnitRef(u.id, el)"
          :unit="u"
          row-position="bottom"
        />
        <div class="float-container" />
      </div>
    </div>
    <div class="team-divider" aria-hidden="true"></div>
    <div class="team-label team-label-ally">Mon équipe</div>
    <!-- ALLY FRONT -->
    <div class="battle-row ally-front">
      <div
        v-for="u in alliesFront.slice(0, 5)"
        :key="u.id"
        :id="`unit-${u.combatIndex ?? u.id}`"
        :data-unit-id="u.id"
        class="unit-slot"
        :class="{
          'unit-ko': u.isDead,
          'unit-active': activeUnitId === u.id,
          'unit-targetable': isTargetable(u.id),
          'unit-target-selected': selectedTargetId != null && String(selectedTargetId) === String(u.id)
        }"
        @mouseenter="$emit('unit-hover', u)"
        @mouseleave="$emit('unit-hover', null)"
        @click="onUnitTap(u)"
        @touchend="onUnitTap(u, $event)"
      >
        <UnitCircle
          :ref="(el) => registerUnitRef(u.id, el)"
          :unit="u"
          row-position="top"
        />
        <div class="float-container" />
      </div>
    </div>
    <!-- ALLY BACK -->
    <div class="battle-row ally-back">
      <div
        v-for="u in alliesBack.slice(0, 5)"
        :key="u.id"
        :id="`unit-${u.combatIndex ?? u.id}`"
        :data-unit-id="u.id"
        class="unit-slot"
        :class="{
          'unit-ko': u.isDead,
          'unit-active': activeUnitId === u.id,
          'unit-targetable': isTargetable(u.id),
          'unit-target-selected': selectedTargetId != null && String(selectedTargetId) === String(u.id)
        }"
        @mouseenter="$emit('unit-hover', u)"
        @mouseleave="$emit('unit-hover', null)"
        @click="onUnitTap(u)"
        @touchend="onUnitTap(u, $event)"
      >
        <UnitCircle
          :ref="(el) => registerUnitRef(u.id, el)"
          :unit="u"
          row-position="top"
        />
        <div class="float-container" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import UnitCircle from './UnitCircle.vue';

/** Unité telle que construite pour l’UI combat (snake / champs moteur). */
type UIUnit = Record<string, unknown> & {
  id: string;
  team?: string;
  role?: string;
  combatIndex?: number | string;
  isDead?: boolean;
};

function isUIUnit(v: unknown): v is UIUnit {
  return typeof v === 'object' && v !== null && 'id' in v && typeof (v as { id: unknown }).id === 'string';
}

const props = withDefaults(
  defineProps<{
    uiUnits: Map<string, unknown>;
    activeUnitId?: string | null;
    targetableUnitIds?: string[];
    selectedTargetId?: string | null;
    /** Label de l’équipe ennemie (ex. "Équipe Ennemie" ou "PNJ" en PvP). */
    enemyTeamLabel?: string;
  }>(),
  { enemyTeamLabel: 'Équipe Ennemie', targetableUnitIds: () => [], selectedTargetId: null }
);

const emit = defineEmits<{
  (e: 'unit-hover', unit: unknown): void;
  (e: 'unit-click', unit: unknown): void;
}>();

/** Clic ou touchend — sur mobile, touchend avec preventDefault pour réponse immédiate */
function onUnitTap(unit: unknown, e?: Event) {
  const u = unit as { id?: string };
  if (!isTargetable(u?.id ?? '')) return;
  if (e && 'changedTouches' in e) {
    e.preventDefault();
  }
  emit('unit-click', unit);
}

function isTargetable(unitId: string): boolean {
  return (props.targetableUnitIds || []).some((id) => String(id) === String(unitId));
}

const unitRefs = new Map<string, InstanceType<typeof UnitCircle>>();

function registerUnitRef(id: string, el: unknown) {
  if (el) unitRefs.set(id, el as InstanceType<typeof UnitCircle>);
  else unitRefs.delete(id);
}

const allies = computed((): UIUnit[] =>
  Array.from(props.uiUnits.values()).filter((u): u is UIUnit => isUIUnit(u) && String(u.team ?? '').toUpperCase() === 'ALLY')
);

const enemies = computed((): UIUnit[] =>
  Array.from(props.uiUnits.values()).filter((u): u is UIUnit => isUIUnit(u) && String(u.team ?? '').toUpperCase() === 'ENEMY')
);

const alliesFront = computed((): UIUnit[] =>
  allies.value.filter((u) => String(u.role ?? '').toUpperCase() === 'CAC')
);

const alliesBack = computed((): UIUnit[] =>
  allies.value.filter((u) => String(u.role ?? '').toUpperCase() === 'DISTANCE')
);

const enemiesFront = computed((): UIUnit[] =>
  enemies.value.filter((u) => String(u.role ?? '').toUpperCase() === 'CAC')
);

const enemiesBack = computed((): UIUnit[] =>
  enemies.value.filter((u) => String(u.role ?? '').toUpperCase() === 'DISTANCE')
);

defineExpose({
  unitRefs
});
</script>

<style scoped>
.battlefield-outer {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto 4px auto auto;
  gap: 12px 16px;
  height: 500px;
  margin-top: 15px;
  min-height: 0;
  align-items: center;
  max-width: 100%;
  overflow: clip;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.battlefield-outer::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.team-label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  letter-spacing: 0.03em;
  padding-right: 8px;
  text-align: right;
}

.team-label-enemy {
  grid-column: 1;
  grid-row: 1 / 3;
  align-self: center;
}

.team-label-ally {
  grid-column: 1;
  grid-row: 4 / 6;
  align-self: center;
}

.team-divider {
  grid-column: 1 / -1;
  grid-row: 3;
  height: 2px;
  background: linear-gradient(to right, transparent, #475569, #64748b, #475569, transparent);
  border-radius: 1px;
}

.battle-row.enemy-back {
  grid-column: 2;
  grid-row: 1;
}

.battle-row.enemy-front {
  grid-column: 2;
  grid-row: 2;
}

.battle-row.ally-front {
  grid-column: 2;
  grid-row: 4;
}

.battle-row.ally-back {
  grid-column: 2;
  grid-row: 5;
}

.battle-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 25px;
  min-height: 0;
}

.unit-slot {
  position: relative;
  text-align: center;
  flex-shrink: 0;
}
.unit-slot.unit-targetable {
  cursor: pointer;
}
.unit-slot.unit-targetable::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 999px;
  border: 2px dashed rgba(45, 212, 191, 0.75);
  box-shadow: 0 0 14px rgba(45, 212, 191, 0.35);
  pointer-events: none;
}
.unit-slot.unit-target-selected::after {
  border-style: solid;
  border-color: rgba(125, 211, 252, 1);
  box-shadow: 0 0 18px rgba(59, 130, 246, 0.6);
}

/* Halo doré pour l'unité alliée dont c'est le tour */
.battle-row.ally-front .unit-slot.unit-active::before,
.battle-row.ally-back .unit-slot.unit-active::before {
  content: '';
  position: absolute;
  inset: -10px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(255, 208, 0, 0.18) 0%, transparent 70%);
  box-shadow:
    0 0 22px 8px rgba(255, 208, 0, 0.45),
    0 0 8px 2px rgba(255, 230, 100, 0.6) inset;
  animation: activeHalo 1.8s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}
@keyframes activeHalo {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.65; transform: scale(1.06); }
}

.float-container {
  position: absolute;
  pointer-events: none;
}

@media (max-width: 768px) {
  .battlefield-outer {
    height: auto;
    min-height: 200px;
    gap: 6px 8px;
    grid-template-columns: 1fr;
  }

  .battle-row {
    gap: 6px;
    flex-wrap: nowrap;
    justify-content: center;
    max-width: 100%;
    min-width: 0;
    overflow-x: auto;
    overflow-y: visible;
    -webkit-overflow-scrolling: touch;
    padding: 2px 0;
  }

  .battle-row::-webkit-scrollbar {
    display: none;
  }

  .unit-slot {
    flex: 0 0 auto;
    min-width: 28px;
  }

  .team-label,
  .team-label-enemy,
  .team-label-ally {
    display: none;
  }

  .battle-row.enemy-back,
  .battle-row.enemy-front,
  .battle-row.ally-front,
  .battle-row.ally-back {
    grid-column: 1;
  }

  .unit-slot.unit-targetable {
    touch-action: manipulation;
    min-width: 28px;
    min-height: 28px;
  }

  .unit-slot.unit-targetable::after {
    inset: -3px;
    border-width: 1px;
  }

  .battle-row.ally-front .unit-slot.unit-active::before,
  .battle-row.ally-back .unit-slot.unit-active::before {
    inset: -4px;
  }
}
</style>

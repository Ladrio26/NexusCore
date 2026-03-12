<template>
  <section class="battle-viewer">
    <div class="card nx-panel">
      <h2 class="nx-title">Battle Viewer</h2>
      <div class="layout">
        <div class="board">
          <div class="side">
            <h3>Équipe A</h3>
            <div class="row">
              <UnitCircle
                v-for="unit in frontA"
                :key="unit.uid"
                :unit="unit"
                row-position="top"
              />
            </div>
            <div class="row back">
              <UnitCircle
                v-for="unit in backA"
                :key="unit.uid"
                :unit="unit"
                row-position="top"
              />
            </div>
          </div>
          <div class="side">
            <h3>Équipe B</h3>
            <div class="row">
              <UnitCircle
                v-for="unit in frontB"
                :key="unit.uid"
                :unit="unit"
                row-position="bottom"
              />
            </div>
            <div class="row back">
              <UnitCircle
                v-for="unit in backB"
                :key="unit.uid"
                :unit="unit"
                row-position="bottom"
              />
            </div>
          </div>
        </div>

        <div class="sidebar">
          <div class="timeline">
            <h3>Timeline ATB</h3>
            <div class="timeline-bar">
              <div
                v-for="u in currentUnits"
                :key="u.uid"
                class="timeline-token"
                :style="{ left: Math.min(100, (u.atb || 0)) + '%' }"
              >
                {{ u.name[0] }}
              </div>
            </div>
          </div>

          <div class="log">
            <h3>Journal de combat</h3>
            <div class="events">
              <div v-for="(e, idx) in displayedEvents" :key="idx" class="event">
                <span class="round">R{{ e.round }}</span>
                <span>
                  <template v-if="e.type === 'attack'">
                    {{ e.actorSide }} → {{ e.targetSide }} :
                    -{{ e.finalDamage }} HP
                    <span v-if="e.isCrit" class="crit">CRIT</span>
                    <span v-if="e.isMiss" class="miss">MISS</span>
                  </template>
                  <template v-else-if="e.type === 'SYNERGY_TRIGGER'">
                    [{{ e.trait }}] {{ e.subType }}
                  </template>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import UnitCircle from '../components/UnitCircle.vue';

const route = useRoute();
const battle = reactive<any>({});
const loading = ref(false);

onMounted(async () => {
  const id = route.params.id;
  if (!id) return;
  loading.value = true;
  try {
    const { data } = await axios.get(`/api/battle/${id}`);
    Object.assign(battle, data);
  } finally {
    loading.value = false;
  }
});

const lastEvent = computed(() => {
  const events = battle.log?.events || [];
  return events.length ? events[events.length - 1] : null;
});

const latestSnapshotEvent = computed(() => {
  const events = Array.isArray(battle.log?.events) ? battle.log.events : [];
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (Array.isArray(event?.stateSnapshot)) return event;
  }
  return null;
});

function unitNameKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

const teamAImageByName = computed(() => {
  const map = new Map<string, string | null>();
  const units = Array.isArray(battle.teamA) ? battle.teamA : [];
  for (const u of units) {
    const key = unitNameKey((u as { name?: string }).name);
    if (!key) continue;
    const img = (u as { image_url?: string | null }).image_url ?? null;
    map.set(key, img);
  }
  return map;
});

const teamBImageByName = computed(() => {
  const map = new Map<string, string | null>();
  const units = Array.isArray(battle.teamB) ? battle.teamB : [];
  for (const u of units) {
    const key = unitNameKey((u as { name?: string }).name);
    if (!key) continue;
    const img = (u as { image_url?: string | null }).image_url ?? null;
    map.set(key, img);
  }
  return map;
});

const currentUnits = computed(() => {
  const snapshot = Array.isArray(latestSnapshotEvent.value?.stateSnapshot) ? latestSnapshotEvent.value.stateSnapshot : [];
  return snapshot.map((u: any) => {
    if (u?.image_url) return u;
    const bySide = String(u?.side ?? '').toUpperCase() === 'A' ? teamAImageByName.value : teamBImageByName.value;
    const byName = bySide.get(unitNameKey(u?.name)) ?? null;
    return { ...u, image_url: byName };
  });
});

const frontA = computed(() =>
  currentUnits.value.filter((u: any) => u.side === 'A' && u.position === 'front')
);
const backA = computed(() =>
  currentUnits.value.filter((u: any) => u.side === 'A' && u.position === 'back')
);
const frontB = computed(() =>
  currentUnits.value.filter((u: any) => u.side === 'B' && u.position === 'front')
);
const backB = computed(() =>
  currentUnits.value.filter((u: any) => u.side === 'B' && u.position === 'back')
);

const displayedEvents = computed(() => (battle.log?.events || []).slice(-60));
</script>

<style scoped>
.battle-viewer {
  display: flex;
  justify-content: center;
}

.card {
  background: rgba(15, 23, 42, 0.95);
  border-radius: 1rem;
  padding: 1.5rem 2rem;
  width: 1120px;
  border: 1px solid rgba(148, 163, 184, 0.4);
}

.layout {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 1.5rem;
}

.board {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.side {
  background: radial-gradient(circle at top, #0f172a, #020617);
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(55, 65, 81, 0.9);
}

.row {
  display: flex;
  justify-content: space-around;
  margin-top: 0.5rem;
}

.row.back {
  margin-top: 0.75rem;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.timeline,
.log {
  background: rgba(15, 23, 42, 0.9);
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(55, 65, 81, 0.9);
}

.timeline-bar {
  position: relative;
  height: 40px;
  margin-top: 0.5rem;
  background: linear-gradient(to right, rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.2));
  border-radius: 999px;
}

.timeline-token {
  position: absolute;
  top: 6px;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: #38bdf8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
}

.events {
  max-height: 260px;
  overflow-y: auto;
  margin-top: 0.5rem;
  font-size: 0.85rem;
}

.event {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.round {
  color: #9ca3af;
  width: 3rem;
}

.crit {
  color: #f97316;
  font-weight: 600;
  margin-left: 0.25rem;
}

.miss {
  color: #f97373;
  font-weight: 600;
  margin-left: 0.25rem;
}
</style>


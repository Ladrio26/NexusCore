<template>
  <section class="admin-bots admin-fullwidth">
    <div class="admin-page-header">
      <h1 class="admin-title">Bots joueurs</h1>
      <p class="admin-desc">
        Créez et gérez des comptes bots qui jouent automatiquement.
        Le système tourne toutes les {{ tickInterval / 1000 }}s et exécute une action par bot selon le profil
        (ordre des actions configurable dans l’onglet Profils).
      </p>
      <div class="admin-bots-nav">
        <button
          type="button"
          class="nx-btn nx-btn-sm"
          :class="{ 'nx-btn-primary': pageTab === 'bots' }"
          @click="pageTab = 'bots'"
        >
          Bots
        </button>
        <button
          type="button"
          class="nx-btn nx-btn-sm"
          :class="{ 'nx-btn-primary': pageTab === 'profiles' }"
          @click="openProfilesTab"
        >
          Profils &amp; priorités
        </button>
      </div>
    </div>

    <p v-if="errorMsg" class="admin-error">{{ errorMsg }}</p>
    <p v-if="successMsg" class="admin-success">{{ successMsg }}</p>

    <!-- Configuration des profils (priorités d’actions, profils custom) -->
    <div v-show="pageTab === 'profiles'" class="profiles-config nx-panel">
      <div class="profiles-toolbar">
        <h2 class="profiles-h2">Profils de bots</h2>
        <button class="nx-btn nx-btn-sm" type="button" :disabled="catalogLoading" @click="loadBotCatalog">
          ↺ Actualiser le catalogue
        </button>
      </div>
      <p v-if="catalogLoading && !botCatalog" class="admin-loading">Chargement du catalogue…</p>
      <div v-else-if="!botCatalog" class="admin-empty">Impossible de charger le catalogue.</div>
      <div v-else class="profiles-grid">
        <div class="profiles-list-col">
          <p class="admin-hint">
            Chaque profil définit l’ordre dans lequel le bot tente les actions (summon, PvP, campagne, etc.).
            Les profils intégrés peuvent être surchargés en base ; les profils personnalisés héritent d’un profil code
            (cooldowns, fatigue, donjon…).
          </p>
          <ul class="profiles-key-list">
            <li
              v-for="p in botCatalog.profiles"
              :key="p.profile_key"
              class="profiles-key-item"
              :class="{ active: selectedCatalogProfileKey === p.profile_key }"
              @click="selectCatalogProfile(p)"
            >
              <span class="pk-name">{{ p.display_label }}</span>
              <code class="pk-code">{{ p.profile_key }}</code>
              <span v-if="p.is_built_in" class="pk-tag">intégré</span>
              <span v-else class="pk-tag pk-tag-custom">custom</span>
            </li>
          </ul>
        </div>
        <div class="profiles-editor-col">
          <template v-if="selectedCatalogProfile">
            <h3 class="profiles-h3">{{ selectedCatalogProfile.display_label }}</h3>
            <label class="form-row">
              <span class="form-label">Libellé affiché</span>
              <input v-model="editProfLabel" class="nx-input" maxlength="128" />
            </label>
            <label v-if="!selectedCatalogProfile.is_built_in" class="form-row">
              <span class="form-label">Profil de base (héritage)</span>
              <select v-model="editProfExtends" class="nx-input" style="width: auto">
                <option v-for="b in builtInProfileKeys" :key="b" :value="b">{{ b }}</option>
              </select>
            </label>
            <p class="form-label" style="margin-top: 1rem">Ordre des actions (premier = priorité la plus haute)</p>
            <ul class="priority-list">
              <li v-for="(aid, idx) in editProfPriority" :key="aid" class="priority-row">
                <span class="pri-idx">{{ idx + 1 }}.</span>
                <span class="pri-label">{{ actionLabelFr(aid) }}</span>
                <span class="pri-actions">
                  <button
                    type="button"
                    class="nx-btn nx-btn-sm"
                    :disabled="idx === 0"
                    @click="movePriorityUp(idx)"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class="nx-btn nx-btn-sm"
                    :disabled="idx === editProfPriority.length - 1"
                    @click="movePriorityDown(idx)"
                  >
                    ↓
                  </button>
                </span>
              </li>
            </ul>
            <div class="form-actions">
              <button type="button" class="nx-btn nx-btn-primary" :disabled="saving" @click="saveProfileDefinition">
                {{ saving ? '…' : 'Enregistrer' }}
              </button>
              <button
                v-if="selectedCatalogProfile.has_db_row"
                type="button"
                class="nx-btn nx-btn-warning"
                :disabled="saving"
                @click="resetOrDeleteProfileDefinition"
              >
                {{ selectedCatalogProfile.is_built_in ? 'Réinitialiser (code)' : 'Supprimer le profil' }}
              </button>
            </div>
          </template>
          <p v-else class="admin-empty">Sélectionnez un profil à gauche.</p>

          <div class="new-profile-box">
            <h3 class="profiles-h3">Nouveau profil personnalisé</h3>
            <p class="admin-hint">
              Clé technique unique (minuscules, chiffres, underscore). Hérite des paramètres du profil de base choisi.
            </p>
            <label class="form-row">
              <span class="form-label">Clé (ex. mon_farmer_agressif)</span>
              <input v-model="newProf.key" class="nx-input" placeholder="ma_clé" maxlength="64" />
            </label>
            <label class="form-row">
              <span class="form-label">Libellé</span>
              <input v-model="newProf.display_label" class="nx-input" placeholder="Mon farmer" maxlength="128" />
            </label>
            <label class="form-row">
              <span class="form-label">Profil de base</span>
              <select v-model="newProf.extends_key" class="nx-input" style="width: auto">
                <option v-for="b in builtInProfileKeys" :key="b" :value="b">{{ b }}</option>
              </select>
            </label>
            <div class="form-actions">
              <button type="button" class="nx-btn nx-btn-primary" :disabled="saving" @click="createProfileDefinition">
                {{ saving ? '…' : 'Créer le profil' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-show="pageTab === 'bots'" class="bots-layout">
      <!-- ── Panneau liste ── -->
      <div class="bots-list-panel nx-panel">
        <div class="panel-toolbar">
          <span class="panel-title">{{ bots.length }} bot{{ bots.length > 1 ? 's' : '' }}</span>
          <button class="nx-btn nx-btn-sm" :disabled="loading" @click="loadBots">↺ Actualiser</button>
          <button class="nx-btn nx-btn-sm nx-btn-primary" @click="openCreateForm">+ Créer un bot</button>
        </div>

        <p v-if="loading && !bots.length" class="admin-loading">Chargement…</p>
        <div v-else-if="!bots.length" class="admin-empty">Aucun bot configuré.</div>

        <ul v-else class="bots-list">
          <li
            v-for="bot in bots"
            :key="bot.user_id"
            class="bot-item"
            :class="{ selected: selectedBot?.user_id === bot.user_id, disabled: !bot.enabled }"
            @click="selectBot(bot)"
          >
            <span class="bot-status-dot" :class="botStatusClass(bot)" :title="botStatusLabel(bot)" />
            <span class="bot-name">{{ bot.display_name }}</span>
            <span class="bot-profile-badge" :class="profileBadgeClass(bot.profile)">{{ bot.profile }}</span>
            <span class="bot-action-label">{{ bot.current_action ?? 'idle' }}</span>
            <span class="bot-count" title="Actions effectuées">{{ bot.action_count ?? 0 }}</span>
          </li>
        </ul>
      </div>

      <!-- ── Panneau détail / création ── -->
      <div class="bots-detail-panel nx-panel">

        <!-- Formulaire de création -->
        <template v-if="mode === 'create'">
          <h2 class="panel-title">Nouveau bot</h2>
          <form class="bot-form" @submit.prevent="createBot">
            <label class="form-row">
              <span class="form-label">Nom d'affichage</span>
              <input v-model="form.display_name" class="nx-input" placeholder="Bot_Alpha" required maxlength="64" />
            </label>
            <label class="form-row">
              <span class="form-label">Profil</span>
              <select v-model="form.profile" class="nx-input">
                <option v-for="p in profileSelectOptions" :key="p.id" :value="p.id">{{ p.label }}</option>
              </select>
            </label>
            <p class="profile-desc">{{ profileDesc(form.profile) }}</p>
            <div class="form-actions">
              <button type="submit" class="nx-btn nx-btn-primary" :disabled="saving">
                {{ saving ? 'Création…' : 'Créer' }}
              </button>
              <button type="button" class="nx-btn" @click="mode = 'detail'">Annuler</button>
            </div>
          </form>
        </template>

        <!-- Détail bot -->
        <template v-else-if="selectedBot">
          <div class="detail-header">
            <h2 class="panel-title">{{ selectedBot.display_name }}</h2>
            <span class="bot-id-label">ID {{ selectedBot.user_id }}</span>
          </div>

          <!-- Statut -->
          <div class="detail-status nx-panel-inner">
            <div class="status-row">
              <span class="status-key">Statut</span>
              <span class="status-val" :class="{ 'text-green': selectedBot.enabled, 'text-muted': !selectedBot.enabled }">
                {{ selectedBot.enabled ? 'Actif' : 'Désactivé' }}
              </span>
            </div>
            <div class="status-row">
              <span class="status-key">Profil</span>
              <span class="status-val bot-profile-badge" :class="profileBadgeClass(selectedBot.profile)">{{ selectedBot.profile }}</span>
            </div>
            <div class="status-row">
              <span class="status-key">Dernière action</span>
              <span class="status-val">{{ selectedBot.current_action ?? '—' }}</span>
            </div>
            <div class="status-row">
              <span class="status-key">Prochaine action</span>
              <span class="status-val">{{ formatDateRelative(selectedBot.next_action_at) }}</span>
            </div>
            <div class="status-row">
              <span class="status-key">Actions totales</span>
              <span class="status-val">{{ selectedBot.action_count ?? 0 }}</span>
            </div>
            <div class="status-row">
              <span class="status-key">Email</span>
              <span class="status-val text-muted">{{ selectedBot.email }}</span>
            </div>
          </div>

          <!-- Onglets -->
          <div class="detail-tabs">
            <button class="tab-btn" :class="{ active: detailTab === 'edit' }"       @click="detailTab = 'edit'">Paramètres</button>
            <button class="tab-btn" :class="{ active: detailTab === 'wallet' }"     @click="detailTab = 'wallet'">Wallet</button>
            <button class="tab-btn" :class="{ active: detailTab === 'logs' }"      @click="detailTab = 'logs'; loadLogs()">Logs</button>
            <button class="tab-btn" :class="{ active: detailTab === 'stats' }"     @click="openStatsTab">Stats</button>
            <button class="tab-btn" :class="{ active: detailTab === 'artifacts' }" @click="openArtifactsTab">Artefacts</button>
            <button class="tab-btn" :class="{ active: detailTab === 'danger' }"    @click="detailTab = 'danger'">Danger</button>
          </div>

          <!-- Onglet Paramètres -->
          <div v-show="detailTab === 'edit'" class="tab-content">
            <div class="form-row">
              <span class="form-label">Profil</span>
              <select v-model="editProfile" class="nx-input" style="width:auto">
                <option v-for="p in profileSelectOptions" :key="p.id" :value="p.id">{{ p.label }}</option>
              </select>
            </div>
            <p class="profile-desc">{{ profileDesc(editProfile) }}</p>
            <div class="form-actions">
              <button class="nx-btn nx-btn-primary" :disabled="saving" @click="saveProfile">
                {{ saving ? '…' : 'Sauvegarder' }}
              </button>
              <button
                class="nx-btn"
                :class="selectedBot.enabled ? 'nx-btn-warning' : 'nx-btn-primary'"
                :disabled="saving"
                @click="toggleEnabled"
              >
                {{ selectedBot.enabled ? 'Désactiver' : 'Activer' }}
              </button>
              <button class="nx-btn" :disabled="saving" @click="resetState" title="Efface les cooldowns">
                ↺ Reset cooldowns
              </button>
            </div>
          </div>

          <!-- Onglet Wallet -->
          <div v-show="detailTab === 'wallet'" class="tab-content">
            <p class="admin-hint">Ajoute des ressources au bot (s'ajoute au solde existant).</p>
            <div class="wallet-grid">
              <label class="wallet-row" v-for="field in WALLET_FIELDS" :key="field.key">
                <span class="wallet-icon">{{ field.icon }}</span>
                <span class="wallet-label">{{ field.label }}</span>
                <input v-model.number="walletForm[field.key]" type="number" min="0" class="nx-input wallet-input" />
              </label>
            </div>
            <div class="form-actions">
              <button class="nx-btn nx-btn-primary" :disabled="saving" @click="giveWallet">
                {{ saving ? '…' : '+ Donner' }}
              </button>
            </div>
          </div>

          <!-- Onglet Logs -->
          <div v-show="detailTab === 'logs'" class="tab-content">
            <div class="logs-toolbar">
              <button class="nx-btn nx-btn-sm" :disabled="logsLoading" @click="loadLogs">↺</button>
              <span class="logs-count">{{ logs.length }} entrées</span>
            </div>
            <p v-if="logsLoading" class="admin-loading">Chargement…</p>
            <div v-else-if="!logs.length" class="admin-empty">Aucun log pour ce bot.</div>
            <div v-else class="logs-table-wrapper">
              <table class="logs-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Action</th>
                    <th>OK</th>
                    <th>Détail</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="log in logs" :key="log.id" :class="{ 'log-fail': !log.success }">
                    <td class="log-date">{{ formatDate(log.created_at) }}</td>
                    <td class="log-action">{{ log.action }}</td>
                    <td class="log-ok">{{ log.success ? '✓' : '✗' }}</td>
                    <td class="log-detail">{{ formatDetail(log.detail_json) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Onglet Stats -->
          <div v-show="detailTab === 'stats'" class="tab-content stats-tab">
            <div class="stats-toolbar">
              <button class="nx-btn nx-btn-sm" :disabled="statsLoading" @click="loadStats">↺ Actualiser</button>
            </div>
            <p v-if="statsLoading" class="admin-loading">Chargement des stats…</p>
            <div v-else-if="!botStats" class="admin-empty">Impossible de charger les stats.</div>
            <div v-else class="stats-scroll">
              <section class="stats-block">
                <h3 class="stats-h3">Compte &amp; PvP (live)</h3>
                <p class="stats-line"><strong>Elo PvP :</strong> {{ botStats.user?.pvp_elo ?? '—' }} &nbsp;|&nbsp; <strong>Elo classique :</strong> {{ botStats.user?.elo ?? '—' }}</p>
                <p class="stats-line"><strong>Combats PvP enregistrés :</strong> {{ botStats.pvp?.battles_total ?? 0 }}
                  — victoires {{ botStats.pvp?.wins ?? 0 }}, défaites {{ botStats.pvp?.losses ?? 0 }}, nuls {{ botStats.pvp?.draws ?? 0 }}</p>
                <p class="stats-line"><strong>vs joueurs :</strong> {{ botStats.pvp?.vs_player?.wins ?? 0 }}V / {{ botStats.pvp?.vs_player?.losses ?? 0 }}D
                  &nbsp;|&nbsp; <strong>vs PNJ :</strong> {{ botStats.pvp?.vs_npc?.wins ?? 0 }}V / {{ botStats.pvp?.vs_npc?.losses ?? 0 }}D</p>
              </section>

              <section class="stats-block">
                <h3 class="stats-h3">Campagne (saison {{ botStats.seasonKey }})</h3>
                <p class="stats-line"><strong>Normal</strong> — étages validés : {{ botStats.campaign?.normal?.stages_cleared ?? 0 }}
                  — plus loin : {{ formatFurthest(botStats.campaign?.normal?.furthest) }}</p>
                <p class="stats-line"><strong>Difficile</strong> — étages validés : {{ botStats.campaign?.hard?.stages_cleared ?? 0 }}
                  — plus loin : {{ formatFurthest(botStats.campaign?.hard?.furthest) }}</p>
                <h4 class="stats-h4">Depuis les logs bot (2500 derniers combats campagne/donjon)</h4>
                <p class="stats-line">Campagne : {{ botStats.campaign_from_logs?.attempts ?? 0 }} essais, {{ botStats.campaign_from_logs?.wins ?? 0 }} victoires</p>
                <div v-if="campaignStageRows.length" class="mini-table-wrap">
                  <table class="mini-table">
                    <thead><tr><th>Étape</th><th>Essais</th><th>Victoires</th></tr></thead>
                    <tbody>
                      <tr v-for="row in campaignStageRows" :key="row.key">
                        <td>{{ row.key }}</td><td>{{ row.attempts }}</td><td>{{ row.wins }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section class="stats-block">
                <h3 class="stats-h3">Donjons</h3>
                <p class="stats-line"><strong>Depuis les logs :</strong> {{ botStats.dungeon_from_logs?.attempts ?? 0 }} tentatives de niveau, {{ botStats.dungeon_from_logs?.wins ?? 0 }} réussites</p>
                <div v-if="dungeonLogRows.length" class="mini-table-wrap">
                  <table class="mini-table">
                    <thead><tr><th>Élément / niveau</th><th>Essais</th><th>Victoires</th></tr></thead>
                    <tbody>
                      <tr v-for="row in dungeonLogRows" :key="row.key">
                        <td>{{ row.label }}</td><td>{{ row.attempts }}</td><td>{{ row.wins }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <h4 class="stats-h4">Progression débloquée (DB)</h4>
                <div v-if="(botStats.dungeon?.progress || []).length" class="mini-table-wrap">
                  <table class="mini-table">
                    <thead><tr><th>Élément</th><th>Niv. max débloqué</th></tr></thead>
                    <tbody>
                      <tr v-for="d in botStats.dungeon.progress" :key="d.element">
                        <td>{{ d.element }}</td><td>{{ d.max_unlocked_level }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p v-else class="stats-muted">Aucune ligne user_dungeon_progress.</p>
                <h4 class="stats-h4">Étages complétés (first clear)</h4>
                <p class="stats-tags">{{ dungeonFloorsLabel }}</p>
                <h4 class="stats-h4">Run actif</h4>
                <pre v-if="botStats.dungeon?.active_run" class="stats-pre">{{ JSON.stringify(botStats.dungeon.active_run, null, 2) }}</pre>
                <p v-else class="stats-muted">Aucun run donjon en cours.</p>
              </section>

              <section class="stats-block">
                <h3 class="stats-h3">Historique campagne par saison</h3>
                <div class="mini-table-wrap">
                  <table class="mini-table">
                    <thead><tr><th>Saison</th><th>Normal — étages</th><th>Normal — max ch/s</th><th>Hard — étages</th><th>Hard — max ch/s</th></tr></thead>
                    <tbody>
                      <tr v-for="s in mergedSeasonRows" :key="s.season">
                        <td>{{ s.season }}</td>
                        <td>{{ s.normalCleared }}</td><td>{{ s.normalMax }}</td>
                        <td>{{ s.hardCleared }}</td><td>{{ s.hardMax }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section class="stats-block">
                <h3 class="stats-h3">Actions bot (tous les logs)</h3>
                <div class="mini-table-wrap">
                  <table class="mini-table">
                    <thead><tr><th>Action</th><th>Total</th><th>Succès</th></tr></thead>
                    <tbody>
                      <tr v-for="r in (botStats.bot_logs_by_action || [])" :key="r.action">
                        <td>{{ r.action }}</td><td>{{ r.total }}</td><td>{{ r.successes }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section class="stats-block">
                <h3 class="stats-h3">Unités les plus engagées en combat</h3>
                <p class="stats-muted">Basé sur combat_victories + combat_defeats (toutes sources).</p>
                <div class="mini-table-wrap">
                  <table class="mini-table">
                    <thead>
                      <tr>
                        <th>Unité</th><th>Niv.</th><th>P</th><th>V</th><th>D</th><th>Kills</th><th>Dégâts</th><th>Soins</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="u in (botStats.top_units || [])" :key="u.user_unit_id">
                        <td>{{ u.unit_name }}</td>
                        <td>{{ u.level }}</td>
                        <td>{{ u.power_level ?? '—' }}</td>
                        <td>{{ u.combat_victories ?? 0 }}</td>
                        <td>{{ u.combat_defeats ?? 0 }}</td>
                        <td>{{ u.combat_kills ?? 0 }}</td>
                        <td>{{ u.combat_damage_dealt ?? 0 }}</td>
                        <td>{{ u.combat_healing_done ?? 0 }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section class="stats-block">
                <h3 class="stats-h3">Compositions (presets d’équipe)</h3>
                <div v-for="p in (botStats.team_presets || [])" :key="p.preset_index" class="preset-block">
                  <div class="preset-title">Preset {{ p.preset_index }}{{ p.preset_name ? ` — ${p.preset_name}` : '' }}
                    <span class="stats-muted">(noyau #{{ p.selected_noyau_index ?? 0 }})</span>
                  </div>
                  <div class="preset-row"><strong>CAC :</strong> {{ formatPresetSlots(p.front) }}</div>
                  <div class="preset-row"><strong>Distance :</strong> {{ formatPresetSlots(p.back) }}</div>
                </div>
              </section>

              <section class="stats-block">
                <h3 class="stats-h3">État runtime bot</h3>
                <p class="stats-line">Ticks enregistrés : {{ botStats.runtime?.action_count ?? '—' }} — dernière action : {{ botStats.runtime?.current_action ?? '—' }}</p>
                <p class="stats-line">Dernier tick : {{ formatDate(botStats.runtime?.last_action_at ?? null) }}</p>
                <pre class="stats-pre">{{ JSON.stringify(botStats.runtime?.dungeon_state ?? {}, null, 2) }}</pre>
              </section>
            </div>
          </div>

          <!-- Onglet Artefacts -->
          <div v-show="detailTab === 'artifacts'" class="tab-content artifacts-tab">
            <div class="stats-toolbar">
              <button class="nx-btn nx-btn-sm" :disabled="artifactsLoading" @click="loadArtifacts">↺ Actualiser</button>
            </div>
            <p v-if="artifactsLoading" class="admin-loading">Chargement…</p>
            <div v-else-if="!botArtifacts" class="admin-empty">Impossible de charger les artefacts.</div>
            <template v-else>
              <p class="stats-line">
                <strong>Total :</strong> {{ botArtifacts.summary?.total ?? 0 }}
                — équipés : {{ botArtifacts.summary?.equipped ?? 0 }}
                — inventaire : {{ botArtifacts.summary?.inventory ?? 0 }}
              </p>
              <div class="mini-table-wrap artifacts-table-wrap">
                <table class="mini-table">
                  <thead>
                    <tr><th>ID</th><th>Stat</th><th>Niv.</th><th>Statut</th><th>Sur l’unité</th><th>Créé</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="a in (botArtifacts.artifacts || [])" :key="a.id">
                      <td>{{ a.id }}</td>
                      <td :title="a.stat_key">{{ a.stat_label_fr || a.stat_key }}</td>
                      <td>{{ a.level }}</td>
                      <td>{{ a.status === 'equipped' ? 'Équipé' : 'Inventaire' }}</td>
                      <td>
                        <template v-if="a.equipped_on">{{ a.equipped_on.name }} (Niv.{{ a.equipped_on.level }}{{ a.equipped_on.specialization ? ', spé ' + a.equipped_on.specialization : '' }})</template>
                        <template v-else>—</template>
                      </td>
                      <td class="cell-nowrap">{{ formatDate(a.created_at) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
          </div>

          <!-- Onglet Danger -->
          <div v-show="detailTab === 'danger'" class="tab-content danger-tab">
            <p class="admin-hint danger-hint">
              ⚠️ La suppression est <strong>irréversible</strong> et efface toutes les données liées (unités, artefacts, progression…).
            </p>
            <button class="nx-btn nx-btn-danger" :disabled="saving" @click="confirmDelete">
              Supprimer définitivement ce bot
            </button>
          </div>
        </template>

        <!-- Placeholder -->
        <div v-else class="detail-placeholder">
          <p>Sélectionnez un bot dans la liste ou créez-en un nouveau.</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api from '../api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Bot {
  user_id: number;
  display_name: string;
  email: string;
  profile: string;
  enabled: number;
  created_at: string;
  current_action: string | null;
  next_action_at: string | null;
  last_action_at: string | null;
  action_count: number;
  total_logs: number;
}

interface BotLog {
  id: number;
  action: string;
  success: number;
  detail_json: string | null;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const tickInterval = 60_000;

const FALLBACK_PROFILE_OPTIONS = [
  { id: 'balanced', label: 'Balanced' },
  { id: 'farmer', label: 'Farmer' },
  { id: 'pvp_focused', label: 'PvP Focused' },
  { id: 'guild_warrior', label: 'Guild Warrior' },
  { id: 'gacha_addict', label: 'Gacha Addict' },
];

const KNOWN_PROFILE_CSS = new Set([
  'balanced',
  'farmer',
  'pvp_focused',
  'guild_warrior',
  'gacha_addict',
]);

interface BotCatalogProfile {
  profile_key: string;
  display_label: string;
  extends_key: string | null;
  is_built_in: boolean;
  has_db_row: boolean;
  action_priority: string[];
}

interface BotCatalog {
  actions: { id: string; labelFr: string }[];
  default_priority: string[];
  profiles: BotCatalogProfile[];
}

const PROFILE_DESCS: Record<string, string> = {
  balanced:      'Équilibre entre toutes les activités. Priorité standard.',
  farmer:        'Farm donjon en priorité pour obtenir des artefacts. Améliore activement ses artefacts.',
  pvp_focused:   'Maximise le PvP. Cooldowns PvP très courts. Ignore le donjon au profit du classement.',
  guild_warrior: 'Concentré sur la guerre de guilde. Participe à chaque phase d\'attaque disponible.',
  gacha_addict:  'Invoque dès que possible, répète souvent. Accumule des unités en priorité.',
};

const WALLET_FIELDS = [
  { key: 'credits',        label: 'Crédits',          icon: '💰' },
  { key: 'cores',          label: 'Cores',             icon: '🔷' },
  { key: 'gold',           label: 'Or',                icon: '🪙' },
  { key: 'fragments',      label: 'Fragments',         icon: '🧩' },
  { key: 'divine_credits', label: 'Crédits divins',    icon: '💠' },
  { key: 'divine_cores',   label: 'Cores divins',      icon: '💎' },
];

// ── State ─────────────────────────────────────────────────────────────────────

const pageTab = ref<'bots' | 'profiles'>('bots');
const botCatalog = ref<BotCatalog | null>(null);
const catalogLoading = ref(false);
const selectedCatalogProfileKey = ref<string | null>(null);
const editProfLabel = ref('');
const editProfExtends = ref('balanced');
const editProfPriority = ref<string[]>([]);
const newProf = ref({ key: '', display_label: '', extends_key: 'balanced' });

const loading    = ref(false);
const saving     = ref(false);
const logsLoading = ref(false);
const errorMsg   = ref('');
const successMsg = ref('');

const bots        = ref<Bot[]>([]);
const selectedBot = ref<Bot | null>(null);
const mode        = ref<'detail' | 'create'>('detail');
const detailTab   = ref<'edit' | 'wallet' | 'logs' | 'stats' | 'artifacts' | 'danger'>('edit');

const form = ref({ display_name: '', profile: 'balanced' });
const editProfile = ref('balanced');
const walletForm  = ref<Record<string, number>>({
  credits: 1000, cores: 5, gold: 10000, fragments: 0, divine_credits: 0, divine_cores: 0,
});
const logs = ref<BotLog[]>([]);
const statsLoading = ref(false);
const artifactsLoading = ref(false);
const botStats = ref<Record<string, any> | null>(null);
const botArtifacts = ref<{ summary?: { total: number; equipped: number; inventory: number }; artifacts?: any[] } | null>(null);

// ── Lifecycle ─────────────────────────────────────────────────────────────────

const campaignStageRows = computed(() => {
  const by = botStats.value?.campaign_from_logs?.byStage;
  if (!by || typeof by !== 'object') return [];
  return Object.entries(by)
    .map(([key, v]: [string, any]) => ({ key, attempts: v.attempts ?? 0, wins: v.wins ?? 0 }))
    .sort((a, b) => b.attempts - a.attempts);
});

const dungeonLogRows = computed(() => {
  const by = botStats.value?.dungeon_from_logs?.byElementLevel;
  if (!by || typeof by !== 'object') return [];
  return Object.entries(by)
    .map(([key, v]: [string, any]) => ({
      key,
      label: `${v.element ?? '?'} — niveau ${v.level ?? '?'}`,
      attempts: v.attempts ?? 0,
      wins: v.wins ?? 0,
    }))
    .sort((a, b) => b.attempts - a.attempts);
});

const mergedSeasonRows = computed(() => {
  const sn = botStats.value?.campaign?.historyNormal || [];
  const sh = botStats.value?.campaign?.historyHard || [];
  const seasons = new Set<string>();
  sn.forEach((x: any) => seasons.add(x.season_key));
  sh.forEach((x: any) => seasons.add(x.season_key));
  const list = [...seasons].sort().reverse();
  return list.map((season) => {
    const n = sn.find((x: any) => x.season_key === season);
    const h = sh.find((x: any) => x.season_key === season);
    return {
      season,
      normalCleared: n?.stages_cleared ?? 0,
      normalMax: n?.furthest_score ? `Ch.${n.furthest_chapter} S.${n.furthest_stage}` : '—',
      hardCleared: h?.stages_cleared ?? 0,
      hardMax: h?.furthest_score ? `Ch.${h.furthest_chapter} S.${h.furthest_stage}` : '—',
    };
  });
});

const dungeonFloorsLabel = computed(() => {
  const floors = botStats.value?.dungeon?.floors_cleared || [];
  if (!floors.length) return 'Aucun étage enregistré.';
  return floors.map((f: any) => `${f.element} ${f.level}`).join(' · ');
});

const selectedCatalogProfile = computed(() => {
  const k = selectedCatalogProfileKey.value;
  if (!k || !botCatalog.value) return null;
  return botCatalog.value.profiles.find((p) => p.profile_key === k) ?? null;
});

const builtInProfileKeys = computed(() => {
  if (!botCatalog.value?.profiles?.length) return FALLBACK_PROFILE_OPTIONS.map((o) => o.id);
  return botCatalog.value.profiles.filter((p) => p.is_built_in).map((p) => p.profile_key);
});

const profileSelectOptions = computed(() => {
  if (!botCatalog.value?.profiles?.length) return FALLBACK_PROFILE_OPTIONS;
  return botCatalog.value.profiles.map((p) => ({
    id: p.profile_key,
    label: p.display_label || p.profile_key,
  }));
});

onMounted(() => {
  loadBots();
  loadBotCatalog();
});

// ── Methods ───────────────────────────────────────────────────────────────────

async function loadBotCatalog() {
  catalogLoading.value = true;
  try {
    const res = await api.get('/admin/bot-profile-catalog');
    botCatalog.value = res.data ?? null;
    const k = selectedCatalogProfileKey.value;
    if (k && botCatalog.value) {
      const p = botCatalog.value.profiles.find((x) => x.profile_key === k);
      if (p) selectCatalogProfile(p);
    }
  } catch {
    botCatalog.value = null;
  } finally {
    catalogLoading.value = false;
  }
}

function openProfilesTab() {
  pageTab.value = 'profiles';
  loadBotCatalog();
}

function selectCatalogProfile(p: BotCatalogProfile) {
  selectedCatalogProfileKey.value = p.profile_key;
  editProfLabel.value = p.display_label;
  editProfExtends.value = p.extends_key || 'balanced';
  editProfPriority.value = [...p.action_priority];
}

function actionLabelFr(id: string) {
  return botCatalog.value?.actions.find((a) => a.id === id)?.labelFr ?? id;
}

function movePriorityUp(i: number) {
  const arr = editProfPriority.value;
  if (i < 1) return;
  const next = [...arr];
  [next[i - 1], next[i]] = [next[i], next[i - 1]];
  editProfPriority.value = next;
}

function movePriorityDown(i: number) {
  const arr = editProfPriority.value;
  if (i >= arr.length - 1) return;
  const next = [...arr];
  [next[i], next[i + 1]] = [next[i + 1], next[i]];
  editProfPriority.value = next;
}

async function saveProfileDefinition() {
  const sel = selectedCatalogProfile.value;
  if (!sel) return;
  saving.value = true;
  clearMessages();
  try {
    const body: Record<string, unknown> = {
      display_label: editProfLabel.value,
      action_priority: editProfPriority.value,
    };
    if (!sel.is_built_in) body.extends_key = editProfExtends.value;
    await api.put(`/admin/bot-profile-definitions/${encodeURIComponent(sel.profile_key)}`, body);
    successMsg.value = 'Profil enregistré.';
    await loadBotCatalog();
  } catch (err: any) {
    errorMsg.value = err.response?.data?.error ?? 'Erreur enregistrement profil.';
  } finally {
    saving.value = false;
  }
}

async function createProfileDefinition() {
  const key = newProf.value.key.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(key)) {
    errorMsg.value = 'Clé invalide : commence par une lettre, puis minuscules, chiffres ou underscore.';
    return;
  }
  saving.value = true;
  clearMessages();
  try {
    const defPri = botCatalog.value?.default_priority?.length
      ? [...botCatalog.value.default_priority]
      : [];
    await api.put(`/admin/bot-profile-definitions/${encodeURIComponent(key)}`, {
      display_label: newProf.value.display_label.trim() || key,
      extends_key: newProf.value.extends_key,
      action_priority: defPri,
    });
    successMsg.value = `Profil « ${key} » créé.`;
    newProf.value = { key: '', display_label: '', extends_key: 'balanced' };
    await loadBotCatalog();
    const created = botCatalog.value?.profiles.find((x) => x.profile_key === key);
    if (created) selectCatalogProfile(created);
  } catch (err: any) {
    errorMsg.value = err.response?.data?.error ?? 'Erreur création profil.';
  } finally {
    saving.value = false;
  }
}

async function resetOrDeleteProfileDefinition() {
  const sel = selectedCatalogProfile.value;
  if (!sel?.has_db_row) return;
  const msg = sel.is_built_in
    ? `Réinitialiser le profil intégré « ${sel.profile_key} » ? Les surcharges en base seront supprimées.`
    : `Supprimer définitivement le profil « ${sel.profile_key} » ?`;
  if (!confirm(msg)) return;
  saving.value = true;
  clearMessages();
  try {
    await api.delete(`/admin/bot-profile-definitions/${encodeURIComponent(sel.profile_key)}`);
    successMsg.value = sel.is_built_in ? 'Surcharges supprimées.' : 'Profil supprimé.';
    selectedCatalogProfileKey.value = null;
    editProfPriority.value = [];
    await loadBotCatalog();
    await loadBots();
  } catch (err: any) {
    errorMsg.value = err.response?.data?.error ?? 'Erreur suppression.';
  } finally {
    saving.value = false;
  }
}

function profileBadgeClass(profileId: string) {
  return KNOWN_PROFILE_CSS.has(profileId) ? `profile-${profileId}` : 'profile-custom';
}

async function loadBots() {
  loading.value = true;
  errorMsg.value = '';
  try {
    const res = await api.get('/admin/bots');
    bots.value = res.data.bots ?? [];
    // Rafraîchir le bot sélectionné si besoin
    if (selectedBot.value) {
      const found = bots.value.find(b => b.user_id === selectedBot.value!.user_id);
      if (found) selectedBot.value = found;
    }
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message ?? 'Erreur lors du chargement des bots.';
  } finally {
    loading.value = false;
  }
}

async function loadLogs() {
  if (!selectedBot.value) return;
  logsLoading.value = true;
  try {
    const res = await api.get(`/admin/bots/${selectedBot.value.user_id}/logs`);
    logs.value = res.data.logs ?? [];
  } catch {
    logs.value = [];
  } finally {
    logsLoading.value = false;
  }
}

async function loadStats() {
  if (!selectedBot.value) return;
  statsLoading.value = true;
  try {
    const res = await api.get(`/admin/bots/${selectedBot.value.user_id}/stats`);
    botStats.value = res.data.stats ?? null;
  } catch {
    botStats.value = null;
  } finally {
    statsLoading.value = false;
  }
}

async function loadArtifacts() {
  if (!selectedBot.value) return;
  artifactsLoading.value = true;
  try {
    const res = await api.get(`/admin/bots/${selectedBot.value.user_id}/artifacts`);
    botArtifacts.value = res.data;
  } catch {
    botArtifacts.value = null;
  } finally {
    artifactsLoading.value = false;
  }
}

function openStatsTab() {
  detailTab.value = 'stats';
  loadStats();
}

function openArtifactsTab() {
  detailTab.value = 'artifacts';
  loadArtifacts();
}

function formatFurthest(f: { chapter?: number; stage?: number } | null | undefined) {
  if (!f || f.chapter == null || f.stage == null) return '—';
  return `Chapitre ${f.chapter}, étage ${f.stage}`;
}

function formatPresetSlots(slots: { name?: string; level?: number; element?: string }[]) {
  if (!slots?.length) return '—';
  return slots
    .map((s) => `${s.name ?? '?'} (Niv.${s.level ?? '?'})${s.element ? ' [' + s.element + ']' : ''}`)
    .join(' · ');
}

function selectBot(bot: Bot) {
  selectedBot.value = bot;
  editProfile.value = bot.profile;
  mode.value = 'detail';
  detailTab.value = 'edit';
  logs.value = [];
  botStats.value = null;
  botArtifacts.value = null;
  clearMessages();
}

function openCreateForm() {
  selectedBot.value = null;
  mode.value = 'create';
  form.value = { display_name: '', profile: 'balanced' };
  clearMessages();
}

async function createBot() {
  saving.value = true;
  clearMessages();
  try {
    const res = await api.post('/admin/bots', form.value);
    successMsg.value = `Bot "${res.data.bot.display_name}" créé avec succès.`;
    await loadBots();
    const created = bots.value.find(b => b.user_id === res.data.bot.user_id);
    if (created) selectBot(created);
    else mode.value = 'detail';
  } catch (err: any) {
    errorMsg.value = err.response?.data?.error ?? 'Erreur lors de la création.';
  } finally {
    saving.value = false;
  }
}

async function saveProfile() {
  if (!selectedBot.value) return;
  saving.value = true;
  clearMessages();
  try {
    const res = await api.patch(`/admin/bots/${selectedBot.value.user_id}`, { profile: editProfile.value });
    successMsg.value = 'Profil mis à jour.';
    await loadBots();
    selectedBot.value = bots.value.find(b => b.user_id === selectedBot.value!.user_id) ?? selectedBot.value;
  } catch (err: any) {
    errorMsg.value = err.response?.data?.error ?? 'Erreur mise à jour profil.';
  } finally {
    saving.value = false;
  }
}

async function toggleEnabled() {
  if (!selectedBot.value) return;
  saving.value = true;
  clearMessages();
  try {
    const newEnabled = !selectedBot.value.enabled;
    await api.patch(`/admin/bots/${selectedBot.value.user_id}`, { enabled: newEnabled });
    successMsg.value = newEnabled ? 'Bot activé.' : 'Bot désactivé.';
    await loadBots();
    selectedBot.value = bots.value.find(b => b.user_id === selectedBot.value!.user_id) ?? selectedBot.value;
  } catch (err: any) {
    errorMsg.value = err.response?.data?.error ?? 'Erreur.';
  } finally {
    saving.value = false;
  }
}

async function resetState() {
  if (!selectedBot.value) return;
  saving.value = true;
  clearMessages();
  try {
    await api.post(`/admin/bots/${selectedBot.value.user_id}/reset-state`);
    successMsg.value = 'Cooldowns réinitialisés — le bot jouera dès le prochain tick.';
    await loadBots();
  } catch (err: any) {
    errorMsg.value = err.response?.data?.error ?? 'Erreur reset.';
  } finally {
    saving.value = false;
  }
}

async function giveWallet() {
  if (!selectedBot.value) return;
  saving.value = true;
  clearMessages();
  try {
    await api.post(`/admin/bots/${selectedBot.value.user_id}/give-wallet`, walletForm.value);
    successMsg.value = 'Ressources ajoutées au wallet du bot.';
  } catch (err: any) {
    errorMsg.value = err.response?.data?.error ?? 'Erreur wallet.';
  } finally {
    saving.value = false;
  }
}

async function confirmDelete() {
  if (!selectedBot.value) return;
  const name = selectedBot.value.display_name;
  if (!confirm(`Supprimer définitivement le bot "${name}" et toutes ses données ?`)) return;
  saving.value = true;
  clearMessages();
  try {
    await api.delete(`/admin/bots/${selectedBot.value.user_id}`);
    successMsg.value = `Bot "${name}" supprimé.`;
    selectedBot.value = null;
    mode.value = 'detail';
    await loadBots();
  } catch (err: any) {
    errorMsg.value = err.response?.data?.error ?? 'Erreur suppression.';
  } finally {
    saving.value = false;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clearMessages() {
  errorMsg.value = '';
  successMsg.value = '';
}

function profileDesc(id: string) {
  const staticD = PROFILE_DESCS[id];
  if (staticD) return staticD;
  const pr = botCatalog.value?.profiles.find((p) => p.profile_key === id);
  if (pr && !pr.is_built_in) {
    return `Profil personnalisé basé sur « ${pr.extends_key || 'balanced'} ». Priorités d’actions modifiables dans l’onglet Profils.`;
  }
  return '';
}

function botStatusClass(bot: Bot) {
  if (!bot.enabled) return 'status-disabled';
  if (!bot.last_action_at) return 'status-new';
  const since = Date.now() - new Date(bot.last_action_at).getTime();
  if (since < 5 * 60_000) return 'status-active';
  return 'status-idle';
}

function botStatusLabel(bot: Bot) {
  if (!bot.enabled) return 'Désactivé';
  if (!bot.last_action_at) return 'Jamais joué';
  const since = Date.now() - new Date(bot.last_action_at).getTime();
  if (since < 5 * 60_000) return 'Actif récemment';
  return 'En attente';
}

function formatDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatDateRelative(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  const diff = d.getTime() - Date.now();
  if (diff < 0) return 'Maintenant';
  const mins = Math.ceil(diff / 60_000);
  if (mins < 60) return `dans ${mins} min`;
  return `dans ${Math.ceil(mins / 60)} h`;
}

function formatDetail(raw: string | null) {
  if (!raw) return '—';
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const parts = [];

    // Résumé multi-portails (nouvelle logique summon)
    if (obj.summary && typeof obj.summary === 'object') {
      const portalLabels: Record<string, string> = {
        standard: 'std', core: 'core', resonance: 'res',
        divine_standard: 'div-std', divine_core: 'div-core', divine_resonance: 'div-res',
      };
      const portalParts = Object.entries(obj.summary).map(([t, v]: [string, any]) =>
        `${portalLabels[t] ?? t}×${v.total}${v.errors?.length ? '⚠' : ''}`
      );
      parts.push(portalParts.join(' '));
      if (obj.totalUnits !== undefined) parts.push(`→ ${obj.totalUnits} unité(s)`);
    } else {
      if (obj.type)        parts.push(`${obj.type}×${obj.count ?? 1}`);
      if (obj.unitsGained !== undefined) parts.push(`+${obj.unitsGained} unité(s)`);
    }

    if (obj.chapter)     parts.push(`ch${obj.chapter} s${obj.stage} (${obj.mode})`);
    if (obj.element)     parts.push(`${obj.element} lv${obj.level}`);
    if (obj.artifactId)  parts.push(`art#${obj.artifactId}`);
    if (obj.slotIndex !== undefined) parts.push(`slot#${obj.slotIndex}`);
    if (obj.eloAfter)    parts.push(`elo→${obj.eloAfter}`);
    // Raisons d'échec — toujours en dernier
    if (obj.error)       parts.push(`⚠ ${obj.error}`);
    if (obj.reason)      parts.push(`⚠ ${obj.reason}`);
    return parts.length ? parts.join(' · ') : JSON.stringify(obj).slice(0, 80);
  } catch {
    return String(raw).slice(0, 80);
  }
}
</script>

<style scoped>
.admin-bots { padding: 1.5rem 2rem; }
.admin-bots-nav {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}
.admin-page-header { margin-bottom: 1.5rem; }
.admin-title  { font-size: 1.6rem; font-weight: 700; margin: 0 0 .4rem; }
.admin-desc   { color: var(--color-text-muted, #aaa); margin: 0; }
.admin-error  { color: var(--color-error, #f87171); padding: .5rem 1rem; background: rgba(248,113,113,.1); border-radius: 6px; margin-bottom: 1rem; }
.admin-success{ color: var(--color-success, #4ade80); padding: .5rem 1rem; background: rgba(74,222,128,.1); border-radius: 6px; margin-bottom: 1rem; }
.admin-loading{ color: var(--color-text-muted, #aaa); font-style: italic; }
.admin-empty  { color: var(--color-text-muted, #aaa); font-style: italic; padding: 1rem 0; }
.admin-hint   { color: var(--color-text-muted, #aaa); font-size: .88rem; margin: 0 0 1rem; }

/* Layout */
.bots-layout {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 1.5rem;
  align-items: start;
}
@media (max-width: 900px) {
  .bots-layout { grid-template-columns: 1fr; }
}

/* List panel */
.bots-list-panel { padding: 1rem; }
.panel-toolbar {
  display: flex;
  align-items: center;
  gap: .5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.panel-title { font-weight: 600; flex: 1; }

.bots-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .3rem; }
.bot-item {
  display: grid;
  grid-template-columns: 10px 1fr auto auto auto;
  align-items: center;
  gap: .5rem;
  padding: .55rem .75rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background .15s;
  border: 1px solid transparent;
}
.bot-item:hover    { background: rgba(255,255,255,.04); }
.bot-item.selected { background: rgba(255,255,255,.08); border-color: var(--color-accent, #7c3aed); }
.bot-item.disabled { opacity: .5; }

.bot-status-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.status-active   { background: #4ade80; box-shadow: 0 0 6px #4ade80; }
.status-idle     { background: #facc15; }
.status-new      { background: #60a5fa; }
.status-disabled { background: #6b7280; }

.bot-name         { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bot-action-label { font-size: .78rem; color: var(--color-text-muted, #aaa); }
.bot-count        { font-size: .78rem; color: var(--color-text-muted, #aaa); }

/* Profile badges */
.bot-profile-badge {
  font-size: .72rem;
  padding: .15rem .45rem;
  border-radius: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.profile-balanced      { background: rgba(99,102,241,.25);  color: #a5b4fc; }
.profile-farmer        { background: rgba(74,222,128,.2);   color: #86efac; }
.profile-pvp_focused   { background: rgba(248,113,113,.2);  color: #fca5a5; }
.profile-guild_warrior { background: rgba(250,204,21,.2);   color: #fde68a; }
.profile-gacha_addict  { background: rgba(192,132,252,.25); color: #e9d5ff; }
.profile-custom        { background: rgba(148,163,184,.22); color: #e2e8f0; }

/* Catalogue profils */
.profiles-config {
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.5rem;
}
.profiles-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.profiles-h2 { margin: 0; font-size: 1.15rem; font-weight: 700; }
.profiles-h3 { margin: 0 0 0.75rem; font-size: 1rem; font-weight: 600; color: #c4b5fd; }
.profiles-grid {
  display: grid;
  grid-template-columns: minmax(240px, 320px) 1fr;
  gap: 1.5rem;
  align-items: start;
}
@media (max-width: 900px) {
  .profiles-grid { grid-template-columns: 1fr; }
}
.profiles-key-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 55vh;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}
.profiles-key-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.5rem;
  padding: 0.55rem 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.15s;
}
.profiles-key-item:last-child { border-bottom: none; }
.profiles-key-item:hover { background: rgba(255, 255, 255, 0.04); }
.profiles-key-item.active {
  background: rgba(99, 102, 241, 0.15);
  border-left: 3px solid var(--color-accent, #7c3aed);
}
.pk-name { font-weight: 600; flex: 1 1 100%; }
.pk-code { font-size: 0.72rem; opacity: 0.75; }
.pk-tag {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
}
.pk-tag-custom { background: rgba(52, 211, 153, 0.2); color: #6ee7b7; }
.priority-list {
  list-style: none;
  margin: 0 0 1rem;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  overflow: hidden;
}
.priority-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.65rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.priority-row:last-child { border-bottom: none; }
.pri-idx {
  font-size: 0.78rem;
  color: var(--color-text-muted, #aaa);
  width: 1.5rem;
}
.pri-label { flex: 1; font-size: 0.88rem; }
.pri-actions { display: flex; gap: 0.25rem; }
.new-profile-box {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px dashed rgba(255, 255, 255, 0.12);
}

/* Detail panel */
.bots-detail-panel { padding: 1.25rem 1.5rem; min-height: 400px; }
.detail-header     { display: flex; align-items: baseline; gap: .75rem; margin-bottom: 1rem; }
.bot-id-label      { font-size: .8rem; color: var(--color-text-muted, #aaa); }
.detail-placeholder{ display: flex; align-items: center; justify-content: center; min-height: 200px; color: var(--color-text-muted, #aaa); }

.detail-status {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: .4rem;
  padding: .75rem 1rem;
  background: rgba(255,255,255,.03);
  border-radius: 8px;
  margin-bottom: 1.25rem;
}
.status-row  { display: flex; flex-direction: column; gap: .1rem; }
.status-key  { font-size: .75rem; color: var(--color-text-muted, #aaa); text-transform: uppercase; letter-spacing: .04em; }
.status-val  { font-weight: 600; }
.text-green  { color: #4ade80; }
.text-muted  { color: var(--color-text-muted, #aaa); font-weight: 400; font-size: .85rem; }

/* Tabs */
.detail-tabs {
  display: flex;
  gap: .3rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid rgba(255,255,255,.08);
  padding-bottom: .5rem;
}
.tab-btn {
  background: transparent;
  border: none;
  padding: .35rem .75rem;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
  color: var(--color-text-muted, #aaa);
  font-size: .9rem;
  transition: all .15s;
}
.tab-btn:hover  { color: #fff; background: rgba(255,255,255,.05); }
.tab-btn.active { color: #fff; background: rgba(255,255,255,.1); font-weight: 600; }

.tab-content { padding: .5rem 0; }

/* Form */
.bot-form     { display: flex; flex-direction: column; gap: .9rem; max-width: 400px; }
.form-row     { display: flex; flex-direction: column; gap: .3rem; }
.form-label   { font-size: .85rem; color: var(--color-text-muted, #aaa); font-weight: 500; }
.form-actions { display: flex; gap: .6rem; flex-wrap: wrap; margin-top: .5rem; }
.profile-desc { font-size: .83rem; color: var(--color-text-muted, #aaa); font-style: italic; margin: 0; }

/* Wallet */
.wallet-grid  { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: .6rem; margin-bottom: 1rem; }
.wallet-row   { display: flex; align-items: center; gap: .5rem; }
.wallet-icon  { font-size: 1.1rem; width: 1.5rem; text-align: center; }
.wallet-label { font-size: .85rem; flex: 1; }
.wallet-input { width: 100px; text-align: right; }

/* Logs */
.logs-toolbar { display: flex; align-items: center; gap: .75rem; margin-bottom: .75rem; }
.logs-count   { font-size: .85rem; color: var(--color-text-muted, #aaa); }
.logs-table-wrapper { overflow-x: auto; max-height: 400px; overflow-y: auto; }
.logs-table   { width: 100%; border-collapse: collapse; font-size: .82rem; }
.logs-table th {
  text-align: left; padding: .4rem .6rem;
  border-bottom: 1px solid rgba(255,255,255,.1);
  color: var(--color-text-muted, #aaa);
  font-weight: 600;
  position: sticky; top: 0;
  background: var(--color-bg-card, #1e1e2e);
}
.logs-table td { padding: .3rem .6rem; border-bottom: 1px solid rgba(255,255,255,.04); }
.logs-table tr:hover td { background: rgba(255,255,255,.03); }
.log-fail td  { opacity: .6; }
.log-fail .log-ok { color: #f87171; }
.logs-table .log-ok { color: #4ade80; font-weight: 700; }
.log-date  { white-space: nowrap; color: var(--color-text-muted, #aaa); }
.log-action{ font-weight: 600; }
.log-detail{ color: var(--color-text-muted, #aaa); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Stats & artefacts */
.stats-tab, .artifacts-tab { max-height: 70vh; display: flex; flex-direction: column; }
.stats-toolbar { margin-bottom: .75rem; }
.stats-scroll { overflow-y: auto; flex: 1; padding-right: .25rem; display: flex; flex-direction: column; gap: 1.25rem; }
.stats-block {
  padding: .75rem 1rem;
  background: rgba(255,255,255,.03);
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,.06);
}
.stats-h3 { margin: 0 0 .5rem; font-size: 1rem; font-weight: 700; color: #c4b5fd; }
.stats-h4 { margin: .75rem 0 .35rem; font-size: .82rem; font-weight: 600; color: var(--color-text-muted, #aaa); }
.stats-line { margin: .25rem 0; font-size: .88rem; line-height: 1.45; }
.stats-muted { font-size: .8rem; color: var(--color-text-muted, #aaa); margin: .35rem 0; }
.stats-tags { font-size: .82rem; color: #e5e7eb; line-height: 1.5; }
.stats-pre {
  margin: .5rem 0 0;
  padding: .6rem .75rem;
  background: rgba(0,0,0,.35);
  border-radius: 6px;
  font-size: .72rem;
  overflow-x: auto;
  max-height: 200px;
}
.mini-table-wrap { overflow-x: auto; margin-top: .35rem; }
.artifacts-table-wrap { max-height: 360px; overflow-y: auto; }
.mini-table { width: 100%; border-collapse: collapse; font-size: .78rem; }
.mini-table th, .mini-table td { padding: .35rem .5rem; border-bottom: 1px solid rgba(255,255,255,.06); text-align: left; }
.mini-table th { color: var(--color-text-muted, #aaa); font-weight: 600; }
.cell-nowrap { white-space: nowrap; }
.preset-block { margin-bottom: .85rem; padding-bottom: .65rem; border-bottom: 1px dashed rgba(255,255,255,.08); }
.preset-block:last-child { border-bottom: none; }
.preset-title { font-weight: 600; margin-bottom: .35rem; font-size: .88rem; }
.preset-row { font-size: .82rem; margin: .2rem 0; line-height: 1.4; }

/* Danger */
.danger-tab  { display: flex; flex-direction: column; gap: 1rem; align-items: flex-start; }
.danger-hint { color: var(--color-warning, #facc15) !important; }

/* Boutons */
.nx-btn-sm      { font-size: .8rem; padding: .25rem .65rem; }
.nx-btn-warning { background: rgba(250,204,21,.15); color: #fde68a; border-color: rgba(250,204,21,.3); }
.nx-btn-primary { background: rgba(99,102,241,.25); color: #a5b4fc; border-color: rgba(99,102,241,.4); }
</style>

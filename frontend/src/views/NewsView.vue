<template>
  <section class="news-page page-content">
    <p v-if="!isLoggedIn" class="news-guest-bar">
      <router-link to="/login" class="news-guest-link">Connexion</router-link>
      ·
      <router-link to="/register" class="news-guest-link">Créer un compte</router-link>
    </p>
    <h1 class="page-title nx-title">News</h1>
    <p class="news-intro">
      Les dernières mises à jour et actualités de Nexus Core Arena.
    </p>

    <div v-if="sortedNews.length === 0" class="news-empty">
      Aucune actualité pour le moment.
    </div>

    <article
      v-for="(entry, idx) in sortedNews"
      :key="`${entry.date}-${idx}`"
      class="news-card nx-panel"
    >
      <div class="news-card-header">
        <time :datetime="entry.date" class="news-date">{{ formatDate(entry.date) }}</time>
        <h2 v-if="entry.title" class="news-title">{{ entry.title }}</h2>
      </div>
      <div class="news-content" v-html="formatContent(entry.content)" />
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NEWS_ENTRIES, sortNewsEntries } from '../data/newsData';
import { getToken } from '../api';

const isLoggedIn = computed(() => !!getToken());

const sortedNews = computed(() => sortNewsEntries(NEWS_ENTRIES));

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function formatContent(text: string): string {
  return text
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}
</script>

<style scoped>
.news-page {
  max-width: 680px;
  margin: 0 auto;
  padding: 24px 20px;
}

.news-guest-bar {
  margin: 0 0 12px;
  font-size: 0.88rem;
  text-align: center;
  color: var(--nx-text-secondary, rgba(234, 246, 255, 0.75));
}

.news-guest-link {
  color: var(--nx-accent, #22d3ee);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.news-intro {
  color: var(--nx-text-secondary, rgba(234, 246, 255, 0.75));
  margin-bottom: 28px;
  font-size: 0.95rem;
}

.news-empty {
  color: var(--nx-text-secondary, rgba(234, 246, 255, 0.6));
  text-align: center;
  padding: 48px 20px;
}

.news-card {
  margin-bottom: 20px;
  padding: 20px;
  border-radius: 12px;
}

.news-card-header {
  margin-bottom: 12px;
}

.news-date {
  display: inline-block;
  font-size: 0.85rem;
  color: var(--nx-accent, #22d3ee);
  font-weight: 600;
  margin-bottom: 4px;
}

.news-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
  color: var(--nx-text-primary, #EAF6FF);
}

.news-content {
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--nx-text-primary, #EAF6FF);
  opacity: 0.9;
}

.news-content :deep(strong) {
  color: var(--nx-accent, #22d3ee);
  font-weight: 700;
}

.news-content :deep(em) {
  font-style: italic;
  opacity: 0.95;
}

@media (max-width: 600px) {
  .news-page {
    padding: 16px 12px;
  }

  .news-card {
    padding: 16px;
  }
}
</style>

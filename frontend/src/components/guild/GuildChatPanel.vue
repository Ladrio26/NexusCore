<template>
  <section class="guild-chat-panel nx-panel">
    <div class="guild-chat-header">
      <h3 class="guild-chat-title">Chat de Guilde</h3>
      <div class="guild-chat-meta">Rafraîchissement toutes les 3s</div>
    </div>

    <div ref="messagesContainer" class="guild-chat-messages">
      <div v-if="loading && messages.length === 0" class="guild-chat-empty">Chargement des messages...</div>
      <div v-else-if="messages.length === 0" class="guild-chat-empty">Aucun message pour le moment. Lance la conversation.</div>
      <article
        v-for="message in messages"
        :key="message.message_id"
        class="guild-chat-bubble"
        :class="{ self: message.user_id === currentUserId }"
      >
        <img :src="getAvatarUrl(message)" alt="" class="guild-chat-avatar" />
        <div class="guild-chat-bubble-body">
          <div class="guild-chat-bubble-meta">
            <strong>{{ message.username }}</strong>
            <span>{{ formatTime(message.created_at) }}</span>
          </div>
          <p>{{ message.message }}</p>
        </div>
      </article>
    </div>

    <form class="guild-chat-composer" @submit.prevent="$emit('send')">
      <textarea
        :value="draft"
        class="guild-chat-input"
        maxlength="500"
        placeholder="Écrire un message..."
        :disabled="sending"
        @input="handleInput"
        @keydown="handleKeydown"
      />
      <div class="guild-chat-actions">
        <span class="guild-chat-counter">{{ draft.length }}/500</span>
        <button type="submit" class="nx-btn" :disabled="sending || !canSend">
          {{ sending ? 'Envoi...' : 'Envoyer' }}
        </button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { getAvatarUrl } from '../../utils/avatar';

type GuildChatMessage = {
  message_id: number;
  user_id: number;
  username: string;
  avatar_url?: string | null;
  message: string;
  created_at: string | null;
};

const props = defineProps<{
  messages: GuildChatMessage[];
  draft: string;
  currentUserId: number | null;
  loading: boolean;
  sending: boolean;
}>();

const emit = defineEmits<{
  (event: 'update:draft', value: string): void;
  (event: 'send'): void;
}>();

const messagesContainer = ref<HTMLElement | null>(null);

const canSend = computed(() => props.draft.trim().length > 0);

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement | null;
  emit('update:draft', target?.value ?? '');
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    if (canSend.value) {
      emit('send');
    }
  }
}

function formatTime(value: string | null) {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

async function scrollToBottom(smooth = false) {
  await nextTick();
  if (!messagesContainer.value) return;
  messagesContainer.value.scrollTo({
    top: messagesContainer.value.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto'
  });
}

watch(
  () => props.messages.map((message) => message.message_id).join(','),
  async (_next, previous) => {
    await scrollToBottom(Boolean(previous));
  },
  { immediate: true }
);
</script>

<style scoped>
.guild-chat-panel {
  padding: 16px;
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(7, 13, 24, 0.96), rgba(10, 19, 34, 0.94));
  border: 1px solid rgba(125, 211, 252, 0.12);
}

.guild-chat-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.guild-chat-title {
  margin: 0;
}

.guild-chat-meta {
  padding: 6px 9px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.62);
  border: 1px solid rgba(148, 163, 184, 0.14);
  color: #cbd5e1;
  font-size: 0.78rem;
}

.guild-chat-messages {
  min-height: 280px;
  max-height: 46vh;
  overflow-y: auto;
  padding: 10px;
  border-radius: 16px;
  background: rgba(2, 6, 23, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.08);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.guild-chat-empty {
  color: #cbd5e1;
  margin: auto 0;
  text-align: center;
}

.guild-chat-bubble {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  max-width: 82%;
}

.guild-chat-bubble.self {
  margin-left: auto;
  flex-direction: row-reverse;
}

.guild-chat-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  object-fit: cover;
  background: rgba(30, 41, 59, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.guild-chat-bubble-body {
  padding: 8px 10px;
  border-radius: 14px 14px 14px 5px;
  background: rgba(30, 41, 59, 0.86);
  border: 1px solid rgba(148, 163, 184, 0.14);
  box-shadow: 0 10px 18px rgba(2, 6, 23, 0.18);
}

.guild-chat-bubble.self .guild-chat-bubble-body {
  border-radius: 14px 14px 5px 14px;
  background: linear-gradient(135deg, rgba(8, 145, 178, 0.88), rgba(59, 130, 246, 0.74));
}

.guild-chat-bubble-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}

.guild-chat-bubble-meta strong {
  color: #f8fafc;
  font-size: 0.84rem;
}

.guild-chat-bubble-meta span {
  color: rgba(226, 232, 240, 0.72);
  font-size: 0.7rem;
}

.guild-chat-bubble-body p {
  margin: 0;
  color: #f8fafc;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.35;
  font-size: 0.88rem;
}

.guild-chat-composer {
  margin-top: 12px;
  padding: 12px;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.guild-chat-input {
  width: 100%;
  min-height: 72px;
  resize: vertical;
  border-radius: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(2, 6, 23, 0.72);
  color: #f8fafc;
  line-height: 1.35;
}

.guild-chat-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.guild-chat-counter {
  color: #94a3b8;
  font-size: 0.78rem;
}

@media (max-width: 720px) {
  .guild-chat-header {
    flex-direction: column;
  }

  .guild-chat-bubble {
    max-width: 100%;
  }

  .guild-chat-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

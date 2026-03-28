import { ref } from 'vue';

const STORAGE_KEY = 'nca_tutorial_v1_done';

export const tutorialVisible = ref(false);

export function startTutorial(force = false): boolean {
  if (!force && localStorage.getItem(STORAGE_KEY)) return false;
  tutorialVisible.value = true;
  return true;
}

export function closeTutorial() {
  tutorialVisible.value = false;
  localStorage.setItem(STORAGE_KEY, '1');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nca:tutorial-general-closed'));
  }
}

export function resetTutorial() {
  localStorage.removeItem(STORAGE_KEY);
}

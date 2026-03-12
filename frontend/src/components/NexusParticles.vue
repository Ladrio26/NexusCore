<template>
  <canvas id="nexus-bg" ref="canvas"></canvas>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';

const canvas = ref<HTMLCanvasElement | null>(null);
let animationId: number | null = null;

type Particle = {
  x: number;
  y: number;
  size: number;
  speedY: number;
};

function createParticles(width: number, height: number, count = 40): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: Math.random() * 2 + 0.5,
    speedY: Math.random() * 0.3 + 0.1
  }));
}

onMounted(() => {
  const c = canvas.value;
  if (!c) return;

  const ctx = c.getContext('2d');
  if (!ctx) return;

  const resize = () => {
    c.width = window.innerWidth;
    c.height = window.innerHeight;
  };
  resize();

  let particles: Particle[] = createParticles(c.width, c.height);

  const animate = () => {
    ctx.clearRect(0, 0, c.width, c.height);

    particles.forEach((p) => {
      p.y -= p.speedY;
      if (p.y < 0) {
        p.y = c.height;
        p.x = Math.random() * c.width;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,255,255,0.3)';
      ctx.fill();
    });

    animationId = requestAnimationFrame(animate);
  };

  window.addEventListener('resize', resize);
  animate();

  onBeforeUnmount(() => {
    if (animationId != null) cancelAnimationFrame(animationId);
    window.removeEventListener('resize', resize);
  });
});
</script>


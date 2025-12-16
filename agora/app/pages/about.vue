<script setup lang="ts">
useHead({
  title: 'About - Agora'
})
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-12">
    <h1 class="text-4xl font-serif font-bold text-stone-900 dark:text-stone-100 mb-8">
      About Agora
    </h1>

    <div class="prose prose-stone dark:prose-invert max-w-none space-y-6">
      <p class="text-lg text-stone-600 dark:text-stone-400 leading-relaxed">
        Agora is a platform for meaningful conversations with history's greatest philosophers, writers, and thinkers.
        Powered by advanced AI, Agora allows you to engage in dialogue with virtual representations of brilliant minds
        from across the ages.
      </p>

      <h2 class="text-2xl font-serif font-semibold text-stone-900 dark:text-stone-100 mt-8">
        Our Mission
      </h2>
      <p class="text-stone-600 dark:text-stone-400 leading-relaxed">
        We believe that the wisdom of great thinkers should be accessible to everyone. Agora bridges the gap between
        historical philosophy and modern curiosity, creating an interactive space where ideas can be explored,
        questioned, and shared.
      </p>

      <h2 class="text-2xl font-serif font-semibold text-stone-900 dark:text-stone-100 mt-8">
        How It Works
      </h2>
      <ul class="list-disc list-inside text-stone-600 dark:text-stone-400 space-y-2">
        <li>Choose a philosopher from our curated gallery</li>
        <li>Start a conversation on any topic that interests you</li>
        <li>Receive thoughtful responses informed by their historical writings and philosophy</li>
        <li>Share your conversations with the community or keep them private</li>
        <li>Fork and continue conversations started by others</li>
      </ul>

      <h2 class="text-2xl font-serif font-semibold text-stone-900 dark:text-stone-100 mt-8">
        Important Note
      </h2>
      <p class="text-stone-600 dark:text-stone-400 leading-relaxed">
        The AI-generated responses are inspired by the writings and known philosophies of historical figures but are
        not actual quotes or verified positions. Agora is designed for educational and entertainment purposes.
        Always consult primary sources for academic work.
      </p>

      <h2 class="text-2xl font-serif font-semibold text-stone-900 dark:text-stone-100 mt-8">
        Creator
      </h2>
      <div class="flex flex-col sm:flex-row items-center sm:items-start gap-6 mt-4">
        <img
          src="/images/taiyan.jpg"
          alt="Taiyan Liu"
          class="w-48 h-48 rounded-xl object-cover shadow-lg flex-shrink-0"
        >

        <div>
          <p class="text-stone-600 dark:text-stone-400 leading-relaxed">
            Agora was created by <span class="font-semibold text-stone-900 dark:text-stone-100">Taiyan Liu</span>,
            a student at Duke University with a passion for philosophy, ideas, coding, art, literature, and music.
          </p>
          <div class="flex flex-wrap items-center gap-4 mt-3">
            <a
              href="https://github.com/neoromantics"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-2 text-stone-600 dark:text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <UIcon
                name="i-simple-icons-github"
                class="w-5 h-5"
              />
              <span>neoromantics</span>
            </a>
            <a
              href="https://instagram.com/dawg.dawg.go"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-2 text-stone-600 dark:text-stone-400 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
            >
              <UIcon
                name="i-simple-icons-instagram"
                class="w-5 h-5"
              />
              <span>dawg.dawg.go</span>
            </a>
          </div>
        </div>
      </div>

      <h2 class="text-2xl font-serif font-semibold text-stone-900 dark:text-stone-100 mt-8">
        Contact
      </h2>
      <p class="text-stone-600 dark:text-stone-400 leading-relaxed">
        For questions, feedback, or support, please reach out to us at
        <a
          href="mailto:newromantics2001@gmail.com"
          class="text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          newromantics2001@gmail.com
        </a>
      </p>
    </div>
  </div>
</template>

<template>
  <div class="site-shell">
    <header class="site-header">
      <NuxtLink class="wordmark" to="/" aria-label="체크인데일리 홈">
        <span class="wordmark-mark">C.</span>
        <span>CHECK-IN <b>DAILY</b></span>
      </NuxtLink>
      <nav class="main-nav" aria-label="주요 메뉴">
        <NuxtLink to="/">오늘의 뉴스</NuxtLink>
        <NuxtLink to="/flights">항공</NuxtLink>
        <NuxtLink to="/hotels">호텔</NuxtLink>
        <NuxtLink to="/saved">스크랩</NuxtLink>
        <NuxtLink to="/admin/dashboard">에디터룸</NuxtLink>
      </nav>
      <span class="edition">TRAVEL INTELLIGENCE · KR</span>
    </header>
    <main><NuxtPage /></main>
    <footer class="site-footer">
      <NuxtLink class="wordmark footer-mark" to="/">CHECK-IN <b>DAILY</b></NuxtLink>
      <span>여행의 다음 장면을 먼저 읽습니다.</span>
      <span>© 2025 Check-in Daily</span>
    </footer>
  </div>
</template>
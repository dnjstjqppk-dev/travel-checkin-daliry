export default defineNuxtPlugin(() => {
  onNuxtReady(() => useSavedStore().load())
})
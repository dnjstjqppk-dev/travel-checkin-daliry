import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  content: ['./pages/**/*.{vue,ts}', './components/**/*.{vue,ts}', './app.vue'],
  theme: { extend: {} },
  plugins: [],
}
<script setup lang="ts">
import { staffRoles } from '~/server/utils/staff-permissions'
definePageMeta({ layout: 'admin' })
interface Staff { id: number; username: string; role: string; is_active: number }
const { data: users, error, refresh } = await useFetch<Staff[]>('/api/admin/users')
const form = reactive({ username: '', password: '', role: 'reporter' })
const message = ref('')
const pending = ref(false)
async function createStaff() {
  pending.value = true; message.value = ''
  try {
    await $fetch('/api/admin/users', { method: 'POST', body: form })
    form.username = ''; form.password = ''; await refresh(); message.value = 'Account created.'
  } catch (error: any) { message.value = error?.data?.statusMessage || 'Unable to create account.' }
  finally { pending.value = false }
}
async function saveStaff(user: Staff) {
  pending.value = true; message.value = ''
  try {
    await $fetch('/api/admin/users/' + user.id, { method: 'PATCH', body: { role: user.role, active: !!user.is_active } })
    await refresh(); message.value = 'Permissions updated. Existing sessions revoked.'
  } catch (error: any) { message.value = error?.data?.statusMessage || 'Unable to update account.'; await refresh() }
  finally { pending.value = false }
}
</script>
<template>
  <section class="staff-page">
    <h1>Newsroom accounts and permissions</h1>
    <p>Reporters create drafts. Editors edit drafts. Chief editors approve and schedule publication. Auditors have read access to logs. Translators can review translation records. Administrators manage access.</p>
    <p v-if="error" role="alert">Account administration requires an administrator account.</p>
    <template v-else>
      <p v-if="message" role="status">{{ message }}</p>
      <form @submit.prevent="createStaff">
        <h2>Create staff account</h2>
        <label>Username<input v-model="form.username" required minlength="3" maxlength="100" autocomplete="off"></label>
        <label>Temporary password<input v-model="form.password" type="password" required minlength="12" maxlength="1024" autocomplete="new-password"></label>
        <label>Role<select v-model="form.role"><option v-for="role in staffRoles" :key="role" :value="role">{{ role }}</option></select></label>
        <button :disabled="pending" type="submit">Create account</button>
      </form>
      <div class="table-scroll"><table><caption>Active and disabled staff accounts</caption><thead><tr><th>Username</th><th>Role</th><th>Active</th><th>Action</th></tr></thead><tbody>
        <tr v-for="user in users || []" :key="user.id"><td>{{ user.username }}</td><td><select v-model="user.role" :aria-label="'Role for ' + user.username"><option v-for="role in staffRoles" :key="role">{{ role }}</option></select></td>
        <td><input v-model="user.is_active" type="checkbox" :true-value="1" :false-value="0" :aria-label="'Active status for ' + user.username"></td><td><button :disabled="pending" @click="saveStaff(user)">Save</button></td></tr>
      </tbody></table></div>
    </template>
  </section>
</template>
<style scoped>
.staff-page { max-width: 1100px; margin: auto; padding: 24px; color: #172131; }
form { display: flex; flex-wrap: wrap; gap: 20px; padding: 24px 0; align-items: end; }
h2 { flex-basis: 100%; }
label { display: grid; gap: 8px; }
input, select, button { padding: 10px; min-height: 44px; border: 1px solid #64748b; border-radius: 4px; background: white; color: #172131; }
button { cursor: pointer; font-weight: 600; } button:disabled { opacity: .6; cursor: wait; }
.table-scroll { overflow-x: auto; } table { width: 100%; text-align: left; border-collapse: collapse; } th, td { padding: 14px; border-bottom: 1px solid #cbd5e1; } caption { text-align: left; padding: 12px 0; }
</style>

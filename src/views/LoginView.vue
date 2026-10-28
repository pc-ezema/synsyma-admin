<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-vue-next'
import BrandMark from '@/components/BrandMark.vue'
import Sparkline from '@/components/dashboard/Sparkline.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const remember = ref(true)
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

const spark = [12, 18, 15, 24, 22, 31, 28, 38, 35, 46, 52, 61]

async function submit() {
  error.value = ''
  if (!email.value || !password.value) {
    error.value = 'Enter your email and password.'
    return
  }
  loading.value = true
  try {
    await auth.login(email.value, password.value, remember.value)
    router.replace((route.query.redirect as string) || { name: 'dashboard' })
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const status = e.response?.status
      if (status === 401) error.value = 'Email or password is incorrect.'
      else if (status === 403) error.value = 'This account does not have admin access.'
      else if (status === 422) error.value = Object.values(e.response?.data?.errors ?? {}).flat()[0] as string ?? 'Check your details and try again.'
      else if (status === 429) error.value = 'Too many attempts. Wait a minute and try again.'
      else error.value = "Can't reach the server. Check your connection and try again."
    } else {
      error.value = 'Something went wrong. Try again.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login">
    <aside class="showcase">
      <div class="brand"><BrandMark :size="100" /></div>

      <div class="pitch">
        <p class="pitch-title">Every user, message and signup in one view.</p>
        <p class="pitch-sub">Manage accounts, moderate chat and watch growth as it happens.</p>
      </div>

      <div class="glass" aria-hidden="true">
        <div class="glass-head">
          <span>New signups this week</span>
          <b>+18.4%</b>
        </div>
        <p class="glass-num">2,846</p>
        <Sparkline class="glass-spark" :data="spark" tone="green" />
      </div>
      <span class="orb orb-a" aria-hidden="true" />
      <span class="orb orb-b" aria-hidden="true" />
    </aside>

    <section class="panel">
      <div class="brand mobile-brand"><BrandMark :size="36" /><span>Synsyma</span></div>

      <form class="form" novalidate @submit.prevent="submit">
        <h1>Welcome back</h1>
        <p class="sub">Sign in to the admin dashboard.</p>

        <div v-if="error" class="alert" role="alert"><AlertCircle :size="18" />{{ error }}</div>

        <div class="group">
          <label for="email">Email</label>
          <div class="field">
            <Mail :size="18" />
            <input id="email" v-model.trim="email" type="email" autocomplete="username" placeholder="admin@Synsyma.com" inputmode="email" />
          </div>
        </div>

        <div class="group">
          <label for="password">Password</label>
          <div class="field">
            <Lock :size="18" />
            <input id="password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" placeholder="Enter your password" />
            <button type="button" class="eye" :aria-label="showPassword ? 'Hide password' : 'Show password'" @click="showPassword = !showPassword">
              <EyeOff v-if="showPassword" :size="18" />
              <Eye v-else :size="18" />
            </button>
          </div>
        </div>

        <div class="row">
          <label class="check">
            <input v-model="remember" type="checkbox" />
            <span class="box" />
            Keep me signed in
          </label>
          <!-- TODO: point to your forgot-password flow -->
          <button type="button" class="link">Forgot password?</button>
        </div>

        <button class="btn btn-primary submit" type="submit" :disabled="loading">
          <Loader2 v-if="loading" :size="18" class="spin" />
          {{ loading ? 'Signing in' : 'Sign in' }}
        </button>
      </form>

      <p class="foot">Protected area. Only authorised Synsyma staff can sign in.</p>
    </section>
  </div>
</template>

<style scoped>
.login { min-height: 100dvh; background: #fff; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); }

/* Left showcase */
.showcase {
  --text: #fff; --text-dim: rgba(255, 255, 255, 0.72); --text-mute: rgba(255, 255, 255, 0.56); --line: rgba(255, 255, 255, 0.08);
  color: #fff;
  position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between;
  padding: 40px 48px; background:
    radial-gradient(700px 480px at 20% 0%, rgba(0, 102, 255, 0.5), transparent 65%),
    radial-gradient(600px 420px at 100% 100%, rgba(0, 179, 44, 0.3), transparent 60%),
    #061a4d;
  border-right: 1px solid var(--line);
}
.brand { display: flex; align-items: center; gap: 12px; font-family: var(--font-display); font-weight: 700; font-size: 22px; }
.pitch { position: relative; z-index: 1; max-width: 480px; }
.pitch-title { font-family: var(--font-display); font-size: clamp(30px, 3.2vw, 44px); line-height: 1.12; font-weight: 600; letter-spacing: -0.025em; }
.pitch-sub { margin-top: 16px; color: var(--text-dim); font-size: 17px; max-width: 400px; }

.glass {
  position: relative; z-index: 1; width: min(100%, 380px); padding: 20px 22px 14px; overflow: hidden;
  background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.16); border-radius: 22px;
  backdrop-filter: blur(18px); box-shadow: 0 30px 60px -30px rgba(0, 0, 0, 0.6);
  animation: float 7s ease-in-out infinite;
}
.glass-head { display: flex; justify-content: space-between; font-size: 14px; color: var(--text-dim); }
.glass-head b { color: var(--syn-green-text); }
.glass-num { margin: 6px 0 0; font-family: var(--font-display); font-size: 40px; font-weight: 600; letter-spacing: -0.02em; }
.glass-spark { display: block; width: calc(100% + 44px); margin: 0 -22px; height: 64px; }
.orb { position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.55; }
.orb-a { width: 280px; height: 280px; right: -80px; top: 18%; background: var(--syn-blue-light); }
.orb-b { width: 220px; height: 220px; left: -60px; bottom: -60px; background: var(--syn-green-emerald); }
@keyframes float { 50% { transform: translateY(-8px); } }

/* Right panel */
.panel { display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 28px; padding: 32px 24px; }
.mobile-brand { display: none; }
.form { width: 100%; max-width: 400px; display: grid; gap: 18px; }
h1 { font-family: var(--font-display); font-size: 30px; font-weight: 600; letter-spacing: -0.02em; }
.sub { margin-top: -10px; color: var(--text-dim); }
.group { display: grid; gap: 8px; }
.group label { font-size: 14px; font-weight: 600; }
.eye { display: grid; place-items: center; width: 32px; height: 32px; margin-right: -6px; background: none; border: 0; border-radius: 8px; color: var(--text-mute); }
.eye:hover { color: var(--blue-ink); background: rgba(4, 20, 59, 0.06); }

.alert {
  display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; font-size: 14px;
  color: #9f1239; background: rgba(217, 45, 74, 0.08); border: 1px solid rgba(217, 45, 74, 0.3); border-radius: var(--radius-md);
}
.alert svg { flex: none; margin-top: 1px; color: var(--danger); }

.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 14px; }
.check { position: relative; display: inline-flex; align-items: center; gap: 10px; cursor: pointer; }
.check input { position: absolute; opacity: 0; width: 20px; height: 20px; margin: 0; }
.box { width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid rgba(4, 20, 59, 0.35); display: grid; place-items: center; transition: all 0.15s; }
.check input:checked + .box { background: var(--grad-blue-full); border-color: transparent; }
.check input:checked + .box::after { content: ''; width: 5px; height: 9px; margin-top: -2px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg); }
.check input:focus-visible + .box { outline: 2px solid var(--syn-blue-light); outline-offset: 2px; }
.link { background: none; border: 0; padding: 0; color: var(--blue-ink); font-weight: 600; }
.link:hover { text-decoration: underline; }

.submit { height: 50px; width: 100%; margin-top: 4px; font-size: 16px; }
.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.foot { max-width: 400px; text-align: center; font-size: 13px; color: var(--text-mute); }

@media (max-width: 959px) {
  .login { grid-template-columns: 1fr; }
  .showcase { display: none; }
  .mobile-brand { display: flex; }
  .panel { justify-content: flex-start; padding-top: 12vh; }
}
</style>

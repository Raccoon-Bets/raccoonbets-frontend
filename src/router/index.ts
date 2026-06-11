import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { isApex } from '@/config/tenant'

// Auth views are shared between the apex and group apps: accounts are global,
// so logging in works the same wherever the visitor lands.
const sharedAuthRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'logIn',
    component: () => import('@/views/auth/logIn.vue'),
  },
  {
    path: '/signup',
    name: 'signUp',
    component: () => import('@/views/auth/signUp.vue'),
  },
  {
    path: '/forgot-password',
    name: 'forgotPassword',
    component: () => import('@/views/auth/forgotPassword.vue'),
  },
  {
    path: '/reset-password/:key?',
    name: 'resetPassword',
    component: () => import('@/views/auth/resetPassword.vue'),
  },
  {
    path: '/verify-account/:key?',
    name: 'verifyAccount',
    component: () => import('@/views/auth/verifyAccount.vue'),
  },
  {
    path: '/oauth/callback',
    name: 'oauthCallback',
    component: () => import('@/views/auth/oauthCallback.vue'),
  },
]

const notFoundRoute: RouteRecordRaw = {
  path: '/:pathMatch(.*)*',
  name: 'notFound',
  component: () => import('@/views/notFound.vue'),
}

// Emailed invitation links point at the apex, but accounts are global, so the
// accept view works on any host the invitee lands on.
const invitationAcceptRoute: RouteRecordRaw = {
  path: '/invitations/:token',
  name: 'invitationAccept',
  component: () => import('@/views/invitationAccept.vue'),
}

// The marketing/account app served on the apex domain (and www).
const apexRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/apex/landing.vue'),
  },
  ...sharedAuthRoutes,
  {
    path: '/account',
    name: 'account',
    component: () => import('@/views/account.vue'),
  },
  {
    path: '/groups',
    name: 'groups',
    component: () => import('@/views/apex/groups.vue'),
  },
  {
    path: '/groups/new',
    name: 'groupsNew',
    component: () => import('@/views/apex/groupsNew.vue'),
  },
  invitationAcceptRoute,
  notFoundRoute,
]

// The group app served on `{slug}.{apexDomain}` subdomains.
const groupRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'feed',
    component: () => import('@/views/group/feed.vue'),
  },
  {
    path: '/markets/new',
    name: 'marketsNew',
    component: () => import('@/views/group/marketsNew.vue'),
  },
  {
    // `\d[-\w]*` (not `\d+(?:-[^/]*)?`): vue-router's path-to-regexp reads the
    // first `)` in a nested `(?:…)` group as the matcher's close, which crashes
    // the SPA. This accepts a bare id or `{id}-{slug}` and still rejects
    // `/markets/new`; the leading id is parsed out and any non-canonical suffix
    // self-corrects via useCanonicalMarketURL.
    path: '/markets/:marketId(\\d[-\\w]*)',
    name: 'marketDetail',
    component: () => import('@/views/group/marketDetail.vue'),
  },
  {
    // Matcher mirrors marketDetail (see note above).
    path: '/markets/:marketId(\\d[-\\w]*)/resolve',
    name: 'marketResolve',
    component: () => import('@/views/group/marketResolve.vue'),
  },
  {
    path: '/me',
    name: 'myPositions',
    component: () => import('@/views/group/myPositions.vue'),
  },
  {
    path: '/members',
    name: 'members',
    component: () => import('@/views/group/members.vue'),
  },
  {
    path: '/settle-up',
    name: 'settleUp',
    component: () => import('@/views/group/settleUp.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/group/settings.vue'),
  },
  ...sharedAuthRoutes,
  invitationAcceptRoute,
  {
    path: '/join',
    name: 'join',
    component: () => import('@/views/group/join.vue'),
  },
  {
    path: '/missing-group',
    name: 'groupMissing',
    component: () => import('@/views/group/missing.vue'),
  },
  notFoundRoute,
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: isApex ? apexRoutes : groupRoutes,
})

export default router

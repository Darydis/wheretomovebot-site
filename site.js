(() => {
  'use strict'

  const CONSENT_KEY = 'wtm_privacy_consent_v1'
  const CONSENT_VERSION = '2026-08-24'
  const DECISION_KEY = 'wtm_landing_consent_decision'
  const CID_KEY = 'wtm_landing_cid_v1'
  const ANALYTICS_ENDPOINT = document.querySelector('meta[name="wtm-analytics-endpoint"]')?.content || '/api/event'

  const storage = {
    get(key) { try { return localStorage.getItem(key) } catch { return null } },
    set(key, value) { try { localStorage.setItem(key, value) } catch { /* analytics stays off */ } },
  }

  function hasConsent() {
    return storage.get(CONSENT_KEY) === CONSENT_VERSION
  }

  function cid() {
    let value = storage.get(CID_KEY)
    if (!value) {
      value = (globalThis.crypto?.randomUUID?.() || String(Math.random()).slice(2)).replace(/-/g, '').slice(0, 24)
      storage.set(CID_KEY, value)
    }
    return value
  }

  function track(event, props = {}) {
    if (!hasConsent()) return
    try {
      fetch(ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, cid: cid(), props }),
        keepalive: true,
      }).catch(() => {})
    } catch { /* analytics never blocks the page */ }
  }

  const modeButtons = [...document.querySelectorAll('[data-mode]')]
  const tabButtons = [...document.querySelectorAll('[data-tab]')]
  const panels = [...document.querySelectorAll('[data-panel]')]
  const demoProfile = document.querySelector('.demo-profile')
  const demoPanel = document.querySelector('#demo-panel')
  let mode = 'solo'
  let tab = 'cities'

  function renderDemo(shouldTrack = true) {
    modeButtons.forEach((button) => {
      const active = button.dataset.mode === mode
      button.classList.toggle('is-active', active)
      button.setAttribute('aria-pressed', String(active))
    })
    tabButtons.forEach((button) => {
      const active = button.dataset.tab === tab
      button.classList.toggle('is-active', active)
      button.setAttribute('aria-selected', String(active))
      button.tabIndex = active ? 0 : -1
    })
    panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== `${mode}:${tab}` })
    if (demoPanel) demoPanel.setAttribute('aria-labelledby', `tab-${tab}`)
    if (demoProfile) demoProfile.textContent = mode === 'solo' ? 'пожелания: море · тепло · доступные цены' : 'две анкеты · один общий список'
    if (shouldTrack) track('landing_demo', { mode, tab })
  }

  modeButtons.forEach((button) => button.addEventListener('click', () => {
    mode = button.dataset.mode
    renderDemo()
  }))

  tabButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      tab = button.dataset.tab
      renderDemo()
    })
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      let next = index
      if (event.key === 'ArrowLeft') next = (index - 1 + tabButtons.length) % tabButtons.length
      if (event.key === 'ArrowRight') next = (index + 1) % tabButtons.length
      if (event.key === 'Home') next = 0
      if (event.key === 'End') next = tabButtons.length - 1
      tab = tabButtons[next].dataset.tab
      tabButtons[next].focus()
      renderDemo()
    })
  })
  renderDemo(false)

  document.querySelectorAll('[data-cta]').forEach((link) => {
    link.addEventListener('click', () => track('landing_cta', {
      placement: link.dataset.cta,
      destination: 'telegram',
    }))
  })

  const featureDetails = document.querySelector('.feature-details')
  featureDetails?.addEventListener('toggle', () => {
    if (featureDetails.open) track('landing_demo', { mode: 'offer', tab: 'all_features' })
  })

  const revealItems = [...document.querySelectorAll('.reveal')]
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 })
    revealItems.forEach((item) => revealObserver.observe(item))
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'))
  }

  const heroButton = document.querySelector('[data-cta="hero"]')
  const stickyButton = document.querySelector('.mobile-cta')
  if (heroButton && stickyButton && 'IntersectionObserver' in window) {
    const ctaObserver = new IntersectionObserver(([entry]) => {
      stickyButton.classList.toggle('is-visible', !entry.isIntersecting)
    }, { threshold: .1 })
    ctaObserver.observe(heroButton)
  }

  const consent = document.querySelector('.consent')
  const decision = storage.get(DECISION_KEY)
  if (consent && !hasConsent() && decision !== 'declined') consent.hidden = false
  consent?.querySelector('[data-consent="accept"]')?.addEventListener('click', () => {
    storage.set(CONSENT_KEY, CONSENT_VERSION)
    storage.set(DECISION_KEY, 'accepted')
    consent.hidden = true
    track('landing_view', { page: 'home' })
  })
  consent?.querySelector('[data-consent="decline"]')?.addEventListener('click', () => {
    storage.set(DECISION_KEY, 'declined')
    consent.hidden = true
  })

  if (hasConsent()) track('landing_view', { page: 'home' })
})()

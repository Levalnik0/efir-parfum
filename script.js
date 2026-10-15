gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;

/* ---------- Preloader ---------- */
function runPreloader(done){
  const fill = document.getElementById('preloaderFill');
  const pre = document.getElementById('preloader');
  let p = { v: 0 };
  gsap.to(p, {
    v: 100,
    duration: reduceMotion ? 0.1 : 1.3,
    ease: 'power2.inOut',
    onUpdate(){ fill.style.width = p.v + '%'; },
    onComplete(){
      gsap.to(pre, {
        yPercent: -100, duration: 0.7, ease: 'power3.inOut', delay: 0.1,
        onComplete(){ pre.style.display = 'none'; done(); }
      });
    }
  });
}

/* ---------- Lenis ---------- */
let lenis;
function initLenis(){
  if (reduceMotion || typeof Lenis === 'undefined') return;
  lenis = new Lenis({ duration: 1.1, smoothWheel: true });
  requestAnimationFrame(function raf(time){ lenis.raf(time); requestAnimationFrame(raf); });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ---------- Custom cursor ---------- */
function initCursor(){
  if (isTouch) return;
  const cursor = document.getElementById('cursor');
  let mx = 0, my = 0, cx = 0, cy = 0;
  window.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; });
  gsap.ticker.add(() => {
    cx += (mx - cx) * 0.2;
    cy += (my - cy) * 0.2;
    cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%,-50%)`;
  });
  document.querySelectorAll('[data-cursor-hover]').forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('is-hover'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('is-hover'));
  });
}

/* ---------- Magnetic buttons ---------- */
function initMagnetic(){
  if (isTouch) return;
  document.querySelectorAll('.btn-magnetic').forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      gsap.to(btn, { x: x * 0.3, y: y * 0.4, duration: 0.4, ease: 'power3.out' });
    });
    btn.addEventListener('mouseleave', () => gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' }));
  });
}

/* ---------- Header ---------- */
function initHeader(){
  const header = document.getElementById('header');
  let lastY = window.scrollY;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate(){
      const y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 40);
      if (y > lastY && y > 200) header.classList.add('is-hidden'); else header.classList.remove('is-hidden');
      lastY = y;
    }
  });
  const burger = document.getElementById('burger');
  const mobileNav = document.getElementById('mobileNav');
  burger.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', open);
  });
  mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    mobileNav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', false);
  }));
}

/* ---------- Hero title: split into letters once, for the dissolve-in reveal ---------- */
function splitHeroTitle(){
  const el = document.querySelector('.hero__title');
  if (!el) return;
  const text = el.textContent;
  el.innerHTML = text.split('').map(ch => `<span class="letter">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
}

/* ---------- Hero entrance ---------- */
function heroEntrance(){
  gsap.set('.hero__eyebrow span', { yPercent: 120 });
  gsap.to('.hero__eyebrow span', { yPercent: 0, duration: 0.9, ease: 'power4.out', delay: 0.1 });
  gsap.to('.hero__title .letter', {
    filter: 'blur(0px)', opacity: 1, duration: 1.1, ease: 'power2.out', stagger: 0.07, delay: 0.25
  });
}

/* ---------- Scroll reveals ---------- */
function initReveals(){
  gsap.utils.toArray('.reveal-up').forEach(el => {
    gsap.fromTo(el, { opacity: 0, y: 32 }, {
      opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true }
    });
  });
}

/* ---------- Ratings: bar fill + count-up ---------- */
function initRatings(){
  document.querySelectorAll('.rating__item').forEach(item => {
    const fill = item.querySelector('.rating__bar-fill');
    const valueEl = item.querySelector('.rating__value');
    const fraction = parseFloat(fill.dataset.fraction);
    const target = parseFloat(valueEl.dataset.count);
    ScrollTrigger.create({
      trigger: item, start: 'top 88%', once: true,
      onEnter(){
        requestAnimationFrame(() => { fill.style.width = (fraction * 100) + '%'; });
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target, duration: 1.3, ease: 'power2.out',
          onUpdate(){ valueEl.textContent = Math.round(obj.v); }
        });
      }
    });
  });
}

/* ---------- 3D lab: pinned scroll-driven bottle ---------- */
function initLab(){
  const canvas = document.getElementById('bottleCanvas');
  const states = document.querySelectorAll('.lab__state');
  let bottleScene = null;
  if (canvas && typeof window.initBottleScene === 'function') {
    bottleScene = window.initBottleScene(canvas);
  }
  window.bottleScene = bottleScene;

  function setState(idx){
    states.forEach(s => s.classList.toggle('is-active', s.dataset.state === String(idx)));
  }

  ScrollTrigger.create({
    trigger: '.lab', start: 'top top', end: 'bottom bottom', scrub: true,
    onUpdate(self){
      if (bottleScene) bottleScene.setScrollProgress(self.progress);
      setState(Math.min(2, Math.floor(self.progress * 3)));
    }
  });
}

/* ---------- Ritual: pinned ring-dial scrubbed by scroll ---------- */
function initRitual(){
  const section = document.querySelector('.ritual');
  const ringFill = document.querySelector('.ritual__ring-fill');
  const ringNum = document.querySelector('.ritual__ring-num');
  const steps = document.querySelectorAll('.ritual__step');
  if (!section || !ringFill || !steps.length) return;
  const circumference = 2 * Math.PI * 86;

  function setStep(i){
    steps.forEach(s => s.classList.toggle('is-active', s.dataset.step === String(i)));
    ringNum.textContent = String(i + 1).padStart(2, '0');
  }
  setStep(0);

  ScrollTrigger.create({
    trigger: section, start: 'top top', end: 'bottom bottom', scrub: true,
    onUpdate(self){
      ringFill.style.strokeDashoffset = String(circumference * (1 - self.progress));
      setStep(Math.min(steps.length - 1, Math.floor(self.progress * steps.length)));
    }
  });
}

/* ---------- CTA form ---------- */
function initCtaForm(){
  const form = document.getElementById('ctaForm');
  const section = document.getElementById('cta');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('c-email');
    const field = input.closest('.field');
    const ok = input.checkValidity();
    field.classList.toggle('is-invalid', !ok);
    if (!ok) return;
    section.classList.add('is-sent');
  });
  document.getElementById('c-email').addEventListener('input', (e) => {
    if (e.target.checkValidity()) e.target.closest('.field').classList.remove('is-invalid');
  });
}

/* ---------- Anchors ---------- */
function initAnchors(){
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -20 });
      else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });
}

/* ---------- Boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  splitHeroTitle();
  initAnchors();
  initHeader();
  initCursor();
  initMagnetic();
  initReveals();
  initRatings();
  initLab();
  initRitual();
  initCtaForm();

  runPreloader(() => {
    initLenis();
    heroEntrance();
    ScrollTrigger.refresh();
  });
});

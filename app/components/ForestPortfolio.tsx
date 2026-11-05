"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { profile, stops, type StopId } from "@/lib/portfolio";
import type { SceneControls } from "./ForestScene";
import PortfolioPanel from "./PortfolioPanel";
import { Arrow, Cross } from "./Icons";

const ForestScene = dynamic(() => import("./ForestScene"), { ssr: false });

export default function ForestPortfolio() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [progress, setProgress] = useState(0);
  const [motion, setMotion] = useState(true);
  const [panel, setPanel] = useState<StopId | null>(null);
  const [visited, setVisited] = useState<StopId[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const markers = useRef<HTMLDivElement>(null);
  const controls = useRef<SceneControls>({ progress: 0, motion: true, paused: false });
  const lastFocused = useRef<HTMLElement | null>(null);
  const onReady = useCallback((value: boolean) => { document.documentElement.dataset.ready = "true"; setReady(value); }, []);
  const activeStop = stops.reduce((current, s, i) => progress >= s.progress - .075 ? i : current, -1);
  const intro = progress < .035;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const preference = () => { controls.current.motion = !mq.matches; setMotion(!mq.matches); };
    preference(); mq.addEventListener("change", preference);
    const onScroll = () => { const max = document.documentElement.scrollHeight - window.innerHeight; const p = max > 0 ? Math.min(1, window.scrollY / max) : 0; controls.current.progress = p; setProgress(Math.round(p * 1000) / 1000); };
    window.addEventListener("scroll", onScroll, { passive: true }); window.addEventListener("resize", onScroll); onScroll();
    return () => { mq.removeEventListener("change", preference); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);

  useEffect(() => {
    const el = dialog.current;
    const sceneControls = controls.current;
    if (!el) return;
    if (panel) {
      const returnFocus = lastFocused.current;
      el.showModal(); sceneControls.paused = true;
      const oldOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
      el.querySelector(".panel-scroll")?.scrollTo(0, 0);
      return () => { document.body.style.overflow = oldOverflow; el.close(); sceneControls.paused = false; requestAnimationFrame(() => returnFocus?.focus({ preventScroll: true })); };
    }
  }, [panel]);

  function travelTo(index: number) {
    const target = stops[index]?.progress ?? 0;
    window.scrollTo({ top: target * (document.documentElement.scrollHeight - window.innerHeight), behavior: controls.current.motion ? "smooth" : "instant" });
  }

  function openPanel(id: StopId, trigger?: HTMLElement) {
    lastFocused.current = trigger ?? markers.current?.querySelector<HTMLButtonElement>(`[data-stop="${id}"]`) ?? document.activeElement as HTMLElement;
    setPanel(id);
    setVisited(v => v.includes(id) ? v : [...v, id]);
  }

  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if (controls.current.paused || event.altKey || event.ctrlKey || event.metaKey) return;
      if (/^[1-4]$/.test(event.key)) { event.preventDefault(); const n = Number(event.key) - 1; travelTo(n); }
      if (event.key === "Enter" && document.activeElement === document.body) {
        const index = stops.findIndex(s => Math.abs(controls.current.progress - s.progress) < .09);
        if (index >= 0) openPanel(stops[index].id);
      }
    }
    window.addEventListener("keydown", keyboard); return () => window.removeEventListener("keydown", keyboard);
  }, []);

  return <>
    <div className="scroll-trail" aria-hidden="true" />
    <div className={`forest-experience ${intro ? "at-entrance" : "on-trail"} ${motion ? "" : "motion-paused"}`}>
      <ForestScene controls={controls} onReady={onReady} markerRoot={markers} />
      <div className="scene-vignette" aria-hidden="true" />
      <div className="scene-grain" aria-hidden="true" />
      <main className="forest-ui" id="main-content">
        <div className="intro-copy" aria-hidden={!intro} inert={!intro}>
          <h1>Dhruv Shah<span className="pixel-period">.</span></h1>
          <div className="eyebrow intro-eyebrow">Software developer</div>
          <p className="intro-subtitle">A curious mind.<br />A path of my own.</p>
          <p className="intro-description">Welcome to my little wilderness.<br />Follow the light. See what I’ve been building.</p>
        </div>

        <div className="world-markers" ref={markers}>{stops.map((s, i) => <button className="world-marker" data-stop={s.id} key={s.id} onClick={event => openPanel(s.id, event.currentTarget)} tabIndex={-1} aria-label={`Open ${s.name}`}>
          <span className="marker-number">0{i + 1}</span><span className="marker-text"><strong>{s.name}</strong></span><Arrow diagonal /><span className="marker-stem" aria-hidden="true" />
        </button>)}</div>

        <aside className="trail-nav" aria-label="Forest trail stops"><span className="trail-nav-label">THE TRAIL</span><div className="trail-line" aria-hidden="true"><span style={{ height: `${progress * 100}%` }} /></div>{stops.map((s, i) => <button key={s.id} onClick={() => travelTo(i)} aria-label={`Travel to ${s.name}`} aria-current={activeStop === i ? "step" : undefined} className={`${activeStop === i ? "current" : Math.abs(activeStop - i) === 1 ? "nearby" : ""} ${visited.includes(s.id) ? "visited" : ""}`}><span className="stop-tick" /><span className="stop-index">0{i + 1}</span><span className="stop-tooltip">{s.name}</span></button>)}</aside>

        {ready === false && <div className="scene-fallback"><h2>A quieter path.</h2><p>Scroll through the trail to discover each part of my portfolio.</p><button className="text-link" onClick={() => openPanel(stops[Math.max(0, activeStop)].id)}>{stops[Math.max(0, activeStop)].name}<Arrow /></button></div>}
        {ready === null && <div className="loading-label" role="status"><span className="live-dot" />Growing a little forest…</div>}
      </main>

      <footer className="scene-footer">
        <div className="scroll-prompt"><span className="mouse-icon" aria-hidden="true"><span /></span><span>Scroll to wander</span><span className="scroll-down" aria-hidden="true">↓</span></div>
      </footer>
    </div>

    <dialog ref={dialog} className="portfolio-dialog" onCancel={() => setPanel(null)} aria-label={`${stops.find(s => s.id === panel)?.name ?? "Portfolio"} details`}>
      <div className="panel-shell"><button className="close-panel" onClick={() => setPanel(null)} aria-label="Close details and return to forest"><Cross /></button><div className="panel-scroll">{panel && <PortfolioPanel key={panel} page={panel} />}</div></div>
    </dialog>
    <noscript><div className="noscript-portfolio"><h1>Dhruv Shah · Software developer</h1><p>{profile.intro}</p><p><a href={profile.github}>Browse my projects on GitHub</a></p><p><a href={`mailto:${profile.email}`}>Contact me</a></p></div></noscript>
  </>;
}

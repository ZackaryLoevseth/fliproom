'use client';

import {useEffect, useMemo, useState} from 'react';
import type {Catalog, Placement, Scene, Step} from '@/lib/types';
import {buildPlan} from '@/lib/planner';
import {planSignature, toggleStep, validProgress} from '@/lib/progress';

const storageKey = 'fliproom.progress.v1';
const colors: Record<string, {fill: string; stroke: string}> = {
  chair: {fill: '#d7ddd0', stroke: '#718573'},
  table: {fill: '#dfc8a7', stroke: '#95734e'},
  screen: {fill: '#c2cadf', stroke: '#687aa7'},
  cart: {fill: '#e7baa4', stroke: '#a26648'},
  mat: {fill: '#c5bbda', stroke: '#807099'},
};

function Arrow({className = ''}: {className?: string}) {
  return <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Floor({catalog, scene, selected, ghost}: {catalog: Catalog; scene: Scene; selected?: Step; ghost?: Scene}) {
  const {width, height} = catalog.room;
  const unit = 50;
  const pad = 34;
  const svgWidth = width * unit + pad * 2;
  const svgHeight = height * unit + pad * 2;
  const footprint = (placement: Placement, isGhost = false) => {
    const item = catalog.items.find(item => item.id === placement.itemId);
    if (!item) return null;
    const itemWidth = (placement.rotation === 90 ? item.height : item.width) * unit;
    const itemHeight = (placement.rotation === 90 ? item.width : item.height) * unit;
    const scheme = colors[item.kind] || colors.chair;
    const active = selected?.itemId === item.id;
    const index = catalog.items.findIndex(value => value.id === item.id) + 1;
    return <g key={`${isGhost ? 'ghost-' : ''}${item.id}`} transform={`translate(${pad + placement.x * unit},${pad + placement.y * unit})`} opacity={isGhost ? .3 : 1}>
      <title>{`${item.label}: ${placement.x}, ${placement.y} metres; ${placement.rotation} degrees`}</title>
      <rect width={itemWidth} height={itemHeight} rx={item.kind === 'chair' ? 8 : 4} fill={isGhost ? 'none' : scheme.fill} stroke={active ? '#12453c' : scheme.stroke} strokeWidth={active ? 3 : 1.3} strokeDasharray={isGhost ? '4 3' : undefined} />
      {!isGhost && <>
        {item.kind === 'table' && <path d={`M7 4v${itemHeight - 8}M${itemWidth - 7} 4v${itemHeight - 8}`} stroke={scheme.stroke} strokeOpacity=".28" />}
        {item.kind === 'chair' && <path d={`M5 7h${Math.max(0, itemWidth - 10)}`} stroke={scheme.stroke} strokeWidth="3" strokeLinecap="round" />}
        <text x={itemWidth / 2} y={itemHeight / 2 + 4} textAnchor="middle" fontSize="11" fontFamily="monospace" fill="#283b34">{String(index).padStart(2, '0')}</text>
      </>}
    </g>;
  };
  const center = (placement: Placement) => {
    const item = catalog.items.find(value => value.id === placement.itemId)!;
    return [pad + (placement.x + (placement.rotation === 90 ? item.height : item.width) / 2) * unit, pad + (placement.y + (placement.rotation === 90 ? item.width : item.height) / 2) * unit];
  };
  const start = selected?.from ? center(selected.from) : undefined;
  const end = selected?.to ? center(selected.to) : undefined;
  return <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="floor" role="img" aria-label={`${scene.name} floor plan, ${width} by ${height} metres. Numbered items are identified in the equipment list.`}>
    <defs>
      <pattern id="floor-grid" width={unit} height={unit} patternUnits="userSpaceOnUse" x={pad} y={pad}><path d={`M ${unit} 0 L 0 0 0 ${unit}`} fill="none" stroke="#d8dfd4" strokeWidth=".7" /></pattern>
      <marker id="arrowhead" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="none" stroke="#174c42" /></marker>
    </defs>
    <rect x={pad} y={pad} width={width * unit} height={height * unit} rx="3" fill="#f5f7ef" />
    <rect x={pad} y={pad} width={width * unit} height={height * unit} fill="url(#floor-grid)" stroke="#9bab9d" strokeWidth="2" />
    <text x={svgWidth / 2} y="17" textAnchor="middle" className="dimension">{width} METRES</text>
    <text x="14" y={svgHeight / 2} textAnchor="middle" transform={`rotate(-90 14 ${svgHeight / 2})`} className="dimension">{height} METRES</text>
    <text x={svgWidth / 2} y={svgHeight - 9} textAnchor="middle" className="dimension">TOP VIEW · 1 GRID SQUARE = 1 METRE</text>
    {ghost?.placements.filter(place => {
      const target = scene.placements.find(value => value.itemId === place.itemId);
      return !target || target.x !== place.x || target.y !== place.y || target.rotation !== place.rotation;
    }).map(place => footprint(place, true))}
    {scene.placements.map(place => footprint(place))}
    {start && end && <path d={`M${start[0]} ${start[1]} Q${(start[0] + end[0]) / 2 + 24} ${(start[1] + end[1]) / 2 - 25} ${end[0]} ${end[1]}`} stroke="#174c42" strokeWidth="2" strokeDasharray="5 4" fill="none" markerEnd="url(#arrowhead)" />}
  </svg>;
}

export function Fliproom({catalog, source, publicMode = false, basePath = ''}: {catalog: Catalog; source: 'demo' | 'sanity'; publicMode?: boolean; basePath?: string}) {
  const [fromId, setFromId] = useState(catalog.scenes[0]?.id || '');
  const [toId, setToId] = useState(catalog.scenes[1]?.id || catalog.scenes[0]?.id || '');
  const [view, setView] = useState<'before' | 'after'>('after');
  const [done, setDone] = useState<string[]>([]);
  const [hovered, setHovered] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  const [storageAvailable, setStorageAvailable] = useState(true);
  const from = catalog.scenes.find(scene => scene.id === fromId);
  const to = catalog.scenes.find(scene => scene.id === toId);
  const plan = useMemo(() => buildPlan(catalog, fromId, toId), [catalog, fromId, toId]);
  const signature = useMemo(() => planSignature(catalog, fromId, toId), [catalog, fromId, toId]);

  useEffect(() => {
    setDone([]);
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        const nextFrom = catalog.scenes.find(scene => scene.id === saved.from)?.id;
        const nextTo = catalog.scenes.find(scene => scene.id === saved.to)?.id;
        if (nextFrom && nextTo && saved.signature === planSignature(catalog, nextFrom, nextTo)) {
          setFromId(nextFrom);
          setToId(nextTo);
          setDone(validProgress(buildPlan(catalog, nextFrom, nextTo).steps, saved.done));
        } else {
          setFromId(catalog.scenes[0]?.id || '');
          setToId(catalog.scenes[1]?.id || catalog.scenes[0]?.id || '');
          setNotice('The room data changed. Previous checkmarks were cleared so you can review the new plan.');
        }
      }
    } catch {
      setStorageAvailable(false);
      setNotice('Browser storage is unavailable or the saved plan is unreadable. You can still use and download this checklist.');
    }
    setLoaded(true);
  }, [catalog]);

  useEffect(() => {
    if (!loaded || !storageAvailable) return;
    try { localStorage.setItem(storageKey, JSON.stringify({signature, from: fromId, to: toId, done})); }
    catch { setStorageAvailable(false); setNotice('Progress could not be saved in this browser. Download the checklist to keep a copy.'); }
  }, [loaded, storageAvailable, signature, fromId, toId, done]);

  function choose(side: 'from' | 'to', id: string) {
    if ((side === 'from' ? fromId : toId) === id) return;
    if (done.length) setNotice('A new changeover is selected. Its checklist starts fresh.');
    setDone([]);
    setHovered(undefined);
    if (side === 'from') setFromId(id); else setToId(id);
  }

  function download() {
    const content = [
      'FLIPROOM — CHANGEOVER CHECKLIST',
      `${catalog.room.name}: ${from?.name} → ${to?.name}`,
      `Data: ${source === 'demo' ? 'fictional local demonstration' : 'published Sanity catalog'}`,
      `Planning estimate: ${plan.totalMinutes} person-minutes; not a measured duration.`,
      '',
      ...plan.blockers.map(value => `BLOCKED: ${value}`),
      ...plan.steps.map((step, i) => `${done.includes(step.id) ? '[x]' : '[ ]'} ${i + 1}. ${step.label} (${step.minutes} min)${step.dependsOn.length ? `; after steps ${step.dependsOn.map(id => plan.steps.findIndex(s => s.id === id) + 1).join(', ')}` : ''}`),
      '',
      'Check access routes, lifting arrangements and venue requirements before moving equipment. This footprint planner does not certify a room for use.',
      'Checkmarks are a browser-local planning record, not proof of physical work.',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([content], {type: 'text/plain;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = 'fliproom-checklist.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (!from || !to) return <main className="setup-message"><h1>Add a room layout to begin.</h1><p>The published catalog has no usable scenes.</p>{!publicMode && <a href="/studio">Open content studio</a>}</main>;
  const selected = plan.steps.find(step => step.id === hovered) || plan.steps.find(step => !done.includes(step.id));
  const percent = plan.steps.length ? Math.round(done.length / plan.steps.length * 100) : 0;
  const finished = plan.steps.length > 0 && done.length === plan.steps.length;

  return <>
    <header className="topbar"><a className="wordmark" href={`${basePath}/`} aria-label="Fliproom home"><span className="logo-mark">↗</span>fliproom</a><span className="header-caption">A little choreography for shared spaces.</span>{!publicMode && <a className="studio-link" href="/studio">Content studio <Arrow /></a>}</header>
    <main className="app-shell">
      <div className="page-intro"><div><p className="eyebrow">THE ROOM CAN BE MORE THAN ONE THING</p><h1>Make room for<br /><em>what’s next.</em></h1></div><div className="intro-aside"><span className={`source-pill ${source}`}><i />{source === 'demo' ? 'Fictional demo · local data' : 'Published Sanity data'}</span><p>Same space. Different possibilities.<br />A plan for everything in between.</p></div></div>
      {notice && <div role="status" className="notice">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notice">×</button></div>}
      <div className="workspace">
        <aside className="scene-sidebar" aria-label="Choose room layouts">
          <div className="room-name"><span className="room-icon">⌑</span><div><strong>{catalog.room.name}</strong><span>{catalog.room.width * catalog.room.height} m² · shared space</span></div></div>
          <label className="field-label" htmlFor="current-layout">01 / ROOM RIGHT NOW</label>
          <select id="current-layout" value={fromId} onChange={event => choose('from', event.target.value)}>{catalog.scenes.map(scene => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select>
          <div className="connector"><span /><Arrow /><span /></div>
          <p className="field-label">02 / MAKE IT INTO</p>
          <div className="scene-options">{catalog.scenes.map((scene, index) => <button key={scene.id} className={`scene-option ${toId === scene.id ? 'selected' : ''}`} aria-pressed={toId === scene.id} onClick={() => choose('to', scene.id)}><span className="scene-number">0{index + 1}</span><span><strong>{scene.name}</strong><small>{scene.subtitle}</small></span><span className="radio-dot" /></button>)}</div>
          <button className="swap-button" onClick={() => {setFromId(toId); setToId(fromId); setDone([]); setHovered(undefined); setNotice('Direction reversed. The checklist starts fresh.');}}>⇄ Reverse changeover</button>
          <div className="sidebar-note"><span>ONE PIECE, ONE PLACE.</span><p>Every layout uses the same equipment inventory. The plan works out what stays, moves or goes into storage.</p></div>
        </aside>
        <section className="plan-area" aria-labelledby="plan-heading">
          <div className="plan-heading"><div><p className="eyebrow">YOUR NEXT CHANGEOVER</p><h2 id="plan-heading">{from.name}<Arrow />{to.name}</h2></div><button className="icon-button" title="Download checklist" aria-label="Download checklist" onClick={download}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button></div>
          <div className="plan-stats"><div><strong>{String(plan.movedCount).padStart(2, '0')}</strong><span>pieces to move</span></div><div><strong>{plan.totalMinutes}<small> min</small></strong><span>estimated person-time</span></div><div className={plan.blockers.length ? 'status-warning' : 'status-clear'}><strong>{plan.blockers.length ? 'Review needed' : 'Plan ready'}<span className="status-dot" /></strong><span>{plan.blockers.length ? 'Resolve the issues below' : 'Footprint checks passed'}</span></div></div>
          <div className="canvas-card"><div className="canvas-toolbar"><span className="canvas-label">THE FLOOR PLAN</span><div className="segmented" aria-label="Floor plan view"><button onClick={() => setView('before')} aria-pressed={view === 'before'} className={view === 'before' ? 'active' : ''}>Before</button><button onClick={() => setView('after')} aria-pressed={view === 'after'} className={view === 'after' ? 'active' : ''}>After <Arrow /></button></div></div><Floor catalog={catalog} scene={view === 'before' ? from : to} ghost={view === 'after' ? from : undefined} selected={view === 'after' ? selected : undefined} /><div className="canvas-caption"><span><i className="solid-key" />{view === 'before' ? 'Current position' : 'Next position'}</span>{view === 'after' && <span><i className="ghost-key" />Previous position</span>}<span className="canvas-hint">Numbers match the inventory below</span></div></div>
          <details className="inventory"><summary>Equipment inventory <span>{catalog.items.length} pieces <span className="plus">+</span></span></summary><div className="inventory-grid">{catalog.items.map((item, index) => <div key={item.id}><span style={{background: colors[item.kind]?.fill}}>{String(index + 1).padStart(2, '0')}</span><p><strong>{item.label}</strong><small>{item.width} × {item.height} m{!to.placements.some(place => place.itemId === item.id) ? ' · storage next' : ''}</small></p></div>)}</div></details>
        </section>
        <section className="checklist-panel" aria-labelledby="checklist-heading"><div className="checklist-top"><p className="eyebrow">03 / LET’S FLIP IT</p><h2 id="checklist-heading">The move list<span>{plan.steps.length}</span></h2><p>One step at a time. Dependencies keep the next position clear.</p></div>
          {plan.blockers.length > 0 && <div role="alert" className="blockers"><strong>This plan needs a fix.</strong><ul>{plan.blockers.map((value, i) => <li key={i}>{value}</li>)}</ul></div>}
          {plan.steps.length === 0 && !plan.blockers.length && <div className="empty-plan"><span>✓</span><h3>Already in place.</h3><p>These layouts match. Choose another destination to create a changeover.</p></div>}
          <ol className="checklist">{plan.steps.map((step, index) => {
            const complete = done.includes(step.id);
            const waiting = !step.dependsOn.every(id => done.includes(id));
            return <li key={step.id} className={`${complete ? 'complete' : ''} ${waiting ? 'waiting' : ''}`} onMouseEnter={() => setHovered(step.id)} onMouseLeave={() => setHovered(undefined)}><button className="step-button" disabled={waiting || !loaded || plan.blockers.length > 0} aria-label={`${complete ? 'Undo' : 'Complete'} step ${index + 1}: ${step.label}`} aria-pressed={complete} onFocus={() => setHovered(step.id)} onBlur={() => setHovered(undefined)} onClick={() => setDone(toggleStep(plan.steps, done, step.id))}><span className="step-check">{complete ? '✓' : String(index + 1).padStart(2, '0')}</span><span className="step-copy"><strong>{step.label}</strong><span>{step.minutes} min <span className="middot">·</span> {waiting ? `After ${step.dependsOn.filter(id => !done.includes(id)).map(id => plan.steps.findIndex(value => value.id === id) + 1).join(', ')}` : complete ? 'Marked complete' : step.kind === 'park' ? 'Temporary position' : 'Ready to move'}</span></span></button></li>;
          })}</ol>
          <div className="progress-area"><div><strong aria-live="polite">{finished ? 'Checklist complete' : `${done.length} of ${plan.steps.length} steps complete`}</strong><span>{percent}%</span></div><progress value={done.length} max={Math.max(1, plan.steps.length)} aria-label="Checklist progress" /><p>{storageAvailable ? 'Checkmarks saved only in this browser.' : 'Browser saving unavailable.'}</p><div className="checklist-actions"><button onClick={download}>↓ Save checklist</button><button disabled={!done.length} onClick={() => {setDone([]); setNotice('Checkmarks cleared. The room layouts are unchanged.');}}>Reset</button></div></div>
        </section>
      </div>
      <footer className="footer"><span>Many uses. One very good room.</span><p>Planning aid · fictional furniture and timing. Check access, lifting and venue requirements before moving anything.</p></footer>
    </main>
  </>;
}

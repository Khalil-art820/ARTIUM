import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import "./DirectMessages.css";

// Direct messages in Instagram's manner: an inbox (one row per person, the
// latest line, unread in bold with a blue dot) and a conversation that opens
// over it full screen. In the conversation: grouped bubbles, time breaks,
// "Seen" under your last message, double-tap for a heart, long-press or
// right-click for reactions, Reply, Copy, Edit (your own, 15 minutes) and
// Unsend (your own), swipe to reply on touch screens.
//
// Data comes from App: conversations[peerId] = [{ id, from: "me" | "them",
// text, at, readAt, editedAt, replyTo, myReaction, theirReaction }], and
// actions.{send, edit, unsend, react} write it. Marking a thread read stays
// in App, which does it while a thread is open.

const REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "👍"];
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const BREAK_MS = 30 * 60 * 1000;

const initials = (name) => String(name || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const lang = () => (typeof document !== "undefined" && document.documentElement.lang) || "en";
const ms = (iso) => (iso ? Date.parse(iso) : 0);

// "now", "5m", "3h", "2d", "4w": the inbox's short ages.
function age(iso) {
  const s = Math.max(0, (Date.now() - ms(iso)) / 1000);
  if (s < 60) return "";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / (7 * 86400))}w`;
}

// The break between messages: a time today, a weekday this week, a date
// before that.
function Stamp({ iso }) {
  const d = new Date(ms(iso));
  const now = new Date();
  const time = new Intl.DateTimeFormat(lang(), { hour: "2-digit", minute: "2-digit" }).format(d);
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(now) - day(d)) / 86400000);
  if (days === 0) return <>{time}</>;
  if (days === 1) return <><span>Yesterday</span> {time}</>;
  if (days < 7) return <>{new Intl.DateTimeFormat(lang(), { weekday: "short" }).format(d)} {time}</>;
  return <>{new Intl.DateTimeFormat(lang(), { day: "numeric", month: "short", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) }).format(d)}, {time}</>;
}

function Face({ person, size }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="dm-face" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} aria-hidden="true">
      {person?.photoUrl && !broken
        ? <img src={person.photoUrl} alt="" onError={() => setBroken(true)} />
        : <b>{initials(person?.name)}</b>}
    </span>
  );
}

const Icon = ({ d, size = 24, sw = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const IconBack = () => <Icon d={<path d="M15 5l-7 7 7 7" />} size={26} />;
const IconX = () => <Icon d={<path d="M6 6l12 12M18 6L6 18" />} size={18} />;
const IconSmile = () => <Icon d={<><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8M9 9.6v.2M15 9.6v.2" /></>} size={18} />;
const IconSearch = () => <Icon d={<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>} size={17} />;

export default function DirectMessages({ people, conversations, activeId, setActiveId, actions, onOpenProfile }) {
  // Names and photos: the members App already has, and for anyone else in a
  // thread (a learner, say), whatever the database lets this account read.
  const [extra, setExtra] = useState({});
  const known = useMemo(() => Object.fromEntries((people || []).map((p) => [p.id, p])), [people]);
  const ids = Object.keys(conversations || {});
  const missing = ids.filter((id) => !known[id] && !extra[id]).join(",");
  useEffect(() => {
    if (!missing) return;
    let live = true;
    supabase.from("profiles").select("id, name, photo_url, instrument").in("id", missing.split(",")).then(({ data }) => {
      if (!live) return;
      const got = Object.fromEntries((data || []).map((r) => [r.id, { id: r.id, name: r.name, photoUrl: r.photo_url, instrumentLabel: r.instrument }]));
      setExtra((e) => ({ ...e, ...Object.fromEntries(missing.split(",").map((id) => [id, got[id] || { id, name: "Artium member" }])) }));
    });
    return () => { live = false; };
  }, [missing]);
  const person = (id) => known[id] || extra[id] || { id, name: "" };

  const [q, setQ] = useState("");
  const rows = useMemo(() => ids.map((id) => {
    const thread = conversations[id] || [];
    const last = thread[thread.length - 1];
    return { id, thread, last, when: last ? ms(last.at) || Date.now() : Date.now(), unread: thread.some((m) => m.from === "them" && !m.readAt) };
  }).sort((a, b) => b.when - a.when), [conversations]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = rows.filter((r) => !q.trim() || (person(r.id).name || "").toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="dm">
      <div className="dm-inbox">
        <h2 className="dm-title">Messages</h2>
        <label className="dm-search">
          <IconSearch />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
        </label>
        {rows.length === 0 ? (
          <div className="dm-empty">
            <p className="dm-empty-t">No messages yet</p>
            <p className="dm-empty-d">Message a musician from their profile to start a conversation.</p>
          </div>
        ) : (
          <ul className="dm-rows">
            {shown.map(({ id, last, unread }) => {
              const p = person(id);
              return (
                <li key={id}>
                  <button type="button" className={`dm-row${unread ? " is-unread" : ""}`} onClick={() => setActiveId(id)}>
                    <Face person={p} size={56} />
                    <span className="dm-row-main">
                      <span className="dm-row-name" data-no-translate="">{p.name}</span>
                      <span className="dm-row-sub">{rowLine(last)}</span>
                    </span>
                    {unread && <i className="dm-dot" aria-label="Unread" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {activeId && (
        <Thread key={activeId} peer={person(activeId)} thread={conversations[activeId] || []} actions={actions}
          onBack={() => setActiveId(null)} onOpenProfile={onOpenProfile} />
      )}
    </div>
  );
}

// The inbox's second line, as Instagram writes it.
function rowLine(last) {
  if (!last) return <span>Say hello</span>;
  if (last.from === "me") {
    if (last.optimistic) return <span>Sending…</span>;
    if (last.readAt) { const a = age(last.readAt); return <span>{a ? `Seen ${a} ago` : "Seen just now"}</span>; }
    const a = age(last.at);
    return <span>{a ? `Sent ${a} ago` : "Sent just now"}</span>;
  }
  const a = age(last.at);
  return <><span className="dm-row-text" data-no-translate="">{last.text}</span>{a && <span className="dm-row-age">· {a}</span>}</>;
}

function Thread({ peer, thread, actions, onBack, onOpenProfile }) {
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);   // a message
  const [editing, setEditing] = useState(null);   // a message
  const [menu, setMenu] = useState(null);         // a message
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const first = (peer.name || "").split(" ")[0];
  const byId = useMemo(() => Object.fromEntries(thread.filter((m) => m.id).map((m) => [m.id, m])), [thread]);

  // The page behind doesn't scroll while a conversation is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e) => { if (e.key === "Escape") { if (menu) setMenu(null); else onBack(); } };
    document.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", esc); };
  }, [menu, onBack]);

  // Open at the latest message; follow new ones if already at the bottom.
  const lastKey = thread.length ? `${thread.length}:${thread[thread.length - 1].id || "o"}` : "0";
  const stuck = useRef(true);
  useEffect(() => {
    const el = bodyRef.current;
    if (el && stuck.current) el.scrollTop = el.scrollHeight;
  }, [lastKey]);
  const onScroll = () => {
    const el = bodyRef.current;
    if (el) stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Typing grows the box up to five lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 118) + "px";
    el.classList.toggle("is-tall", el.scrollHeight > 118);
  }, [text]);

  function submit() {
    const body = text.trim();
    if (!body) return;
    if (editing) {
      if (body !== editing.text) actions.edit(peer.id, editing.id, body);
      setEditing(null);
    } else {
      stuck.current = true;
      actions.send(peer.id, body, replyTo?.id || null);
      setReplyTo(null);
    }
    setText("");
  }
  const startReply = (m) => { setEditing(null); setReplyTo(m); setMenu(null); inputRef.current?.focus(); };
  const startEdit = (m) => { setReplyTo(null); setEditing(m); setText(m.text); setMenu(null); setTimeout(() => inputRef.current?.focus(), 0); };
  const cancelBar = () => { if (editing) setText(""); setEditing(null); setReplyTo(null); };
  const toggleHeart = (m) => { if (m.id) actions.react(peer.id, m.id, m.myReaction === "❤️" ? null : "❤️"); };

  // The last message overall, if it's yours, carries Sent / Seen.
  const last = thread[thread.length - 1];

  return (
    <div className="dm-thread" role="dialog" aria-label={peer.name}>
      <header className="dm-head">
        <button type="button" className="dm-icon" onClick={onBack} aria-label="Back"><IconBack /></button>
        <button type="button" className="dm-head-who" onClick={() => onOpenProfile && peer.id && onOpenProfile(peer.id)} aria-label="Open profile">
          <Face person={peer} size={34} />
          <span className="dm-head-text">
            <b data-no-translate="">{peer.name}</b>
            {peer.instrumentLabel && <em data-no-translate="">{peer.instrumentLabel}</em>}
          </span>
        </button>
      </header>

      <div className="dm-body" ref={bodyRef} onScroll={onScroll}>
        <div className="dm-intro">
          <Face person={peer} size={88} />
          <b data-no-translate="">{peer.name}</b>
          {peer.instrumentLabel && <em data-no-translate="">{peer.instrumentLabel}</em>}
          <button type="button" className="dm-intro-btn" onClick={() => onOpenProfile && peer.id && onOpenProfile(peer.id)}>View profile</button>
        </div>
        {thread.map((m, i) => {
          const prev = thread[i - 1], next = thread[i + 1];
          const brk = !prev || ms(m.at) - ms(prev.at) > BREAK_MS;
          const nextBrk = !next || ms(next.at) - ms(m.at) > BREAK_MS;
          const top = brk || prev.from !== m.from || !!m.replyTo;
          const bottom = nextBrk || next.from !== m.from || !!next.replyTo;
          return (
            <React.Fragment key={m.id || `o${i}`}>
              {brk && m.at && <p className="dm-break"><Stamp iso={m.at} /></p>}
              <Bubble m={m} peer={peer} quoted={m.replyTo ? byId[m.replyTo] || false : null}
                top={top} bottom={bottom} showFace={m.from === "them" && bottom}
                onMenu={() => setMenu(m)} onHeart={() => toggleHeart(m)} onSwipe={() => m.id && startReply(m)} />
              {m === last && m.from === "me" && (
                <p className="dm-seen">{m.optimistic ? "Sending…" : m.readAt ? "Seen" : "Sent"}</p>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="dm-compose">
        {(replyTo || editing) && (
          <div className="dm-bar">
            <span className="dm-bar-text">
              <b>{editing ? "Editing message" : replyTo.from === "me" ? "Replying to yourself" : `Replying to ${first}`}</b>
              {replyTo && <em data-no-translate="">{replyTo.text}</em>}
            </span>
            <button type="button" className="dm-icon" onClick={cancelBar} aria-label="Cancel"><IconX /></button>
          </div>
        )}
        <div className="dm-input">
          <textarea ref={inputRef} rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Message…"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} />
          {text.trim() && <button type="button" className="dm-send" onMouseDown={(e) => e.preventDefault()} onClick={submit}>{editing ? "Save" : "Send"}</button>}
        </div>
      </div>

      {menu && (
        <MessageMenu m={menu} onClose={() => setMenu(null)}
          onReact={(emoji) => { actions.react(peer.id, menu.id, menu.myReaction === emoji ? null : emoji); setMenu(null); }}
          onReply={() => startReply(menu)}
          onCopy={() => { try { navigator.clipboard.writeText(menu.text); } catch { /* not allowed */ } setMenu(null); }}
          onEdit={() => startEdit(menu)}
          onUnsend={() => { actions.unsend(peer.id, menu.id); if (replyTo?.id === menu.id) setReplyTo(null); if (editing?.id === menu.id) cancelBar(); setMenu(null); }} />
      )}
    </div>
  );
}

function Bubble({ m, peer, quoted, top, bottom, showFace, onMenu, onHeart, onSwipe }) {
  const mine = m.from === "me";
  const [dx, setDx] = useState(0);
  const touch = useRef(null);
  const lastTap = useRef(0);

  // Long-press opens the menu; a sideways drag (right on theirs, left on
  // yours) replies; two taps in quick succession give a heart.
  function onTouchStart(e) {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, moved: false, timer: setTimeout(() => { if (touch.current && !touch.current.moved) { touch.current.fired = true; onMenu(); } }, 450) };
  }
  function onTouchMove(e) {
    const s = touch.current; if (!s) return;
    const t = e.touches[0];
    const x = t.clientX - s.x, y = t.clientY - s.y;
    if (Math.abs(x) > 8 || Math.abs(y) > 8) { s.moved = true; clearTimeout(s.timer); }
    if (Math.abs(x) > Math.abs(y)) {
      const pull = mine ? Math.min(0, x) : Math.max(0, x);
      setDx(Math.max(-72, Math.min(72, pull)));
    }
  }
  function onTouchEnd() {
    const s = touch.current; touch.current = null;
    if (!s) return;
    clearTimeout(s.timer);
    if (Math.abs(dx) > 52) onSwipe();
    setDx(0);
    if (!s.moved && !s.fired) {
      const now = Date.now();
      if (now - lastTap.current < 300) { onHeart(); lastTap.current = 0; } else lastTap.current = now;
    }
  }

  const reactions = [m.theirReaction, m.myReaction].filter(Boolean);
  const replyLabel = quoted === null ? null
    : mine ? (quoted && quoted.from === "me" ? "You replied to yourself" : `You replied to ${(peer.name || "").split(" ")[0]}`)
      : (quoted && quoted.from === "me" ? `${(peer.name || "").split(" ")[0]} replied to you` : `${(peer.name || "").split(" ")[0]} replied`);

  return (
    <div className={`dm-msg ${mine ? "is-mine" : "is-theirs"}${top ? " is-top" : ""}${bottom ? " is-bottom" : ""}${reactions.length ? " has-react" : ""}`}>
      {!mine && <span className="dm-msg-face">{showFace && <Face person={peer} size={28} />}</span>}
      <div className="dm-msg-col" style={dx ? { transform: `translateX(${dx}px)` } : undefined}>
        {replyLabel && (
          <div className="dm-quote">
            <span className="dm-quote-label">{replyLabel}</span>
            <span className="dm-quote-text" data-no-translate={quoted ? "" : undefined}>{quoted ? quoted.text : "Message unavailable"}</span>
          </div>
        )}
        <div className="dm-b-wrap">
          <div className={`dm-b${m.optimistic ? " is-pending" : ""}`} data-no-translate=""
            onContextMenu={(e) => { e.preventDefault(); onMenu(); }} onDoubleClick={onHeart}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
            {m.text}
          </div>
          <button type="button" className="dm-more" onClick={onMenu} aria-label="More"><IconSmile /></button>
        </div>
        {reactions.length > 0 && <span className="dm-react" data-no-translate="">{reactions.join("")}</span>}
        {m.editedAt && <span className="dm-edited">Edited</span>}
      </div>
    </div>
  );
}

function MessageMenu({ m, onClose, onReact, onReply, onCopy, onEdit, onUnsend }) {
  const mine = m.from === "me";
  const saved = !!m.id;
  const canEdit = mine && saved && Date.now() - ms(m.at) < EDIT_WINDOW_MS;
  return (
    <div className="dm-menu-root" onClick={onClose}>
      <div className={`dm-menu ${mine ? "is-mine" : "is-theirs"}`} onClick={(e) => e.stopPropagation()} role="menu">
        {saved && (
          <div className="dm-menu-react">
            {REACTIONS.map((r) => (
              <button key={r} type="button" className={m.myReaction === r ? "is-on" : ""} onClick={() => onReact(r)} data-no-translate="">{r}</button>
            ))}
          </div>
        )}
        <div className="dm-menu-preview" data-no-translate="">{m.text}</div>
        <div className="dm-menu-list">
          {saved && <button type="button" role="menuitem" onClick={onReply}>Reply</button>}
          <button type="button" role="menuitem" onClick={onCopy}>Copy</button>
          {canEdit && <button type="button" role="menuitem" onClick={onEdit}>Edit</button>}
          {mine && saved && <button type="button" role="menuitem" className="is-danger" onClick={onUnsend}>Unsend</button>}
        </div>
      </div>
    </div>
  );
}

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

// Your bubbles take Instagram's gradient by where they sit on the screen:
// pink-magenta at the top, purple through the middle, blue-violet at the
// bottom, and they change colour as you scroll. Painted per bubble (rather
// than a fixed CSS background, which iPhones ignore).
const STOPS = [[0, [214, 46, 158]], [0.32, [160, 52, 222]], [0.62, [118, 56, 250]], [1, [79, 91, 213]]];
function shade(t) {
  let i = 0;
  while (i < STOPS.length - 2 && t > STOPS[i + 1][0]) i++;
  const [t0, a] = STOPS[i], [t1, b] = STOPS[i + 1];
  const k = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * k)).join(",")})`;
}

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
// Instagram's back arrow: a full arrow, not a chevron.
const IconBack = () => <Icon d={<path d="M20 12H4.5M11 5l-7 7 7 7" />} size={26} sw={2} />;
// The verified mark beside a name: the app's scalloped emerald badge (the Connect button's colour).
const Verified = () => (
  <svg className="dm-verified" width="19" height="19" viewBox="0 0 24 24" aria-label="Verified">
    <path fill="#073D37" d="M12.00 2.60Q15.25 -0.12 16.70 3.86Q20.87 3.13 20.14 7.30Q24.12 8.75 21.40 12.00Q24.12 15.25 20.14 16.70Q20.87 20.87 16.70 20.14Q15.25 24.12 12.00 21.40Q8.75 24.12 7.30 20.14Q3.13 20.87 3.86 16.70Q-0.12 15.25 2.60 12.00Q-0.12 8.75 3.86 7.30Q3.13 3.13 7.30 3.86Q8.75 -0.12 12.00 2.60Z" />
    <path d="M7.7 12.2l2.9 2.9 5.8-5.9" fill="none" stroke="#FFFFFF" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconX = () => <Icon d={<path d="M6 6l12 12M18 6L6 18" />} size={18} />;
const IconSmile = () => <Icon d={<><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8M9 9.6v.2M15 9.6v.2" /></>} size={18} />;
// Instagram's search: a ring open at the top right, a spark in the gap.
const IconSearch = () => <Icon d={<><path d="M17.2 9.6A7 7 0 1 1 13 4.4" /><path d="M16.5 16.5l4 4" /><path d="M18 2.5v4M16 4.5h4" /></>} size={21} sw={1.9} />;
// The list button at the top left: three lines, each with a dot.
const IconSelect = () => <Icon d={<><circle cx="4.5" cy="6" r="1.4" /><circle cx="4.5" cy="12" r="1.4" /><circle cx="4.5" cy="18" r="1.4" /><path d="M9.5 6H20M9.5 12H20M9.5 18H20" /></>} size={26} sw={1.9} />;
const IconClose = () => <Icon d={<path d="M5 5l14 14M19 5L5 19" />} size={26} sw={1.9} />;
const IconDots = () => <Icon d={<><circle cx="5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="19" cy="12" r="1.3" fill="currentColor" /></>} size={24} sw={1.2} />;
const IconTick = () => <Icon d={<path d="M5 12.5l4.5 4.5L19 7.5" />} size={15} sw={3} />;

// The inbox. `trusted`: ids that always land in Primary (connections; for a
// learner, teachers who accepted them). Anyone else who writes first, before
// you've written back or accepted, waits in Requests.
export default function DirectMessages({ people, conversations, activeId, setActiveId, actions, onOpenProfile, myId, trusted = [] }) {
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

  // Chats you deleted (dm_cleared): hidden up to that moment, for you only; a
  // newer message brings the conversation back. Requests you accepted
  // (dm_accepted).
  const [cleared, setCleared] = useState({});
  const [accepted, setAccepted] = useState({});
  // People you blocked (dm_blocks): their conversation sits in Blocked, and
  // the database refuses messages either way until you unblock them.
  const [blocked, setBlocked] = useState({});
  useEffect(() => {
    let live = true;
    supabase.from("dm_blocks").select("blocked_id").then(({ data, error }) => {
      if (live && !error && data) setBlocked(Object.fromEntries(data.map((r) => [r.blocked_id, true])));
    });
    supabase.from("dm_cleared").select("peer_id, cleared_at").then(({ data, error }) => {
      if (live && !error && data) setCleared(Object.fromEntries(data.map((r) => [r.peer_id, ms(r.cleared_at)])));
    });
    supabase.from("dm_accepted").select("peer_id").then(({ data, error }) => {
      if (live && !error && data) setAccepted(Object.fromEntries(data.map((r) => [r.peer_id, true])));
    });
    return () => { live = false; };
  }, []);
  const visible = (id) => (conversations[id] || []).filter((m) => !cleared[id] || !m.at || ms(m.at) > cleared[id]);
  const trustedKey = [...trusted].sort().join(",");
  const isRequest = (id) => !accepted[id] && !trusted.includes(id) && !(conversations[id] || []).some((m) => m.from === "me")
    && (conversations[id] || []).length > 0;

  const [folder, setFolder] = useState("primary");
  const [q, setQ] = useState("");
  const rows = useMemo(() => ids.map((id) => {
    const thread = visible(id);
    const last = thread[thread.length - 1];
    const fold = blocked[id] ? "blocked" : isRequest(id) ? "requests" : "primary";
    return { id, thread, last, fold, request: fold === "requests", when: last ? ms(last.at) || Date.now() : Date.now(), unread: fold !== "blocked" && thread.some((m) => m.from === "them" && !m.readAt) };
  }).filter((r) => r.thread.length || !cleared[r.id] || r.id === activeId)
    .sort((a, b) => b.when - a.when), [conversations, cleared, accepted, blocked, activeId, trustedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const inFolder = rows.filter((r) => r.fold === folder);
  const shown = inFolder.filter((r) => !q.trim() || (person(r.id).name || "").toLowerCase().includes(q.trim().toLowerCase()));
  const unreadIn = (f) => rows.filter((r) => r.fold === f && r.unread).length;
  async function blockPeer(peer) {
    const p = person(peer);
    if (!window.confirm(`Block ${p.name || "this person"}? Neither of you will be able to message the other until you unblock them.`)) return;
    const { error } = await supabase.from("dm_blocks").insert({ user_id: myId, blocked_id: peer });
    if (error && !/duplicate/i.test(error.message || "")) { window.alert("Couldn't block. Please try again."); return; }
    setBlocked((b) => ({ ...b, [peer]: true }));
    if (actions.markRead) actions.markRead([peer]);
  }
  async function unblockPeer(peer) {
    const { error } = await supabase.from("dm_blocks").delete().eq("user_id", myId).eq("blocked_id", peer);
    if (error) { window.alert("Couldn't unblock. Please try again."); return; }
    setBlocked((b) => { const n = { ...b }; delete n[peer]; return n; });
  }

  // Select mode, from the list button: tick conversations, then act on them
  // from the bar at the bottom.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState([]);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const endSelect = () => { setSelecting(false); setPicked([]); };
  useEffect(() => { setPicked([]); }, [folder]);
  const anyUnread = picked.some((id) => rows.find((r) => r.id === id)?.unread);

  // The bar sits right on top of the app's tab bar, as Instagram's does.
  const [barBottom, setBarBottom] = useState(0);
  useEffect(() => {
    if (!selecting) return;
    const nav = document.querySelector(".artium-aw-tabs");
    setBarBottom(nav ? Math.max(0, window.innerHeight - nav.getBoundingClientRect().top) : 0);
  }, [selecting]);

  async function clearChats(list) {
    const now = new Date().toISOString();
    const { error } = await supabase.from("dm_cleared").upsert(list.map((peer) => ({ peer_id: peer, user_id: myId, cleared_at: now })));
    if (error) { window.alert("Couldn't delete. Please try again."); return false; }
    setCleared((c) => ({ ...c, ...Object.fromEntries(list.map((p) => [p, ms(now)])) }));
    return true;
  }
  async function deletePicked() {
    const n = picked.length;
    if (!window.confirm(n === 1 ? "Delete this chat? It's removed from your inbox only." : `Delete ${n} chats? They're removed from your inbox only.`)) return;
    if (await clearChats(picked)) endSelect();
  }
  async function acceptChats(list) {
    const { error } = await supabase.from("dm_accepted").upsert(list.map((peer) => ({ peer_id: peer, user_id: myId })));
    if (error) { window.alert("Couldn't accept. Please try again."); return false; }
    setAccepted((a) => ({ ...a, ...Object.fromEntries(list.map((p) => [p, true])) }));
    return true;
  }

  return (
    <div className="dm">
      <div className="dm-inbox">
        <div className="dm-top">
          {selecting ? <span className="dm-top-side" /> : (
            <button type="button" className="dm-top-side dm-icon" onClick={() => setSelecting(true)} aria-label="Select chats" disabled={!inFolder.length}><IconSelect /></button>
          )}
          <h2 className="dm-title">{selecting ? `${picked.length} selected` : "Messages"}</h2>
          {selecting ? (
            <button type="button" className="dm-top-side dm-icon" onClick={endSelect} aria-label="Cancel"><IconClose /></button>
          ) : <span className="dm-top-side" />}
        </div>
        <label className="dm-search">
          <IconSearch />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
        </label>
        <div className={`dm-folders${selecting ? " is-dim" : ""}`}>
          {[["primary", "Primary"], ["requests", "Requests"], ["blocked", "Blocked"]].map(([k, label]) => {
            const n = unreadIn(k);
            return (
              <button key={k} type="button" className={`dm-folder${folder === k ? " is-on" : ""}`} onClick={() => setFolder(k)} disabled={selecting}>
                {n > 0 && <i className="dm-folder-dot" aria-hidden="true" />}
                <span>{label}</span>
                {n > 0 && <b>{n}</b>}
              </button>
            );
          })}
        </div>
        {inFolder.length === 0 ? (
          <div className="dm-empty">
            {folder === "requests" ? (<>
              <p className="dm-empty-t">No message requests</p>
              <p className="dm-empty-d">Messages from people you're not connected with appear here.</p>
            </>) : folder === "blocked" ? (<>
              <p className="dm-empty-t">No one blocked</p>
              <p className="dm-empty-d">Conversations with people you block appear here.</p>
            </>) : (<>
              <p className="dm-empty-t">No messages yet</p>
              <p className="dm-empty-d">Message a musician from their profile to start a conversation.</p>
            </>)}
          </div>
        ) : (
          <ul className="dm-rows">
            {folder === "requests" && !selecting && (
              <li className="dm-req-note">They won't know you've seen their message until you accept.</li>
            )}
            {shown.map(({ id, last, unread }) => {
              const p = person(id);
              const on = picked.includes(id);
              return (
                <li key={id}>
                  <button type="button" className={`dm-row${unread ? " is-unread" : ""}`} onClick={() => (selecting ? toggle(id) : setActiveId(id))}
                    aria-pressed={selecting ? on : undefined}>
                    {selecting && <span className={`dm-check${on ? " is-on" : ""}`} aria-hidden="true">{on && <IconTick />}</span>}
                    <Face person={p} size={56} />
                    <span className="dm-row-main">
                      <span className="dm-row-name" data-no-translate="">{p.name}</span>
                      <span className="dm-row-sub">{rowLine(last)}</span>
                    </span>
                    {unread && !selecting && <i className="dm-dot" aria-label="Unread" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {selecting && (
        <div className="dm-actions" style={{ bottom: barBottom }}>
          {folder === "requests" ? (
            <button type="button" disabled={!picked.length} onClick={async () => { if (await acceptChats(picked)) endSelect(); }}>
              {`Accept (${picked.length})`}
            </button>
          ) : folder === "blocked" ? (
            <button type="button" disabled={!picked.length} onClick={async () => { for (const p of picked) await unblockPeer(p); endSelect(); }}>
              {`Unblock (${picked.length})`}
            </button>
          ) : (
            <button type="button" disabled={!picked.length} onClick={() => { (anyUnread ? actions.markRead : actions.markUnread)(picked); endSelect(); }}>
              {anyUnread ? `Mark as read (${picked.length})` : `Mark as unread (${picked.length})`}
            </button>
          )}
          <button type="button" className="is-danger" disabled={!picked.length} onClick={deletePicked}>{`Delete (${picked.length})`}</button>
        </div>
      )}
      {activeId && (
        <Thread key={activeId} peer={person(activeId)} thread={visible(activeId)} actions={actions}
          onBack={() => setActiveId(null)} onOpenProfile={onOpenProfile}
          blocked={!!blocked[activeId]} onBlock={() => blockPeer(activeId)} onUnblock={() => unblockPeer(activeId)}
          request={!blocked[activeId] && isRequest(activeId) ? {
            onAccept: () => acceptChats([activeId]),
            onDelete: async () => { if (window.confirm("Delete this chat? It's removed from your inbox only.") && await clearChats([activeId])) setActiveId(null); },
          } : null} />
      )}
    </div>
  );
}

// The inbox's second line, as Instagram writes it.
function rowLine(last) {
  if (!last) return <span>Say hello</span>;
  if (last.from === "me") {
    if (last.failed) return <span>Not delivered</span>;
    if (last.optimistic) return <span>Sending…</span>;
    if (last.readAt) { const a = age(last.readAt); return <span>{a ? `Seen ${a} ago` : "Seen just now"}</span>; }
    const a = age(last.at);
    return <span>{a ? `Sent ${a} ago` : "Sent just now"}</span>;
  }
  const a = age(last.at);
  return <><span className="dm-row-text" data-no-translate="">{last.text}</span>{a && <span className="dm-row-age">· {a}</span>}</>;
}

// A conversation. Full screen over the inbox, or `embedded` in a page (the
// learner's lesson room). `request`: an unaccepted request, shown with Accept
// and Delete instead of the composer, and not marked read until accepted.
export function Thread({ peer, thread, actions, onBack, onOpenProfile, embedded = false, request = null, blocked = false, onBlock, onUnblock }) {
  const [text, setText] = useState("");
  const [headMenu, setHeadMenu] = useState(false);
  const rootRef = useRef(null);
  const [replyTo, setReplyTo] = useState(null);   // a message
  const [editing, setEditing] = useState(null);   // a message
  const [menu, setMenu] = useState(null);         // a message
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const first = (peer.name || "").split(" ")[0];
  // The line under the name: what they play.
  const sub = peer.instrumentLabel || (Array.isArray(peer.instruments) ? peer.instruments.join(" & ") : "") || peer.instrument || "";
  const byId = useMemo(() => Object.fromEntries(thread.filter((m) => m.id).map((m) => [m.id, m])), [thread]);

  // Reading it is reading it for real (the inbox dot, "Seen" on their side),
  // except for a request, which stays unread until accepted.
  const unreadKey = thread.filter((m) => m.from === "them" && !m.readAt).length;
  useEffect(() => {
    if (unreadKey && !request && peer.id && actions.markRead) actions.markRead([peer.id]);
  }, [unreadKey, request, peer.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The page behind doesn't scroll while a conversation is open.
  useEffect(() => {
    if (embedded) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e) => { if (e.key === "Escape") { if (menu) setMenu(null); else onBack(); } };
    document.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", esc); };
  }, [menu, onBack, embedded]);

  // Open at the latest message; follow new ones if already at the bottom.
  const lastKey = thread.length ? `${thread.length}:${thread[thread.length - 1].id || "o"}` : "0";
  const stuck = useRef(true);
  useEffect(() => {
    const el = bodyRef.current;
    if (el && stuck.current) el.scrollTop = el.scrollHeight;
  }, [lastKey]);
  // When the keyboard opens, phones shrink (or pan) the visible part of the
  // page. The conversation is sized to exactly that visible part, so the
  // messages stay on screen above the keyboard, still at the latest one.
  useEffect(() => {
    const vv = window.visualViewport;
    const root = rootRef.current;
    if (embedded || !vv || !root) return undefined;
    const fit = () => {
      root.style.height = `${vv.height}px`;
      root.style.bottom = "auto";
      root.style.transform = vv.offsetTop ? `translateY(${vv.offsetTop}px)` : "";
      const el = bodyRef.current;
      if (el && stuck.current) el.scrollTop = el.scrollHeight;
    };
    fit();
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    return () => { vv.removeEventListener("resize", fit); vv.removeEventListener("scroll", fit); };
  }, [embedded]);
  const paint = () => {
    const el = bodyRef.current;
    if (!el) return;
    const vh = window.innerHeight || 1;
    el.querySelectorAll(".dm-msg.is-mine .dm-b").forEach((b) => {
      const r = b.getBoundingClientRect();
      b.style.backgroundColor = shade(Math.min(1, Math.max(0, (r.top + r.height / 2) / vh)));
    });
  };
  const painting = useRef(0);
  const repaint = () => { cancelAnimationFrame(painting.current); painting.current = requestAnimationFrame(paint); };
  useEffect(() => { paint(); });
  useEffect(() => {
    window.addEventListener("resize", repaint);
    return () => { window.removeEventListener("resize", repaint); cancelAnimationFrame(painting.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onScroll = () => {
    repaint();
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
    <div ref={rootRef} className={`dm-thread${embedded ? " is-embedded" : ""}`} role={embedded ? undefined : "dialog"} aria-label={peer.name}>
      {!embedded && <header className="dm-head">
        <button type="button" className="dm-icon" onClick={onBack} aria-label="Back"><IconBack /></button>
        <button type="button" className="dm-head-who" onClick={() => onOpenProfile && peer.id && onOpenProfile(peer.id)} aria-label="Open profile">
          <span className="dm-head-face"><Face person={peer} size={40} /></span>
          <span className="dm-head-text">
            <b><span data-no-translate="">{peer.name}</span>{(peer.verified || peer.conservatoryVerified) && <Verified />}</b>
            {sub && <em data-no-translate="">{sub}</em>}
          </span>
        </button>
        {(onBlock || onUnblock) && (
          <div className="dm-head-more">
            <button type="button" className="dm-icon" onClick={() => setHeadMenu((v) => !v)} aria-label="More options" aria-haspopup="menu" aria-expanded={headMenu}><IconDots /></button>
            {headMenu && (<>
              <div className="dm-head-scrim" onClick={() => setHeadMenu(false)} />
              <div className="dm-head-menu" role="menu">
                {onOpenProfile && peer.id && <button type="button" role="menuitem" onClick={() => { setHeadMenu(false); onOpenProfile(peer.id); }}>View profile</button>}
                {blocked
                  ? <button type="button" role="menuitem" onClick={() => { setHeadMenu(false); onUnblock(); }}>Unblock</button>
                  : <button type="button" role="menuitem" className="is-danger" onClick={() => { setHeadMenu(false); onBlock(); }}>Block</button>}
              </div>
            </>)}
          </div>
        )}
      </header>}

      <div className="dm-body" ref={bodyRef} onScroll={onScroll}>
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
                <p className={`dm-seen${m.failed ? " is-failed" : ""}`}>{m.failed ? "Not delivered" : m.optimistic ? "Sending…" : m.readAt ? "Seen" : "Sent"}</p>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {blocked ? (
        <div className="dm-request">
          <p className="dm-request-t">{`You blocked ${first || "this person"}`}</p>
          <p className="dm-request-d">Neither of you can send messages until you unblock them.</p>
          <div className="dm-request-btns">
            <button type="button" className="is-accept" onClick={onUnblock}>Unblock</button>
          </div>
        </div>
      ) : request ? (
        <div className="dm-request">
          <p className="dm-request-t">{`${first || "Someone"} wants to send you a message`}</p>
          <p className="dm-request-d">They won't know you've seen it until you accept.</p>
          <div className="dm-request-btns">
            <button type="button" className="is-danger" onClick={request.onDelete}>Delete</button>
            <button type="button" className="is-accept" onClick={request.onAccept}>Accept</button>
          </div>
        </div>
      ) : (
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
            onFocus={() => { stuck.current = true; setTimeout(() => { const el = bodyRef.current; if (el) el.scrollTop = el.scrollHeight; }, 250); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} />
          {text.trim() && <button type="button" className="dm-send" onMouseDown={(e) => e.preventDefault()} onClick={submit}>{editing ? "Save" : "Send"}</button>}
        </div>
      </div>
      )}

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

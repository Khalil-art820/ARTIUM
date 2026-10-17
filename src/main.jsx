import React from "react";
import ReactDOM from "react-dom/client";
import App, { BottomTabs, STUDENT_TABS, NotificationBell, ArtiumRadio, NetworkExplorer, CONSERVATORIES, PromoteMe } from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import "./index.css";
import "./pwa.js";


// The tab bar's CSS lives in App's inline <style>; replicate the bits the harness needs.
const TAB_CSS = `.artium-aw-tabs{position:fixed;z-index:40;display:flex;align-items:stretch;left:14px;right:14px;bottom:10px;border-radius:24px;background:linear-gradient(180deg,#FCFCFB,#F2F2F0 70%,#EAEAE8);border:1px solid rgba(176,146,98,.3);box-shadow:0 14px 30px -14px rgba(150,115,55,.38),inset 0 1px 0 #fff}
.artium-aw-tabs button{flex:1 1 0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 2px 8px;border:none;background:none;cursor:pointer;color:#6A7080;font:inherit;font-size:9.5px;font-weight:500;position:relative}
.artium-aw-tabs button[data-on="1"]{color:#C9962E}`;

// Dev-only design preview: /?gatepreview renders the trial gate with mock props.
const GatePreview = import.meta.env.DEV && new URLSearchParams(location.search).has("gatepreview")
  ? React.lazy(() => import("./components/entrygate/ArtiumGateChordify.jsx").then((m) => {
      const Wrapper = () => {
        // Mirrors App.jsx's toggleMusic exactly, driving the real ArtiumRadio.
        const [musicOn, setMusicOn] = React.useState(false);
        const [musicPlaying, setMusicPlaying] = React.useState(false);
        const radioRef = React.useRef(null);
        const toggleMusic = () => {
          if (!musicOn) { setMusicOn(true); if (musicPlaying) return; }
          try { radioRef.current?.togglePlay(); } catch { /* not ready yet */ }
        };
        const [tab, setTab] = React.useState("home");
        const a = (n) => () => alert(n);
        return (
          <>
          <style>{TAB_CSS}</style>
          <m.default
            memberCount={2}
            featuredMembers={new URLSearchParams(location.search).has("featured") ? [
              { id: "me", name: "Khalil Tannous", photoUrl: "/gate-cards/piano.webp", instrument: "Piano", icon: "piano" },
              { id: "s2", name: "Sample Violinist", photoUrl: "/gate-cards/violin.webp", instrument: "Violin", icon: "violin" },
            ] : undefined}
            memberChips={[
              { name: "Khalil Tannous", meta: "Piano · Beirut", photoUrl: "/gate-hero.jpg" },
              { name: "Lucas M.", meta: "Violin · Vienna" },
            ]}
            bellSlot={<NotificationBell myProfile={{ id: "preview", name: "Khalil Tannous" }} puck networkFeeds authUser={null} />}
            musicOn={musicPlaying}
            onMusicToggle={toggleMusic}
            avatarName="Khalil Tannous"
            onAvatar={a("onAvatar")}
            onLearner={a("onLearner")}
            onStudent={a("onStudent")}
            onPianist={a("onPianist")}
            onComposers={a("onComposers")}
            onNews={a("onNews")}
            onLogout={a("onLogout")}
          />
          <BottomTabs light modern items={STUDENT_TABS} active={tab} onTab={setTab} />
          <ArtiumRadio modern open={musicOn} controllerRef={radioRef} onPlayingChange={setMusicPlaying} onClose={() => setMusicOn(false)} />
          </>
        );
      };
      return { default: Wrapper };
    }))
  : null;

// Dev-only: /?networkpreview renders the Network tab's explorer with sample
// members at real conservatories (never shipped — the production build drops it).
const NetworkPreview = import.meta.env.DEV && new URLSearchParams(location.search).has("networkpreview")
  ? () => {
      const S = (id, name, cons, inst, year, open, verified, photo) => ({ id, name, conservatoryId: cons, instrument: inst, year, teaching: { open }, conservatoryVerified: verified, photoUrl: photo });
      const students = [
        S("me", "Khalil Tannous", "juilliard", "Piano", "Masters, Doctoral, 3rd year", true, true, "/gate-hero.jpg"),
        S("s2", "Sample Violinist", "eisler", "Violin", "Masters, 2nd year", false, true, "/app-banner.jpg"),
        S("s3", "Sample Cellist", "udk", "Cello", "Doctoral, 1st year", true, false, "/landing-backdrop.jpg"),
        S("s4", "Sample Singer", "hemgeneve", "Voice", "Graduated", false, true, ""),
        S("s5", "Sample Flautist", "curtis", "Flute", "Masters, 1st year", true, true, "/earth-artium.jpg"),
      ];
      return (
        <div className="artium-has-tabs tm-tab-map" style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px 120px", minHeight: "100vh" }}>
          <style>{TAB_CSS}</style>
          {/* Mirrors the greeting App draws above the explorer. */}
          <div className="tm-hello" style={{ margin: "-20px -16px 0" }}>
            <div className="tm-hello-l">
              <p className="tm-hello-eyebrow">Welcome back,</p>
              <h2 className="tm-hello-name">Khalil</h2>
              <span className="tm-hello-rule" />
              <p className="tm-hello-tag">Connecting passionate musicians around the world</p>
            </div>
            <p className="tm-hello-script">More music.<br />More connections.
              <svg viewBox="0 0 160 14" preserveAspectRatio="none"><path d="M2 12 C 50 4, 110 2, 158 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </p>
          </div>
          <NetworkExplorer learnerMode={new URLSearchParams(location.search).has("learner")} students={students} allCons={CONSERVATORIES} myId="me" myConservatoryId="juilliard"
            onOpenStudent={(id) => alert("open " + id)} onMessage={(id) => alert("message " + id)} />
          <BottomTabs light modern items={STUDENT_TABS} active="map" onTab={() => {}} />
        </div>
      );
    }
  : null;

// Dev-only: /?promotepreview renders the Promote Me landing.
const PromotePreview = import.meta.env.DEV && new URLSearchParams(location.search).has("promotepreview")
  ? () => (
      <div style={{ background: "#F7F4F2", minHeight: "100vh" }}>
        <style>{TAB_CSS}</style>
        <PromoteMe myProfile={{ id: "preview", name: "Khalil Tannous" }} authUser={{ id: "00000000-0000-0000-0000-000000000000" }} />
        <BottomTabs light modern items={STUDENT_TABS} active="promote" onTab={() => {}} />
      </div>
    )
  : null;

ReactDOM.createRoot(document.getElementById("root")).render(
  PromotePreview ? <PromotePreview /> : NetworkPreview ? <NetworkPreview /> : GatePreview ? (
    <React.Suspense fallback={null}><GatePreview /></React.Suspense>
  ) : (
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
  )
);

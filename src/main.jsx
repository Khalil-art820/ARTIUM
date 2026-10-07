import React from "react";
import ReactDOM from "react-dom/client";
import App, { BottomTabs, STUDENT_TABS, NotificationBell } from "./App.jsx";
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
        const [musicOn, setMusicOn] = React.useState(false);
        const a = (n) => () => alert(n);
        return (
          <>
          <style>{TAB_CSS}</style>
          <m.default
            memberCount={2}
            memberChips={[
              { name: "Khalil Tannous", meta: "Piano · Beirut", photoUrl: "/gate-hero.jpg" },
              { name: "Lucas M.", meta: "Violin · Vienna" },
            ]}
            bellSlot={<NotificationBell myProfile={{ id: "preview", name: "Khalil Tannous" }} puck networkFeeds authUser={null} />}
            musicOn={musicOn}
            onMusicToggle={() => setMusicOn((v) => !v)}
            avatarName="Khalil Tannous"
            onAvatar={a("onAvatar")}
            onLearner={a("onLearner")}
            onStudent={a("onStudent")}
            onPianist={a("onPianist")}
            onComposers={a("onComposers")}
            onNews={a("onNews")}
            onLogout={a("onLogout")}
          />
          <BottomTabs light items={STUDENT_TABS} active="home" onTab={() => {}} />
          </>
        );
      };
      return { default: Wrapper };
    }))
  : null;

ReactDOM.createRoot(document.getElementById("root")).render(
  GatePreview ? (
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

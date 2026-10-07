import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import "./index.css";
import "./pwa.js";

// Dev-only design preview: /?gatepreview renders the trial gate with mock props.
const GatePreview = import.meta.env.DEV && new URLSearchParams(location.search).has("gatepreview")
  ? React.lazy(() => import("./components/entrygate/ArtiumGateChordify.jsx").then((m) => {
      const Wrapper = () => {
        const [musicOn, setMusicOn] = React.useState(false);
        const a = (n) => () => alert(n);
        return (
          <m.default
            memberCount={2}
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

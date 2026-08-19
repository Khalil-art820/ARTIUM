import React from "react";
import { recoverStaleBuild } from "./pwa";

/**
 * A render crash anywhere under here unmounts the whole tree, which shows up
 * as a blank white page with nothing to go on — you have to already know to
 * open the console. This catches it and puts the error on screen instead,
 * so a crash can be reported by reading it off the page.
 *
 * Deliberately plain: no imports from App.jsx, no shared style constants,
 * inline styles only. Whatever this renders has to survive the failure of
 * the thing it is reporting on.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Still log it — the console keeps the full stack with source mapping.
    console.error("Artium crashed while rendering:", error, info);
    this.setState({ info });
    // Most render crashes in the field are not the current build crashing —
    // they are the service worker faithfully serving a build from before the
    // deploy that fixed them, and on a phone that copy can outlive days of
    // fixes. Burn the cache and reload once; if the crash is real, the
    // once-per-tab guard lets it land back here and be read.
    recoverStaleBuild("render-crash");
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    const detail = [
      error?.stack || String(error),
      info?.componentStack ? `\nComponent stack:${info.componentStack}` : "",
    ].join("");

    const box = {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 12,
      lineHeight: 1.5,
      background: "#fff",
      color: "#12212F",
      padding: "28px 22px",
      minHeight: "100vh",
      boxSizing: "border-box",
    };

    return (
      <div style={box}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: 22, margin: "0 0 6px" }}>
            Something broke while drawing this screen
          </h1>
          <p style={{ color: "#5A6B7B", margin: "0 0 18px" }}>
            Your data is fine — this is a display error. Copy the text below and send it over.
          </p>

          <p style={{ fontWeight: 700, margin: "0 0 6px", color: "#8C1D2F" }}>
            {String(error?.message || error)}
          </p>

          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "#F6F8FA",
              border: "1px solid #E2E8EE",
              borderRadius: 10,
              padding: "12px 14px",
              maxHeight: 340,
              overflow: "auto",
              margin: "0 0 18px",
            }}
          >
            {detail}
          </pre>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => navigator.clipboard?.writeText(`${error?.message || error}\n\n${detail}`)}
              style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #E2E8EE", background: "#fff", cursor: "pointer", font: "inherit", fontWeight: 600 }}
            >
              Copy error
            </button>
            <button
              onClick={() => {
                // The plain reload this button used to do was answered by the
                // same worker with the same cached build — pressing it on a
                // stale-build crash looped forever. Clear first, then reload.
                sessionStorage.removeItem("artium_stale_chunk_reload");
                recoverStaleBuild("error-screen-button").then((acted) => {
                  if (!acted) window.location.reload();
                });
              }}
              style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: "#FFC629", color: "#12212F", cursor: "pointer", font: "inherit", fontWeight: 700 }}
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

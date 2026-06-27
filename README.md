# Artium

A social network concept for conservatory music students — landing page, signup
flow, world map of conservatories, student profiles, messaging, and an ambient
music toggle. Built with **React + Vite + Tailwind CSS**.

---

## 1. One-time setup (Windows)

You need **Node.js** installed. This is the only thing you have to install once.

1. Go to <https://nodejs.org> and download the **LTS** installer.
2. Run it, click Next through the defaults, finish.
3. Verify it worked: open **Command Prompt** (press `Win`, type `cmd`, Enter) and run:

   ```
   node -v
   npm -v
   ```

   You should see two version numbers. If you do, you're set.

---

## 2. Install the project's dependencies

Open Command Prompt **inside this folder**. Easiest way: open the `artium`
folder in File Explorer, click the address bar, type `cmd`, and press Enter.
Then run (needs internet, first time only — takes a minute or two):

```
npm install
```

---

## 3. Run it with live reload

```
npm run dev
```

Your browser opens automatically at `http://localhost:5173`. **Leave this window
open while you work.** Now edit any file under `src/` and save — the browser
updates instantly, no refresh needed. Press `Ctrl + C` in the Command Prompt to
stop the server.

---

## Where to make changes

| What you want to change            | File                                      |
| ---------------------------------- | ----------------------------------------- |
| Everything — the whole app         | `src/App.jsx`                             |
| The list of conservatories         | `src/App.jsx` → `CONSERVATORIES`          |
| Sample students                    | `src/App.jsx` → `SAMPLE_STUDENTS`         |
| Colours / theme                    | `src/App.jsx` → `C` (near the top)        |
| Animations & sliders CSS           | `src/App.jsx` → the inline `<style>` block |
| Background music                   | `src/assets/ambient.mp3`                  |

Tip: `App.jsx` is one big file. The sections are marked with comment banners
(`/* ---- DATA ---- */`, `/* ---- LANDING ---- */`, etc.) — use your editor's
search (`Ctrl + F`) to jump to them. If it grows, you can split components out
into their own files under `src/` and `import` them into `App.jsx`.

A good free editor for this is **VS Code**: <https://code.visualstudio.com>.

---

## 4. Build a final version to publish

When you're happy and want files you can put on the web:

```
npm run build
```

This creates a `dist/` folder with the finished site. You can drag that `dist`
folder straight onto a free host like **Netlify Drop** (<https://app.netlify.com/drop>)
to get a public link. To preview the built version locally first:

```
npm run preview
```

---

## Notes

- The 6.7 MB ambient track now lives as a real file at `src/assets/ambient.mp3`
  instead of being pasted inside the code, so your editor stays fast.
- Icons come from `lucide-react`; fonts (Fraunces, Inter, JetBrains Mono) load
  from Google Fonts, so the first load needs an internet connection.
# artium

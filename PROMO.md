# WebLinux — Launch Copy Kit
Copy-paste drafts. Replace [BRACKETS] where noted. Stagger posts — see timing notes at bottom.

==================================================================
1. HACKER NEWS (Show HN) — the big one. Tue-Thu, 7-9am US Eastern.
==================================================================
TITLE (pick one):
  A) Show HN: WebLinux – boot 5 real Linux distros in your browser, internet included
  B) Show HN: Real Linux in a browser tab – x86 emulator on WASM, 5 distros, working networking
  C) Show HN: I made Linux boot in a browser – no server, no install, no account

FIRST COMMENT (paste right after submitting — HN ranks posts with engaged threads):

  Demo: https://alizafar780.github.io/WebLinux/

  This is a single static page: the whole x86 machine (CPU, BIOS, RAM, IDE, PS/2, VGA)
  runs client-side via the v86 emulator on WebAssembly. The 5 distros (Buildroot,
  Buildroot 6.8, TinyCore 11, DSL with a JWM desktop, NodeOS) are just files in the repo.

  The part I'm most happy about: the guest has working internet. The virtual NE2000 NIC
  is bridged through v86's public WebSocket relay, so inside the browser tab you get:
      udhcpc                      # real DHCP lease
      ping -c 3 1.1.1.1           # 0% packet loss
      wget -O - http://example.com  # real DNS + TCP + HTTP
  Verified in headless Chrome; boot to shell ~5-7s locally, ~17s on GitHub Pages.

  Also: save/load full machine state to a file, pause/resume, audio (SB16 + PC speaker),
  and a capture tool that records the boot via headless Chrome screencast
  (tools/capture_demo.js + stitch_gif.py).

  Tech notes: v86's minified build has a "linked bus" quirk (emulator.s / emulator.Ue
  dispatch each other) — documented in the README. Kernel cmdline gets `quiet` appended
  which cut boot time dramatically (DOM text rendering was the bottleneck).

  Would love feedback — especially on perf and which distros to add next.

==================================================================
2. REDDIT — r/linux (self-post, text). Midday US ET.
==================================================================
TITLE: I made a site that boots real Linux distros in your browser — with working internet

BODY:
  https://alizafar780.github.io/WebLinux/

  No VPS, no Docker, no streaming — the entire x86 machine is emulated in WebAssembly
  client-side (v86). Five distros: Buildroot, Buildroot 6.8, TinyCore 11, DSL (JWM
  desktop + Firefox 2!), and NodeOS. You get a real BusyBox shell, and the guest is
  actually on the internet:

    udhcpc -> DHCP lease
    ping -c 3 1.1.1.1 -> 0% packet loss
    wget example.com -> real HTML back

  Also: save/load the whole VM state to a file, pause/resume, audio, fullscreen.

  Repo: https://github.com/AliZafar780/WebLinux (BSD-2-Clause, v86 attribution)
  No server, no install, no account. Would love feedback!

==================================================================
3. REDDIT — r/webdev (next day, different angle)
==================================================================
TITLE: Zero-backend web app: full Linux distros booting in the browser (WASM)

BODY:
  https://alizafar780.github.io/WebLinux/

  The entire backend is a static file server. The x86 emulator (v86) runs the CPU in
  WebAssembly, text mode renders as DOM rows, networking rides a WebSocket relay that
  puts the guest on the real internet. Guest networking verified: DHCP, ping, wget.

  The interesting engineering bit: kernel cmdline `quiet` dropped boot from ~30s to
  ~5-7s because DOM text rendering was the bottleneck, not the emulator.

  Repo (with tools to re-record the demo via headless Chrome CDP):
  https://github.com/AliZafar780/WebLinux

==================================================================
4. X / TWITTER THREAD — 4 tweets, attach hero.png
==================================================================
T1: You can now boot real, unmodified Linux in your browser tab. No server, no install, no account. Just WASM. 🐧
   https://alizafar780.github.io/WebLinux/  [attach hero.png]

T2: 5 distros included: Buildroot, Buildroot 6.8, TinyCore 11, DSL (JWM desktop + Firefox 2!) and NodeOS — where the OS shell IS a Node.js REPL.

T3: The guest is genuinely on the internet: it gets a real DHCP lease through a WebSocket relay, pings 1.1.1.1 with 0% loss, and wget's real pages. Verified in headless Chrome.

T4: Save/load full machine state to a file, pause/resume, audio (SB16 + PC speaker). Built on v86 by @copy — full repo + docs: https://github.com/AliZafar780/WebLinux

==================================================================
5. LOBSTERS — short
==================================================================
TITLE: WebLinux: real Linux distros booting in the browser (WASM, with working guest networking)

URL: https://github.com/AliZafar780/WebLinux
COMMENT: v86-based. Guest has real internet via WebSocket relay — DHCP/ping/wget verified. README documents the linked-bus quirk of the minified build and the `quiet`-cmdline boot optimization.

==================================================================
6. PRODUCT HUNT (later, after stars) 
==================================================================
NAME: WebLinux
TAGLINE: Boot 5 real Linux distros in your browser — internet included, zero setup
DESCRIPTION: A static web page that boots unmodified Linux kernels on a WebAssembly x86 emulator. Real guest networking (DHCP, ping, wget), save/load machine state, audio, fullscreen. No server, no install, no account.
URL: https://alizafar780.github.io/WebLinux/
TOPIC: Developer Tools / Open Source

==================================================================
7. DEV.TO long-form (optional, SEO)
==================================================================
TITLE: How I put Linux in a browser tab (and gave it internet)
ANGLE: v86 internals, linked bus quirk, `quiet` cmdline perf win, headless Chrome CDP screencast recording pipeline.

==================================================================
TIMING & RULES
==================================================================
- HN: Tue-Thu 7-9am US Eastern. Only ONE shot — title matters most (option A is my pick).
- r/linux: same day ~noon ET. r/webdev: NEXT day (different angle, different title).
- X thread: right after HN post. Lobsters: same week.
- Answer every HN comment within the first 60-90 minutes — engagement drives ranking.
- Never post the same link to 2 subreddits within 24h (looks like spam).
- If HN flops (under 20 points), you may resubmit once after ~6 months — same for r/linux.
- Edit the README "Roadmap" with whichever distros people ask for — it signals activity.
- If it gets traction: add a "Star on GitHub" link to the top of the page footer.

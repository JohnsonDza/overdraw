# Legal notes: can Overdraw be distributed and sold?

> This is a licence-compliance summary prepared on 2026-10-23 from the code and
> dependencies in this repository. It is not legal advice. Before you sell, have
> a lawyer in your country review your terms, tax setup and name.

## Short answer

**Yes.** Everything Overdraw ships is under a licence that allows commercial
use, modification, redistribution and sale, in a closed-source product. The
conditions are mainly attribution, and the build now meets them automatically.
The main open items are your own **name/trademark check**, your **own licence
choice**, and **code signing**.

## What ships, and under which licence

| Component | Licence | Commercial use | What you must do |
| --- | --- | --- | --- |
| Excalidraw (editor) | MIT | ✅ | Keep its copyright and licence text |
| perfect-freehand (pen strokes, inside Excalidraw) | MIT, © 2021 Stephen Ruiz Ltd | ✅ | Same |
| React, Mermaid, roughjs and 160 other bundled packages | MIT, ISC, BSD, Apache-2.0, 0BSD, CC0, Unlicense | ✅ | Same; none of the Apache-2.0 packages has a NOTICE file |
| Fonts: Excalifont, Virgil, Xiaolai, Nunito, Lilita One, Assistant, Cascadia Code | SIL Open Font License 1.1 | ✅ bundled in an app | Ship the OFL text and copyright lines. Don't sell the fonts on their own. Don't rename a *modified* font to a reserved name (we don't modify them) |
| Comic Shanns font | MIT | ✅ | Keep its notice |
| Electron + Chromium | MIT, BSD and others | ✅ | Keep `LICENSE.electron.txt` and `LICENSES.chromium.html` (shipped next to `Overdraw.exe`) |
| FFmpeg (`ffmpeg.dll`, part of Chromium) | LGPL 2.1+ | ✅ as a separate DLL | Ship its licence (in `LICENSES.chromium.html`) and keep it replaceable |

### What the build does for you

- **`THIRD_PARTY_NOTICES.txt`** is generated on every build from the modules
  actually in the bundle (163 packages plus the fonts) and shipped next to
  `Overdraw.exe`. Users can open it from **Settings → Third-Party Licenses**.
- **Licence gate:** the build *fails* if a bundled package is not under a
  permissive licence, so a copyleft (GPL/AGPL) dependency can't slip into a paid
  release unnoticed (`scripts/notices-plugin.ts`).
- **Liberation Sans removed.** The copy inside Excalidraw's package is the 1.x
  release (GPLv2 with a font exception, not the OFL). It was only used for old
  "Helvetica" text; Windows draws that with the metric-identical Arial instead.
- **Codec-free FFmpeg.** Electron's default `ffmpeg.dll` contains H.264/AAC
  decoders, which are covered by patents that can require licences for
  commercial products. Overdraw plays no media, so packaging swaps in the
  codec-free build Electron publishes, verified against a pinned SHA-256
  (`scripts/after-pack.cjs`).

## Things to sort out yourself

1. **Trademarks.**
   - Don't use "Excalidraw" in your product name, logo, domain, or ads in a way
     that suggests endorsement. Excalidraw s.r.o. filed a US trademark
     application for EXCALIDRAW (serial 97010906, 2021). A factual credit such as
     "drawing engine: Excalidraw (MIT licence)" is the normal, accepted form;
     don't use their logo.
   - **"Overdraw"** is your working name. A quick search found no other app by
     that name, but it's a common word (graphics term; close to "overdraft").
     Search the trademark office in each country where you'll sell (USPTO,
     EUIPO, your national office) before you invest in the brand.
2. **Your own licence.** `package.json` says `UNLICENSED`, meaning all rights
   reserved: nobody may copy or resell it without your permission. That's the
   right default for a paid app. If you'd rather open-source it, MIT is fine, but
   then anyone may also redistribute it for free.
3. **End-user terms.** For a paid release, add a short EULA (licence grant,
   warranty disclaimer, limitation of liability). Store platforms provide a
   standard one you can use.
4. **Privacy.** Overdraw works offline and collects nothing. Say so in a short
   privacy statement; stores ask for one.
5. **Tax and payments.** Selling through the Microsoft Store, or a "merchant of
   record" service such as Paddle or Lemon Squeezy, means they collect and remit
   VAT/sales tax for you. Selling directly means you handle it.
6. **Security fixes.** `npm audit` reports 4 low-severity issues in KaTeX (used
   only by the Mermaid diagram import). Keep dependencies updated; Dependabot is
   configured in `.github/dependabot.yml`.

## Distribution and code signing

Windows warns about or blocks unsigned apps (SmartScreen and Smart App
Control). Your options, cheapest first:

| Route | Cost | Notes |
| --- | --- | --- |
| **Microsoft Store (MSIX)** | Free registration for individuals (since Sept 2025) | Microsoft signs Store MSIX packages for you, so no certificate to buy, and the Store handles payments, updates and tax. Needs ID verification; an `appx` build target and the Windows SDK. |
| **Azure Artifact Signing** | $9.99/month | Cheapest trusted signature for downloads. *Individuals* must be in the US or Canada; organisations in more countries. Already wired into `.github/workflows/release.yml`. |
| **OV code-signing certificate** from a CA | Roughly $200–500/year | Works anywhere; keys must live on a hardware token or cloud HSM. |
| **Unsigned** | Free | Fine for friends and testers: SmartScreen shows "Run anyway"; PCs with Smart App Control on can't run it. |

See [DISTRIBUTING.md](DISTRIBUTING.md) for the step-by-step.

## Sources

- Excalidraw licence (MIT): <https://github.com/excalidraw/excalidraw/blob/master/LICENSE>
- perfect-freehand fork licence (MIT): <https://github.com/Uncodedtech/perfect-freehand/blob/main/LICENSE>
- Excalifont, OFL-1.1, "free for personal and commercial use": <https://plus.excalidraw.com/excalifont>
- Virgil (OFL-1.1): <https://github.com/excalidraw/virgil>; Xiaolai / Kose (OFL-1.1): <https://github.com/lxgw/kose-font>; Cascadia Code (OFL-1.1): <https://github.com/microsoft/cascadia-code>; Comic Shanns (MIT): <https://github.com/shannpersand/comic-shanns>; Nunito, Lilita One, Assistant (OFL-1.1): <https://github.com/google/fonts>
- EXCALIDRAW trademark application 97010906: <https://trademarks.justia.com/970/10/excalidraw-97010906.html>
- FFmpeg licensing: <https://ffmpeg.org/legal.html>
- Artifact Signing quickstart and eligibility: <https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart>
- Windows code-signing options: <https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options>
- Free Microsoft Store registration: <https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account>

# Giving Overdraw to other people

The main way to share Overdraw is the **source repository**: people clone it
and run `npm ci` and `npm start`, as the [README](README.md) explains. That needs
no code signing, and Windows doesn't block it. This page covers the optional
alternative: packaged `.exe` and `.zip` builds.

## 1. Share a test build (no accounts needed)

```bash
npm run dist:zip
```

This makes `release\Overdraw-<version>-win-x64.zip` (about 150 MB). It contains
`Overdraw.exe`, a **READ ME FIRST.txt** with install steps for your testers, and
the licence files.

1. Upload the zip to OneDrive, Google Drive or WeTransfer and send the link.
2. Send the SHA-256 hash too (from `certutil -hashfile <zip> SHA256` or
   `release\SHA256SUMS.txt` when built in CI), so testers can confirm the file
   wasn't altered.
3. Tell them it's unsigned: Windows will say *"Windows protected your PC"* →
   **More info → Run anyway**. On PCs with **Smart App Control** on, unsigned
   apps can't run at all; those testers need a signed build (section 3).

## 2. Build installers on GitHub (recommended)

The NSIS installer can't be built on a PC with Smart App Control on (the build
runs an unsigned helper). GitHub's Windows runners don't have that problem.

The Release workflow only runs when you start it by hand:

1. Push this repository to GitHub.
2. Optionally tag a version and push the tag:

   ```bash
   git tag v1.0.0
   ```

   ```bash
   git push origin v1.0.0
   ```

3. Open **Actions → Release → Run workflow**. Choose the tag under *Use workflow
   from* to also attach the files to a **draft** release, or a branch to just get
   them as a downloadable artifact. It builds `Overdraw-Setup-1.0.0.exe`
   (installer), `Overdraw-1.0.0-portable.exe`, the zip, and `SHA256SUMS.txt`.

Releases of a private repository are only visible to people with access. To give
testers a public download link, publish the release from a public repository
(it can contain just releases, no code), or upload the files elsewhere.

## 3. Turn on code signing (removes the warnings)

Using **Azure Artifact Signing** ($9.99/month; individuals must be in the US or
Canada):

1. In Azure, create an Artifact Signing account, complete identity validation,
   and create a *Public Trust* certificate profile.
2. Create an app registration (service principal) and give it the
   *Certificate Profile Signer* role on that account (the role's full name in
   the Azure portal includes the service name).
3. In the GitHub repository, go to **Settings → Secrets and variables → Actions**
   and add:

   | Secrets | Variables |
   | --- | --- |
   | `AZURE_TENANT_ID` | `AZURE_SIGNING_ENDPOINT` (e.g. `https://eus.codesigning.azure.net`) |
   | `AZURE_CLIENT_ID` | `AZURE_SIGNING_ACCOUNT` |
   | `AZURE_CLIENT_SECRET` | `AZURE_SIGNING_PROFILE` |
   |  | `AZURE_SIGNING_PUBLISHER` (exactly as validated) |

The next tagged build is signed automatically. New certificates still build
SmartScreen reputation over the first downloads.

Outside the US or Canada, buy an OV certificate from a certificate authority
instead and configure it under `win.signtoolOptions` in `electron-builder.yml`.

## 4. Sell it

The simplest route is the **Microsoft Store**. Registration is free for
individuals; Microsoft signs MSIX packages (so there's no certificate to buy) and
handles payments, tax and updates. That needs an `appx` target in
`electron-builder.yml` and the Windows SDK installed on the build machine.

Before charging money, read [LEGAL.md](LEGAL.md): licence notices are already
handled, but the name, your end-user terms and tax setup are yours to sort out.

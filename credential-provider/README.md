# Senti Credential Provider (Windows)

This is the real thing: a C++ **credential provider** that plugs into the
Windows login screen (`LogonUI` / `winlogon`) so Senti becomes the actual gate,
not a window sitting on top of an already-unlocked desktop.

With this registered, the Senti tile appears **on the real login screen** —
before you are logged in. Task Manager can't kill it (you aren't in a session
yet), and Ctrl+Alt+Del leads *to* it, not around it.

## Honest status

**Scaffold — not yet a finished, tested lock.** It compiles into a registerable
credential-provider DLL and shows the Senti tile with a PIN field. Two pieces
are stubbed and must be built and hardened in a VM before this protects
anything:

- `Serialization.cpp` — pack username + password into the `KERB_INTERACTIVE_
  UNLOCK_LOGON` buffer LSA expects (`CredPackAuthenticationBuffer`). Until this
  is done, the tile shows but cannot complete a login.
- `SentiVault.cpp` — `SentiVault_Unlock(pin, &password)`: verify the Senti PIN
  and release the Windows password, both sealed at rest with DPAPI (written by
  the desktop app at enrollment).

Voice verification is **v2**: it replaces/precedes the PIN check inside
`_VerifyAndUnlock`. Getting mic capture + the ONNX voiceprint model running
inside the secure desktop is the hard, later part. The PIN stays as the
always-available fallback.

I will not call this "unbypassable" until it has been compiled and a real login
completed and verified in a VM.

## Why it is safe to develop

The registration **adds** the Senti tile; it never filters out the built-in
password provider. The normal Windows password tile is always still there. You
cannot brick yourself by registering this — worst case, click the password
tile. Still: **only ever test in a virtual machine** until you have logged in
through Senti successfully, several times.

## Build

Needs Visual Studio 2022 (Desktop C++ workload) + Windows SDK.

```powershell
cd credential-provider
cmake -B build -A x64
cmake --build build --config Release
# -> build/Release/SentiCredentialProvider.dll
```

## Test in a VM (do not skip)

1. Snapshot the VM first. If login breaks, you revert in one click.
2. Copy the DLL to `C:\Program Files\Senti\SentiCredentialProvider.dll`.
3. Import `register.reg` (adjust the path if you put the DLL elsewhere).
4. Lock the VM (Win+L) or sign out. The Senti tile should appear next to the
   normal password tile.
5. Select it, enter the PIN, and confirm you are logged in.
6. To remove: delete the two registry keys in `register.reg` and reboot.

## Files

| File | Role |
| --- | --- |
| `src/Guid.h` | The provider's CLSID — stable, never regenerate once shipped |
| `src/Common.h` | Tile field layout (image, label, PIN, submit, status) |
| `src/SentiProvider.*` | `ICredentialProvider` — contributes the one Senti tile |
| `src/SentiCredential.*` | `ICredentialProviderCredential` — the tile; collects PIN, releases credentials to log in |
| `src/Dll.cpp` | COM plumbing: class factory + exports |
| `register.reg` | Registers the provider (co-exists with the password tile) |
| `CMakeLists.txt` | Build |

See `../ARCHITECTURE.md` for how this fits the rest of Senti and what data,
if any, leaves the machine.

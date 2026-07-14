#include "SentiCredential.h"
#include <shlwapi.h>
#include <ntsecapi.h>
#include <wincred.h>
#pragma comment(lib, "Shlwapi.lib")
#pragma comment(lib, "Secur32.lib")
#pragma comment(lib, "Credui.lib")

// ---- helpers ---------------------------------------------------------------

static HRESULT DupString(PCWSTR in, PWSTR* out)
{
    if (!out) return E_INVALIDARG;
    *out = nullptr;
    if (!in) { return SHStrDupW(L"", out); }
    return SHStrDupW(in, out);
}

// ---- lifetime --------------------------------------------------------------

SentiCredential::SentiCredential()
    : _cRef(1), _cpus(CPUS_INVALID), _pCredProvCredentialEvents(nullptr)
{
    ZeroMemory(_rgFieldDescriptors, sizeof(_rgFieldDescriptors));
    ZeroMemory(_rgFieldStatePairs, sizeof(_rgFieldStatePairs));
    ZeroMemory(_rgFieldStrings, sizeof(_rgFieldStrings));
}

SentiCredential::~SentiCredential()
{
    for (int i = 0; i < SFI_NUM_FIELDS; i++)
    {
        if (_rgFieldStrings[i])
        {
            // The PIN field holds a secret — wipe it before freeing.
            size_t len = lstrlenW(_rgFieldStrings[i]);
            SecureZeroMemory(_rgFieldStrings[i], len * sizeof(wchar_t));
            CoTaskMemFree(_rgFieldStrings[i]);
        }
    }
}

HRESULT SentiCredential::Initialize(
    CREDENTIAL_PROVIDER_USAGE_SCENARIO cpus,
    const FIELD_STATE_PAIR* rgfsp,
    const CREDENTIAL_PROVIDER_FIELD_DESCRIPTOR* rgcpfd)
{
    _cpus = cpus;
    for (int i = 0; i < SFI_NUM_FIELDS; i++)
    {
        _rgFieldStatePairs[i] = rgfsp[i];
        _rgFieldDescriptors[i] = rgcpfd[i];
    }
    // Field strings start empty; the label carries the tile name.
    DupString(L"Senti", &_rgFieldStrings[SFI_LABEL]);
    DupString(L"", &_rgFieldStrings[SFI_PIN]);
    DupString(L"Say your unlock, or enter your Senti PIN", &_rgFieldStrings[SFI_STATUS]);
    return S_OK;
}

// ---- IUnknown --------------------------------------------------------------

IFACEMETHODIMP_(ULONG) SentiCredential::AddRef() { return InterlockedIncrement(&_cRef); }
IFACEMETHODIMP_(ULONG) SentiCredential::Release()
{
    LONG c = InterlockedDecrement(&_cRef);
    if (!c) delete this;
    return c;
}
IFACEMETHODIMP SentiCredential::QueryInterface(REFIID riid, void** ppv)
{
    if (!ppv) return E_POINTER;
    if (riid == IID_IUnknown || riid == IID_ICredentialProviderCredential)
        *ppv = static_cast<ICredentialProviderCredential*>(this);
    else { *ppv = nullptr; return E_NOINTERFACE; }
    AddRef();
    return S_OK;
}

// ---- ICredentialProviderCredential ----------------------------------------

IFACEMETHODIMP SentiCredential::Advise(ICredentialProviderCredentialEvents* e)
{
    if (_pCredProvCredentialEvents) _pCredProvCredentialEvents->Release();
    _pCredProvCredentialEvents = e;
    if (e) e->AddRef();
    return S_OK;
}
IFACEMETHODIMP SentiCredential::UnAdvise()
{
    if (_pCredProvCredentialEvents) _pCredProvCredentialEvents->Release();
    _pCredProvCredentialEvents = nullptr;
    return S_OK;
}
IFACEMETHODIMP SentiCredential::SetSelected(BOOL* pbAutoLogon)
{
    // No auto-logon: the user must present their voice or PIN every time.
    *pbAutoLogon = FALSE;
    return S_OK;
}
IFACEMETHODIMP SentiCredential::SetDeselected()
{
    // Clear the PIN whenever the tile loses focus, so it never lingers.
    if (_rgFieldStrings[SFI_PIN])
    {
        size_t len = lstrlenW(_rgFieldStrings[SFI_PIN]);
        SecureZeroMemory(_rgFieldStrings[SFI_PIN], len * sizeof(wchar_t));
        CoTaskMemFree(_rgFieldStrings[SFI_PIN]);
        DupString(L"", &_rgFieldStrings[SFI_PIN]);
        if (_pCredProvCredentialEvents)
            _pCredProvCredentialEvents->SetFieldString(this, SFI_PIN, L"");
    }
    return S_OK;
}
IFACEMETHODIMP SentiCredential::GetFieldState(DWORD dwFieldID,
    CREDENTIAL_PROVIDER_FIELD_STATE* pcpfs,
    CREDENTIAL_PROVIDER_FIELD_INTERACTIVE_STATE* pcpfis)
{
    if (dwFieldID >= SFI_NUM_FIELDS) return E_INVALIDARG;
    *pcpfs = _rgFieldStatePairs[dwFieldID].cpfs;
    *pcpfis = _rgFieldStatePairs[dwFieldID].cpfis;
    return S_OK;
}
IFACEMETHODIMP SentiCredential::GetStringValue(DWORD dwFieldID, PWSTR* ppwsz)
{
    if (dwFieldID >= SFI_NUM_FIELDS) return E_INVALIDARG;
    return DupString(_rgFieldStrings[dwFieldID], ppwsz);
}
IFACEMETHODIMP SentiCredential::GetBitmapValue(DWORD dwFieldID, HBITMAP* phbmp)
{
    if (dwFieldID != SFI_TILEIMAGE || !phbmp) return E_INVALIDARG;
    // The tile art (the Senti orb) is loaded from the module's resources.
    *phbmp = LoadBitmap(GetModuleHandle(L"SentiCredentialProvider.dll"),
                        MAKEINTRESOURCE(101 /* IDB_TILE */));
    return *phbmp ? S_OK : HRESULT_FROM_WIN32(GetLastError());
}
IFACEMETHODIMP SentiCredential::GetSubmitButtonValue(DWORD dwFieldID, DWORD* pdwAdjacentTo)
{
    if (dwFieldID != SFI_SUBMIT) return E_INVALIDARG;
    *pdwAdjacentTo = SFI_PIN;  // the arrow sits next to the PIN box
    return S_OK;
}
IFACEMETHODIMP SentiCredential::SetStringValue(DWORD dwFieldID, PCWSTR pwz)
{
    if (dwFieldID != SFI_PIN) return E_INVALIDARG;  // only the PIN is editable
    CoTaskMemFree(_rgFieldStrings[dwFieldID]);
    return DupString(pwz, &_rgFieldStrings[dwFieldID]);
}

// ---- the important one: hand Windows real credentials ----------------------

IFACEMETHODIMP SentiCredential::GetSerialization(
    CREDENTIAL_PROVIDER_GET_SERIALIZATION_RESPONSE* pcpgsr,
    CREDENTIAL_PROVIDER_CREDENTIAL_SERIALIZATION* pcpcs,
    PWSTR* ppwszOptionalStatusText,
    CREDENTIAL_PROVIDER_STATUS_ICON* pcpsiOptionalStatusIcon)
{
    *pcpgsr = CPGSR_NO_CREDENTIAL_NOT_FINISHED;
    *ppwszOptionalStatusText = nullptr;
    *pcpsiOptionalStatusIcon = CPSI_NONE;

    // 1) Verify identity (PIN today; voice verification plugs in here) and
    //    retrieve the stored Windows password.
    PWSTR windowsPassword = nullptr;
    HRESULT hr = _VerifyAndUnlock(&windowsPassword);
    if (FAILED(hr) || !windowsPassword)
    {
        DupString(L"That was not recognized. Try again, or use your Windows password.",
                  ppwszOptionalStatusText);
        *pcpsiOptionalStatusIcon = CPSI_ERROR;
        return S_OK;  // stay on the tile, do not log in
    }

    // 2) Package username + password the way LSA expects. This is the standard
    //    KERB_INTERACTIVE_UNLOCK_LOGON path used by every biometric provider.
    //    (Full packing via CredPackAuthenticationBuffer / KerbInteractive is
    //    implemented in Serialization.cpp — kept out of this file for length.)
    hr = PackAuthentication(_cpus, windowsPassword, pcpcs, &pcpgsr);

    // Wipe the plaintext password copy immediately.
    if (windowsPassword)
    {
        SecureZeroMemory(windowsPassword, lstrlenW(windowsPassword) * sizeof(wchar_t));
        CoTaskMemFree(windowsPassword);
    }

    if (SUCCEEDED(hr))
        *pcpgsr = CPGSR_RETURN_CREDENTIAL_FINISHED;  // log the user in
    return hr;
}

IFACEMETHODIMP SentiCredential::ReportResult(NTSTATUS, NTSTATUS,
    PWSTR* ppwszOptionalStatusText, CREDENTIAL_PROVIDER_STATUS_ICON* pcpsi)
{
    *ppwszOptionalStatusText = nullptr;
    *pcpsi = CPSI_NONE;
    return S_OK;
}

// ---- the Senti check -------------------------------------------------------

HRESULT SentiCredential::_VerifyAndUnlock(PWSTR* ppwszWindowsPassword)
{
    // === WHERE SENTI PLUGS IN =================================================
    // v1 (this scaffold): compare the entered PIN against the Senti PIN, which
    //   is stored — with the user's Windows password — as an encrypted LSA
    //   secret written by the desktop app at enrollment. A correct PIN releases
    //   the Windows password.
    //
    // v2: run speaker verification here. The secure desktop can host a small
    //   native capture + the ONNX voiceprint model; on a match, the same stored
    //   Windows password is released. The PIN stays as the always-available
    //   fallback (three failures -> Windows password tile).
    //
    // Both live in SentiVault.cpp: OpenVault(pin) -> {windowsPassword}.
    // =========================================================================
    return SentiVault_Unlock(_rgFieldStrings[SFI_PIN], ppwszWindowsPassword);
}

#include "SentiProvider.h"

// The Senti tile's field layout, and each field's initial state. This is the
// blueprint LogonUI renders.
static const CREDENTIAL_PROVIDER_FIELD_DESCRIPTOR s_rgFieldDescriptors[] =
{
    { SFI_TILEIMAGE, CPFT_TILE_IMAGE,     const_cast<PWSTR>(L"Image") },
    { SFI_LABEL,     CPFT_LARGE_TEXT,     const_cast<PWSTR>(L"Senti") },
    { SFI_PIN,       CPFT_PASSWORD_TEXT,  const_cast<PWSTR>(L"Senti PIN") },
    { SFI_SUBMIT,    CPFT_SUBMIT_BUTTON,  const_cast<PWSTR>(L"Submit") },
    { SFI_STATUS,    CPFT_SMALL_TEXT,     const_cast<PWSTR>(L"Status") },
};

static const FIELD_STATE_PAIR s_rgFieldStatePairs[] =
{
    { CPFS_DISPLAY_IN_BOTH,            CPFIS_NONE },     // tile image
    { CPFS_DISPLAY_IN_BOTH,            CPFIS_NONE },     // label
    { CPFS_DISPLAY_IN_SELECTED_TILE,  CPFIS_FOCUSED },  // PIN
    { CPFS_DISPLAY_IN_SELECTED_TILE,  CPFIS_NONE },     // submit
    { CPFS_DISPLAY_IN_SELECTED_TILE,  CPFIS_NONE },     // status
};

SentiProvider::SentiProvider()
    : _cRef(1), _cpus(CPUS_INVALID), _pCredential(nullptr) {}

SentiProvider::~SentiProvider()
{
    if (_pCredential) _pCredential->Release();
}

IFACEMETHODIMP_(ULONG) SentiProvider::AddRef() { return InterlockedIncrement(&_cRef); }
IFACEMETHODIMP_(ULONG) SentiProvider::Release()
{
    LONG c = InterlockedDecrement(&_cRef);
    if (!c) delete this;
    return c;
}
IFACEMETHODIMP SentiProvider::QueryInterface(REFIID riid, void** ppv)
{
    if (!ppv) return E_POINTER;
    if (riid == IID_IUnknown || riid == IID_ICredentialProvider)
        *ppv = static_cast<ICredentialProvider*>(this);
    else { *ppv = nullptr; return E_NOINTERFACE; }
    AddRef();
    return S_OK;
}

IFACEMETHODIMP SentiProvider::SetUsageScenario(CREDENTIAL_PROVIDER_USAGE_SCENARIO cpus, DWORD)
{
    // Show the Senti tile at the logon screen and the unlock screen. We stay
    // out of credential-change and other flows so we can never wedge them.
    switch (cpus)
    {
    case CPUS_LOGON:
    case CPUS_UNLOCK_WORKSTATION:
        _cpus = cpus;
        return _EnsureCredential();
    default:
        return E_NOTIMPL;  // decline everything else — safety
    }
}

IFACEMETHODIMP SentiProvider::SetSerialization(const CREDENTIAL_PROVIDER_CREDENTIAL_SERIALIZATION*)
{
    return E_NOTIMPL;
}
IFACEMETHODIMP SentiProvider::Advise(ICredentialProviderEvents*, UINT_PTR) { return S_OK; }
IFACEMETHODIMP SentiProvider::UnAdvise() { return S_OK; }

IFACEMETHODIMP SentiProvider::GetFieldDescriptorCount(DWORD* pdwCount)
{
    *pdwCount = SFI_NUM_FIELDS;
    return S_OK;
}
IFACEMETHODIMP SentiProvider::GetFieldDescriptorAt(DWORD dwIndex,
    CREDENTIAL_PROVIDER_FIELD_DESCRIPTOR** ppcpfd)
{
    if (dwIndex >= SFI_NUM_FIELDS || !ppcpfd) return E_INVALIDARG;
    // Hand back a copy LogonUI owns and frees.
    auto* p = (CREDENTIAL_PROVIDER_FIELD_DESCRIPTOR*)CoTaskMemAlloc(sizeof(**ppcpfd));
    if (!p) return E_OUTOFMEMORY;
    *p = s_rgFieldDescriptors[dwIndex];
    if (p->pszLabel) SHStrDupW(s_rgFieldDescriptors[dwIndex].pszLabel, &p->pszLabel);
    *ppcpfd = p;
    return S_OK;
}

IFACEMETHODIMP SentiProvider::GetCredentialCount(DWORD* pdwCount, DWORD* pdwDefault,
    BOOL* pbAutoLogonWithDefault)
{
    *pdwCount = 1;                       // one tile: Senti
    *pdwDefault = 0;                     // select it by default
    *pbAutoLogonWithDefault = FALSE;     // but never auto-submit
    return S_OK;
}
IFACEMETHODIMP SentiProvider::GetCredentialAt(DWORD dwIndex, ICredentialProviderCredential** ppcpc)
{
    if (dwIndex != 0 || !ppcpc || !_pCredential) return E_INVALIDARG;
    return _pCredential->QueryInterface(IID_ICredentialProviderCredential, (void**)ppcpc);
}

HRESULT SentiProvider::_EnsureCredential()
{
    if (_pCredential) { _pCredential->Release(); _pCredential = nullptr; }
    _pCredential = new (std::nothrow) SentiCredential();
    if (!_pCredential) return E_OUTOFMEMORY;
    return _pCredential->Initialize(_cpus, s_rgFieldStatePairs, s_rgFieldDescriptors);
}

HRESULT SentiProvider::CreateInstance(REFIID riid, void** ppv)
{
    auto* p = new (std::nothrow) SentiProvider();
    if (!p) return E_OUTOFMEMORY;
    HRESULT hr = p->QueryInterface(riid, ppv);
    p->Release();
    return hr;
}

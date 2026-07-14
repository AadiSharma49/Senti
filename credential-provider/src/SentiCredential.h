#pragma once
#include <windows.h>
#include <credentialprovider.h>
#include "Common.h"

// One "tile" on the login screen. It collects the Senti PIN, and on submit
// hands Windows the packaged credentials to actually log the user in.
//
// The voice-verification seam is marked below: once speaker verification runs
// in the secure desktop, it replaces (or precedes) the PIN check and releases
// the stored Windows password the same way.
class SentiCredential : public ICredentialProviderCredential
{
public:
    // IUnknown
    IFACEMETHODIMP_(ULONG) AddRef();
    IFACEMETHODIMP_(ULONG) Release();
    IFACEMETHODIMP QueryInterface(REFIID riid, void** ppv);

    // ICredentialProviderCredential
    IFACEMETHODIMP Advise(ICredentialProviderCredentialEvents* pcpce);
    IFACEMETHODIMP UnAdvise();
    IFACEMETHODIMP SetSelected(BOOL* pbAutoLogon);
    IFACEMETHODIMP SetDeselected();
    IFACEMETHODIMP GetFieldState(DWORD dwFieldID,
        CREDENTIAL_PROVIDER_FIELD_STATE* pcpfs,
        CREDENTIAL_PROVIDER_FIELD_INTERACTIVE_STATE* pcpfis);
    IFACEMETHODIMP GetStringValue(DWORD dwFieldID, PWSTR* ppwsz);
    IFACEMETHODIMP GetBitmapValue(DWORD dwFieldID, HBITMAP* phbmp);
    IFACEMETHODIMP GetCheckboxValue(DWORD, BOOL*, PWSTR*) { return E_NOTIMPL; }
    IFACEMETHODIMP GetSubmitButtonValue(DWORD dwFieldID, DWORD* pdwAdjacentTo);
    IFACEMETHODIMP GetComboBoxValueCount(DWORD, DWORD*, DWORD*) { return E_NOTIMPL; }
    IFACEMETHODIMP GetComboBoxValueAt(DWORD, DWORD, PWSTR*) { return E_NOTIMPL; }
    IFACEMETHODIMP SetStringValue(DWORD dwFieldID, PCWSTR pwz);
    IFACEMETHODIMP SetCheckboxValue(DWORD, BOOL) { return E_NOTIMPL; }
    IFACEMETHODIMP SetComboBoxSelectedValue(DWORD, DWORD) { return E_NOTIMPL; }
    IFACEMETHODIMP CommandLinkClicked(DWORD) { return E_NOTIMPL; }
    IFACEMETHODIMP GetSerialization(
        CREDENTIAL_PROVIDER_GET_SERIALIZATION_RESPONSE* pcpgsr,
        CREDENTIAL_PROVIDER_CREDENTIAL_SERIALIZATION* pcpcs,
        PWSTR* ppwszOptionalStatusText,
        CREDENTIAL_PROVIDER_STATUS_ICON* pcpsiOptionalStatusIcon);
    IFACEMETHODIMP ReportResult(NTSTATUS ntsStatus, NTSTATUS ntsSubStatus,
        PWSTR* ppwszOptionalStatusText,
        CREDENTIAL_PROVIDER_STATUS_ICON* pcpsiOptionalStatusIcon);

    HRESULT Initialize(CREDENTIAL_PROVIDER_USAGE_SCENARIO cpus,
        const FIELD_STATE_PAIR* rgfsp,
        const CREDENTIAL_PROVIDER_FIELD_DESCRIPTOR* rgcpfd);

    SentiCredential();

private:
    virtual ~SentiCredential();

    // Verify the Senti PIN against what Windows already knows, then release the
    // stored Windows password so LogonUI can complete the login. Returns S_OK
    // when the user should be logged in.
    HRESULT _VerifyAndUnlock(PWSTR* ppwszWindowsPassword);

    LONG _cRef;
    CREDENTIAL_PROVIDER_USAGE_SCENARIO _cpus;
    CREDENTIAL_PROVIDER_FIELD_DESCRIPTOR _rgFieldDescriptors[SFI_NUM_FIELDS];
    FIELD_STATE_PAIR _rgFieldStatePairs[SFI_NUM_FIELDS];
    PWSTR _rgFieldStrings[SFI_NUM_FIELDS];
    ICredentialProviderCredentialEvents* _pCredProvCredentialEvents;
};

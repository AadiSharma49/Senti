#include <windows.h>
#include <unknwn.h>
#include <new>
#include "Guid.h"
#include "SentiProvider.h"

static LONG g_cRef = 0;   // outstanding objects; the DLL can unload at 0.
HINSTANCE g_hInst = nullptr;

void DllAddRef()  { InterlockedIncrement(&g_cRef); }
void DllRelease() { InterlockedDecrement(&g_cRef); }

// ---- class factory ---------------------------------------------------------

class SentiClassFactory : public IClassFactory
{
public:
    IFACEMETHODIMP_(ULONG) AddRef()  { return 2; }  // singleton, static
    IFACEMETHODIMP_(ULONG) Release() { return 1; }
    IFACEMETHODIMP QueryInterface(REFIID riid, void** ppv)
    {
        if (riid == IID_IUnknown || riid == IID_IClassFactory)
        { *ppv = static_cast<IClassFactory*>(this); AddRef(); return S_OK; }
        *ppv = nullptr; return E_NOINTERFACE;
    }
    IFACEMETHODIMP CreateInstance(IUnknown* pUnkOuter, REFIID riid, void** ppv)
    {
        if (pUnkOuter) return CLASS_E_NOAGGREGATION;
        return SentiProvider::CreateInstance(riid, ppv);
    }
    IFACEMETHODIMP LockServer(BOOL fLock)
    {
        if (fLock) DllAddRef(); else DllRelease();
        return S_OK;
    }
};
static SentiClassFactory g_classFactory;

// ---- DLL exports -----------------------------------------------------------

STDAPI DllGetClassObject(REFCLSID rclsid, REFIID riid, void** ppv)
{
    if (rclsid == CLSID_SentiProvider)
        return g_classFactory.QueryInterface(riid, ppv);
    *ppv = nullptr;
    return CLASS_E_CLASSNOTAVAILABLE;
}

STDAPI DllCanUnloadNow()
{
    return (g_cRef == 0) ? S_OK : S_FALSE;
}

BOOL WINAPI DllMain(HINSTANCE hInst, DWORD reason, LPVOID)
{
    if (reason == DLL_PROCESS_ATTACH)
    {
        g_hInst = hInst;
        DisableThreadLibraryCalls(hInst);
    }
    return TRUE;
}

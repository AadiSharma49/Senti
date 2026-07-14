#pragma once
#include <initguid.h>

// Senti's credential provider CLSID. Windows identifies our provider by this
// GUID in the registry. It must be unique and stable — never regenerate it
// once a build is in the wild, or existing installs break.
//
// {8F9A6C10-3E4B-4D2A-9F71-5B2C7E1A9D30}
DEFINE_GUID(CLSID_SentiProvider,
    0x8f9a6c10, 0x3e4b, 0x4d2a, 0x9f, 0x71, 0x5b, 0x2c, 0x7e, 0x1a, 0x9d, 0x30);

#pragma once

// Field layout for the Senti tile. A credential provider describes its UI as a
// flat list of fields; these indices name them.
enum SENTI_FIELD_ID
{
    SFI_TILEIMAGE   = 0,  // the Senti orb
    SFI_LABEL       = 1,  // "Senti" / status line
    SFI_PIN         = 2,  // the PIN box (Senti unlock)
    SFI_SUBMIT      = 3,  // the submit arrow
    SFI_STATUS      = 4,  // small status/hint text
    SFI_NUM_FIELDS  = 5,
};

// A field descriptor plus its initial visibility/state — one per field above.
struct FIELD_STATE_PAIR
{
    CREDENTIAL_PROVIDER_FIELD_STATE cpfs;
    CREDENTIAL_PROVIDER_FIELD_INTERACTIVE_STATE cpfis;
};

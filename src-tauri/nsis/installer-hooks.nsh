; Connexio NSIS Installer Hooks
; Story 6.1: Add Explorer Context Menu Integration
;
; This file adds registry entries for Windows Explorer context menu:
; - Right-click on folder: "Open in Connexio"
; - Right-click on folder background: "Open in Connexio"

!macro CUSTOM_INSTALL
  ; Add context menu for folders
  WriteRegStr HKCU "Software\Classes\Directory\shell\Connexio" "" "Open in Connexio"
  WriteRegStr HKCU "Software\Classes\Directory\shell\Connexio" "Icon" "$INSTDIR\Connexio.exe,0"
  WriteRegStr HKCU "Software\Classes\Directory\shell\Connexio\command" "" '"$INSTDIR\Connexio.exe" "%V"'

  ; Add context menu for folder background (inside folder)
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\Connexio" "" "Open in Connexio"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\Connexio" "Icon" "$INSTDIR\Connexio.exe,0"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\Connexio\command" "" '"$INSTDIR\Connexio.exe" "%V"'

  ; Add context menu for drives
  WriteRegStr HKCU "Software\Classes\Drive\shell\Connexio" "" "Open in Connexio"
  WriteRegStr HKCU "Software\Classes\Drive\shell\Connexio" "Icon" "$INSTDIR\Connexio.exe,0"
  WriteRegStr HKCU "Software\Classes\Drive\shell\Connexio\command" "" '"$INSTDIR\Connexio.exe" "%V"'
!macroend

!macro CUSTOM_UNINSTALL
  ; Remove context menu for folders
  DeleteRegKey HKCU "Software\Classes\Directory\shell\Connexio"

  ; Remove context menu for folder background
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\Connexio"

  ; Remove context menu for drives
  DeleteRegKey HKCU "Software\Classes\Drive\shell\Connexio"
!macroend

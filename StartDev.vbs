Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
WshShell.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)

WshShell.Run "taskkill /IM autowhisk.exe /F", 0, True
WshShell.Run "start-frontend.bat", 0, False
WScript.Sleep 3000
WshShell.Run "start-tauri-dev.bat", 1, False

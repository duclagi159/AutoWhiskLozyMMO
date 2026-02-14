Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
WshShell.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)

WshShell.Run "taskkill /IM autowhisk.exe /F", 0, True
WScript.Sleep 500
WshShell.Run """src-tauri\target\release\autowhisk.exe""", 1, False

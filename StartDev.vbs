Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
WshShell.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.Run """start-frontend.bat""", 0, False
WScript.Sleep 3000
WshShell.Run """src-tauri\target\debug\autowhisk.exe""", 1, False

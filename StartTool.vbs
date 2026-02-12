Set WshShell = CreateObject("WScript.Shell") 
strPath = "ToolApp\bin\Debug\net8.0-windows\ToolApp.exe"
WshShell.Run chr(34) & strPath & chr(34), 1, false
Set WshShell = Nothing

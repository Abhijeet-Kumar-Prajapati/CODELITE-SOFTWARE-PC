; =====================================================================
;  CodeLite - Windows Installer Script
;  Compile with:  ISCC.exe CodeLite.iss
;  (see installer\build.ps1)
; =====================================================================

#define AppName        "CodeLite"
#define AppNameLower   "codelite"
#define AppVersion     "1.0.0"
#define AppPublisher   "CodeLite Project"
#define AppURL         "https://github.com/YOUR-USERNAME/CodeLite"
#define AppExeName     "START CodeLite.bat"
#define AppMutexName   "CodeLiteSetup"

[Setup]
AppId={{7E3C1B42-9A55-4C0E-9B2F-6D1A2C4E8F31}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
VersionInfoVersion={#AppVersion}
VersionInfoCompany={#AppPublisher}
VersionInfoDescription={#AppName} Setup
VersionInfoProductName={#AppName}
VersionInfoProductVersion={#AppVersion}
DefaultDirName={localappdata}\Programs\{#AppNameLower}
DefaultGroupName={#AppName}
UninstallDisplayName={#AppName} {#AppVersion}
UninstallDisplayIcon={app}\build\{#AppNameLower}.ico
AppMutex={#AppMutexName}
AppComments=A lightweight, offline code editor
SetupIconFile=..\src\build\{#AppNameLower}.ico
WizardStyle=modern
WizardSizePercent=120
OutputDir=..\dist
OutputBaseFilename={#AppName}-Setup-{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
LZMANumBlockThreads=4
PrivilegesRequired=lowest
DisableProgramGroupPage=yes
InfoBeforeFile=..\docs\INFOBEFORE.txt
SetupLogging=yes
CloseApplications=yes
RestartApplications=no
MinVersion=10.0

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce
Name: "autostart";  Description: "Start {#AppName} when Windows starts"; GroupDescription: "Startup"

[Files]
; --- application ---
Source: "..\src\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; --- documentation ---
Source: "..\docs\USER-GUIDE-HI.txt"; DestDir: "{app}"; DestName: "User Guide (Hindi).txt"; Flags: ignoreversion
Source: "..\docs\USER-GUIDE-EN.txt"; DestDir: "{app}"; DestName: "User Guide.txt";        Flags: ignoreversion
Source: "..\docs\CHANGELOG.md";        DestDir: "{app}"; DestName: "CHANGELOG.md";            Flags: ignoreversion
Source: "..\docs\logo.png";            DestDir: "{app}\build";                                    Flags: ignoreversion

[Dirs]
; Start Menu group
Name: "{autoprograms}\{#AppName}"
; Optional startup entry
Name: "{userstartup}";             Check: IsAutoStartSelected

[Icons]
; Start Menu - main launcher
Name: "{autoprograms}\{#AppName}\{#AppName}"; \
    Filename: "{app}\{#AppExeName}"; \
    WorkingDir: "{app}"; \
    IconFilename: "{app}\build\{#AppNameLower}.ico"; \
    Comment: "Open the {#AppName} code editor"

; separate uninstall entry
Name: "{autoprograms}\{#AppName}\Uninstall {#AppName}"; \
    Filename: "{uninstallexe}"; \
    IconFilename: "{app}\build\{#AppNameLower}.ico"

; Start Menu - user guides
Name: "{autoprograms}\{#AppName}\User Guide";        Filename: "{app}\User Guide.txt"
Name: "{autoprograms}\{#AppName}\User Guide (Hindi)"; Filename: "{app}\User Guide (Hindi).txt"
Name: "{autoprograms}\{#AppName}\Changelog";          Filename: "{app}\CHANGELOG.md"

; Desktop shortcut
Name: "{autodesktop}\{#AppName}"; \
    Filename: "{app}\{#AppExeName}"; \
    WorkingDir: "{app}"; \
    IconFilename: "{app}\build\{#AppNameLower}.ico"; \
    Comment: "Open the {#AppName} code editor"; \
    Tasks: desktopicon

; Startup shortcut
Name: "{userstartup}\{#AppName}"; \
    Filename: "{app}\{#AppExeName}"; \
    WorkingDir: "{app}"; \
    IconFilename: "{app}\build\{#AppNameLower}.ico"; \
    Tasks: autostart

[Run]
Filename: "{app}\{#AppExeName}"; \
    Description: "Launch {#AppName} now"; \
    WorkingDir: "{app}"; \
    Flags: nowait postinstall skipifsilent

[UninstallDelete]
; remove the leftover localhost port marker
Type: files; Name: "{app}\app\*.tmp"

[Code]
function IsAutoStartSelected: Boolean;
begin
  Result := WizardIsTaskSelected('autostart');
end;

{ ---------------------------------------------------------------------
  After install: stop any server left behind by a previous run so the
  freshly installed copy starts clean.
  --------------------------------------------------------------------- }
procedure CurStepChanged(CurStep: TSetupStep);
var
  PortFile: String;
begin
  if CurStep = ssPostInstall then
  begin
    PortFile := ExpandConstant('{tmp}\{#AppNameLower}.port');
    if FileExists(PortFile) then DeleteFile(PortFile);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  PortFile: String;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    PortFile := ExpandConstant('{tmp}\{#AppNameLower}.port');
    if FileExists(PortFile) then DeleteFile(PortFile);
  end;
end;

{ ---------------------------------------------------------------------
  Report the install folder on the final page.
  --------------------------------------------------------------------- }
procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpFinished then
  begin
    WizardForm.StatusLabel.Caption := 'CodeLite is ready.';
  end;
end;
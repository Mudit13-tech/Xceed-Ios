#Requires -Version 5.1
<#
.SYNOPSIS
    Publishes an OTA update from this machine, in place of the
    "Remote AMS Sync & OTA Update" GitHub Action.

.DESCRIPTION
    This is the runner's job, run locally. The workflow does four things after
    its AMS sync - install, `npm run deploy:ota`, commit the version bump, and
    push main + ams-update atomically - and every one of them works fine off a
    laptop. Nothing about OTA publishing needs a runner; the workflow is just
    where it usually happens.

    Written because Actions stopped starting jobs at all: run 35259040307
    (2026-09-17) failed in 4 seconds with no steps and the annotation "The job
    was not started because recent account payments have failed or your spending
    limit needs to be increased." That is an account-billing state, not anything
    in this repo, so every dispatch keeps failing until billing is fixed - and a
    release cannot wait on it.

    The publish is the irreversible step: once the server accepts the upload,
    every device pulls it on next launch. So every check that could abort this
    run is made BEFORE the upload, never after.

.PARAMETER Sync
    Run safe-pull-from-ams.ps1 first, for full parity with the workflow (which
    syncs AMS and publishes in one job). Omit it to publish what is already on
    main - the common case, and the one where the sync half is only risk.

.PARAMETER Install
    Run `npm ci` before building. Implied by -Sync, since a sync can change
    package.json. Skipped by default because node_modules is normally current
    and `npm ci` on this dependency tree is slow.

.PARAMETER Dev
    Publish to http://localhost:8010 instead of production. Nothing is committed
    or pushed in this mode.

.PARAMETER NoPush
    Publish and commit the bump, but do not push. For when the push has to
    happen by hand.

.PARAMETER Force
    Skip the clean-tree, on-main and up-to-date-with-origin guards. Only those
    guards - it does not force-push anything.

.EXAMPLE
    .\manual-ota-update.ps1
    Publish what is on main right now.

.EXAMPLE
    .\manual-ota-update.ps1 -Sync
    Pull AMS, then publish. The same work as one green workflow run.

.EXAMPLE
    .\manual-ota-update.ps1 -Dev
    Rehearse against a local backend without touching production or git.
#>
[CmdletBinding()]
param(
    [switch]$Sync,
    [switch]$Install,
    [switch]$Dev,
    [switch]$NoPush,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# PS 5.1 can negotiate down to TLS 1.0, which the OTA server refuses. Only the
# verification step at the end speaks HTTPS from PowerShell, so a miss here
# would read as "the publish did not land" when it did.
try {
    [Net.ServicePointManager]::SecurityProtocol =
        [Net.SecurityProtocolType]::Tls12 -bor [Net.ServicePointManager]::SecurityProtocol
} catch { }

function Write-Step($Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Write-Note($Message) { Write-Host "    $Message" -ForegroundColor DarkGray }
function Write-Good($Message) { Write-Host "    $Message" -ForegroundColor Green }
function Write-Warn($Message) { Write-Host "    $Message" -ForegroundColor Yellow }

function Stop-Run {
    param([string]$Message, [string[]]$Hint)
    Write-Host ""
    Write-Host "ABORTED: $Message" -ForegroundColor Red
    foreach ($line in $Hint) { Write-Host "  $line" -ForegroundColor Yellow }
    Write-Host ""
    exit 1
}

# Run from the repo root whatever the caller's cwd is. Every path below, and
# every git command, assumes it.
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "Manual OTA publish (GitHub Actions stand-in)" -ForegroundColor Cyan
Write-Host "-------------------------------------------" -ForegroundColor DarkGray

# ---------------------------------------------------------------------------
# 1. Preflight. Everything here is cheap and everything here can abort; none of
#    it may run after the upload, when aborting is no longer a thing you can do.
# ---------------------------------------------------------------------------
Write-Step "Preflight checks"

if (-not (Test-Path 'scripts/deploy-ota.cjs')) {
    Stop-Run "scripts/deploy-ota.cjs is missing - this is not the learning-module-app root." @(
        "Run this script from the repo it lives in."
    )
}

$branch = (& git rev-parse --abbrev-ref HEAD).Trim()
if ($LASTEXITCODE -ne 0) { Stop-Run "Not a git repository." }

if ($branch -ne 'main' -and -not $Force) {
    Stop-Run "On branch '$branch', not main." @(
        "The workflow publishes main, and package.json's version is the OTA channel -",
        "bumping it from a side branch publishes a version main does not record.",
        "",
        "  git checkout main",
        "",
        "Or pass -Force if you really mean to publish this branch."
    )
}

$dirty = & git status --porcelain
if ($dirty -and -not $Force) {
    Stop-Run "Working tree is not clean." @(
        "An OTA publish serves the built tree, so uncommitted work would reach every",
        "device with no commit recording what they are running.",
        "",
        "  git status",
        "  git stash    # or commit",
        "",
        "Or pass -Force to publish the tree as it stands."
    )
}
if ($dirty -and $Force) {
    Write-Warn "Working tree is dirty and -Force was passed - publishing uncommitted code."
}

# The upload authenticates with OTA_SECRET_KEY out of .env (deploy-ota.cjs loads
# dotenv itself). Checking it here rather than letting the upload 401 means the
# build does not run for nothing - and a 401 reads like a server problem.
if (-not (Test-Path '.env')) {
    Stop-Run ".env is missing." @(
        "It carries OTA_SECRET_KEY and OTA_SERVER_URL, and it is gitignored, so a",
        "fresh clone never has one. See README section 3."
    )
}
$envLines = Get-Content '.env'
function Get-EnvValue($Key) {
    $line = @($envLines | Where-Object { $_ -match "^\s*$Key\s*=\s*\S" }) | Select-Object -Last 1
    if (-not $line) { return $null }
    $value = ($line -replace "^\s*$Key\s*=\s*", '').Trim()
    return $value.Trim('"').Trim([char]0x27)
}

if (-not (Get-EnvValue 'OTA_SECRET_KEY')) {
    Stop-Run "OTA_SECRET_KEY is not set in .env." @(
        "The upload is rejected 401 without it. It must match the backend server's",
        "own .env exactly - ask the maintainer for the current value."
    )
}

if ($Dev) {
    $serverUrl = 'http://localhost:8010'
} else {
    $serverUrl = Get-EnvValue 'OTA_SERVER_URL'
    if (-not $serverUrl) {
        $serverUrl = 'https://xceed.nitj.ac.in'
        Write-Warn "OTA_SERVER_URL not set in .env - deploy-ota.cjs will use its default, $serverUrl."
    }
}
$serverUrl = $serverUrl.TrimEnd('/')
Write-Good "Branch $branch, tree clean, credentials present."
Write-Note "Target: $serverUrl"

# Against origin, before anything is built. Publishing from a main that is
# behind origin/main ships code someone else has already superseded, and the
# push at the end would then be rejected - after the release is already live.
if (-not $Dev -and -not $NoPush) {
    Write-Step "Checking this clone against origin"
    & git fetch origin
    if ($LASTEXITCODE -ne 0) {
        Stop-Run "Could not fetch from origin." @(
            "Publishing without knowing whether main is current risks shipping stale code",
            "and leaves the version bump unpushable. Reconnect and re-run."
        )
    }

    if ($branch -eq 'main') {
        $counts = (& git rev-list --left-right --count main...origin/main) -split '\s+'
        $ahead = [int]$counts[0]
        $behind = [int]$counts[1]
        if ($behind -gt 0 -and -not $Force) {
            Stop-Run "main is $behind commit(s) behind origin/main." @(
                "Those commits would not be in the bundle, and the push at the end would be",
                "rejected once the release is already live on devices.",
                "",
                "  git pull --ff-only origin main",
                "",
                "Then re-run."
            )
        }
        if ($ahead -gt 0) { Write-Note "main is $ahead commit(s) ahead of origin - they go up with the bump." }
        Write-Good "main is current with origin."
    }
}

# ---------------------------------------------------------------------------
# 2. Optional AMS sync - the first half of the workflow's job.
# ---------------------------------------------------------------------------
if ($Sync) {
    Write-Step "Syncing from AMS (safe-pull-from-ams.ps1)"
    if (-not (Test-Path 'safe-pull-from-ams.ps1')) {
        Stop-Run "safe-pull-from-ams.ps1 is missing on this branch." @(
            "Publish without -Sync, or check out a branch that has it."
        )
    }
    & "$PSScriptRoot\safe-pull-from-ams.ps1"
    if ($LASTEXITCODE -ne 0) {
        Stop-Run "The AMS sync stopped - nothing has been published." @(
            "Its own output above says why. A merge conflict there is the usual cause;",
            "resolve it, commit, push main + ams-update, then re-run this script",
            "WITHOUT -Sync (the sync has already happened)."
        )
    }
    Write-Good "AMS sync complete."
}

# ---------------------------------------------------------------------------
# 3. Dependencies.
# ---------------------------------------------------------------------------
if ($Install -or $Sync) {
    Write-Step "Installing dependencies"
    & npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
        # The same fallback the workflow uses. `npm ci` refuses a lockfile that
        # disagrees with package.json, which is exactly the state a sync that
        # added a dependency leaves behind.
        Write-Warn "npm ci failed - falling back to npm install, as the workflow does."
        & npm install --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { Stop-Run "Dependency install failed - nothing has been published." }
    }
    Write-Good "Dependencies installed."
} else {
    Write-Note "Skipping install (pass -Install if package.json changed since your last one)."
}

# ---------------------------------------------------------------------------
# 4. Build, zip, upload. deploy-ota.cjs owns all of it, including the version
#    bump - which it writes to package.json only after the server has accepted
#    the upload, so an unchanged version below means nothing was published.
# ---------------------------------------------------------------------------
$versionBefore = (Get-Content 'package.json' -Raw | ConvertFrom-Json).version
Write-Step "Building and publishing (current version $versionBefore)"
Write-Note "This takes a few minutes; the build is the slow part."

# Invoked directly rather than through `npm run deploy:ota -- --dev`, so the
# extra `--` cannot be swallowed between PowerShell and npm on the way to the
# script. dotenv is loaded by the script itself, so nothing is lost.
if ($Dev) { & node scripts/deploy-ota.cjs --dev } else { & node scripts/deploy-ota.cjs }
$deployExit = $LASTEXITCODE

$versionAfter = (Get-Content 'package.json' -Raw | ConvertFrom-Json).version

if ($deployExit -ne 0) {
    Stop-Run "deploy-ota.cjs failed - nothing was published." @(
        "Its output above says where. The usual ones:",
        "  401 Unauthorized  - OTA_SECRET_KEY does not match the server's",
        "  build failed      - fix the build and re-run; nothing was uploaded",
        "",
        "package.json is still at $versionAfter - the bump is only written once the",
        "server accepts the upload, so there is no phantom version to clean up."
    )
}

if ($versionAfter -eq $versionBefore) {
    Stop-Run "deploy-ota.cjs exited 0 but package.json is still at $versionBefore." @(
        "It writes the bump only on a successful upload, so this means nothing was",
        "published. Read its output above before re-running."
    )
}

Write-Good "Published $versionBefore -> $versionAfter"

# ---------------------------------------------------------------------------
# 5. Record the bump. The release exists on the server now; from here on every
#    failure is recoverable by hand, so nothing below un-publishes anything.
# ---------------------------------------------------------------------------
if ($Dev) {
    Write-Step "Local publish - not committing"
    Write-Warn "package.json was bumped to $versionAfter by a publish to localhost, which"
    Write-Warn "production has never seen. Do not commit it:"
    Write-Host "      git checkout -- package.json" -ForegroundColor Cyan
    Write-Host ""
    exit 0
}

Write-Step "Committing the version bump"
& git add package.json package-lock.json
& git diff --staged --quiet
if ($LASTEXITCODE -ne 0) {
    # [skip ci] is kept from the workflow's own commit message: inert while
    # Actions is billing-blocked, and it stops this commit re-triggering
    # anything once it is running again.
    & git commit -m "Bump version for OTA update [skip ci]"
    if ($LASTEXITCODE -ne 0) {
        Stop-Run "Commit failed. The release IS live at $versionAfter - commit and push the bump by hand."
    }
    Write-Good "Committed the bump to $versionAfter."
} else {
    Write-Note "Nothing staged - no version change to record."
}

if ($NoPush) {
    Write-Step "Done (-NoPush)"
    Write-Warn "$versionAfter is live on $serverUrl but the bump is only in this clone."
    Write-Host "      git push --atomic origin main ams-update" -ForegroundColor Cyan
    Write-Host ""
    exit 0
}

# ---------------------------------------------------------------------------
# 6. Push. main and ams-update together, the way both the workflow and
#    safe-pull-from-ams.ps1 end - main landing without ams-update is what makes
#    the next sync merge against an older AMS snapshot, and that skew drops
#    local edits with no conflict raised.
#
#    The catch this script has to handle that the runner never does: a runner
#    checks ams-update out fresh every time, while this clone's copy is whatever
#    it was at the last local sync - routinely a few commits behind origin,
#    because a workflow run pushed it. Pushing it in that state is a
#    non-fast-forward, and --atomic means BOTH refs are then rejected, so the
#    bump for a release that is already live would not land. Fast-forward it
#    first; if it has genuinely forked, push main alone and say so rather than
#    force anything - forcing ams-update rewrites the merge base, which is the
#    only thing protecting local work from the next sync.
# ---------------------------------------------------------------------------
Write-Step "Pushing"
$refs = @('main')

& git show-ref --verify --quiet refs/heads/ams-update
if ($LASTEXITCODE -eq 0) {
    & git fetch origin ams-update:ams-update 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $refs += 'ams-update'
    } else {
        Write-Warn "Local ams-update could not be fast-forwarded to origin's - the two have forked."
        Write-Warn "Pushing main only. Reconcile it with a merge, never a force:"
        Write-Host "      git checkout ams-update; git merge origin/ams-update" -ForegroundColor Cyan
        Write-Host "      git checkout main; git merge ams-update" -ForegroundColor Cyan
        Write-Host "      git push --atomic origin main ams-update" -ForegroundColor Cyan
    }
} else {
    Write-Note "No local ams-update branch - pushing main only."
}

& git push --atomic origin $refs
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Warn "Push rejected - nothing was pushed (--atomic is both refs or neither)."
    Write-Warn "$versionAfter IS live on $serverUrl; only the commit is unpushed."
    Write-Warn "Fetch and reconcile rather than forcing:"
    Write-Host "      git fetch origin" -ForegroundColor Cyan
    Write-Host "      git log --oneline --graph main origin/main ams-update origin/ams-update" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}
Write-Good "Pushed $($refs -join ' + ')."

# ---------------------------------------------------------------------------
# 7. Verify the server is actually serving it. The upload returning 200 and the
#    channel advertising the new version are two different things, and it is the
#    second one every device reads on launch.
# ---------------------------------------------------------------------------
Write-Step "Verifying the published channel"
try {
    $live = Invoke-RestMethod -Uri "$serverUrl/api/v1/ota/version.json" -TimeoutSec 20
    if ($live.version -eq $versionAfter) {
        Write-Good "$serverUrl is serving $($live.version)."
    } else {
        Write-Warn "Server reports $($live.version), expected $versionAfter - re-check before assuming devices will update."
    }
} catch {
    Write-Warn "Could not read $serverUrl/api/v1/ota/version.json ($($_.Exception.Message))."
    Write-Warn "The upload was accepted, so this is most likely the check failing, not the release."
}

Write-Host ""
Write-Host "Done. $versionAfter is published; devices pick it up on next launch." -ForegroundColor Green
Write-Note "Native code unchanged? Nothing else is needed - OTA covers the JS layer only."
Write-Note "Cutting a Play/App Store build instead? Realign versionName (android/app/build.gradle)"
Write-Note "and MARKETING_VERSION (ios/App/App.xcodeproj/project.pbxproj) to $versionAfter first."
Write-Host ""

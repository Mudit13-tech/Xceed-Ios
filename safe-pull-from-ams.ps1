$ErrorActionPreference = "Stop"
$AmsPath = "../IAMS/AMS-with-TimeTable"
$AppPath = $PWD.Path

Write-Host "Starting safe sync from AMS-with-TimeTable..." -ForegroundColor Cyan

# 1. Ensure working directory is clean
$status = git status --porcelain
if ($status) {
    Write-Host "Error: Your working directory is not clean. Please commit or stash your changes before syncing." -ForegroundColor Red
    exit 1
}

# 2. Switch to ams-update branch
Write-Host "Switching to 'ams-update' tracking branch..." -ForegroundColor Yellow
git checkout ams-update

# 3. Archive from AMS and Extract here
Write-Host "Exporting client code from AMS..." -ForegroundColor Yellow
Set-Location $AmsPath
git archive HEAD:client -o "$AppPath/client_export.tar"
Set-Location $AppPath

Write-Host "Extracting into learning-module-app..." -ForegroundColor Yellow
tar -xf client_export.tar
Remove-Item client_export.tar

# 4. Commit changes on ams-update
git add .
$diffStatus = git status --porcelain
if ($diffStatus) {
    git commit -m "Automated AMS Sync" | Out-Null
    Write-Host "Changes committed to ams-update branch." -ForegroundColor Green
} else {
    Write-Host "No new changes found in AMS client." -ForegroundColor Yellow
}

# 5. Switch back to main and merge
Write-Host "Switching back to main and merging updates..." -ForegroundColor Yellow
git checkout main

# 5a. Register the merge drivers .gitattributes names. They live in git config,
# which is per-clone and never committed, so on a clone that has not run
# `npm install` since these were added the attributes are inert - and inert
# silently: the merge falls back to line-by-line and the conflicts they exist to
# remove come back with nothing to explain them.
# $ErrorActionPreference does not apply to native commands - only to cmdlets -
# so a node that dies here carries on to the merge unless its exit code is
# checked. That is the worst possible outcome: the merge then runs with no
# drivers registered, .gitattributes does nothing, and the conflicts all of this
# exists to prevent come back with nothing to explain them.
if (-not (Test-Path 'build/gitMergeSetup.mjs')) {
    Write-Host ""
    Write-Host "build/gitMergeSetup.mjs is missing on this branch." -ForegroundColor Red
    Write-Host "The merge policy in .gitattributes needs it, and merging without it" -ForegroundColor Yellow
    Write-Host "silently falls back to a line-by-line merge. Checking out a branch that" -ForegroundColor Yellow
    Write-Host "has build/ (or merging it into main) is the fix. Stopping instead of" -ForegroundColor Yellow
    Write-Host "merging without the drivers." -ForegroundColor Yellow
    exit 1
}
node build/gitMergeSetup.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "Could not register the merge drivers. Not merging." -ForegroundColor Red
    exit 1
}

git merge --no-edit ams-update
if ($LASTEXITCODE -ne 0) {
    $conflicts = git diff --name-only --diff-filter=U
    Write-Host ""
    Write-Host "Merge conflicts in:" -ForegroundColor Red
    $conflicts | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "A file conflicting here means this repo edits lines AMS also edits." -ForegroundColor Yellow
    Write-Host "If it is a file we have effectively rewritten rather than patched, it" -ForegroundColor Yellow
    Write-Host "belongs beside its AMS copy as <name>.mobile.<ext> instead, which stops" -ForegroundColor Yellow
    Write-Host "it conflicting again. See build/mobileOverrides.js." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Resolve, then: git commit" -ForegroundColor Cyan
    Write-Host "Or abandon:    git merge --abort" -ForegroundColor Cyan
    exit 1
}

# 6. Rebuild the lockfile against the merged manifest. .gitattributes keeps our
# package-lock.json whole through the merge - a lockfile conflict cannot be
# resolved by hand and means nothing when it happens - which leaves it
# describing the dependencies from before the sync. `npm ci` refuses a lockfile
# that disagrees with its package.json, so skipping this breaks the next install
# with nothing pointing back at the sync.
Write-Host "Rebuilding package-lock.json against the merged package.json..." -ForegroundColor Yellow
npm install --package-lock-only --no-audit --no-fund
if (git status --porcelain package-lock.json) {
    git add package-lock.json
    git commit -m "Rebuild lockfile after AMS sync" | Out-Null
    Write-Host "Lockfile updated." -ForegroundColor Green
}

Write-Host "Local sync complete - your custom changes are preserved." -ForegroundColor Green

# 7. Say what upstream changed in the files this repo overrides. Those files no
# longer conflict, which is the point of overriding them - but it also means
# their upstream changes now arrive silently, and this is the only thing that
# reports them.
Write-Host ""
if (Test-Path 'build/amsDrift.mjs') {
    node build/amsDrift.mjs
} else {
    Write-Host "(build/amsDrift.mjs not on this branch - skipping the drift report.)" -ForegroundColor DarkGray
}

# 8. Publish both branches, the way the workflow's own final step does.
#
# The remote sync reads ams-update from origin, so origin/ams-update is the
# merge base for every workflow run. Pushing main and leaving ams-update behind
# makes the next one merge against an older AMS snapshot, which forks the vendor
# branch into two lineages (the "Reconcile the vendor branch's two lineages"
# commit is what that cost last time) and, far less visibly, hands
# build/mergePackageJson.mjs a stale base. That driver decides "we changed this"
# by comparing ours against base, so a dependency this merge just brought onto
# main reads as a deliberate local pin, and AMS's later bumps to it are dropped
# with no conflict raised.
#
# --atomic because the half-pushed state is the one worth avoiding: main landing
# without ams-update is precisely the skew described above.
#
# Not gated on whether anything changed. A no-op push costs one line of output;
# a skipped one leaves the sync commit in this clone only.
Write-Host ""
Write-Host "Pushing main and ams-update..." -ForegroundColor Yellow
git push --atomic origin main ams-update
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Push rejected - nothing was pushed, since --atomic means both refs or neither." -ForegroundColor Red
    Write-Host "The usual cause is the OTA workflow having run since this clone last synced," -ForegroundColor Yellow
    Write-Host "leaving origin ahead. Fetch and reconcile rather than forcing: a force here is" -ForegroundColor Yellow
    Write-Host "what rewrites the vendor branch's history, and the merge base is the only thing" -ForegroundColor Yellow
    Write-Host "protecting local work from the next sync." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  git fetch origin" -ForegroundColor Cyan
    Write-Host "  git log --oneline --graph main origin/main ams-update origin/ams-update" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}
Write-Host "main and ams-update are published." -ForegroundColor Green

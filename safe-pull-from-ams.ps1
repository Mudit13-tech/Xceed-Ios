$ErrorActionPreference = "Stop"
$AmsPath = "../IAMS/AMS-with-TimeTable"
$AmsBranch = "main"
$AppPath = $PWD.Path

Write-Host "Starting safe sync from AMS-with-TimeTable..." -ForegroundColor Cyan

# 1. Ensure working directory is clean
$status = git status --porcelain
if ($status) {
    Write-Host "Error: Your working directory is not clean. Please commit or stash your changes before syncing." -ForegroundColor Red
    exit 1
}

# 2. Switch to ams-update and catch it up with origin.
#
# The workflow's sync does `git checkout ams-update` from origin, so an Action
# run since this clone's last sync leaves the local branch behind. A bare
# checkout here would then lay this run's "Automated AMS Sync" commit on the
# stale tip, forking the vendor branch into two lineages - and the damage is
# already done four steps before the push at step 8 reports it. Fetching first
# is the only thing that prevents it; the push can only ever complain.
#
# --ff-only because catching up is a fast-forward or it is nothing. A reset (or
# a merge that silently rewrites) here is how the Action's sync commit gets
# dropped from the base the next workflow run merges against - the failure that
# eats local edits with no conflict raised. See the block at step 8.
Write-Host "Switching to 'ams-update' tracking branch..." -ForegroundColor Yellow
git checkout ams-update
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Could not check out ams-update. Not syncing." -ForegroundColor Red
    Write-Host "Step 3 unpacks AMS's client into the working tree, so continuing here" -ForegroundColor Yellow
    Write-Host "would extract it over whatever branch is actually checked out." -ForegroundColor Yellow
    exit 1
}

Write-Host "Fetching origin so the sync starts from the latest AMS snapshot..." -ForegroundColor Yellow
git fetch origin
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Could not fetch from origin. Not syncing." -ForegroundColor Red
    Write-Host "Going ahead risks committing this sync onto a stale ams-update, which is" -ForegroundColor Yellow
    Write-Host "the exact thing this step exists to prevent. Reconnect and re-run." -ForegroundColor Yellow
    exit 1
}

if (git rev-parse --verify --quiet origin/ams-update) {
    git merge --ff-only origin/ams-update
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "ams-update holds commits origin/ams-update does not - the local and" -ForegroundColor Red
        Write-Host "workflow lineages have already forked. Not syncing on top of that." -ForegroundColor Red
        Write-Host ""
        Write-Host "Join them first. A merge, never a force: forcing deletes the Action's" -ForegroundColor Yellow
        Write-Host "sync commit from the base the next workflow run merges against." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  git merge origin/ams-update" -ForegroundColor Cyan
        Write-Host "  git checkout main; git merge ams-update" -ForegroundColor Cyan
        Write-Host "  git push --atomic origin main ams-update" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Then re-run this script." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "No origin/ams-update yet - nothing to catch up to." -ForegroundColor DarkGray
}

# 3. Archive from AMS and Extract here
#
# From origin/$AmsBranch, never HEAD. `git archive HEAD:client` exports whatever
# that clone happens to have checked out, which is only as current as the last
# time somebody pulled it by hand - on 08/09/2026 it was four commits behind
# origin/main and sitting on an unrelated feature branch.
#
# Stale is the lesser half of it. What gets extracted here is committed to
# ams-update as "Automated AMS Sync", i.e. recorded as what AMS looks like
# *now*, and step 6's three-way merge treats that as authoritative. Exporting an
# old snapshot therefore tells the merge that upstream has *deleted* everything
# added since, so files the Action legitimately synced are backed out of main -
# and because it reads as AMS's own change, no conflict is raised to say so.
#
# The workflow cannot drift this way: actions/checkout clones AMS fresh and gets
# its current default branch every run. Fetching here is what keeps this half in
# agreement with that one, which is the premise .gitattributes and step 5a are
# both written against.
#
# `git -C` rather than Set-Location so an early exit cannot leave the caller's
# shell inside the AMS clone.
Write-Host "Fetching AMS so the export is of upstream's current $AmsBranch..." -ForegroundColor Yellow
git -C $AmsPath fetch origin
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Could not fetch from AMS. Not syncing." -ForegroundColor Red
    Write-Host "Exporting from a stale clone would record an old AMS snapshot as the" -ForegroundColor Yellow
    Write-Host "current one, and the next merge would read upstream's newer files as" -ForegroundColor Yellow
    Write-Host "deletions to apply. Reconnect and re-run." -ForegroundColor Yellow
    exit 1
}

Write-Host "Exporting client code from AMS (origin/$AmsBranch)..." -ForegroundColor Yellow
git -C $AmsPath archive "origin/${AmsBranch}:client" -o "$AppPath/client_export.tar"
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Could not export client/ from AMS origin/$AmsBranch. Not syncing." -ForegroundColor Red
    Write-Host "If AMS renamed its default branch, update `$AmsBranch at the top of this" -ForegroundColor Yellow
    Write-Host "script - the sync workflow follows AMS's default branch automatically," -ForegroundColor Yellow
    Write-Host "so this copy is the only one that has to be told." -ForegroundColor Yellow
    exit 1
}

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

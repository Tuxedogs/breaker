# Build scintel-fitting-merge-context.zip for ChatGPT review
$ErrorActionPreference = 'Stop'

$Moonbreaker = 'D:\Moonbreaker'
$Scintel = 'D:\scintel'
$ZipPath = Join-Path $Moonbreaker 'scintel-fitting-merge-context.zip'
$Staging = Join-Path $env:TEMP "scintel-fitting-context-$(Get-Date -Format 'yyyyMMddHHmmss')"
$ExcludedLarge = [System.Collections.Generic.List[string]]::new()

function Ensure-Dir([string]$Path) {
    if (-not (Test-Path $Path)) { New-Item -ItemType Directory -Path $Path -Force | Out-Null }
}

function Copy-RelFile([string]$SourceRoot, [string]$RelPath, [string]$DestRoot) {
    $src = Join-Path $SourceRoot $RelPath
    if (-not (Test-Path -LiteralPath $src)) { return $false }
    $dest = Join-Path $DestRoot $RelPath
    Ensure-Dir ([System.IO.Path]::GetDirectoryName($dest))
    Copy-Item -LiteralPath $src -Destination $dest -Force
    return $true
}

function Copy-IfSmall([string]$SourceRoot, [string]$RelPath, [string]$DestRoot, [double]$MaxMb) {
    $src = Join-Path $SourceRoot $RelPath
    if (-not (Test-Path -LiteralPath $src)) { return $false }
    $mb = (Get-Item -LiteralPath $src).Length / 1MB
    if ($mb -gt $MaxMb) {
        $ExcludedLarge.Add("$RelPath ($([math]::Round($mb,2)) MB, limit ${MaxMb} MB)") | Out-Null
        return $false
    }
    return Copy-RelFile $SourceRoot $RelPath $DestRoot
}

function Copy-Glob([string]$Root, [string]$Pattern, [string]$DestRoot, [string[]]$ExcludeDirNames = @()) {
    if (-not (Test-Path $Root)) { return }
    Get-ChildItem -Path $Root -Recurse -File -Filter $Pattern -ErrorAction SilentlyContinue |
        Where-Object {
            $rel = $_.FullName.Substring($Root.Length).TrimStart('\', '/')
            $skip = $false
            foreach ($ex in $ExcludeDirNames) {
                if ($rel -match "(^|[\\/])$([regex]::Escape($ex))([\\/]|$)") { $skip = $true; break }
            }
            -not $skip
        } |
        ForEach-Object {
            $rel = $_.FullName.Substring($Root.Length).TrimStart('\', '/')
            Copy-RelFile $Root $rel $DestRoot | Out-Null
        }
}

function Save-GitSnapshot([string]$Repo, [string]$DestDir) {
    Ensure-Dir $DestDir
    Push-Location $Repo
    try {
        git branch --show-current | Out-File (Join-Path $DestDir 'branch.txt') -Encoding utf8
        git status --short | Out-File (Join-Path $DestDir 'status-short.txt') -Encoding utf8
        git log --oneline -20 | Out-File (Join-Path $DestDir 'log-oneline-20.txt') -Encoding utf8
        git diff --name-only | Out-File (Join-Path $DestDir 'diff-name-only.txt') -Encoding utf8
        git diff --stat | Out-File (Join-Path $DestDir 'diff-stat.txt') -Encoding utf8
    } finally { Pop-Location }
}

Remove-Item $Staging -Recurse -Force -ErrorAction SilentlyContinue
Ensure-Dir $Staging

$mbRoot = Join-Path $Staging 'moonbreaker'
$scRoot = Join-Path $Staging 'scintel'
Ensure-Dir $mbRoot
Ensure-Dir $scRoot

# Git snapshots
Save-GitSnapshot $Moonbreaker (Join-Path $Staging '_context\moonbreaker-git')
Save-GitSnapshot $Scintel (Join-Path $Staging '_context\scintel-git')

# Moonbreaker root/config
foreach ($item in @(
    'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
    '.gitignore', 'README.md', 'vercel.json'
)) {
    Copy-RelFile $Moonbreaker $item $mbRoot | Out-Null
}
Get-ChildItem $Moonbreaker -File -Filter 'tsconfig*.json' | ForEach-Object {
    Copy-RelFile $Moonbreaker $_.Name $mbRoot | Out-Null
}
Get-ChildItem $Moonbreaker -File -Filter 'vite.config.*' | ForEach-Object {
    Copy-RelFile $Moonbreaker $_.Name $mbRoot | Out-Null
}

# Moonbreaker src patterns
$mbSrcDirs = @(
    'src\App.tsx', 'src\App.ts', 'src\App.jsx', 'src\App.js',
    'src\main.tsx', 'src\main.ts', 'src\main.jsx', 'src\main.js'
)
foreach ($p in $mbSrcDirs) { Copy-RelFile $Moonbreaker $p $mbRoot | Out-Null }

$mbCopyTrees = @(
    'src\routes', 'src\layouts', 'src\pages',
    'src\pages\fitting', 'src\features\fitting', 'src\lib\fitting',
    'src\components\fitting',
    'src\pages\logistics', 'src\pages\industry', 'src\pages\mining',
    'src\features\crafting', 'src\features\buildQueue', 'src\features\inventory',
    'src\server\fitting', 'src\api\fitting'
)
foreach ($tree in $mbCopyTrees) {
    $abs = Join-Path $Moonbreaker $tree
    if (Test-Path $abs) {
        Get-ChildItem $abs -Recurse -File | ForEach-Object {
            $rel = $_.FullName.Substring($Moonbreaker.Length).TrimStart('\', '/')
            Copy-RelFile $Moonbreaker $rel $mbRoot | Out-Null
        }
    }
}

# Nav/Sidebar components
Get-ChildItem (Join-Path $Moonbreaker 'src\components') -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match 'Nav|Sidebar' } |
    ForEach-Object {
        $rel = $_.FullName.Substring($Moonbreaker.Length).TrimStart('\', '/')
        Copy-RelFile $Moonbreaker $rel $mbRoot | Out-Null
    }

# fitting-related loose src files
Get-ChildItem (Join-Path $Moonbreaker 'src\lib') -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match 'fitting|component|Api' } |
    ForEach-Object {
        $rel = $_.FullName.Substring($Moonbreaker.Length).TrimStart('\', '/')
        Copy-RelFile $Moonbreaker $rel $mbRoot | Out-Null
    }
Get-ChildItem (Join-Path $Moonbreaker 'src\hooks') -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match 'fitting' } |
    ForEach-Object {
        $rel = $_.FullName.Substring($Moonbreaker.Length).TrimStart('\', '/')
        Copy-RelFile $Moonbreaker $rel $mbRoot | Out-Null
    }
Get-ChildItem (Join-Path $Moonbreaker 'src\stores') -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match 'fitting' } |
    ForEach-Object {
        $rel = $_.FullName.Substring($Moonbreaker.Length).TrimStart('\', '/')
        Copy-RelFile $Moonbreaker $rel $mbRoot | Out-Null
    }
Get-ChildItem (Join-Path $Moonbreaker 'src\types') -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match 'fitting' } |
    ForEach-Object {
        $rel = $_.FullName.Substring($Moonbreaker.Length).TrimStart('\', '/')
        Copy-RelFile $Moonbreaker $rel $mbRoot | Out-Null
    }

# All src CSS/SCSS
Get-ChildItem (Join-Path $Moonbreaker 'src') -Recurse -File -Include '*.css', '*.scss' |
    ForEach-Object {
        $rel = $_.FullName.Substring($Moonbreaker.Length).TrimStart('\', '/')
        Copy-RelFile $Moonbreaker $rel $mbRoot | Out-Null
    }

# Server/API (LiteralPath for Vercel bracket routes)
foreach ($tree in @('server', 'src\server', 'src\api')) {
    $abs = Join-Path $Moonbreaker $tree
    if (Test-Path -LiteralPath $abs) {
        Get-ChildItem -LiteralPath $abs -Recurse -File |
            Where-Object { $_.FullName -notmatch '\\node_modules\\|\\dist\\|\\\.git\\' } |
            ForEach-Object {
                $rel = $_.FullName.Substring($Moonbreaker.Length).TrimStart('\', '/')
                Copy-RelFile $Moonbreaker $rel $mbRoot | Out-Null
            }
    }
}
$apiBracketRoutes = @(
    'api\crafting\[...path].ts',
    'api\missions\[...path].ts',
    'api\user\inventory\locations\[id].ts',
    'api\user\inventory\stacks\[id].ts'
)
foreach ($rel in $apiBracketRoutes) {
    Copy-RelFile $Moonbreaker $rel $mbRoot | Out-Null
}
Get-ChildItem -LiteralPath (Join-Path $Moonbreaker 'api\user') -Recurse -File -ErrorAction SilentlyContinue |
    ForEach-Object {
        $rel = $_.FullName.Substring($Moonbreaker.Length).TrimStart('\', '/')
        Copy-RelFile $Moonbreaker $rel $mbRoot | Out-Null
    }

# server-data fitting: manifest + small registries only
Copy-RelFile $Moonbreaker 'server-data\fitting\current.json' $mbRoot | Out-Null
Copy-RelFile $Moonbreaker 'server-data\fitting\LIVE\legacy-records\manifest.json' $mbRoot | Out-Null
$smallFittingRegistries = @(
    'components.json', 'ships.json', 'ship_weapons.json', 'vehicle_ammo.json',
    'shields.json', 'power_plants.json', 'coolers.json', 'quantum_drives.json',
    'radars.json', 'thrusters.json', 'component_identity_index.json', 'ship_performance.json'
)
foreach ($name in $smallFittingRegistries) {
    Copy-IfSmall $Moonbreaker "server-data\fitting\LIVE\legacy-records\$name" $mbRoot 10 | Out-Null
}
$largeFitting = @(
    'compatible_items_by_port.json', 'ship_hardpoints.json', 'default_loadouts.json',
    'compatibility_rules.part-001.json', 'compatibility_rules.part-002.json',
    'compatibility_rules.part-003.json', 'stock_loadout_calculations.json'
)
foreach ($name in $largeFitting) {
    $path = Join-Path $Moonbreaker "server-data\fitting\LIVE\legacy-records\$name"
    if (Test-Path $path) {
        $mb = [math]::Round((Get-Item $path).Length / 1MB, 2)
        $ExcludedLarge.Add("moonbreaker/server-data/fitting/LIVE/legacy-records/$name ($mb MB)") | Out-Null
    }
}

# server-data crafting metadata only
foreach ($rel in @(
    'server-data\crafting\component-cards\index.json',
    'server-data\crafting\component-cards\facets.json',
    'server-data\crafting\component-cards\browse.json',
    'server-data\crafting\blueprint-sources\index.json'
)) {
    Copy-RelFile $Moonbreaker $rel $mbRoot | Out-Null
}

# public/api file list only
$pubApi = Join-Path $Moonbreaker 'public\api'
if (Test-Path $pubApi) {
    $listPath = Join-Path $mbRoot 'public\api\_FILE_LIST.txt'
    Ensure-Dir (Split-Path $listPath -Parent)
    Get-ChildItem $pubApi -Recurse -File |
        ForEach-Object {
            $rel = $_.FullName.Substring($pubApi.Length).TrimStart('\', '/')
            $mb = [math]::Round($_.Length / 1MB, 2)
            "${rel}`t${mb} MB"
        } | Out-File $listPath -Encoding utf8
}

# Scintel config/docs/scripts
foreach ($tree in @('config', 'scripts\ingest', 'scripts\fitting')) {
    $abs = Join-Path $Scintel $tree
    if (Test-Path $abs) {
        Get-ChildItem $abs -Recurse -File |
            Where-Object { $_.FullName -notmatch '\\builds\\|\\data\\|\\libs\\foundry\\|Game2\.dcb|\.p4k' } |
            ForEach-Object {
                $rel = $_.FullName.Substring($Scintel.Length).TrimStart('\', '/')
                Copy-RelFile $Scintel $rel $scRoot | Out-Null
            }
    }
}

Get-ChildItem (Join-Path $Scintel 'docs') -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Name -match 'fitting|api|pipeline' -or $_.DirectoryName -match 'contracts'
    } |
    ForEach-Object {
        $rel = $_.FullName.Substring($Scintel.Length).TrimStart('\', '/')
        Copy-RelFile $Scintel $rel $scRoot | Out-Null
    }

# Scintel server fitting
foreach ($tree in @('server\fitting', 'server\routes')) {
    $abs = Join-Path $Scintel $tree
    if (Test-Path $abs) {
        Get-ChildItem $abs -Recurse -File |
            Where-Object { $_.Name -match 'fitting' -or $tree -eq 'server\fitting' } |
            ForEach-Object {
                $rel = $_.FullName.Substring($Scintel.Length).TrimStart('\', '/')
                Copy-RelFile $Scintel $rel $scRoot | Out-Null
            }
    }
}

# Scintel out fitting reports + small registries
$scintelOutFitting = 'out\LIVE\legacy-records\api\fitting'
$outAbs = Join-Path $Scintel $scintelOutFitting
if (Test-Path $outAbs) {
    Get-ChildItem $outAbs -File | ForEach-Object {
        $name = $_.Name
        $rel = "$scintelOutFitting\$name".Replace('\', '/')
        $include = $false
        if ($name -match 'report|unresolved|coverage|inventory|manifest') { $include = $true }
        elseif ($name -in @(
            'compatibility_rules.json', 'compatible_items_by_port.json',
            'fitting_source_independence_report.json', 'stock_loadout_calculations.json',
            'fitting_calculation_report.json'
        )) {
            if ($name -eq 'compatibility_rules.json' -or $name -eq 'compatible_items_by_port.json') {
                $ExcludedLarge.Add("scintel/$rel ($([math]::Round($_.Length/1MB,2)) MB)") | Out-Null
            } elseif ($_.Length / 1MB -le 10) {
                $include = $true
            } else {
                $ExcludedLarge.Add("scintel/$rel ($([math]::Round($_.Length/1MB,2)) MB)") | Out-Null
            }
        }
        elseif ($name -in $smallFittingRegistries) {
            if ($_.Length / 1MB -le 10) { $include = $true }
            else { $ExcludedLarge.Add("scintel/$rel ($([math]::Round($_.Length/1MB,2)) MB)") | Out-Null }
        }
        elseif ($name -in @('default_loadouts.json', 'ship_hardpoints.json')) {
            $ExcludedLarge.Add("scintel/$rel ($([math]::Round($_.Length/1MB,2)) MB)") | Out-Null
        }
        if ($include) {
            Copy-RelFile $Scintel ($scintelOutFitting + '\' + $name) $scRoot | Out-Null
        }
    }
}

# README
$mbBranch = Get-Content (Join-Path $Staging '_context\moonbreaker-git\branch.txt') -Raw
$scBranch = Get-Content (Join-Path $Staging '_context\scintel-git\branch.txt') -Raw
$readme = @"
Scintel / Moonbreaker Fitting Merge Context Pack
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

1. Current branches
   - Moonbreaker (D:\Moonbreaker): $($mbBranch.Trim())
   - Scintel (D:\scintel): $($scBranch.Trim())

2. Fitting branch merge status
   - Moonbreaker main includes fitting API contract work (commits: feat: land fitting api contract, fix: align server ESM import specifiers).
   - Commit 86284537 "fix: remove premature fitting API deploy" removed public Vercel deployment of fitting endpoints.
   - Local feature branches still exist: codex/fitting-v1-integration, codex/fitting-mitigation-api-ui, feature/premium-fitting-terminal-prototype (not checked out).
   - Scintel master has fitting pipeline scripts; working tree has uncommitted fitting registry changes.

3. Merge conflicts
   - No uncommitted merge conflict markers in either working tree at pack time.
   - Merging codex/fitting-v1-integration into main would add large dataset files (e.g. monolithic compatibility_rules.json); not a textual conflict snapshot here.

4. npm run build (Moonbreaker)
   - PASS (tsc -b && vite build completed successfully at pack time).

5. Fitting tests
   - Present: npm run fitting:test -> server/fitting/fitting.routes.test.ts
   - PASS: 6 tests, 0 failures at pack time.

6. Fitting UI gating
   - YES. Routes /fitting and /fitting/:shipKey render FittingWipPlaceholder unless VITE_ENABLE_FITTING_UI=true.
   - Dashboard FittingLaunchPanel also hidden unless that env flag is set.
   - Full FittingPage UI exists but is dev-flag gated.

7. Public /api/fitting deployment
   - NO for production as configured. vercel.json rewrites cover missions and crafting only; no fitting function mapping.
   - api/v1/fitting/[...path].ts was removed from main (commit 86284537); fitting routes live in server/routes/fitting.routes.ts, server/routes/fittingApi.ts, and server/index.ts for local dev.
   - Fitting API deploy was explicitly removed in recent main history.

8. Files intentionally excluded (too large or policy)
$(
    if ($ExcludedLarge.Count -eq 0) { '   - (none)' }
    else { ($ExcludedLarge | Sort-Object -Unique | ForEach-Object { "   - $_" }) -join "`n" }
)

Also excluded globally: node_modules, dist, build, .git, .env*, raw game files (Data.p4k, Game2.dcb), foundry record dumps, Moonbreaker public/api JSON payloads (file list included instead), server-data/crafting/by-id/** monoliths.

Notes:
- Moonbreaker blueprintSourcesApi.ts not found; craftingBlueprintSourcesApi.ts included instead.
- src/pages/crafting/** not present; industry/crafting paths included.
- src/features/crafting/** and src/features/inventory/** not present as directories.
"@

$readme | Out-File (Join-Path $Staging '_context\README.txt') -Encoding utf8

# Zip
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
Compress-Archive -Path (Join-Path $Staging '*') -DestinationPath $ZipPath -CompressionLevel Optimal
Remove-Item $Staging -Recurse -Force

$zipMb = [math]::Round((Get-Item $ZipPath).Length / 1MB, 2)
Write-Output "Created $ZipPath ($zipMb MB)"
Write-Output "Excluded large files: $($ExcludedLarge.Count)"

# Alternative Electron Build - Using electron-packager

Write-Host "`n🔨 Starting Aivora Build (Alternative Method)..." -ForegroundColor Cyan

# Step 1: Clean old builds
Write-Host "`n1️⃣ Cleaning old builds..." -ForegroundColor Yellow
Remove-Item -Path ".\dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".\dist-electron" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".\aivora-win32-x64" -Recurse -Force -ErrorAction SilentlyContinue

# Step 2: Build the web app
Write-Host "`n2️⃣ Building web app..." -ForegroundColor Yellow
npm run build

# Step 3: Build Electron (using vite)
Write-Host "`n3️⃣ Building Electron main process..." -ForegroundColor Yellow
npx vite build -c electron.vite.config.ts

# Step 4: Install electron-packager if not installed
Write-Host "`n4️⃣ Checking electron-packager..." -ForegroundColor Yellow
npm install --save-dev electron-packager

# Step 5: Package the app
Write-Host "`n5️⃣ Packaging Electron app..." -ForegroundColor Yellow
npx electron-packager . Aivora --platform=win32 --arch=x64 --out=release --overwrite --icon=public/favicon.ico --ignore="node_modules|.git|src|release|.vscode"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Build complete!" -ForegroundColor Green
    Write-Host "📦 Your app is ready at: release\Aivora-win32-x64\Aivora.exe" -ForegroundColor Cyan
    Write-Host "`n🚀 To distribute: Zip the 'Aivora-win32-x64' folder and share!" -ForegroundColor Yellow
}
else {
    Write-Host "`n❌ Build failed!" -ForegroundColor Red
}

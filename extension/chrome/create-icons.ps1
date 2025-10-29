# Script para crear iconos PNG básicos para la extensión de Chrome

# Crear directorio de iconos si no existe
$iconsDir = "icons"
if (!(Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir
}

# Copiar el icono base si existe
$sourceIcon = "..\..\resources\icon.png"
if (Test-Path $sourceIcon) {
    Copy-Item $sourceIcon "$iconsDir\icon128.png" -Force
    Copy-Item $sourceIcon "$iconsDir\icon48.png" -Force
    Copy-Item $sourceIcon "$iconsDir\icon16.png" -Force
    Write-Host "Iconos PNG creados exitosamente"
} else {
    Write-Host "No se encontró el icono base en $sourceIcon"
    Write-Host "Creando iconos PNG básicos..."
    
    # Crear un archivo PNG básico (esto es solo un placeholder)
    # En un entorno real, necesitarías usar herramientas como ImageMagick o similar
    $pngHeader = [byte[]](0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
    
    # Crear archivos PNG mínimos (estos son solo placeholders)
    [System.IO.File]::WriteAllBytes("$iconsDir\icon16.png", $pngHeader)
    [System.IO.File]::WriteAllBytes("$iconsDir\icon48.png", $pngHeader)
    [System.IO.File]::WriteAllBytes("$iconsDir\icon128.png", $pngHeader)
    
    Write-Host "Archivos PNG placeholder creados. Reemplaza con iconos reales."
}

Write-Host "Proceso completado."
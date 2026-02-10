#!/bin/bash
# /usr/bin/update-script.sh
# Skrypt do aktualizacji panelu NAS z GitHub Releases

LOG_FILE="/var/log/nas-panel-update.log"
VERSION_FILE="/opt/nas-panel/version.txt"
BACKUP_DIR="/opt/nas-panel-backups"
GITHUB_REPO="gekomod/nas-panel"  # Zastąp swoim repozytorium
TIMESTAMP=$(date +%Y%m%d%H%M%S)

# Funkcja do logowania
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Pobierz najnowszą wersję z GitHub Releases
download_latest_release() {
    log "Sprawdzanie najnowszej wersji na GitHub..."
    
    API_URL="https://api.github.com/repos/$GITHUB_REPO/releases/latest"
    RESPONSE=$(curl -s "$API_URL")
    
    # Znajdź plik .deb w assets
    DEB_URL=$(echo "$RESPONSE" | grep -o "browser_download_url.*\.deb" | cut -d '"' -f 4)
    LATEST_VERSION=$(echo "$RESPONSE" | grep tag_name | cut -d '"' -f 4)
    
    if [ -z "$DEB_URL" ]; then
        log "Błąd: Nie znaleziono pliku .deb w najnowszym wydaniu"
        exit 1
    fi

    DEB_FILE="/tmp/nas-panel-${LATEST_VERSION}.deb"
    
    log "Pobieranie: $DEB_URL"
    wget -q "$DEB_URL" -O "$DEB_FILE" || {
        log "Błąd pobierania pakietu"
        exit 1
    }
    
    echo "$DEB_FILE"
}

# Wykonaj aktualizację
perform_update() {
    log "=== Rozpoczęcie procesu aktualizacji ==="
    
    # Pobierz paczkę
    DEB_FILE=$(download_latest_release)
    
    # Zatrzymaj usługę przed aktualizacją
    log "Zatrzymywanie usługi..."
    systemctl stop nas-api.service 2>/dev/null
    
    # Instalacja paczki
    log "Instalowanie $DEB_FILE..."
    dpkg -i "$DEB_FILE" || {
        log "Błąd instalacji, próba naprawy..."
        apt-get install -f -y
    }
    
    # Uruchom ponownie usługę
    log "Uruchamianie usługi..."
    systemctl start nas-api.service
    
    # Zapisz wersję
    echo "${LATEST_VERSION#v}" > "$VERSION_FILE"
    
    # Posprzątaj
    rm -f "$DEB_FILE"
    
    log "Aktualizacja zakończona pomyślnie do wersji $LATEST_VERSION"
    log "=== Koniec procesu aktualizacji ==="
}

# Główna funkcja
main() {
    if [ "$(id -u)" -ne 0 ]; then
        echo "Skrypt musi być uruchomiony jako root" >&2
        exit 1
    fi
    
    mkdir -p "$(dirname "$LOG_FILE")" "$BACKUP_DIR"
    touch "$LOG_FILE"
    chown nas:nas "$LOG_FILE"
    
    perform_update
}

main "$@"
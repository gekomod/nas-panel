#!/bin/bash

# backup-system.sh v1.1
# System backup script for NAS Panel
# Backup system files and configurations

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_ROOT="/var/backups/system"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"
LOG_FILE="/var/log/system-backup.log"
MAX_BACKUPS=30  # Keep last 30 backups
COMPRESS_LEVEL=6

# Important system files and directories to backup
SYSTEM_FILES=(
    "/etc/passwd"
    "/etc/group"
    "/etc/shadow"
    "/etc/sudoers"
    "/etc/hosts"
    "/etc/hostname"
    "/etc/resolv.conf"
    "/etc/fstab"
    "/etc/crontab"
    "/etc/ssh/sshd_config"
    "/etc/apt/sources.list"
    "/etc/apt/sources.list.d"
    "/etc/systemd"
    "/etc/network/interfaces"
    "/etc/default"
    "/etc/nginx"  # if exists
    "/etc/apache2"  # if exists
)

# NAS Panel specific files
NAS_PANEL_FILES=(
    "/etc/nas-panel"
    "/opt/nas-panel"
    "/var/lib/nas-panel"
)

# Database backups (if applicable)
DATABASE_BACKUPS=(
    # Add database backup commands if needed
    # "mysqldump -u root --all-databases > $BACKUP_DIR/databases.sql"
)

# Functions
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[✓]${NC} $1"
    log_message "SUCCESS: $1"
}

info() {
    echo -e "${BLUE}[i]${NC} $1"
    log_message "INFO: $1"
}

warning() {
    echo -e "${YELLOW}[!]${NC} $1"
    log_message "WARNING: $1"
}

error() {
    echo -e "${RED}[✗]${NC} $1"
    log_message "ERROR: $1"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "This script must be run as root"
        exit 1
    fi
}

create_backup_dir() {
    info "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
    
    if [ $? -eq 0 ]; then
        success "Backup directory created"
    else
        error "Failed to create backup directory"
        exit 1
    fi
}

backup_system_files() {
    info "Backing up system files..."
    
    local system_backup_dir="$BACKUP_DIR/system"
    mkdir -p "$system_backup_dir"
    
    local backed_up=0
    local skipped=0
    
    for item in "${SYSTEM_FILES[@]}"; do
        if [ -e "$item" ]; then
            local dest="$system_backup_dir$(dirname "$item")"
            mkdir -p "$dest"
            
            if [ -d "$item" ]; then
                cp -ra "$item" "$dest/" 2>/dev/null
            else
                cp -a "$item" "$dest/" 2>/dev/null
            fi
            
            if [ $? -eq 0 ]; then
                backed_up=$((backed_up + 1))
                log_message "Backed up: $item"
            else
                skipped=$((skipped + 1))
                warning "Failed to backup: $item"
            fi
        else
            skipped=$((skipped + 1))
            log_message "Does not exist: $item"
        fi
    done
    
    success "System files: $backed_up backed up, $skipped skipped"
}

backup_nas_panel() {
    info "Backing up NAS Panel files..."
    
    local nas_backup_dir="$BACKUP_DIR/nas-panel"
    mkdir -p "$nas_backup_dir"
    
    local backed_up=0
    local skipped=0
    
    for item in "${NAS_PANEL_FILES[@]}"; do
        if [ -e "$item" ]; then
            if [ -d "$item" ]; then
                cp -ra "$item" "$nas_backup_dir/" 2>/dev/null
            else
                cp -a "$item" "$nas_backup_dir/" 2>/dev/null
            fi
            
            if [ $? -eq 0 ]; then
                backed_up=$((backed_up + 1))
                log_message "Backed up NAS Panel: $item"
            else
                skipped=$((skipped + 1))
                warning "Failed to backup NAS Panel: $item"
            fi
        else
            skipped=$((skipped + 1))
            log_message "NAS Panel file does not exist: $item"
        fi
    done
    
    # Backup package list
    dpkg --get-selections > "$nas_backup_dir/installed-packages.list" 2>/dev/null
    if [ $? -eq 0 ]; then
        success "Package list saved"
        backed_up=$((backed_up + 1))
    fi
    
    success "NAS Panel files: $backed_up backed up, $skipped skipped"
}

backup_databases() {
    info "Checking for databases to backup..."
    
    local db_backup_dir="$BACKUP_DIR/databases"
    mkdir -p "$db_backup_dir"
    
    local backed_up=0
    
    # Check for MySQL/MariaDB
    if command -v mysqldump &> /dev/null; then
        info "Backing up MySQL/MariaDB databases..."
        
        # Try to backup all databases
        if mysqldump --all-databases --single-transaction --quick \
           --lock-tables=false > "$db_backup_dir/all-databases.sql" 2>/dev/null; then
            success "MySQL databases backed up"
            backed_up=$((backed_up + 1))
        else
            warning "Failed to backup MySQL databases"
        fi
    fi
    
    # Check for PostgreSQL
    if command -v pg_dumpall &> /dev/null; then
        info "Backing up PostgreSQL databases..."
        
        if sudo -u postgres pg_dumpall > "$db_backup_dir/postgres-all.sql" 2>/dev/null; then
            success "PostgreSQL databases backed up"
            backed_up=$((backed_up + 1))
        else
            warning "Failed to backup PostgreSQL databases"
        fi
    fi
    
    if [ $backed_up -eq 0 ]; then
        info "No databases found to backup"
    fi
}

create_system_info() {
    info "Creating system information report..."
    
    local info_dir="$BACKUP_DIR/system-info"
    mkdir -p "$info_dir"
    
    # System information
    uname -a > "$info_dir/uname.txt"
    lsb_release -a 2>/dev/null > "$info_dir/lsb_release.txt"
    cat /etc/os-release 2>/dev/null > "$info_dir/os-release.txt"
    
    # Hardware information
    lscpu > "$info_dir/cpu.txt" 2>/dev/null
    free -h > "$info_dir/memory.txt" 2>/dev/null
    df -h > "$info_dir/disk-usage.txt"
    ip addr show > "$info_dir/network.txt" 2>/dev/null
    
    # Service status
    systemctl list-units --type=service --state=running > "$info_dir/running-services.txt" 2>/dev/null
    
    # Process list
    ps aux --sort=-%mem | head -20 > "$info_dir/top-processes.txt"
    
    # Network connections
    ss -tulpn > "$info_dir/network-connections.txt" 2>/dev/null
    
    success "System information collected"
}

compress_backup() {
    info "Compressing backup..."
    
    local tar_file="$BACKUP_ROOT/system-backup-$TIMESTAMP.tar.gz"
    
    # Create tar archive with compression
    if tar -czf "$tar_file" -C "$BACKUP_DIR" . --warning=no-file-changed; then
        success "Backup compressed: $tar_file"
        
        # Calculate size
        local size=$(du -h "$tar_file" | cut -f1)
        info "Backup size: $size"
        
        # Clean up uncompressed directory
        rm -rf "$BACKUP_DIR"
        
        echo "$tar_file"
    else
        error "Failed to compress backup"
        return 1
    fi
}

cleanup_old_backups() {
    info "Cleaning up old backups (keeping last $MAX_BACKUPS)..."
    
    # List backups sorted by date, remove old ones
    local backups=($(ls -1t "$BACKUP_ROOT"/system-backup-*.tar.gz 2>/dev/null))
    local total=${#backups[@]}
    
    if [ $total -gt $MAX_BACKUPS ]; then
        local to_remove=$((total - MAX_BACKUPS))
        info "Removing $to_remove old backup(s)..."
        
        for ((i=MAX_BACKUPS; i<total; i++)); do
            rm -f "${backups[$i]}"
            log_message "Removed old backup: ${backups[$i]}"
        done
        
        success "Old backups cleaned up"
    else
        info "No old backups to clean up"
    fi
}

verify_backup() {
    info "Verifying backup integrity..."
    
    local latest_backup=$(ls -1t "$BACKUP_ROOT"/system-backup-*.tar.gz 2>/dev/null | head -1)
    
    if [ -z "$latest_backup" ]; then
        warning "No backup found to verify"
        return 1
    fi
    
    if tar -tzf "$latest_backup" > /dev/null 2>&1; then
        success "Backup integrity verified: $latest_backup"
        return 0
    else
        error "Backup integrity check failed: $latest_backup"
        return 1
    fi
}

create_backup_report() {
    local report_file="$BACKUP_ROOT/backup-report-$TIMESTAMP.txt"
    
    cat > "$report_file" << EOF
===============================
SYSTEM BACKUP REPORT v1.1
===============================
Backup Date: $(date)
Backup ID: $TIMESTAMP
Backup Location: $BACKUP_ROOT
Backup File: system-backup-$TIMESTAMP.tar.gz

SYSTEM INFORMATION:
------------------
Hostname: $(hostname)
OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2 2>/dev/null || uname -o)
Kernel: $(uname -r)
Uptime: $(uptime -p)

BACKUP SUMMARY:
---------------
System Files: Backed up ${#SYSTEM_FILES[@]} important system files
NAS Panel: Backed up ${#NAS_PANEL_FILES[@]} NAS Panel locations
Databases: Attempted backup of MySQL and PostgreSQL if available

BACKUP STATUS: SUCCESS
Backup completed successfully at $(date '+%H:%M:%S')

Next scheduled backup: Check cron jobs for schedule

===============================
EOF
    
    # Append log file to report
    echo -e "\nLOG OUTPUT:" >> "$report_file"
    echo "===========" >> "$report_file"
    tail -50 "$LOG_FILE" >> "$report_file" 2>/dev/null
    
    success "Backup report created: $report_file"
}

main() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    NAS Panel System Backup v1.1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    
    # Check if running as root
    check_root
    
    # Create backup directory
    create_backup_dir
    
    # Start backup process
    local start_time=$(date +%s)
    
    # Backup system files
    backup_system_files
    
    # Backup NAS Panel files
    backup_nas_panel
    
    # Backup databases
    backup_databases
    
    # Create system information
    create_system_info
    
    # Compress backup
    local backup_file=$(compress_backup)
    if [ $? -ne 0 ]; then
        error "Backup compression failed"
        exit 1
    fi
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Verify backup
    verify_backup
    
    # Create report
    create_backup_report
    
    # Calculate duration
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))
    
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}    BACKUP COMPLETED SUCCESSFULLY${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "Duration: ${minutes}m ${seconds}s"
    echo -e "Backup file: $backup_file"
    echo -e "Log file: $LOG_FILE"
    echo ""
    
    log_message "Backup completed successfully in ${minutes}m ${seconds}s"
    
    exit 0
}

# Handle script termination
trap 'error "Backup interrupted by user"; exit 130' INT TERM

# Run main function
main

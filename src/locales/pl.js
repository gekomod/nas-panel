export default {
  home: {
    title: "Pulpit systemowy",
    manageWidgets: "Zarządzaj widgetami",
    widgetManager: {
      title: "Zarządzanie widgetami",
      widgetName: "Nazwa widgetu",
      status: "Status",
      actions: "Akcje",
      enabled: "Włączony",
      disabled: "Wyłączony",
      activate: "Włącz",
      deactivate: "Wyłącz",
      cancel: "Anuluj",
      saveChanges: "Zapisz zmiany"
    }
  },
  storageDisks: {
    title: 'Dyski magazynujące',
    device: 'Urządzenie',
    model: 'Model',
    serial: 'Numer seryjny',
    vendor: 'Dostawca',
    capacity: 'Pojemność',
    errorLoading: 'Błąd ładowania danych dysków',
    refresh: 'Odśwież listę dysków',
    scanNew: 'Skanuj nowe urządzenia',
    scanSuccess: 'Skanowanie zakończone',
    scanComplete: 'Zakończono skanowanie w poszukiwaniu nowych urządzeń',
    scanError: 'Błąd podczas skanowania'
  },
  storageFilesystems: {
    title: 'Systemy plików',
    device: 'Urządzenie',
    tags: 'Tagi',
    type: 'Typ',
    available: 'Dostępne',
    used: 'Użycie',
    mounted: 'Zamontowane',
    reference: 'Odwołanie',
    status: 'Status',
    refresh: 'Odśwież',
    errorLoading: 'Błąd ładowania systemów plików'
  },
  storageSmart: {
    title: 'Monitorowane urządzenia',
    monitored: 'Monitorowane',
    device: 'Urządzenie',
    model: 'Model',
    vendor: 'Dostawca',
    serial: 'Numer seryjny',
    wwn: 'WWN',
    capacity: 'Pojemność',
    temperature: 'Temperatura',
    statusS: 'Status (S.M.A.R.T)',
    statusValues: {
      healthy: 'Zdrowy',
      warning: 'Ostrzeżenie',
      error: 'Błąd',
      unknown: 'Nieznany',
      unavailable: 'Niedostępne'
    },
    refresh: 'Odśwież',
    errorLoading: 'Błąd ładowania danych SMART',
    enableMonitoring: 'Włącz monitoring',
    disableMonitoring: 'Wyłącz monitoring',
    notAvailableTitle: 'Monitorowanie SMART niedostępne',
    notAvailableMessage: 'Narzędzie smartctl nie jest zainstalowane w systemie',
    notAvailableSolution: 'Aby monitorować stan dysków, zainstaluj pakiet smartmontools:',
    retry: 'Spróbuj ponownie',
    installCommand: 'sudo apt-get install smartmontools',
    unavailable: 'Niedostępne',
    commandCopied: 'Komenda skopiowana do schowka',
    status: {
      passed: 'Pomyślny',
      failed: 'Niepowodzenie',
      unknown: 'Nieznany',
      healthy: 'Sprawny',
      error: 'Błąd',
      warning: 'Ostrzeżenie'
    },
    details: {
      smartStatus: 'Status SMART',
      temperature: 'Temperatura',
      model: 'Model',
      serial: 'Numer seryjny',
      capacity: 'Pojemność',
      produce: 'Producent',
      powerCycleCount: 'Liczba cykli włączeń',
      powerOnHours: 'Czas pracy',
      hours: 'godzin',
      firmware: 'Wersja Firmware',
      wwn: 'WWN',
      interfaceSpeed: 'Prędkość interfejsu',
      currentSpeed: 'Aktualna',
      maxSpeed: 'Maksymalna'
    },
    attributes: {
      noData: 'Brak danych atrybutów SMART'
    }
  },
  widgets: {
    SystemInfoWidget: "Informacje systemowe",
    RamWidget: "Pamięć RAM",
    CpuWidget: "Procesor CPU",
    FileSystemWidget: "System plików"
  },
  systemInfo: {
    system: "System",
    hostname: "Nazwa hosta",
    architecture: "Architektura",
    systemTime: "Czas systemowy",
    uptime: "Czas pracy",
    restartRequired: "Wymagany restart",
    cpu: "Procesor",
    manufacturer: "Producent",
    model: "Model",
    cores: "Rdzenie",
    speed: "Taktowanie",
    versions: "Wersje",
    app: "Aplikacja",
    lastUpdate: "Ostatnia aktualizacja",
    node: "Node.js",
    npm: "Npm"
  },
  ram: {
    title: "Pamięć RAM",
    used: "Użyte",
    free: "Wolne",
    active: "Aktywne",
    status: {
      normal: "Normalne",
      high: "Wysokie",
      critical: "Krytyczne",
      error: "Błąd"
    },
    lastUpdate: "Ostatnia aktualizacja"
  },
  cpu: {
    title: "Procesor",
    usage: "Użycie",
    temperature: "Temperatura",
    cores: "Rdzenie",
    status: {
      normal: "Normalne",
      highLoad: "Wysokie obciążenie",
      error: "Błąd"
    },
    lastUpdate: "Ostatnia aktualizacja"
  },
  fileSystem: {
    title: "System plików",
    device: "Urządzenie",
    mount: "Punkt montowania",
    size: "Rozmiar",
    usage: "Użycie",
    autoRefresh: "Auto-odświeżanie",
    refresh: "Odśwież",
    autoRefreshOn: 'Auto-odświeżanie włączone',
    autoRefreshOff: 'Auto-odświeżanie wyłączone',
    lastUpdate: "Ostatnia aktualizacja"
  },
  common: {
    yes: "Tak",
    no: "Nie",
    loading: "Ładowanie...",
    unknown: "Nieznany",
    error: "Błąd",
    na: 'N/D'
  }
}

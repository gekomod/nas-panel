import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Ścieżka do pliku konfiguracyjnego SMART
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SMART_CONFIG_PATH = path.join(__dirname, 'smart_monitoring.json');

// Funkcja do ładowania konfiguracji
export async function loadSmartConfig() {
  try {
    const data = await fs.readFile(SMART_CONFIG_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    // Jeśli plik nie istnieje, zwróć domyślną konfigurację
    if (err.code === 'ENOENT') {
      return { devices: {} };
    }
    throw err;
  }
}

// Funkcja do zapisywania konfiguracji
export async function saveSmartConfig(config) {
  await fs.writeFile(SMART_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

#!/usr/bin/env python3
import requests
import logging
from datetime import datetime

# Konfiguracja
API_URL = "http://localhost:3000/network/dynamic-dns/update-all"
AUTH_TOKEN = "your_api_token_here"  # Zastąp rzeczywistym tokenem
LOG_FILE = "/var/log/dynamic-dns.log"

# Konfiguracja logowania
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

try:
    headers = {"Authorization": f"Bearer {AUTH_TOKEN}"}
    response = requests.get(API_URL, headers=headers)
    response.raise_for_status()
    
    data = response.json()
    for result in data.get('results', []):
        status = "SUCCESS" if result.get('success') else "FAILED"
        logging.info(
            f"{status} - Host: {result.get('hostname')}, "
            f"Message: {result.get('message')}"
        )
    
    if not data.get('results'):
        logging.warning("No DNS services configured")
        
except Exception as e:
    logging.error(f"Update failed: {str(e)}")
    raise

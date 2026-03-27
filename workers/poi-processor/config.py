import os
from dotenv import load_dotenv

load_dotenv()

# Database (MySQL)
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = int(os.getenv('DB_PORT', 3306))
DB_USER = os.getenv('DB_USER', 'root')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_NAME = os.getenv('DB_NAME', 'tonpao_poi')

# Google Places API
GOOGLE_PLACES_API_KEY = os.getenv('GOOGLE_PLACES_API_KEY')
if not GOOGLE_PLACES_API_KEY:
    raise ValueError('GOOGLE_PLACES_API_KEY environment variable is required')

# Worker settings
REQUEST_DELAY = float(os.getenv('REQUEST_DELAY', 0.1))
MAX_RETRIES = int(os.getenv('MAX_RETRIES', 3))
RETRY_DELAY = float(os.getenv('RETRY_DELAY', 1.0))
REQUEST_TIMEOUT = int(os.getenv('REQUEST_TIMEOUT', 30))

# Logging
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

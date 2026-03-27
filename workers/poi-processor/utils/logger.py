import logging
from config import LOG_LEVEL

logger = logging.getLogger('poi_processor')
logger.setLevel(LOG_LEVEL)

handler = logging.StreamHandler()
formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
handler.setFormatter(formatter)
logger.addHandler(handler)


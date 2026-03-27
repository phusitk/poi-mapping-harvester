#!/usr/bin/env python3
"""
POI Processor Worker
Async worker for processing POI data from Google Places API

Usage:
  python main.py <job_id>

Example:
  python main.py f47ac10b-58cc-4372-a567-0e02b2c3d479
"""

import sys
import argparse
from services.poi_processor import POIProcessor
from utils.logger import logger
from utils.helpers import validate_uuid


def main():
    parser = argparse.ArgumentParser(description='POI Processor Worker')
    parser.add_argument('job_id', help='Job ID to process')
    args = parser.parse_args()

    job_id = args.job_id

    if not validate_uuid(job_id):
        logger.error(f'Invalid UUID format: {job_id}')
        sys.exit(1)

    try:
        processor = POIProcessor()
        processor.process_job(job_id)
        logger.info('Worker completed successfully')
        sys.exit(0)
    except Exception as e:
        logger.error(f'Worker failed: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()

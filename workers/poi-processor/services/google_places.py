import requests
import json
import time
from config import GOOGLE_PLACES_API_KEY, REQUEST_DELAY, REQUEST_TIMEOUT, MAX_RETRIES, RETRY_DELAY
from utils.logger import logger


class GooglePlacesClient:
    BASE_URL = 'https://maps.googleapis.com/maps/api/place'

    def __init__(self):
        self.api_key = GOOGLE_PLACES_API_KEY
        self.request_count = 0
        self.last_request_time = 0

    def _rate_limit(self):
        """Implement rate limiting between requests"""
        elapsed = time.time() - self.last_request_time
        if elapsed < REQUEST_DELAY:
            time.sleep(REQUEST_DELAY - elapsed)

    def _request_with_retry(self, url: str, params: dict) -> dict:
        """Make HTTP request with retry logic"""
        import os
        referer = os.getenv('NEXT_PUBLIC_API_URL', 'http://localhost:3000')
        headers = {'Referer': referer}

        for attempt in range(MAX_RETRIES):
            try:
                self._rate_limit()
                self.last_request_time = time.time()
                response = requests.get(url, params=params, headers=headers, timeout=REQUEST_TIMEOUT)
                response.raise_for_status()
                self.request_count += 1
                return response.json()
            except requests.exceptions.RequestException as e:
                if attempt < MAX_RETRIES - 1:
                    wait_time = RETRY_DELAY * (2 ** attempt)
                    logger.warning(f'Request failed (attempt {attempt + 1}/{MAX_RETRIES}), retrying in {wait_time}s: {e}')
                    time.sleep(wait_time)
                else:
                    logger.error(f'Request failed after {MAX_RETRIES} attempts: {e}')
                    raise

    def nearby_search(
        self,
        place_type: str,
        latitude: float,
        longitude: float,
        radius: int = 200,
    ) -> list:
        """Search for places nearby a location using Google Places type"""
        url = f'{self.BASE_URL}/nearbysearch/json'
        all_results = []
        next_page_token = None

        while True:
            params = {
                'type': place_type,
                'location': f'{latitude},{longitude}',
                'radius': radius,
                'key': self.api_key,
            }

            if next_page_token:
                params['pagetoken'] = next_page_token

            try:
                response = self._request_with_retry(url, params)

                if response.get('status') == 'OK':
                    results = response.get('results', [])
                    all_results.extend(results)
                    logger.debug(f'Found {len(results)} results for place_type "{place_type}"')

                    next_page_token = response.get('next_page_token')
                    if not next_page_token:
                        break

                    time.sleep(2)  # Google requires delay before using next_page_token
                elif response.get('status') in ['ZERO_RESULTS', 'NOT_FOUND']:
                    logger.debug(f'No results for place_type "{place_type}"')
                    break
                else:
                    error_message = response.get('error_message', response.get('status'))
                    logger.error(f'API error: {error_message}')
                    raise Exception(f'Google Places API error: {error_message}')
            except Exception as e:
                logger.error(f'Error during nearby search for place_type "{place_type}": {e}')
                raise

        return all_results

    def get_place_details(self, place_id: str, fields: list = None) -> dict:
        """Get detailed information about a place"""
        if not fields:
            fields = ['formatted_address', 'rating', 'review', 'geometry']

        url = f'{self.BASE_URL}/details/json'
        params = {
            'place_id': place_id,
            'fields': ','.join(fields),
            'key': self.api_key,
        }

        try:
            response = self._request_with_retry(url, params)
            if response.get('status') == 'OK':
                return response.get('result', {})
            else:
                error_message = response.get('error_message', response.get('status'))
                logger.error(f'API error getting place details: {error_message}')
                raise Exception(f'Google Places API error: {error_message}')
        except Exception as e:
            logger.error(f'Error getting place details for {place_id}: {e}')
            raise

    def parse_place_data(self, place: dict, keyword: str) -> dict:
        """Parse raw place data — Basic Data only (name, coords, type, icon, address)"""
        return {
            'place_id': place.get('place_id'),
            'place_name': place.get('name', ''),
            'primary_category': place.get('types', [None])[0],
            'icon_url': place.get('icon'),
            'address': place.get('vicinity'),
            'latitude': place.get('geometry', {}).get('location', {}).get('lat'),
            'longitude': place.get('geometry', {}).get('location', {}).get('lng'),
            'raw_payload_json': json.dumps(place, ensure_ascii=False),
            'keyword_text': keyword,
        }


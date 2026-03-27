from services.database import Database
from services.google_places import GooglePlacesClient
from utils.logger import logger


class POIProcessor:
    def __init__(self):
        self.db = Database()
        self.google_client = GooglePlacesClient()

    def process_job(self, job_id: str):
        """Main job processing orchestrator"""
        logger.info(f'Starting job processing for job_id: {job_id}')

        self.db.connect()

        try:
            job = self.db.get_job(job_id)
            if not job:
                logger.error(f'Job not found: {job_id}')
                raise Exception(f'Job not found: {job_id}')

            logger.info(f'Job {job_id}: {job["job_name"]}')

            # Reset any grids left in failed/processing state from a previous run
            self.db.reset_failed_job_grids(job_id)

            self.db.update_job_status(job_id, 'processing')
            self.db.update_job_progress(job_id, done_grids=0, failed_grids=0, total_results=0, total_requests=0)

            keywords = self.db.get_keywords_for_set(job['keyword_set_id'])
            logger.info(f'Processing {len(keywords)} keywords')

            pending_grids = self.db.get_pending_job_grids(job_id)
            logger.info(f'Found {len(pending_grids)} pending grids')

            done_count = 0
            failed_count = 0
            total_results = 0
            total_requests = 0

            for grid in pending_grids:
                try:
                    logger.info(f'Processing grid {grid["grid_code"]} ({grid["grid_id"]})')
                    self.db.update_job_grid_status(grid['job_grid_id'], 'processing')

                    grid_results, grid_requests = self._process_grid(
                        job_id=job_id,
                        grid=grid,
                        keywords=keywords,
                    )

                    self.db.update_job_grid_status(grid['job_grid_id'], 'completed')
                    self.db.update_job_grid_results(grid['job_grid_id'], grid_results, grid_requests)
                    self.db.update_grid_status(str(grid['grid_id']), 'completed')

                    done_count += 1
                    total_results += grid_results
                    total_requests += grid_requests

                    logger.info(
                        f'Grid {grid["grid_code"]} completed: {grid_results} results, {grid_requests} requests',
                    )
                except Exception as e:
                    logger.error(f'Error processing grid {grid["grid_code"]}: {e}')
                    failed_count += 1
                    self.db.update_job_grid_status(
                        grid['job_grid_id'],
                        'failed',
                        error_message=str(e)[:255],
                    )
                    self.db.update_grid_status(str(grid['grid_id']), 'failed')

                self.db.update_job_progress(
                    job_id,
                    done_grids=done_count,
                    failed_grids=failed_count,
                    total_results=total_results,
                    total_requests=total_requests,
                )

            final_status = 'completed' if failed_count == 0 else 'failed'
            self.db.update_job_status(job_id, final_status)

            logger.info(
                f'Job {job_id} completed: {done_count} grids done, {failed_count} grids failed, {total_results} total results',
            )
        except Exception as e:
            logger.error(f'Fatal error processing job {job_id}: {e}')
            self.db.update_job_status(job_id, 'failed')
            raise
        finally:
            self.db.disconnect()

    def _process_grid(
        self,
        job_id: str,
        grid: dict,
        keywords: list,
    ) -> tuple:
        """Process a single grid for all keywords"""
        total_results = 0
        total_requests = 0

        for keyword in keywords:
            try:
                logger.debug(f'Searching for type: {keyword}')
                places = self.google_client.nearby_search(
                    place_type=keyword,
                    latitude=grid['center_lat'],
                    longitude=grid['center_lng'],
                )

                total_requests += len(places)  # Count as requests used

                for place in places:
                    parsed_place = self.google_client.parse_place_data(place, keyword)

                    poi_data = {
                        'job_id': job_id,
                        'grid_id': str(grid['grid_id']),
                        'keyword_text': keyword,
                        **parsed_place,
                    }

                    self.db.insert_poi_raw(poi_data)
                    self.db.upsert_poi_master(poi_data)
                    self.db.insert_poi_job_map(poi_data)

                    total_results += 1

                logger.debug(f'Keyword {keyword}: {len(places)} places found')
            except Exception as e:
                logger.error(f'Error processing keyword {keyword} in grid {grid["grid_code"]}: {e}')
                raise

        return total_results, total_requests


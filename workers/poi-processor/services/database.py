import mysql.connector
from config import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
from utils.logger import logger


class Database:
    def __init__(self):
        self.connection = None

    def connect(self):
        try:
            self.connection = mysql.connector.connect(
                host=DB_HOST,
                port=DB_PORT,
                user=DB_USER,
                password=DB_PASSWORD,
                database=DB_NAME,
                autocommit=False,
            )
            logger.info('Database connected')
        except Exception as e:
            logger.error(f'Database connection failed: {e}')
            raise

    def disconnect(self):
        if self.connection and self.connection.is_connected():
            self.connection.close()
            logger.info('Database disconnected')

    def _execute(self, sql, params=None, commit=False):
        cursor = self.connection.cursor(dictionary=True)
        try:
            cursor.execute(sql, params or ())
            if commit:
                self.connection.commit()
            return cursor
        except Exception as e:
            self.connection.rollback()
            logger.error(f'Database error: {e}')
            raise
        finally:
            cursor.close()

    def get_job(self, job_id: str):
        cursor = self.connection.cursor(dictionary=True)
        try:
            cursor.execute('SELECT * FROM jobs WHERE job_id = %s', (job_id,))
            return cursor.fetchone()
        finally:
            cursor.close()

    def update_job_status(self, job_id: str, status: str):
        sql = '''UPDATE jobs SET status = %s,
                 started_at = CASE WHEN %s = 'processing' AND started_at IS NULL THEN NOW() ELSE started_at END,
                 finished_at = CASE WHEN %s IN ('completed', 'failed') THEN NOW() ELSE finished_at END,
                 updated_at = NOW()
                 WHERE job_id = %s'''
        self._execute(sql, (status, status, status, job_id), commit=True)

    def update_job_progress(self, job_id: str, done_grids=None, failed_grids=None,
                             total_results=None, total_requests=None):
        updates, params = [], []
        if done_grids is not None:
            updates.append('done_grids = %s'); params.append(done_grids)
        if failed_grids is not None:
            updates.append('failed_grids = %s'); params.append(failed_grids)
        if total_results is not None:
            updates.append('total_results = %s'); params.append(total_results)
        if total_requests is not None:
            updates.append('total_requests = %s'); params.append(total_requests)
        if not updates:
            return
        updates.append('updated_at = NOW()')
        params.append(job_id)
        self._execute(f"UPDATE jobs SET {', '.join(updates)} WHERE job_id = %s", params, commit=True)

    def reset_failed_job_grids(self, job_id: str):
        """Reset failed/processing grids back to pending so they can be retried"""
        self._execute(
            '''UPDATE job_grids SET grid_status = 'pending',
               started_at = NULL, finished_at = NULL,
               error_message = NULL, retry_count = retry_count + 1,
               updated_at = NOW()
               WHERE job_id = %s AND grid_status IN ('failed', 'processing')''',
            (job_id,),
            commit=True,
        )

    def get_pending_job_grids(self, job_id: str):
        cursor = self.connection.cursor(dictionary=True)
        try:
            cursor.execute(
                '''SELECT jg.*, g.grid_code, g.center_lat, g.center_lng,
                   g.min_lat, g.min_lng, g.max_lat, g.max_lng
                   FROM job_grids jg
                   JOIN grids g ON jg.grid_id = g.grid_id
                   WHERE jg.job_id = %s AND jg.grid_status = 'pending'
                   ORDER BY g.row_index, g.col_index''',
                (job_id,),
            )
            return cursor.fetchall()
        finally:
            cursor.close()

    def update_job_grid_status(self, job_grid_id: str, status: str, error_message: str = None):
        if status == 'processing':
            sql = '''UPDATE job_grids SET grid_status = %s,
                     started_at = NOW(), updated_at = NOW()
                     WHERE job_grid_id = %s'''
            self._execute(sql, (status, job_grid_id), commit=True)
        else:
            sql = '''UPDATE job_grids SET grid_status = %s,
                     finished_at = NOW(), error_message = %s, updated_at = NOW()
                     WHERE job_grid_id = %s'''
            self._execute(sql, (status, error_message, job_grid_id), commit=True)

    def update_job_grid_results(self, job_grid_id: str, records_collected: int, requests_used: int):
        self._execute(
            '''UPDATE job_grids SET records_collected = %s, requests_used = %s,
               updated_at = NOW() WHERE job_grid_id = %s''',
            (records_collected, requests_used, job_grid_id),
            commit=True,
        )

    def update_grid_status(self, grid_id: str, status: str):
        """Update the main grids table status so the map reflects harvest state"""
        self._execute(
            '''UPDATE grids SET status = %s,
               last_harvested_at = CASE WHEN %s = 'completed' THEN NOW() ELSE last_harvested_at END,
               updated_at = NOW()
               WHERE grid_id = %s''',
            (status, status, grid_id),
            commit=True,
        )

    def get_keywords_for_set(self, keyword_set_id: str):
        cursor = self.connection.cursor(dictionary=True)
        try:
            cursor.execute(
                'SELECT keyword_text FROM keyword_set_items WHERE keyword_set_id = %s ORDER BY sort_order',
                (keyword_set_id,),
            )
            return [row['keyword_text'] for row in cursor.fetchall()]
        finally:
            cursor.close()

    def insert_poi_raw(self, poi_data: dict):
        self._execute(
            '''INSERT INTO poi_raw (
               job_id, grid_id, keyword_text, place_id, place_name,
               primary_category, address, latitude, longitude,
               raw_payload_json, harvested_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())''',
            (
                poi_data['job_id'],
                poi_data['grid_id'],
                poi_data['keyword_text'],
                poi_data['place_id'],
                poi_data['place_name'],
                poi_data.get('primary_category'),
                poi_data.get('address'),
                poi_data.get('latitude'),
                poi_data.get('longitude'),
                poi_data.get('raw_payload_json'),
            ),
            commit=True,
        )

    def upsert_poi_master(self, poi_data: dict):
        self._execute(
            '''INSERT INTO poi_master (
               place_id, place_name, primary_category, address,
               latitude, longitude, first_seen_at, last_seen_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW(), NOW())
            ON DUPLICATE KEY UPDATE
               last_seen_at = NOW(),
               updated_at = NOW(),
               address = VALUES(address)''',
            (
                poi_data['place_id'],
                poi_data['place_name'],
                poi_data.get('primary_category'),
                poi_data.get('address'),
                poi_data.get('latitude'),
                poi_data.get('longitude'),
            ),
            commit=True,
        )

    def insert_poi_job_map(self, poi_data: dict):
        self._execute(
            '''INSERT IGNORE INTO poi_job_map (
               place_id, job_id, grid_id, keyword_text, harvested_at
            ) VALUES (%s, %s, %s, %s, NOW())''',
            (
                poi_data['place_id'],
                poi_data['job_id'],
                poi_data['grid_id'],
                poi_data['keyword_text'],
            ),
            commit=True,
        )

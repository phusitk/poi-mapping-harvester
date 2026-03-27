import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import path from 'path'
import { randomUUID } from 'crypto'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const KEYWORD_SET_ID = 'b0000000-0000-0000-0000-000000000001'

const TOURISM_TYPES = [
  { type: 'restaurant',        label: 'ร้านอาหาร' },
  { type: 'cafe',              label: 'คาเฟ่' },
  { type: 'bar',               label: 'บาร์/เครื่องดื่ม' },
  { type: 'bakery',            label: 'เบเกอรี่/ขนม' },
  { type: 'meal_takeaway',     label: 'อาหารสั่งกลับ/Street food' },
  { type: 'lodging',           label: 'โรงแรม/ที่พัก' },
  { type: 'tourist_attraction',label: 'สถานที่ท่องเที่ยว' },
  { type: 'museum',            label: 'พิพิธภัณฑ์/ศูนย์เรียนรู้' },
  { type: 'art_gallery',       label: 'หอศิลป์/ศิลปหัตถกรรม' },
  { type: 'park',              label: 'สวนสาธารณะ/พื้นที่กลางแจ้ง' },
  { type: 'place_of_worship',  label: 'วัด/ศาสนสถาน' },
  { type: 'amusement_park',    label: 'สวนสนุก/แหล่งบันเทิง' },
  { type: 'zoo',               label: 'สวนสัตว์/ฟาร์ม' },
  { type: 'shopping_mall',     label: 'ห้าง/ตลาด/ช้อปปิ้ง' },
  { type: 'spa',               label: 'สปา/นวดไทย' },
  { type: 'travel_agency',     label: 'บริษัทท่องเที่ยว' },
]

async function run() {
  let connection = null
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'tonpao_poi',
    })

    await connection.execute(
      `UPDATE keyword_sets SET keyword_set_name = 'Tourism POI Types',
       description = '16 Google Places types สำหรับงานวิจัยท่องเที่ยว'
       WHERE keyword_set_id = ?`,
      [KEYWORD_SET_ID],
    )

    const [del] = await connection.execute(
      'DELETE FROM keyword_set_items WHERE keyword_set_id = ?',
      [KEYWORD_SET_ID],
    )
    console.log(`Removed ${del.affectedRows} old items.`)

    for (let i = 0; i < TOURISM_TYPES.length; i++) {
      const { type, label } = TOURISM_TYPES[i]
      await connection.execute(
        `INSERT INTO keyword_set_items (keyword_item_id, keyword_set_id, keyword_text, sort_order, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [randomUUID(), KEYWORD_SET_ID, type, i],
      )
      console.log(`  [${i + 1}/16] ${type} — ${label}`)
    }

    console.log('\n✅ Updated to 16 tourism types.')
    await connection.end()
  } catch (err) {
    console.error('❌ Failed:', err.message)
    if (connection) await connection.end()
    process.exit(1)
  }
}

run()

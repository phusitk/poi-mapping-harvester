#!/usr/bin/env node
/**
 * อัปเดต keyword_set_items ให้ใช้ Google Places types
 * แทนที่คำค้นหาเดิม เพื่อให้ได้ POI ครบและตรงหมวดหมู่
 */

import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import path from 'path'
import { randomUUID } from 'crypto'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const KEYWORD_SET_ID = 'b0000000-0000-0000-0000-000000000001'

// Google Places API types ครอบคลุมทุกประเภทที่ต้องการ
const PLACE_TYPES = [
  // ร้านอาหาร / คาเฟ่ / เครื่องดื่ม
  { type: 'restaurant',     label: 'ร้านอาหาร' },
  { type: 'cafe',           label: 'คาเฟ่' },
  { type: 'bar',            label: 'บาร์' },
  { type: 'bakery',         label: 'ร้านเบเกอรี่' },
  { type: 'meal_takeaway',  label: 'อาหารสั่งกลับ' },
  { type: 'night_club',     label: 'ไนต์คลับ' },

  // โรงแรม / ที่พัก
  { type: 'lodging',        label: 'โรงแรม/ที่พัก' },

  // ร้านค้า / ช้อปปิ้ง
  { type: 'shopping_mall',      label: 'ห้างสรรพสินค้า' },
  { type: 'supermarket',        label: 'ซูเปอร์มาร์เก็ต' },
  { type: 'convenience_store',  label: 'ร้านสะดวกซื้อ' },
  { type: 'clothing_store',     label: 'ร้านเสื้อผ้า' },
  { type: 'jewelry_store',      label: 'ร้านเครื่องประดับ' },
  { type: 'book_store',         label: 'ร้านหนังสือ' },
  { type: 'electronics_store',  label: 'ร้านอุปกรณ์อิเล็กทรอนิกส์' },
  { type: 'home_goods_store',   label: 'ร้านของใช้ในบ้าน' },
  { type: 'shoe_store',         label: 'ร้านรองเท้า' },
  { type: 'florist',            label: 'ร้านดอกไม้' },
  { type: 'hardware_store',     label: 'ร้านอุปกรณ์ก่อสร้าง' },

  // สถานที่ท่องเที่ยว / นันทนาการ
  { type: 'tourist_attraction', label: 'สถานที่ท่องเที่ยว' },
  { type: 'amusement_park',     label: 'สวนสนุก' },
  { type: 'aquarium',           label: 'พิพิธภัณฑ์สัตว์น้ำ' },
  { type: 'park',               label: 'สวนสาธารณะ' },
  { type: 'zoo',                label: 'สวนสัตว์' },
  { type: 'stadium',            label: 'สนามกีฬา' },

  // แหล่งเรียนรู้ / ศิลปวัฒนธรรม
  { type: 'museum',             label: 'พิพิธภัณฑ์/ศูนย์เรียนรู้' },
  { type: 'art_gallery',        label: 'หอศิลป์/ศิลปหัตถกรรม' },
  { type: 'library',            label: 'ห้องสมุด' },
  { type: 'university',         label: 'มหาวิทยาลัย' },
  { type: 'place_of_worship',   label: 'วัด/ศาสนสถาน' },

  // สุขภาพ / ความงาม
  { type: 'spa',                label: 'สปา/นวด' },
  { type: 'gym',                label: 'ฟิตเนส' },
  { type: 'beauty_salon',       label: 'ร้านเสริมสวย' },
  { type: 'hospital',           label: 'โรงพยาบาล' },
  { type: 'pharmacy',           label: 'ร้านขายยา' },

  // บริการ
  { type: 'bank',               label: 'ธนาคาร' },
  { type: 'gas_station',        label: 'ปั๊มน้ำมัน' },
  { type: 'travel_agency',      label: 'บริษัทท่องเที่ยว' },
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
    console.log('Connected to database.')

    // Update keyword set name
    await connection.execute(
      `UPDATE keyword_sets SET keyword_set_name = 'Comprehensive POI Types',
       description = 'Google Places types ครอบคลุมทุกประเภท POI'
       WHERE keyword_set_id = ?`,
      [KEYWORD_SET_ID],
    )

    // Remove old items
    const [del] = await connection.execute(
      'DELETE FROM keyword_set_items WHERE keyword_set_id = ?',
      [KEYWORD_SET_ID],
    )
    console.log(`Removed ${del.affectedRows} old keyword items.`)

    // Insert new types
    for (let i = 0; i < PLACE_TYPES.length; i++) {
      const { type, label } = PLACE_TYPES[i]
      await connection.execute(
        `INSERT INTO keyword_set_items (keyword_item_id, keyword_set_id, keyword_text, sort_order, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [randomUUID(), KEYWORD_SET_ID, type, i],
      )
      console.log(`  [${i + 1}/${PLACE_TYPES.length}] ${type} — ${label}`)
    }

    console.log(`\n✅ Updated keyword set with ${PLACE_TYPES.length} Google Places types.`)
    await connection.end()
  } catch (err) {
    console.error('❌ Failed:', err.message)
    if (connection) await connection.end()
    process.exit(1)
  }
}

run()

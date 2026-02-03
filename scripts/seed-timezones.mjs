/**
 * Seed script for timezones
 * Populates the timezones table with standard timezone identifiers
 */

import { drizzle } from "drizzle-orm/mysql2";
import { timezones } from "../drizzle/schema.js";

const db = drizzle(process.env.DATABASE_URL);

const timezoneList = [
  "UTC",
  "Africa/Abidjan",
  "Africa/Accra",
  "Africa/Algiers",
  "Africa/Cairo",
  "Africa/Casablanca",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Tunis",
  "America/Anchorage",
  "America/Argentina/Buenos_Aires",
  "America/Bogota",
  "America/Caracas",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Santiago",
  "America/Sao_Paulo",
  "America/Toronto",
  "Asia/Baghdad",
  "Asia/Bangkok",
  "Asia/Beirut",
  "Asia/Dhaka",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Jakarta",
  "Asia/Jerusalem",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Kuala_Lumpur",
  "Asia/Manila",
  "Asia/Riyadh",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tehran",
  "Asia/Tokyo",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",
  "Europe/Amsterdam",
  "Europe/Athens",
  "Europe/Belgrade",
  "Europe/Berlin",
  "Europe/Brussels",
  "Europe/Bucharest",
  "Europe/Budapest",
  "Europe/Copenhagen",
  "Europe/Dublin",
  "Europe/Helsinki",
  "Europe/Istanbul",
  "Europe/Kiev",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Moscow",
  "Europe/Oslo",
  "Europe/Paris",
  "Europe/Prague",
  "Europe/Rome",
  "Europe/Stockholm",
  "Europe/Vienna",
  "Europe/Warsaw",
  "Europe/Zurich",
  "Pacific/Auckland",
];

async function seedTimezones() {
  console.log("Seeding timezones...");

  try {
    // Clear existing timezones
    await db.delete(timezones);

    // Insert all timezones
    const values = timezoneList.map((tz) => ({
      timezone: tz,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await db.insert(timezones).values(values);

    console.log(`✓ Seeded ${timezoneList.length} timezones`);
  } catch (error) {
    console.error("Error seeding timezones:", error);
    process.exit(1);
  }

  process.exit(0);
}

seedTimezones();

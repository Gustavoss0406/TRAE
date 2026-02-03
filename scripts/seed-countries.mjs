/**
 * Seed script for countries
 * Populates the countries table with major football nations
 */

import { drizzle } from "drizzle-orm/mysql2";
import { countries } from "../drizzle/schema.js";

const db = drizzle(process.env.DATABASE_URL);

const countriesList = [
  { name: "England", code: "GB", flag: "https://media.api-sports.io/flags/gb.svg" },
  { name: "Spain", code: "ES", flag: "https://media.api-sports.io/flags/es.svg" },
  { name: "Italy", code: "IT", flag: "https://media.api-sports.io/flags/it.svg" },
  { name: "Germany", code: "DE", flag: "https://media.api-sports.io/flags/de.svg" },
  { name: "France", code: "FR", flag: "https://media.api-sports.io/flags/fr.svg" },
  { name: "Portugal", code: "PT", flag: "https://media.api-sports.io/flags/pt.svg" },
  { name: "Netherlands", code: "NL", flag: "https://media.api-sports.io/flags/nl.svg" },
  { name: "Belgium", code: "BE", flag: "https://media.api-sports.io/flags/be.svg" },
  { name: "Brazil", code: "BR", flag: "https://media.api-sports.io/flags/br.svg" },
  { name: "Argentina", code: "AR", flag: "https://media.api-sports.io/flags/ar.svg" },
  { name: "Uruguay", code: "UY", flag: "https://media.api-sports.io/flags/uy.svg" },
  { name: "Colombia", code: "CO", flag: "https://media.api-sports.io/flags/co.svg" },
  { name: "Mexico", code: "MX", flag: "https://media.api-sports.io/flags/mx.svg" },
  { name: "USA", code: "US", flag: "https://media.api-sports.io/flags/us.svg" },
  { name: "Turkey", code: "TR", flag: "https://media.api-sports.io/flags/tr.svg" },
  { name: "Russia", code: "RU", flag: "https://media.api-sports.io/flags/ru.svg" },
  { name: "Poland", code: "PL", flag: "https://media.api-sports.io/flags/pl.svg" },
  { name: "Ukraine", code: "UA", flag: "https://media.api-sports.io/flags/ua.svg" },
  { name: "Greece", code: "GR", flag: "https://media.api-sports.io/flags/gr.svg" },
  { name: "Croatia", code: "HR", flag: "https://media.api-sports.io/flags/hr.svg" },
  { name: "Serbia", code: "RS", flag: "https://media.api-sports.io/flags/rs.svg" },
  { name: "Switzerland", code: "CH", flag: "https://media.api-sports.io/flags/ch.svg" },
  { name: "Austria", code: "AT", flag: "https://media.api-sports.io/flags/at.svg" },
  { name: "Denmark", code: "DK", flag: "https://media.api-sports.io/flags/dk.svg" },
  { name: "Sweden", code: "SE", flag: "https://media.api-sports.io/flags/se.svg" },
  { name: "Norway", code: "NO", flag: "https://media.api-sports.io/flags/no.svg" },
  { name: "Scotland", code: "SCT", flag: "https://media.api-sports.io/flags/gb.svg" },
  { name: "Wales", code: "WLS", flag: "https://media.api-sports.io/flags/gb.svg" },
  { name: "Ireland", code: "IE", flag: "https://media.api-sports.io/flags/ie.svg" },
  { name: "Czech-Republic", code: "CZ", flag: "https://media.api-sports.io/flags/cz.svg" },
  { name: "Romania", code: "RO", flag: "https://media.api-sports.io/flags/ro.svg" },
  { name: "Japan", code: "JP", flag: "https://media.api-sports.io/flags/jp.svg" },
  { name: "South-Korea", code: "KR", flag: "https://media.api-sports.io/flags/kr.svg" },
  { name: "Australia", code: "AU", flag: "https://media.api-sports.io/flags/au.svg" },
  { name: "Saudi-Arabia", code: "SA", flag: "https://media.api-sports.io/flags/sa.svg" },
  { name: "Egypt", code: "EG", flag: "https://media.api-sports.io/flags/eg.svg" },
  { name: "Morocco", code: "MA", flag: "https://media.api-sports.io/flags/ma.svg" },
  { name: "Algeria", code: "DZ", flag: "https://media.api-sports.io/flags/dz.svg" },
  { name: "Tunisia", code: "TN", flag: "https://media.api-sports.io/flags/tn.svg" },
  { name: "South-Africa", code: "ZA", flag: "https://media.api-sports.io/flags/za.svg" },
  { name: "Nigeria", code: "NG", flag: "https://media.api-sports.io/flags/ng.svg" },
  { name: "Ghana", code: "GH", flag: "https://media.api-sports.io/flags/gh.svg" },
  { name: "Senegal", code: "SN", flag: "https://media.api-sports.io/flags/sn.svg" },
  { name: "Cameroon", code: "CM", flag: "https://media.api-sports.io/flags/cm.svg" },
  { name: "Ivory-Coast", code: "CI", flag: "https://media.api-sports.io/flags/ci.svg" },
  { name: "Chile", code: "CL", flag: "https://media.api-sports.io/flags/cl.svg" },
  { name: "Peru", code: "PE", flag: "https://media.api-sports.io/flags/pe.svg" },
  { name: "Ecuador", code: "EC", flag: "https://media.api-sports.io/flags/ec.svg" },
  { name: "Paraguay", code: "PY", flag: "https://media.api-sports.io/flags/py.svg" },
  { name: "Venezuela", code: "VE", flag: "https://media.api-sports.io/flags/ve.svg" },
  { name: "World", code: "WW", flag: null },
];

async function seedCountries() {
  console.log("Seeding countries...");

  try {
    // Clear existing countries
    await db.delete(countries);

    // Insert all countries
    const values = countriesList.map((country) => ({
      ...country,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await db.insert(countries).values(values);

    console.log(`✓ Seeded ${countriesList.length} countries`);
  } catch (error) {
    console.error("Error seeding countries:", error);
    process.exit(1);
  }

  process.exit(0);
}

seedCountries();

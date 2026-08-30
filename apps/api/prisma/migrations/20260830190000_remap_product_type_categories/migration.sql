-- Remap productType to the official repair-cafe.ch categories.
-- Handles both the English keys written by the app (Assortment, Textile, ...)
-- and the German values written by the legacy SQLite import (Allerlei, Textil, ...).

-- Clean 1:1 remaps
UPDATE "Repair" SET "productType" = 'TextileLeather'
WHERE "productType" IN ('Textile', 'Textil');

UPDATE "Repair" SET "productType" = 'WoodMetalMechanics'
WHERE "productType" IN ('Wood', 'Holz');

UPDATE "Repair" SET "productType" = 'Miscellaneous'
WHERE "productType" IN ('Assortment', 'Sortiment', 'Allerlei', 'Other', 'Anderes', 'Andere');

UPDATE "Repair" SET "productType" = 'HouseholdAppliances'
WHERE "productType" IN ('Electrical', 'Elektro');

-- Electronics splits into three new categories based on the item description.
-- 1) Computers, laptops, printers, monitors
UPDATE "Repair" SET "productType" = 'ComputerLaptop'
WHERE "productType" IN ('Electronics', 'Elektronik')
  AND (
    "itemName" ILIKE '%laptop%' OR
    "itemName" ILIKE '%notebook%' OR
    "itemName" ILIKE '%computer%' OR
    "itemName" ILIKE '%drucker%' OR
    "itemName" ILIKE '%printer%' OR
    "itemName" ILIKE '%monitor%' OR
    "itemName" ILIKE '%bildschirm%' OR
    "itemName" ILIKE '%tastatur%' OR
    "itemName" ILIKE '%scanner%'
  );

-- 2) Household appliances that were historically misfiled under Elektronik
UPDATE "Repair" SET "productType" = 'HouseholdAppliances'
WHERE "productType" IN ('Electronics', 'Elektronik')
  AND (
    "itemName" ILIKE '%staubsauger%' OR
    "itemName" ILIKE '%sauger%' OR
    "itemName" ILIKE '%wasserkocher%' OR
    "itemName" ILIKE '%kocher%' OR
    "itemName" ILIKE '%bügeleisen%' OR
    "itemName" ILIKE '%nähmaschine%' OR
    "itemName" ILIKE '%kaffee%' OR
    "itemName" ILIKE '%ventilator%' OR
    "itemName" ILIKE '%toaster%' OR
    "itemName" ILIKE '%mixer%' OR
    "itemName" ILIKE '%föhn%' OR
    "itemName" ILIKE '%zahnbürste%' OR
    "itemName" ILIKE '%lampe%' OR
    "itemName" ILIKE '%leuchte%' OR
    "itemName" ILIKE '%licht%' OR
    "itemName" ILIKE '%warmhalte%' OR
    "itemName" ILIKE '%wamhalte%' OR
    "itemName" ILIKE '%waffeleisen%' OR
    "itemName" ILIKE '%bartschneider%'
  );

-- 3) Everything else in Elektronik: phones, tablets, entertainment electronics
UPDATE "Repair" SET "productType" = 'PhoneTabletEntertainment'
WHERE "productType" IN ('Electronics', 'Elektronik');

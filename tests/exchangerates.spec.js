const { test } = require('@playwright/test');
const sql = require('mssql');
// const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

test.setTimeout(120000);

test('Extract Exchange Rates and Send to Bitrix24 and Oracle DB', async ({ page }) => {
  // Step 1: Extract exchange rate data
  await page.goto('https://www.centralbank.ae/en/forex-eibor/exchange-rates/', {
    waitUntil: 'domcontentloaded',
    timeout: 3000,
  });

  const agreeButton = page.locator('button:has-text("Agree and continue")');
  if (await agreeButton.isVisible()) {
    await agreeButton.click();
    await page.waitForLoadState('networkidle');
  }

  await page.waitForSelector('table tbody tr', { timeout: 20000 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(3000);

  const tableRows = await page.locator('table tbody tr');
  const rowCount = await tableRows.count();

  let exchangeRates = [];

  for (let i = 0; i < rowCount; i++) {
    const cells = await tableRows.nth(i).locator('td').allTextContents();
    if (cells.length >= 3) {
      const currency = cells[1].trim();
      const rate = parseFloat(cells[2].trim());
      if (!isNaN(rate)) {
        exchangeRates.push({ currency, rate });
      }
    }
  }

//   Step 2: Send to Bitrix24 CRM
  // const bitrixUrl = "https://b24-f5486q.bitrix24.in/rest/1/b154c9lmuevxrec3/crm.deal.add.json";

  // for (const { currency, rate } of exchangeRates) {
  //   const formData = new URLSearchParams();
  //   formData.append("FIELDS[TITLE]", `${currency}: ${rate}`);
  //   formData.append("FIELDS[STAGE_ID]", "NEW");

  //   try {
  //     const response = await fetch(bitrixUrl, {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  //       body: formData.toString(),
  //     });

  //     const result = await response.json();
  //     console.log(`Bitrix24 response for ${currency}:`, result);
  //   } catch (err) {
  //     console.error(`Error sending ${currency} to Bitrix24:`, err);
  //   }
  // }

  
  // Step 3: Insert into MS SQL Server (Azure)
console.log('Inserting exchange rates into SQL Server...');

const config = {
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      server: process.env.SQL_SERVER,
      port: Number(process.env.SQL_PORT),
      database: process.env.SQL_DATABASE,
      options: {
        encrypt: true,
        trustServerCertificate: false,
  },
  
};

 let db;
  try {
    db = await sql.connect(config);
    console.log('Connected to SQL Server');
    for (const { currency, rate } of exchangeRates) {
      await db.request()
        .input('currency', sql.VarChar, currency)
        .input('amount', sql.Float, rate)
        .query('INSERT INTO ForTesting (Currency, Amount) VALUES (@currency, @amount)');
      console.log(`Inserted: ${currency} = ${rate}`);
    }
  } catch (err) {
    console.error('SQL Error:', err);
  } finally {
    if (db) await db.close();
  }
});
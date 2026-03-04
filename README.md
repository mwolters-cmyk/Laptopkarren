# Laptopkarren Dashboard

Dashboard voor het analyseren van laptopkar-reserveringen op het Stedelijk Gymnasium Leiden.

## Gebruik

1. Open `index.html` in een browser (of via GitHub Pages)
2. Sleep het Excel-bestand met reserveringen in de upload-zone
3. Het dashboard toont automatisch alle analyses

## Wat wordt getoond

- **KPI's**: totaal reserveringen, unieke docenten, actieve karren, annuleringspercentage
- **Trends**: reserveringen per week en per maand (Athena vs Socrates)
- **Populaire dagen & tijden**: weekdag-verdeling en heatmap dag/uur
- **Top 10 docenten** per locatie
- **Capaciteitsanalyse**: bezettingsgraad per locatie, piektijden, trendlijn
- **Per kar overzicht**: selecteer een kar voor gedetailleerde statistieken

## Verwacht Excel-formaat

Excel-bestand (.xlsx) met twee tabbladen:
- **Athena** - reserveringen locatie Athena
- **Socrates** (of "Sorates") - reserveringen locatie Socrates

Kolommen: Onderwerp, Locatie, Verplichte deelnemers, Begin, Einde, Gewijzigd, Gemaakt

## GitHub Pages

1. Maak een nieuwe repository op GitHub
2. Upload de bestanden (`index.html`, `style.css`, `dashboard.js`)
3. Ga naar **Settings > Pages**
4. Kies **Source: Deploy from a branch**, selecteer `main` en `/root`
5. Na een minuut is het dashboard beschikbaar op `https://<gebruikersnaam>.github.io/<repo-naam>/`

## Technisch

- Puur client-side: geen server nodig, alle data wordt in de browser verwerkt
- Geen data wordt verstuurd of opgeslagen
- Bibliotheken: [Chart.js](https://www.chartjs.org/) en [SheetJS](https://sheetjs.com/) (via CDN)

# Stock-trading

Ett enkelt analysverktyg som använder sample-data för att ge förslag på vilka aktier som ser mest attraktiva ut just nu. Verktyget använder tekniska indikatorer (glidande medelvärden, RSI, momentum och volatilitet) för att skapa en sammanfattning av varje aktie och ger konkreta tips om stöd- och motståndsnivåer.

## Innehåll

- Sample-data för tre välkända aktier (`data/`)
- Python-moduler för att ladda data, beräkna indikatorer och generera rekommendationer (`src/stock_trading/`)
- Ett CLI-gränssnitt för att snabbt få en analys i terminalen

## Kom igång

1. Se till att du har Python 3.10+ installerat.
2. Kör kommandona nedan från projektets rotkatalog.

```bash
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
```

Inga externa paket krävs – allt bygger på Python-standardbiblioteket.

## Användning

Kör CLI:t genom att lägga till `src/` i `PYTHONPATH` och använda modulen `stock_trading.cli`:

```bash
PYTHONPATH=src python -m stock_trading.cli
```

Kommandot analyserar samtliga tillgängliga tickers och skriver ut:

- Rekommendation (t.ex. *Köp*, *Behåll*, *Sälj*)
- Centrala indikatorvärden
- En punktlista med motivering och tips
- Den aktie som har den starkaste signalen för tillfället

### Analysera specifika tickers

```bash
PYTHONPATH=src python -m stock_trading.cli --ticker AAPL --ticker MSFT
```

### Lista tillgängliga tickers

```bash
PYTHONPATH=src python -m stock_trading.cli --list
```

## Vidare utveckling

- Byt ut sample-datan mot riktiga marknadsdata genom att lägga CSV-filer i `data/` med samma format.
- Lägg till fler indikatorer eller en mer avancerad poängmodell i `stock_trading/recommender.py`.
- Bygg ett webbgränssnitt ovanpå modulerna om du vill presentera analyserna grafiskt.

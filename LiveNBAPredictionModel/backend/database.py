import pandas as pd
from sqlalchemy import create_engine

class DBConnector:
    def __init__(self, url):
        self.engine = create_engine(url)

    def save_dataframe(self, df, table_name):
        """Pushes a pandas DataFrame (from nba_api) to SQL."""
        try:
            df.to_sql(table_name, self.engine, if_exists='append', index=False)
            print(f"Successfully saved {len(df)} rows to {table_name}.")
        except Exception as e:
            print(f"Error saving to database: {e}")
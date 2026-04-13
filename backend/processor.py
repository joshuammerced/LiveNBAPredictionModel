import pandas as pd
import numpy as np

class NBADataProcessor:
    def __init__(self, df):
        # We ensure the date is converted immediately for sorting
        if 'GAME_DATE' in df.columns:
            df['GAME_DATE'] = pd.to_datetime(df['GAME_DATE'])
        self.df = df

    def add_rest_features(self):
        """
        Calculates days since last game and categorizes rest.
        Essential for predicting fatigue-based performance drops.
        """
        # 1. Sort by Team and Date to ensure chronological diff()
        self.df = self.df.sort_values(by=['TEAM_ID', 'GAME_DATE'])

        # 2. Calculate raw day difference
        self.df['days_since_last_game'] = self.df.groupby('TEAM_ID')['GAME_DATE'].diff().dt.days

        # 3. Categorize (0 = Back-to-Back, 1 = 1 Day, 2 = 2+ Days)
        def classify_rest(days):
            if pd.isna(days) or days > 7: return 2  # Season opener/long break
            if days == 1: return 0  # Back-to-back
            if days == 2: return 1  # 1 day off
            return 2 # 2+ days off

        self.df['rest_type'] = self.df['days_since_last_game'].apply(classify_rest)
        return self

    def clean_game_logs(self):
        """
        Handles Step 1.4: Missing values, types, and baseline features.
        """
        # Drop games with no score (unplayed/postponed)
        self.df = self.df.dropna(subset=['PTS'])

        # Correct Data Types
        self.df['PTS'] = self.df['PTS'].astype(int)

        # Basic Feature Engineering
        # 'vs.' = Home (1), '@' = Away (0)
        if 'MATCHUP' in self.df.columns:
            self.df['is_home'] = self.df['MATCHUP'].apply(lambda x: 1 if 'vs.' in x else 0)

        # Win/Loss to Binary
        if 'WL' in self.df.columns:
            self.df['win'] = self.df['WL'].map({'W': 1, 'L': 0})

        # Chain the rest day calculation automatically
        self.add_rest_features()

        return self.df

# --- How to use this in your workflow ---
# raw_data = pd.DataFrame(...) # Data from nba_api
# processor = NBADataProcessor(raw_data)
# final_df = processor.clean_game_logs()
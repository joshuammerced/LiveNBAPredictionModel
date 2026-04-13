def add_features(df):
    df['WIN'] = df['WL'].apply(lambda x: 1 if x == 'W' else 0)
    df['POINT_DIFF'] = df['PTS'] - df['PLUS_MINUS']
    return df